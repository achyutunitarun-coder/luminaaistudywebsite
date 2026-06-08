import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  emoji: string;
  children: ReactNode;
}

/**
 * Shared mini-browser shell — slides up from the input area.
 * Used by Gmail, Calendar, Drive, Notion browsers.
 */
export function MiniBrowserShell({ open, onClose, title, emoji, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 w-[min(560px,calc(100vw-2rem))] max-h-[70vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#0a0a0f]/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <span className="text-lg">{emoji}</span>
              <span className="text-[13px] font-medium text-white/85">{title}</span>
              <button
                onClick={onClose}
                className="ml-auto p-1 rounded hover:bg-white/[0.06] text-white/55 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
