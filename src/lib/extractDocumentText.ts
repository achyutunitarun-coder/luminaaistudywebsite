/**
 * Shared document text extraction utility.
 * Supports: PDF (via pdfjs-dist with AI OCR fallback for scanned PDFs),
 *           Excel/CSV (via xlsx), and plain text files.
 */

const loadPdfjs = async () => {
  const [pdfjsLib, workerSrc] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default;
  return pdfjsLib;
};

/**
 * Check if extracted text is mostly useless (e.g. just copyright notices repeated).
 */
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

/**
 * Render PDF pages to base64 JPEG images using canvas.
 */
const renderPdfPagesToImages = async (
  file: File,
  maxPages = 20,
  scale = 1.5
): Promise<string[]> => {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const totalPages = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.75));
      canvas.width = 0;
      canvas.height = 0;
    } catch (e) {
      console.warn(`Failed to render PDF page ${i}:`, e);
    }
  }
  return images;
};

/**
 * Send rendered PDF page images to the backend OCR function for AI-powered text extraction.
 */
const ocrPdfViaAI = async (images: string[], filename: string): Promise<string> => {
  try {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ images, filename }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'OCR request failed' }));
      console.error('[OCR] Failed:', err);
      return `[PDF: ${filename} - OCR failed: ${err.error || resp.statusText}]`;
    }

    const data = await resp.json();
    return data.text || `[PDF: ${filename} - OCR returned no text]`;
  } catch (e) {
    console.error('[OCR] Error:', e);
    return `[PDF: ${filename} - OCR error: ${e instanceof Error ? e.message : 'unknown'}]`;
  }
};

const extractPdfText = async (file: File): Promise<string> => {
  try {
    const pdfjsLib = await loadPdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    let fullText = '';
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `\n--- Page ${i} ---\n${pageText}`;
    }

    // If text quality is good, return it
    if (!isLowQualityText(fullText, totalPages)) {
      return fullText.trim();
    }

    // Text is low quality — fall back to AI OCR
    console.log(`[PDF] Low quality text in "${file.name}", using AI vision OCR...`);
    const images = await renderPdfPagesToImages(file);
    if (images.length === 0) {
      return fullText.trim() || `[PDF: ${file.name} - ${totalPages} pages - no extractable text found]`;
    }

    return await ocrPdfViaAI(images, file.name);
  } catch (e) {
    console.error('PDF extraction error:', e);
    return `[PDF: ${file.name} - could not extract text. Error: ${e instanceof Error ? e.message : 'unknown'}]`;
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
export async function extractDocumentText(file: File, includeImageBase64 = false): Promise<string> {
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
    return extractPdfText(file);
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
