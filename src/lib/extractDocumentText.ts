/**
 * Shared document text extraction utility.
 * Supports: PDF (via pdfjs-dist), Excel/CSV (via xlsx), and plain text files.
 */

const extractPdfText = async (file: File): Promise<string> => {
  try {
    const [pdfjsLib, workerSrc] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);

    // Force a local bundled worker URL so PDF parsing is stable in Vite/prod.
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default;

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

    return fullText.trim() || `[PDF: ${file.name} - ${totalPages} pages - no extractable text found]`;
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
 * Works with PDFs, Excel/CSV, images (returns base64), and text-based files.
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

/** Accepted file types string for <input accept="..."> */
export const DOCUMENT_ACCEPT = '.txt,.md,.csv,.json,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.py,.js,.ts,.jsx,.tsx,.html,.css,.xml,.yaml,.yml,.xlsx,.xls,.rtf,.log,.tex,.java,.c,.cpp';
