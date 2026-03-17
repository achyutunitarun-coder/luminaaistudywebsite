import { useState, useRef } from 'react';
import { Paperclip, X, FileText, Image, File, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type UploadedFile = {
  name: string;
  type: string;
  content: string; // extracted text or base64 for images
  size: number;
};

const ACCEPTED = '.txt,.md,.csv,.json,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.py,.js,.ts,.jsx,.tsx,.html,.css,.xml,.yaml,.yml,.xlsx,.xls';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <Image className="w-3.5 h-3.5 text-primary" />;
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="w-3.5 h-3.5 text-warning" />;
  return <File className="w-3.5 h-3.5 text-muted-foreground" />;
};

const extractPdfText = async (file: globalThis.File): Promise<string> => {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
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
    
    return fullText.trim() || `[PDF: ${file.name} - ${totalPages} pages - no extractable text found. This may be a scanned document.]`;
  } catch (e) {
    console.error('PDF extraction error:', e);
    return `[PDF: ${file.name} - could not extract text. Error: ${e instanceof Error ? e.message : 'unknown'}]`;
  }
};

const extractText = async (file: globalThis.File): Promise<string> => {
  // Images → base64
  if (file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
  
  // PDFs → pdf.js extraction
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(file);
  }
  
  // Text-based files
  const textExtensions = ['.txt', '.md', '.csv', '.json', '.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.xml', '.yaml', '.yml', '.doc', '.docx'];
  const isText = file.type.startsWith('text/') || textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  
  if (isText) {
    return file.text();
  }
  
  // Best effort for unknown types
  try {
    return await file.text();
  } catch {
    return `[File: ${file.name} - ${(file.size / 1024).toFixed(1)}KB - content could not be extracted]`;
  }
};

type Props = {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  compact?: boolean;
};

export const FileUploadButton = ({ files, onFilesChange, maxFiles = 5, compact = false }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [processingName, setProcessingName] = useState('');

  const handleFiles = async (fileList: FileList) => {
    setProcessing(true);
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < Math.min(fileList.length, maxFiles - files.length); i++) {
      const file = fileList[i];
      if (file.size > MAX_SIZE) continue;

      setProcessingName(file.name);
      const content = await extractText(file);
      newFiles.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        content,
        size: file.size,
      });
    }

    onFilesChange([...files, ...newFiles]);
    setProcessing(false);
    setProcessingName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5"
          >
            {files.map((f, i) => (
              <motion.div
                key={`${f.name}-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/20 text-xs"
              >
                {getFileIcon(f.type)}
                <span className="text-foreground/80 truncate max-w-[120px]">{f.name}</span>
                <span className="text-muted-foreground text-[10px]">
                  {f.type.includes('pdf') ? `PDF` : (f.size / 1024).toFixed(0) + 'KB'}
                </span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
      {files.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className={`flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors ${compact ? '' : 'text-xs'}`}
          title="Attach file (PDF, images, code, text)"
        >
          {processing ? (
            <Loader2 className={`${compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} animate-spin`} />
          ) : (
            <Paperclip className={`${compact ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
          )}
          {!compact && <span>{processing ? `Processing ${processingName}...` : 'Attach'}</span>}
        </button>
      )}
    </div>
  );
};

export const buildFileContext = (files: UploadedFile[]): string => {
  if (files.length === 0) return '';
  
  let context = '\n\n--- ATTACHED FILES ---\n';
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      context += `\n[Image: ${f.name}]\n`;
    } else {
      context += `\n### File: ${f.name}\n\`\`\`\n${f.content.slice(0, 20000)}\n\`\`\`\n`;
    }
  }
  return context;
};
