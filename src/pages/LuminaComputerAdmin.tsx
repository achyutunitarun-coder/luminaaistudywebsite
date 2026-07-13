// Lumina Computer — routing & cooldown dashboard.
// Read-only view of model routing policy, active cooldowns, and recent
// generations for the signed-in user.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { ArrowLeft, Activity, ShieldAlert, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Routing = {
  id: string;
  role: string;
  primary_model_id: string | null;
  fallback_model_ids: string[] | null;
  updated_at?: string | null;
};

type Cooldown = {
  model_id: string;
  cooldown_until: string;
  reason?: string | null;
};

type GenLog = {
  id: string;
  block_id: string | null;
  model_id: string | null;
  success: boolean | null;
  latency_ms: number | null;
  error_text: string | null;
  created_at: string;
};

export default function LuminaComputerAdmin() {
  const [routing, setRouting] = useState<Routing[]>([]);
  const [cooldowns, setCooldowns] = useState<Cooldown[]>([]);
  const [logs, setLogs] = useState<GenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    setLoading(true);
    const [r, c, l] = await Promise.all([
      supabase.from("lc_model_routing" as any).select("*").order("role"),
      supabase.from("lc_model_cooldowns" as any).select("*").order("cooling_until", { ascending: false }),
      supabase.from("lc_generation_log" as any).select("*").order("created_at", { ascending: false }).limit(60),
    ]);
    setRouting(((r.data as any[]) ?? []) as Routing[]);
    setCooldowns(((c.data as any[]) ?? []) as Cooldown[]);
    setLogs(((l.data as any[]) ?? []) as GenLog[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const activeCooldowns = cooldowns.filter((c) => new Date(c.cooling_until).getTime() > now);

  const successRate = (() => {
    if (logs.length === 0) return null;
    const ok = logs.filter((l) => l.status === "ok" || l.status === "success" || l.status === "ready").length;
    return Math.round((ok / logs.length) * 100);
  })();

  const avgLatency = (() => {
    const nums = logs.map((l) => l.latency_ms).filter((n): n is number => typeof n === "number" && n > 0);
    if (!nums.length) return null;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  })();

  const fallbackRate = (() => {
    if (logs.length === 0) return null;
    const fb = logs.filter((l) => l.fallback).length;
    return Math.round((fb / logs.length) * 100);
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <NavLink
              to="/lumina-computer"
              className="h-9 w-9 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              aria-label="Back to Lumina Computer"
            >
              <ArrowLeft className="h-4 w-4" />
            </NavLink>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Routing & Cooldowns</h1>
              <p className="text-sm text-muted-foreground">Live view of Lumina Computer's model router.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-label="Refresh data">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Recent runs" value={String(logs.length)} icon={Activity} />
          <StatCard label="Success rate" value={successRate == null ? "—" : `${successRate}%`}
            tone={successRate != null && successRate < 80 ? "warn" : "ok"} icon={CheckCircle2} />
          <StatCard label="Avg latency" value={avgLatency == null ? "—" : `${avgLatency} ms`} icon={Clock} />
          <StatCard label="Cooling down" value={String(activeCooldowns.length)}
            tone={activeCooldowns.length > 0 ? "warn" : "ok"} icon={ShieldAlert}
            hint={fallbackRate != null ? `fallback ${fallbackRate}%` : undefined} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Routing */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Routing chains</h2>
            <div className="space-y-3">
              {routing.length === 0 && <div className="text-xs text-muted-foreground">No routing rows.</div>}
              {routing.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 p-3">
                  <div className="text-xs uppercase tracking-wider text-teal-300/80 mb-1.5">{r.role}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(r.models ?? []).map((m, i) => {
                      const cooling = activeCooldowns.find((c) => c.model_id === m);
                      return (
                        <span key={`${m}-${i}`}
                          className={`text-[11px] font-mono px-2 py-1 rounded-full border ${
                            cooling
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                              : i === 0
                                ? "border-teal-400/40 bg-teal-400/10 text-teal-200"
                                : "border-white/10 bg-white/5 text-muted-foreground"
                          }`}
                          title={cooling ? `cooling until ${new Date(cooling.cooling_until).toLocaleTimeString()}` : i === 0 ? "primary" : "fallback"}
                        >
                          {i === 0 ? "▶ " : ""}{m}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cooldowns */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Active cooldowns</h2>
            {activeCooldowns.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-xl border border-white/5 p-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> All models available.
              </div>
            ) : (
              <ul className="space-y-2">
                {activeCooldowns.map((c) => {
                  const secs = Math.max(0, Math.round((new Date(c.cooling_until).getTime() - now) / 1000));
                  return (
                    <li key={c.model_id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-mono truncate">{c.model_id}</div>
                        {c.reason && <div className="text-[11px] text-amber-200/70 truncate">{c.reason}</div>}
                      </div>
                      <div className="text-xs text-amber-200 font-mono shrink-0">{secs}s</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Recent runs */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Recent generations</h2>
          {logs.length === 0 ? (
            <div className="text-xs text-muted-foreground">No runs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1.5 pr-3 font-medium">Time</th>
                    <th className="py-1.5 pr-3 font-medium">Model</th>
                    <th className="py-1.5 pr-3 font-medium">Status</th>
                    <th className="py-1.5 pr-3 font-medium">Latency</th>
                    <th className="py-1.5 pr-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-white/5">
                      <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</td>
                      <td className="py-1.5 pr-3 font-mono truncate max-w-[220px]">{l.model_used ?? "—"}</td>
                      <td className="py-1.5 pr-3">
                        {l.status === "ok" || l.status === "success" || l.status === "ready" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3 w-3" /> {l.status}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-300"><XCircle className="h-3 w-3" /> {l.status}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{l.latency_ms ? `${l.latency_ms} ms` : "—"}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-[280px]">
                        {l.fallback ? <span className="text-amber-300 mr-2">fallback</span> : null}
                        {l.error_text ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone = "ok", hint,
}: {
  label: string; value: string; icon: any; tone?: "ok" | "warn"; hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-3.5 w-3.5 ${tone === "warn" ? "text-amber-300" : "text-teal-300"}`} />
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
