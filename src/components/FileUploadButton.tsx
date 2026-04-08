import { useState, useRef } from 'react';
import { Paperclip, X, FileText, Image, File, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { extractDocumentText, DOCUMENT_ACCEPT } from '@/lib/extractDocumentText';
import { Progress } from '@/components/ui/progress';

export type UploadedFile = {
  name: string;
  type: string;
  content: string;
  size: number;
};
const MAX_SIZE = 20 * 1024 * 1024;

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <Image className="w-3.5 h-3.5 text-primary" />;
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return <FileText className="w-3.5 h-3.5 text-warning" />;
  return <File className="w-3.5 h-3.5 text-muted-foreground" />;
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
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const handleFiles = async (fileList: FileList) => {
    setProcessing(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < Math.min(fileList.length, maxFiles - files.length); i++) {
        const file = fileList[i];
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name} exceeds 20MB limit`);
          continue;
        }

        setProcessingName(file.name);
        setProgressStage('');
        setProgressPercent(0);

        try {
          const content = await extractDocumentText(file, true, (info) => {
            setProgressStage(info.stage);
            setProgressPercent(info.total > 0 ? Math.round((info.current / info.total) * 100) : 0);
          });
          newFiles.push({
            name: file.name,
            type: file.type || 'application/octet-stream',
            content,
            size: file.size,
          });
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
          toast.error(`Failed to process ${file.name}`);
        }
      }

      onFilesChange([...files, ...newFiles]);
    } finally {
      setProcessing(false);
      setProcessingName('');
      setProgressStage('');
      setProgressPercent(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <AnimatePresence>
        {processing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-1 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-xs font-medium text-foreground/80 truncate">{processingName}</span>
            </div>
            {progressStage && (
              <span className="text-[11px] text-muted-foreground">{progressStage}</span>
            )}
            {progressPercent > 0 && (
              <Progress value={progressPercent} className="h-1.5" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
        accept={DOCUMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
      {files.length < maxFiles && !processing && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className={`flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors ${compact ? '' : 'text-xs'}`}
          title="Attach file (PDF, images, code, text)"
        >
          <Paperclip className={`${compact ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
          {!compact && <span>Attach</span>}
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
