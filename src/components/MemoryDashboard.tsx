import { useEffect } from "react";
import { Brain, Clock, Trophy, Flame, Eye, TrendingUp, BookOpen, Zap } from "lucide-react";
import { useMemory } from "@/contexts/MemoryContext";

export function MemorySidebar() {
  const { summary, recentlyViewed, loading, refreshSummary } = useMemory();

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  if (loading) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading memory…</span>
        </div>
      </div>
    );
  }

  const streak = summary?.currentStreak ?? 0;
  const totalCredits = summary?.totalCredits ?? 0;
  const topics = summary?.topicsStudied ?? 0;

  return (
    <div className="p-3 space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
          <Flame className="w-3.5 h-3.5 mx-auto text-warning" />
          <div className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{streak}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Streak</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
          <Zap className="w-3.5 h-3.5 mx-auto text-primary" />
          <div className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{totalCredits}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Credits</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
          <BookOpen className="w-3.5 h-3.5 mx-auto" style={{ color: "var(--teal)" }} />
          <div className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{topics}</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Topics</div>
        </div>
      </div>

      {/* Recently viewed */}
      {recentlyViewed.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <Eye className="w-3 h-3" /> Recently Viewed
          </div>
          <div className="space-y-1">
            {recentlyViewed.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="text-xs px-2 py-1.5 rounded-md truncate cursor-default"
                style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                title={item.title ?? item.content_type}
              >
                {item.title ?? item.content_type}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly activity */}
      {summary && summary.weeklyActivityCount > 0 && (
        <div className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <TrendingUp className="w-3 h-3" />
          <span>{summary.weeklyActivityCount} activities this week</span>
        </div>
      )}
    </div>
  );
}

export function MemoryDashboard() {
  const { summary, progress, loading, refreshSummary } = useMemory();

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
        No memory data yet. Start studying!
      </div>
    );
  }

  const topProgress = [...progress]
    .sort((a, b) => (b.interactions_count ?? 0) - (a.interactions_count ?? 0))
    .slice(0, 8);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        <Brain className="w-6 h-6" style={{ color: "var(--brand)" }} />
        Your Memory
      </h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Flame className="w-5 h-5 text-warning" />} label="Current Streak" value={`${summary.currentStreak} days`} />
        <StatCard icon={<Zap className="w-5 h-5 text-primary" />} label="Total Credits" value={String(summary.totalCredits)} />
        <StatCard icon={<BookOpen className="w-5 h-5" style={{ color: "var(--teal)" }} />} label="Topics Studied" value={String(summary.topicsStudied)} />
        <StatCard icon={<Trophy className="w-5 h-5 text-amber-400" />} label="Avg Score" value={summary.averageScore > 0 ? `${Math.round(summary.averageScore)}%` : "—"} />
      </div>

      {/* Learning progress */}
      {topProgress.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "var(--brand)" }} />
            Learning Progress
          </h2>
          <div className="space-y-2">
            {topProgress.map((item) => {
              const pct = item.score != null ? Math.min(100, Number(item.score)) : Math.min(100, (item.interactions_count ?? 0) * 10);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-32 text-sm truncate" style={{ color: "var(--text-primary)" }}>{item.topic}</div>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 70 ? "var(--teal)" : pct >= 40 ? "var(--amber)" : "var(--brand)",
                      }}
                    />
                  </div>
                  <div className="text-xs w-12 text-right" style={{ color: "var(--text-muted)" }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {summary.recentActivity.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Clock className="w-4 h-4" style={{ color: "var(--brand)" }} />
            Recent Activity
          </h2>
          <div className="space-y-1.5">
            {summary.recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg"
                style={{ background: "var(--bg-elevated)" }}
              >
                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                  {item.category ?? "—"}
                </span>
                <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                  {item.description ?? item.action}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
