// Admin > Chat tab — live metrics for the agentic chatbot.
// Shows 24h stats, 14-day volume, tool usage breakdown, and top chatters.

import { useEffect, useState } from "react";
import { getChatMetrics, type ChatMetricsResult } from "@/lib/api/admin.functions";
import { BarChart } from "@/components/ui/charts/BarChart";
import { StatCard } from "@/components/ui/StatCard";

const TOOL_LABELS: Record<string, string> = {
  ask_discovery: "Discovery agent",
  ask_binder: "Binder agent",
  ask_prompt_engineer: "Prompt-Engineer",
  ask_concierge: "Concierge",
  searchPrompts: "Search prompts",
  getTrendingPrompts: "Trending",
  getNewArrivals: "New arrivals",
  getPromptDetail: "Prompt detail",
  getMyCredits: "Check credits",
  listMyCollections: "Collections",
  listMySaved: "Saved prompts",
  savePrompt: "Save prompt",
  createCollection: "Create collection",
  addPromptToCollection: "Add to collection",
};

export function ChatTab() {
  const [data, setData] = useState<ChatMetricsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getChatMetrics()
      .then(setData)
      .catch((err) => console.error("Failed to load chat metrics:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-ink/50 text-sm p-6">Loading chat metrics…</p>;
  }

  if (!data) {
    return <p className="text-magenta text-sm p-6">Failed to load metrics.</p>;
  }

  const errorRate =
    data.stats24h.total > 0
      ? ((data.stats24h.errors / data.stats24h.total) * 100).toFixed(1)
      : "0.0";

  const volumePoints = data.volume14d.map((d) => ({
    label: d.date.slice(5), // MM-DD
    value: d.count,
  }));

  const maxToolCount = Math.max(...data.toolUsage.map((t) => t.count), 1);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl uppercase">Chat <span className="text-magenta">Monitoring</span></h2>

      {/* 24h stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Chats (24h)" value={String(data.stats24h.total)} icon="💬" />
        <StatCard
          label="Errors (24h)"
          value={`${data.stats24h.errors} (${errorRate}%)`}
          icon="⚠️"
          shadowClass={data.stats24h.errors > 0 ? "shadow-pop-orange" : "shadow-pop"}
        />
        <StatCard
          label="Avg latency"
          value={data.stats24h.avgMs > 0 ? `${(data.stats24h.avgMs / 1000).toFixed(1)}s` : "—"}
          icon="⚡"
        />
        <StatCard
          label="LangSmith"
          value={process.env.LANGCHAIN_TRACING_V2 === "true" ? "Active" : "Off"}
          icon="🔍"
        />
      </div>

      {/* 14-day volume chart */}
      <div className="bg-white border-4 border-ink shadow-pop p-5">
        <h3 className="font-display text-xl uppercase mb-4">Chat volume (14 days)</h3>
        {volumePoints.length === 0 ? (
          <p className="text-ink/40 text-sm text-center py-8">No chats yet.</p>
        ) : (
          <BarChart data={volumePoints} height={160} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool usage */}
        <div className="bg-white border-4 border-ink shadow-pop p-5">
          <h3 className="font-display text-xl uppercase mb-4">Tool usage (7 days)</h3>
          {data.toolUsage.length === 0 ? (
            <p className="text-ink/40 text-sm text-center py-6">No tool calls yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.toolUsage.map((t) => {
                const pct = Math.round((t.count / maxToolCount) * 100);
                return (
                  <li key={t.tool}>
                    <div className="flex justify-between text-xs font-bold uppercase mb-1">
                      <span>{TOOL_LABELS[t.tool] ?? t.tool}</span>
                      <span className="text-ink/50">{t.count}</span>
                    </div>
                    <div className="h-2 bg-ink/10 border border-ink/20">
                      <div
                        className="h-full bg-magenta"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Top chatters */}
        <div className="bg-white border-4 border-ink shadow-pop p-5">
          <h3 className="font-display text-xl uppercase mb-4">Top chatters (7 days)</h3>
          {data.topUsers.length === 0 ? (
            <p className="text-ink/40 text-sm text-center py-6">No users yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.topUsers.map((u, i) => (
                <li
                  key={u.username}
                  className="flex items-center justify-between py-2 border-b border-ink/10 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-xl text-ink/30">#{i + 1}</span>
                    <span className="font-bold">{u.username}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-magenta">{u.count} msgs</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* LangSmith setup hint when not active */}
      {process.env.LANGCHAIN_TRACING_V2 !== "true" && (
        <div className="border-4 border-ink bg-accent-yellow p-4 shadow-pop text-sm">
          <p className="font-bold uppercase text-xs mb-1">🔍 LangSmith tracing not configured</p>
          <p className="text-ink/70">
            Set <code className="bg-ink/10 px-1">LANGCHAIN_TRACING_V2=true</code>,{" "}
            <code className="bg-ink/10 px-1">LANGCHAIN_API_KEY=ls__...</code>, and{" "}
            <code className="bg-ink/10 px-1">LANGCHAIN_PROJECT=promptstar</code> in Railway to enable
            full per-trace LLM debugging on smith.langchain.com.
          </p>
        </div>
      )}
    </div>
  );
}
