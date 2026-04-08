import { supabase } from '@/integrations/supabase/client';

/**
 * Shared document text extraction utility.
 * Supports: PDF (via pdfjs-dist with AI OCR fallback for scanned PDFs),
 *           Excel/CSV (via xlsx), and plain text files.
 */

const OCR_RENDER_SCALE = 1.0;
const OCR_RENDER_QUALITY = 0.5;
const OCR_BATCH_SIZE = 4;
const OCR_CONCURRENCY = 2;
const SAMPLE_PAGES_BEFORE_OCR = 5;

export type PdfProgressCallback = (info: { stage: string; current: number; total: number }) => void;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loadPdfjs = async () => {
  const [pdfjsLib, workerSrc] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default;
  return pdfjsLib;
};

const loadPdfDocument = async (file: File) => {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
};

const extractPdfPageText = async (page: any): Promise<string> => {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item: any) => item.str)
    .join(' ');
};

const isLowQualityText = (text: string, totalPages: number): boolean => {
  if (!text.trim()) return true;
  const cleaned = text.replace(/---\s*Page\s*\d+\s*---/g, '').trim();
  if (cleaned.length < 50 * totalPages) return true;

  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  if (lines.length === 0) return true;

  const uniqueLines = new Set(lines);
  if (uniqueLines.size < lines.length * 0.2 && totalPages > 3) return true;

  return false;
};

const renderPdfPageToImage = async (page: any, scale = OCR_RENDER_SCALE): Promise<string | null> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  await page.render({ canvasContext: ctx, viewport }).promise;
  const image = canvas.toDataURL('image/jpeg', OCR_RENDER_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return image;
};

const renderPdfBatchToImages = async (pdf: any, startPage: number, endPage: number): Promise<string[]> => {
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  const rendered = await Promise.all(
    pageNumbers.map(async (pageNumber) => {
      const page = await pdf.getPage(pageNumber);
      try {
        return await renderPdfPageToImage(page);
      } finally {
        page.cleanup?.();
      }
    })
  );

  return rendered.filter((image): image is string => Boolean(image));
};

const ocrPdfBatch = async (
  images: string[],
  filename: string,
  pageOffset: number,
  totalPages: number,
  attempt = 1
): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke<{ text?: string; error?: string }>('ocr-pdf', {
      body: { images, filename, pageOffset, totalPages },
    });

    if (error) throw error;
    if (data?.text?.trim()) return data.text;
    throw new Error(data?.error || 'OCR returned no text');
  } catch (e) {
    if (attempt < 3) {
      await delay(800 * attempt);
      return ocrPdfBatch(images, filename, pageOffset, totalPages, attempt + 1);
    }

    console.error('[OCR] Batch failed:', e);
    const pageStart = pageOffset + 1;
    const pageEnd = pageOffset + images.length;
    return `[Pages ${pageStart}-${pageEnd}: OCR failed - ${e instanceof Error ? e.message : 'request failed'}]`;
  }
};

const ocrPdfViaAI = async (pdf: any, filename: string, onProgress?: PdfProgressCallback): Promise<string> => {
  const totalPages = pdf.numPages;
  const batchRanges = Array.from(
    { length: Math.ceil(totalPages / OCR_BATCH_SIZE) },
    (_, index) => {
      const startPage = index * OCR_BATCH_SIZE + 1;
      return {
        startPage,
        endPage: Math.min(startPage + OCR_BATCH_SIZE - 1, totalPages),
      };
    }
  );

  const results = new Array<string>(batchRanges.length).fill('');
  let nextBatchIndex = 0;
  let completedPages = 0;

  const worker = async () => {
    while (true) {
      const batchIndex = nextBatchIndex++;
      if (batchIndex >= batchRanges.length) return;

      const batch = batchRanges[batchIndex];
      
      onProgress?.({
        stage: `Scanning pages ${batch.startPage}–${batch.endPage} of ${totalPages}`,
        current: completedPages,
        total: totalPages,
      });

      const images = await renderPdfBatchToImages(pdf, batch.startPage, batch.endPage);

      if (!images.length) {
        results[batchIndex] = `[Pages ${batch.startPage}-${batch.endPage}: OCR failed - rendering failed]`;
        completedPages += (batch.endPage - batch.startPage + 1);
        continue;
      }

      results[batchIndex] = await ocrPdfBatch(
        images,
        filename,
        batch.startPage - 1,
        totalPages
      );
      
      completedPages += (batch.endPage - batch.startPage + 1);
      onProgress?.({
        stage: `Scanned pages ${batch.startPage}–${batch.endPage} of ${totalPages}`,
        current: completedPages,
        total: totalPages,
      });
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(OCR_CONCURRENCY, batchRanges.length)) },
      () => worker()
    )
  );

  return results.filter(Boolean).join('\n').trim();
};

const extractPdfText = async (file: File, onProgress?: PdfProgressCallback): Promise<string> => {
  let pdf: any = null;

  try {
    onProgress?.({ stage: 'Loading PDF...', current: 0, total: 1 });
    pdf = await loadPdfDocument(file);
    const totalPages = pdf.numPages;
    
    onProgress?.({ stage: `Analyzing ${totalPages} pages...`, current: 0, total: totalPages });
    
    const sampledPageCount = Math.min(totalPages, SAMPLE_PAGES_BEFORE_OCR);
    const sampledPageTexts: string[] = [];

    for (let i = 1; i <= sampledPageCount; i++) {
      const page = await pdf.getPage(i);
      try {
        sampledPageTexts.push(await extractPdfPageText(page));
      } finally {
        page.cleanup?.();
      }
    }

    let fullText = sampledPageTexts
      .map((pageText, index) => `\n--- Page ${index + 1} ---\n${pageText}`)
      .join('');

    if (isLowQualityText(fullText, sampledPageCount)) {
      console.log(`[PDF] Low quality text in "${file.name}", using AI vision OCR...`);
      onProgress?.({ stage: 'Scanned PDF detected — using AI OCR...', current: 0, total: totalPages });
      return await ocrPdfViaAI(pdf, file.name, onProgress);
    }

    for (let i = sampledPageCount + 1; i <= totalPages; i++) {
      onProgress?.({ stage: `Reading page ${i} of ${totalPages}`, current: i, total: totalPages });
      const page = await pdf.getPage(i);
      try {
        const pageText = await extractPdfPageText(page);
        fullText += `\n--- Page ${i} ---\n${pageText}`;
      } finally {
        page.cleanup?.();
      }
    }

    if (!isLowQualityText(fullText, totalPages)) {
      return fullText.trim();
    }

    console.log(`[PDF] Native extraction degraded in "${file.name}", switching to AI vision OCR...`);
    onProgress?.({ stage: 'Switching to AI OCR for better results...', current: 0, total: totalPages });
    return await ocrPdfViaAI(pdf, file.name, onProgress);
  } catch (e) {
    console.error('PDF extraction error:', e);
    return `[PDF: ${file.name} - could not extract text. Error: ${e instanceof Error ? e.message : 'unknown'}]`;
  } finally {
    try {
      await pdf?.destroy?.();
    } catch {
      // Ignore PDF cleanup issues.
    }
  }
};

const extractExcelText = async (file: File): Promise<string> => {
  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let result = '';
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      result += `\n--- Sheet: ${sheetName} ---\n${csv}`;
    }
    return result.trim() || `[Excel: ${file.name} - no data found]`;
  } catch (e) {
    console.error('Excel parsing error:', e);
    return `[Excel: ${file.name} - could not parse]`;
  }
};

/**
 * Extract text content from a file.
 * For scanned/image-heavy PDFs, automatically uses AI vision OCR to extract real content.
 */
export async function extractDocumentText(
  file: File, 
  includeImageBase64 = false,
  onProgress?: PdfProgressCallback
): Promise<string> {
  if (file.type.startsWith('image/')) {
    if (includeImageBase64) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
    return `[Image: ${file.name} - ${(file.size / 1024).toFixed(1)}KB]`;
  }

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(file, onProgress);
  }

  const excelExts = ['.xlsx', '.xls', '.csv'];
  if (excelExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
    return extractExcelText(file);
  }

  const textExtensions = [
    '.txt', '.md', '.csv', '.json', '.py', '.js', '.ts', '.jsx', '.tsx',
    '.html', '.css', '.xml', '.yaml', '.yml', '.doc', '.docx', '.rtf',
    '.log', '.tex', '.java', '.c', '.cpp', '.rb', '.go', '.rs', '.sql',
  ];
  const isText = file.type.startsWith('text/') || textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

  if (isText) {
    return file.text();
  }

  try {
    return await file.text();
  } catch {
    return `[File: ${file.name} - ${(file.size / 1024).toFixed(1)}KB - content could not be extracted]`;
  }
}

/** Accepted file types string for <input accept="..."> */
export const DOCUMENT_ACCEPT = '.txt,.md,.csv,.json,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.py,.js,.ts,.jsx,.tsx,.html,.css,.xml,.yaml,.yml,.xlsx,.xls,.rtf,.log,.tex,.java,.c,.cpp';
