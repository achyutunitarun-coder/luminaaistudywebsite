import { useState, useRef, useEffect } from 'react';
import { Send, Square, FileText, Code2, Presentation, ScrollText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUploadButton, type UploadedFile } from '@/components/FileUploadButton';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
  onPickArtifact?: (type: 'notes' | 'exam' | 'slides' | 'code') => void;
  files?: UploadedFile[];
  onFilesChange?: (files: UploadedFile[]) => void;
}

export const InputBar = ({ value, onChange, onSend, onStop, isLoading, disabled, onPickArtifact, files, onFilesChange }: Props) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) onSend();
    }
  };

  const types = [
    { k: 'notes',  label: 'Notes',  icon: FileText,     color: 'text-violet-400' },
    { k: 'exam',   label: 'Exam',   icon: ScrollText,   color: 'text-amber-400' },
    { k: 'slides', label: 'Slides', icon: Presentation, color: 'text-pink-400' },
    { k: 'code',   label: 'Code',   icon: Code2,        color: 'text-emerald-400' },
  ] as const;

  return (
    <div className="relative w-full">
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-2 z-30 grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl"
          >
            {types.map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  onPickArtifact?.(t.k);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
              >
                <t.icon className={`w-4 h-4 ${t.color}`} />
                <span>{t.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 p-2 rounded-2xl bg-card/60 backdrop-blur-xl border border-border focus-within:border-primary/60 transition-colors">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="shrink-0 w-9 h-9 grid place-items-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Generate artifact"
          aria-label="Generate artifact"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything, or say 'create notes on photosynthesis'…"
          maxLength={8000}
          disabled={disabled}
          className="flex-1 bg-transparent border-0 outline-none resize-none py-2 px-1 text-sm placeholder:text-muted-foreground/60 max-h-[200px] overflow-y-auto"
        />

        {value.length > 1000 && (
          <span className="self-end pb-2 text-[10px] text-muted-foreground tabular-nums">
            {value.length.toLocaleString()} / 8,000
          </span>
        )}

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 w-9 h-9 grid place-items-center rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="shrink-0 w-9 h-9 grid place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
