import { useState, useRef, useEffect } from 'react';
import {
  Send, Square, FileText, Code2, Presentation, ScrollText, Sparkles,
  Paperclip, X, Image as ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
  onPickArtifact?: (type: 'notes' | 'exam' | 'slides' | 'code') => void;
}

interface Attachment {
  id: string;
  name: string;
  kind: 'image' | 'text';
  preview?: string;
  text?: string;
}

const uid = () => Math.random().toString(36).slice(2);

export const InputBar = ({ value, onChange, onSend, onStop, isLoading, disabled, onPickArtifact }: Props) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [value]);

  const flushAttachments = () => {
    if (attachments.length === 0) return;
    const blobs: string[] = [];
    for (const a of attachments) {
      if (a.kind === 'text' && a.text) {
        blobs.push(`\n\n--- ${a.name} ---\n${a.text}`);
      } else if (a.kind === 'image') {
        blobs.push(`\n\n[attached image: ${a.name}]`);
      }
    }
    if (blobs.length) onChange((value || '') + blobs.join(''));
    setAttachments([]);
  };

  const submit = () => {
    if (!value.trim() && attachments.length === 0) return;
    flushAttachments();
    // Defer one tick so onChange propagates before send
    setTimeout(() => onSend(), 0);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) submit();
    }
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    const next: Attachment[] = [];
    for (const f of Array.from(list)) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} too large (max 5MB)`);
        continue;
      }
      if (f.type.startsWith('image/')) {
        const url = await new Promise<string>((r) => {
          const fr = new FileReader();
          fr.onload = () => r(fr.result as string);
          fr.readAsDataURL(f);
        });
        next.push({ id: uid(), name: f.name, kind: 'image', preview: url });
      } else if (f.type.startsWith('text/') || /\.(md|json|csv|txt|html|css|js|ts|tsx|jsx|py)$/i.test(f.name)) {
        const text = await f.text();
        next.push({ id: uid(), name: f.name, kind: 'text', text: text.slice(0, 50000) });
      } else {
        toast.error(`Unsupported: ${f.name}`);
      }
    }
    setAttachments((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAttachment = (id: string) =>
    setAttachments((p) => p.filter((a) => a.id !== id));

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

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-card/70 border border-border text-xs text-foreground/80"
            >
              {a.kind === 'image' ? (
                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <span className="truncate max-w-[140px]">{a.name}</span>
              <button
                onClick={() => removeAttachment(a.id)}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,.md,.txt,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx,.py"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex items-end gap-2 p-2 rounded-2xl bg-card/60 backdrop-blur-xl border border-border focus-within:border-primary/60 transition-colors">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="shrink-0 w-9 h-9 grid place-items-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Attach files"
          aria-label="Attach files"
        >
          <Paperclip className="w-4 h-4" />
        </button>
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
          placeholder="Ask anything, attach files, or say 'create notes on photosynthesis'…"
          maxLength={50000}
          disabled={disabled}
          className="flex-1 bg-transparent border-0 outline-none resize-none py-2 px-1 text-sm placeholder:text-muted-foreground/60 max-h-[200px] overflow-y-auto"
        />

        {value.length > 1000 && (
          <span className="self-end pb-2 text-[10px] text-muted-foreground tabular-nums">
            {value.length.toLocaleString()}
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
            onClick={submit}
            disabled={(!value.trim() && attachments.length === 0) || disabled}
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
