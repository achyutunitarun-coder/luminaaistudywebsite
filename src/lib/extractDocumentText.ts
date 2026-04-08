/**
 * Shared document text extraction utility.
 * Supports: PDF (via pdfjs-dist with image fallback for scanned PDFs),
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
 * Returns true if text quality is too low to be useful.
 */
const isLowQualityText = (text: string, totalPages: number): boolean => {
  if (!text.trim()) return true;

  // Remove page markers
  const cleaned = text.replace(/---\s*Page\s*\d+\s*---/g, '').trim();
  if (cleaned.length < 50 * totalPages) return true; // Less than ~50 chars per page on average

  // Check if content is mostly repetitive (like copyright on every page)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  if (lines.length === 0) return true;

  const uniqueLines = new Set(lines);
  // If unique content is less than 20% of total lines, it's repetitive junk
  if (uniqueLines.size < lines.length * 0.2 && totalPages > 3) return true;

  return false;
};

/**
 * Render PDF pages to base64 images using canvas.
 * This handles scanned PDFs, image-heavy PDFs, and PDFs with diagrams/equations.
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

      // Convert to JPEG for smaller size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      images.push(dataUrl);

      // Cleanup
      canvas.width = 0;
      canvas.height = 0;
    } catch (e) {
      console.warn(`Failed to render PDF page ${i}:`, e);
    }
  }

  return images;
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

    // Text is low quality — fall back to rendering pages as images
    console.log(`[PDF] Low quality text detected in "${file.name}", falling back to image rendering...`);
    return await extractPdfAsImages(file);
  } catch (e) {
    console.error('PDF extraction error:', e);
    return `[PDF: ${file.name} - could not extract text. Error: ${e instanceof Error ? e.message : 'unknown'}]`;
  }
};

/**
 * Extract PDF as rendered page images (base64).
 * Returns a special format that AI tools can understand.
 */
const extractPdfAsImages = async (file: File): Promise<string> => {
  try {
    const images = await renderPdfPagesToImages(file);
    if (images.length === 0) {
      return `[PDF: ${file.name} - could not render pages as images]`;
    }

    // Return a JSON structure that consumers can parse
    const result = {
      type: 'pdf_images',
      filename: file.name,
      totalPages: images.length,
      pages: images.map((img, i) => ({
        page: i + 1,
        image: img,
      })),
    };

    return `[PDF_IMAGES:${JSON.stringify(result)}]`;
  } catch (e) {
    console.error('PDF image rendering error:', e);
    return `[PDF: ${file.name} - image rendering failed: ${e instanceof Error ? e.message : 'unknown'}]`;
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
 * Works with PDFs, Excel/CSV, images (returns base64), and text-based files.
 * For scanned/image-heavy PDFs, automatically falls back to rendering pages as images.
 * @param file The File object to extract text from
 * @param includeImageBase64 If true, returns base64 for images. If false, returns a placeholder string.
 */
export async function extractDocumentText(file: File, includeImageBase64 = false): Promise<string> {
  // Images
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

  // PDFs
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(file);
  }

  // Excel / CSV
  const excelExts = ['.xlsx', '.xls', '.csv'];
  if (excelExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
    return extractExcelText(file);
  }

  // Text-based files (code, markdown, plain text, etc.)
  const textExtensions = [
    '.txt', '.md', '.csv', '.json', '.py', '.js', '.ts', '.jsx', '.tsx',
    '.html', '.css', '.xml', '.yaml', '.yml', '.doc', '.docx', '.rtf',
    '.log', '.tex', '.java', '.c', '.cpp', '.rb', '.go', '.rs', '.sql',
  ];
  const isText = file.type.startsWith('text/') || textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

  if (isText) {
    return file.text();
  }

  // Best effort
  try {
    return await file.text();
  } catch {
    return `[File: ${file.name} - ${(file.size / 1024).toFixed(1)}KB - content could not be extracted]`;
  }
}

/**
 * Parse PDF_IMAGES content and return structured page images for AI consumption.
 */
export function parsePdfImages(content: string): { type: 'pdf_images'; filename: string; totalPages: number; pages: { page: number; image: string }[] } | null {
  if (!content.startsWith('[PDF_IMAGES:')) return null;
  try {
    const json = content.slice('[PDF_IMAGES:'.length, -1);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Accepted file types string for <input accept="..."> */
export const DOCUMENT_ACCEPT = '.txt,.md,.csv,.json,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.py,.js,.ts,.jsx,.tsx,.html,.css,.xml,.yaml,.yml,.xlsx,.xls,.rtf,.log,.tex,.java,.c,.cpp';
