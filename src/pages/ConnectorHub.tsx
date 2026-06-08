import { Loader2, Plug, Check } from "lucide-react";
import { CONNECTORS, type ConnectorCategory } from "@/lib/connectors/config";
import { useConnectors } from "@/hooks/useConnectors";
import { startOAuth, disconnect } from "@/lib/connectors/api";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const ORDER: ConnectorCategory[] = ["Email", "Calendar", "Storage", "Productivity"];

export default function ConnectorHub() {
  const nav = useNavigate();
  const { connections, loading, refresh, isServiceConnected } = useConnectors();
  const [busy, setBusy] = useState<string | null>(null);

  const handleConnect = async (provider: "google" | "notion", service: string) => {
    setBusy(service);
    try {
      const url = await startOAuth(provider, provider === "google" ? [service as any] : undefined);
      sessionStorage.setItem("lumina_oauth_return", "/connectors");
      window.location.assign(url);
    } catch (e) {
      toast.error("Could not start sign-in", { description: String(e) });
      setBusy(null);
    }
  };

  const handleDisconnect = async (provider: "google" | "notion") => {
    if (!confirm(`Disconnect ${provider === "google" ? "Google" : "Notion"}?`)) return;
    await disconnect(provider);
    toast.success("Disconnected");
    await refresh();
  };

  const connectedCount = connections.length;

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <header className="max-w-4xl mx-auto px-6 pt-10 pb-6">
        <button onClick={() => nav(-1)} className="text-[12px] text-white/45 hover:text-white">← Back</button>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/25 grid place-items-center">
            <Plug className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">Connectors</h1>
            <p className="text-[12.5px] text-white/50">
              Bring your inbox, calendar, files, and notes into Lumina.
              {!loading && ` · ${connectedCount} connected`}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="flex items-center gap-2 text-white/55"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        ) : (
          ORDER.map((cat) => {
            const items = CONNECTORS.filter((c) => c.category === cat);
            if (!items.length) return null;
            return (
              <section key={cat} className="mb-8">
                <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">{cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((c) => {
                    const connected = isServiceConnected(c.id);
                    const accountConn = connections.find((x) => x.provider === c.provider);
                    return (
                      <div
                        key={c.id}
                        className="group rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-xl p-4 transition-all hover:-translate-y-0.5 hover:border-teal-400/30 hover:shadow-[0_0_20px_rgba(20,184,166,0.18)]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{c.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-medium text-white/90">{c.label}</span>
                              {connected && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-teal-300 px-1.5 py-0.5 rounded-full border border-teal-400/30 bg-teal-400/10">
                                  <Check className="w-2.5 h-2.5" />Connected
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[12px] text-white/50 leading-relaxed">{c.description}</p>
                            {connected && accountConn?.account_label && (
                              <p className="mt-1 text-[11px] text-white/40 truncate">{accountConn.account_label}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          {connected ? (
                            <button
                              onClick={() => handleDisconnect(c.provider)}
                              className="text-[11.5px] px-2.5 py-1 rounded-md border border-white/10 text-white/65 hover:bg-white/[0.05] hover:text-white"
                            >Disconnect</button>
                          ) : (
                            <button
                              onClick={() => handleConnect(c.provider, c.id)}
                              disabled={busy === c.id}
                              className="text-[11.5px] px-2.5 py-1 rounded-md bg-teal-500/15 border border-teal-500/30 text-teal-100 hover:bg-teal-500/25 disabled:opacity-50"
                            >{busy === c.id ? "Opening…" : "Connect"}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
