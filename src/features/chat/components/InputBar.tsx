import { useState, useRef, useEffect } from 'react';
import {
  Send, Square, FileText, Code2, Presentation, ScrollText, Sparkles,
  Paperclip, X, Image as ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ConnectorPlusMenu } from '@/components/connectors/ConnectorPlusMenu';
import { GmailMiniBrowser } from '@/components/connectors/GmailMiniBrowser';
import { CalendarMiniBrowser } from '@/components/connectors/CalendarMiniBrowser';
import { DriveMiniBrowser } from '@/components/connectors/DriveMiniBrowser';
import { NotionMiniBrowser } from '@/components/connectors/NotionMiniBrowser';
import { serializeContextBlocks, type ContextBlock } from '@/lib/connectors/contextBlock';
import type { ConnectorServiceId } from '@/lib/connectors/config';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: (overrideText?: string) => void;
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
  const [contextBlocks, setContextBlocks] = useState<ContextBlock[]>([]);
  const [activeBrowser, setActiveBrowser] = useState<ConnectorServiceId | null>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [value]);

  const buildValueWithAttachments = () => {
    const blobs: string[] = [];
    for (const a of attachments) {
      if (a.kind === 'text' && a.text) {
        blobs.push(`\n\n--- ${a.name} ---\n${a.text}`);
      } else if (a.kind === 'image') {
        blobs.push(`\n\n[attached image: ${a.name}]`);
      }
    }
    const ctx = serializeContextBlocks(contextBlocks);
    if (!blobs.length && !ctx) return value;
    return (value || '') + blobs.join('') + ctx;
  };

  const submit = () => {
    if (!value.trim() && attachments.length === 0 && contextBlocks.length === 0) return;
    const nextValue = buildValueWithAttachments();
    onChange(nextValue);
    setAttachments([]);
    setContextBlocks([]);
    onSend(nextValue);
  };

  const addContextBlock = (b: ContextBlock) => {
    setContextBlocks((prev) => prev.find((x) => x.id === b.id) ? prev : [...prev, b]);
    toast.success('Added to chat context');
  };

  const removeContextBlock = (id: string) =>
    setContextBlocks((p) => p.filter((b) => b.id !== id));

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

      {contextBlocks.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2 px-1">
          {contextBlocks.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
              className="group flex items-start gap-2.5 px-3 py-2 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] backdrop-blur"
            >
              <span className="text-[15px] leading-none mt-0.5">
                {b.service === 'gmail' ? '✉️' : b.service === 'calendar' ? '📅' : b.service === 'drive' ? '📂' : '📝'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10.5px] uppercase tracking-wide text-teal-300/80">{b.sourceLabel}</div>
                <div className="text-[12.5px] font-medium text-white/90 truncate">{b.title}</div>
                <div className="text-[11.5px] text-white/55 line-clamp-2">{b.preview}</div>
              </div>
              <button
                onClick={() => removeContextBlock(b.id)}
                className="p-1 rounded hover:bg-white/[0.06] text-white/45 hover:text-white"
                aria-label="Remove context"
              ><X className="w-3 h-3" /></button>
            </motion.div>
          ))}
        </div>
      )}

      <GmailMiniBrowser    open={activeBrowser === 'gmail'}    onClose={() => setActiveBrowser(null)} onInsert={addContextBlock} />
      <CalendarMiniBrowser open={activeBrowser === 'calendar'} onClose={() => setActiveBrowser(null)} onInsert={addContextBlock} />
      <DriveMiniBrowser    open={activeBrowser === 'drive'}    onClose={() => setActiveBrowser(null)} onInsert={addContextBlock} />
      <NotionMiniBrowser   open={activeBrowser === 'notion'}   onClose={() => setActiveBrowser(null)} onInsert={addContextBlock} />

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,.md,.txt,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx,.py"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex items-end gap-2 p-2.5 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)] focus-within:border-primary/40 transition-all duration-300">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="shrink-0 w-9 h-9 grid place-items-center rounded-xl hover:bg-white/[0.08] transition-all text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95"
          title="Attach files"
          aria-label="Attach files"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="shrink-0 w-9 h-9 grid place-items-center rounded-xl hover:bg-white/[0.08] transition-all text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95"
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
          className="flex-1 bg-transparent border-0 outline-none resize-none py-2.5 px-1 text-sm placeholder:text-muted-foreground/50 max-h-[200px] overflow-y-auto"
        />

        {value.length > 1000 && (
          <span className="self-end pb-3 text-[10px] text-muted-foreground/50 tabular-nums">
            {value.length.toLocaleString()}
          </span>
        )}

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-destructive/15 hover:bg-destructive/25 text-destructive transition-all hover:scale-105 active:scale-95"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={(!value.trim() && attachments.length === 0 && contextBlocks.length === 0) || disabled}
            className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(124,92,252,0.3)] disabled:shadow-none"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
