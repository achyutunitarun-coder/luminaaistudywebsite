import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plug, Settings, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CONNECTORS, type ConnectorServiceId } from "@/lib/connectors/config";
import { useConnectors } from "@/hooks/useConnectors";
import { startOAuth } from "@/lib/connectors/api";
import { toast } from "sonner";

interface Props {
  onPickService: (id: ConnectorServiceId) => void;
  buttonClassName?: string;
}

export function ConnectorPlusMenu({ onPickService, buttonClassName }: Props) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ConnectorServiceId | null>(null);
  const { isServiceConnected, refresh } = useConnectors();
  const anyConnected = CONNECTORS.some((c) => isServiceConnected(c.id));

  const connect = async (provider: "google" | "notion", service: ConnectorServiceId) => {
    setBusy(service);
    try {
      const url = await startOAuth(provider, provider === "google" ? [service] : undefined);
      sessionStorage.setItem("lumina_oauth_return", window.location.pathname);
      window.location.assign(url);
    } catch (e) {
      toast.error("Could not start sign-in", { description: String(e) });
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          buttonClassName ??
          "shrink-0 w-9 h-9 grid place-items-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground relative"
        }
        title="Connect a service"
        aria-label="Connect a service"
      >
        <Plug className="w-4 h-4" />
        {anyConnected && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(20,184,166,0.8)]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="absolute bottom-full mb-2 left-0 z-40 w-72 rounded-2xl border border-white/[0.08] bg-[#0a0a0f]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            >
              <div className="px-3.5 py-2.5 border-b border-white/[0.06]">
                <div className="text-[11px] uppercase tracking-wide text-white/45">Bring context from</div>
              </div>
              <div className="p-1.5 space-y-0.5">
                {CONNECTORS.map((c) => {
                  const connected = isServiceConnected(c.id);
                  const isBusy = busy === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (connected) { setOpen(false); onPickService(c.id); }
                        else void connect(c.provider, c.id);
                      }}
                      disabled={isBusy}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left group"
                    >
                      <span className="text-lg">{c.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-white/85 truncate">{c.label}</div>
                        <div className="text-[11px] text-white/40 truncate">{c.description}</div>
                      </div>
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                      ) : connected ? (
                        <span className="flex items-center gap-1 text-[10.5px] text-teal-400 font-medium">
                          <Check className="w-3 h-3" />Connected
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-white/50 px-1.5 py-0.5 rounded border border-white/10 group-hover:text-white/80 group-hover:border-white/20">
                          Connect
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); nav("/connectors"); }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 border-t border-white/[0.06] text-[12px] text-white/55 hover:text-white hover:bg-white/[0.03] transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Manage connectors
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
