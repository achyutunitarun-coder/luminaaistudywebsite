import { useState, useRef } from 'react';
import { Paperclip, X, FileText, Image, File, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractDocumentText, DOCUMENT_ACCEPT } from '@/lib/extractDocumentText';

export type UploadedFile = {
  name: string;
  type: string;
  content: string; // extracted text or base64 for images
  size: number;
};
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <Image className="w-3.5 h-3.5 text-primary" />;
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="w-3.5 h-3.5 text-warning" />;
  return <File className="w-3.5 h-3.5 text-muted-foreground" />;
};

// Use the shared extraction utility
const extractText = (file: globalThis.File): Promise<string> => extractDocumentText(file, true);

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
