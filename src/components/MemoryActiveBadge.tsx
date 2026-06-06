import { useState } from "react";
import { Sparkles, X } from "lucide-react";

interface Props {
  summary?: string;
}

/**
 * "Memory active" indicator shown in chat header when getContextForRequest
 * returned hadSummary: true. Clicking it reveals the current summary text.
 */
export function MemoryActiveBadge({ summary }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full hover:bg-white/5 transition"
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 11,
          color: "rgba(20,184,166,0.75)",
          border: "0.5px solid rgba(20,184,166,0.3)",
        }}
      >
        <Sparkles className="w-3 h-3" />
        Memory active — earlier context summarised
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-lg w-full rounded-2xl p-6 relative"
            style={{ background: "#111827", border: "0.5px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
            <h3 className="text-white text-lg font-medium mb-3">What Lumina remembers</h3>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
              {summary || "Earlier context from this thread has been summarised. The most recent messages are kept verbatim."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
