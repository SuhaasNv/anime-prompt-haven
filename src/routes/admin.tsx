import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { CURRENT_USER_QUERY_KEY, getCurrentUser } from "@/lib/api/auth.functions";
import { listReports, moderateListing } from "@/lib/api/reports.functions";
import { listAllTransactions } from "@/lib/api/credits.functions";
import { getDashboardMetrics, getAuditLogs } from "@/lib/api/admin.functions";

interface FlaggedListing {
  id: string;
  title: string;
  status: string;
  reportCount: number;
  reasons: {
    nsfw: number;
    spam: number;
    stolen: number;
    misleading: number;
    other: number;
  };
}

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: getCurrentUser,
      staleTime: 60_000,
    });
    if (!user?.is_admin) {
      throw redirect({ to: "/" });
    }
    return { user };
  },
  loader: async () => {
    const flagged = await listReports();
    return { flagged };
  },
  head: () => ({
    meta: [
      { title: "Admin Dashboard — PromptStar" },
      { name: "description", content: "Community moderation dashboard" },
    ],
  }),
  component: AdminDashboard,
});

type AdminTab = "dashboard" | "queue" | "audit" | "credits";

const TYPE_LABELS: Record<string, string> = {
  bonus: "Bonus",
  sale_earn: "Sale Earn",
  copy_earn: "Copy Earn",
  purchase: "Purchase",
  platform_fee: "Platform Fee",
  refund: "Refund",
  withdrawal: "Withdrawal",
};

function AdminDashboard() {
  const { flagged } = Route.useLoaderData() as { flagged: FlaggedListing[] };
  const [listings, setListings] = useState<FlaggedListing[]>(flagged);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [creditData, setCreditData] = useState<Awaited<ReturnType<typeof listAllTransactions>> | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getDashboardMetrics>> | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof getAuditLogs>> | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (activeTab === "dashboard" && !metrics) {
      setLoadingMetrics(true);
      getDashboardMetrics().then(setMetrics).finally(() => setLoadingMetrics(false));
    }
  }, [activeTab, metrics]);

  useEffect(() => {
    if (activeTab === "audit" && !auditLogs) {
      setLoadingAudit(true);
      getAuditLogs().then(setAuditLogs).finally(() => setLoadingAudit(false));
    }
  }, [activeTab, auditLogs]);

  useEffect(() => {
    if (activeTab !== "credits" || creditData) return;
    setLoadingCredits(true);
    listAllTransactions().then(setCreditData).finally(() => setLoadingCredits(false));
  }, [activeTab, creditData]);

  const handleRestore = async (id: string) => {
    setProcessing(id);
    try {
      await moderateListing({ data: { listingId: id, action: "restore" } });
      setListings(listings.filter((l) => l.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to restore listing");
    } finally {
      setProcessing(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Permanently remove this listing?")) return;
    setProcessing(id);
    try {
      await moderateListing({ data: { listingId: id, action: "remove" } });
      setListings(listings.filter((l) => l.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove listing");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10">
        <div className="mb-8">
          <Link to="/" className="text-sm font-bold uppercase tracking-wider mb-6 inline-block hover:text-magenta">
            ← Back to Market
          </Link>
          <h1 className="font-display text-5xl md:text-6xl uppercase mb-2">
            Admin <span className="text-magenta">Dashboard</span>
          </h1>
          <p className="text-ink/70">Moderation tools and platform activity.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b-4 border-ink flex-wrap">
          {(["dashboard", "queue", "audit", "credits"] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 font-display uppercase text-sm border-2 border-b-0 transition-all ${
                activeTab === tab
                  ? "bg-magenta text-white border-ink"
                  : "bg-white text-ink border-ink/30 hover:border-ink"
              }`}
            >
              {tab === "dashboard" && "📊 Analytics"}
              {tab === "queue" && `⚠️ Queue (${listings.length})`}
              {tab === "audit" && "🔍 Audit Log"}
              {tab === "credits" && "✦ Transactions"}
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <div>
            {loadingMetrics ? (
              <p className="text-ink/50 py-10 text-center font-mono">Loading metrics…</p>
            ) : metrics ? (
              <div className="space-y-8">
                {/* Revenue Section */}
                <div>
                  <h3 className="font-display text-xl uppercase mb-4">Revenue</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Revenue (24h)", value: metrics.revenue.total24h },
                      { label: "Revenue (7d)", value: metrics.revenue.total7d },
                      { label: "Revenue (30d)", value: metrics.revenue.total30d },
                      { label: "Platform Fees (24h)", value: metrics.revenue.platformFees24h },
                    ].map((m) => (
                      <div key={m.label} className="bg-white border-4 border-ink p-4 shadow-pop">
                        <div className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-2">{m.label}</div>
                        <div className="font-display text-2xl uppercase">✦ {m.value.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User Engagement */}
                <div>
                  <h3 className="font-display text-xl uppercase mb-4">Users</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Active Creators (24h)", value: metrics.users.activeCreators24h },
                      { label: "Active Buyers (24h)", value: metrics.users.activeBuyers24h },
                      { label: "Total Creators", value: metrics.users.totalCreators },
                      { label: "Total Users", value: metrics.users.totalUsers },
                    ].map((m) => (
                      <div key={m.label} className="bg-white border-4 border-ink p-4 shadow-pop">
                        <div className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-2">{m.label}</div>
                        <div className="font-display text-2xl uppercase">{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content Health */}
                <div>
                  <h3 className="font-display text-xl uppercase mb-4">Content Health</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Flagged Listings", value: metrics.content.flaggedListings },
                      { label: "Pending Reports", value: metrics.content.pendingReports },
                      { label: "Total Listings", value: metrics.content.totalListings },
                      { label: "Avg Rating", value: metrics.health.averageRating.toFixed(1) },
                    ].map((m) => (
                      <div key={m.label} className="bg-white border-4 border-ink p-4 shadow-pop">
                        <div className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-2">{m.label}</div>
                        <div className="font-display text-2xl uppercase">{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "audit" && (
          <div>
            {loadingAudit ? (
              <p className="text-ink/50 py-10 text-center font-mono">Loading audit log…</p>
            ) : auditLogs ? (
              <div className="bg-white border-4 border-ink shadow-pop overflow-hidden">
                <div className="p-4 border-b-4 border-ink bg-accent-yellow">
                  <h3 className="font-display text-xl uppercase">Admin Audit Trail</h3>
                  <p className="text-xs text-ink/60 mt-1">Immutable record of all admin actions</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-ink/5 border-b-2 border-ink">
                      <tr>
                        {["Date", "Admin", "Action", "Target ID", "Details"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 font-bold uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="border-b border-ink/10 hover:bg-ink/5">
                            <td className="px-4 py-2 text-ink/50">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-4 py-2 font-bold">{log.admin_email}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 border border-ink bg-accent-yellow font-bold uppercase">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-ink/70">{log.target_id ? log.target_id.slice(0, 8) : "—"}</td>
                            <td className="px-4 py-2 text-ink/50 truncate max-w-[200px]">{log.details ?? "—"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-ink/50">
                            No audit logs found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "credits" && (
          <div>
            {loadingCredits ? (
              <p className="text-ink/50 py-10 text-center font-mono">Loading…</p>
            ) : creditData ? (
              <>
                {/* Stats strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {[
                    { label: "Distributed (24h)", value: `✦ ${creditData.stats.totalDistributed.toFixed(2)}` },
                    { label: "Platform Fees (24h)", value: `✦ ${creditData.stats.totalPlatformFees.toFixed(2)}` },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border-4 border-ink p-4 text-center shadow-pop">
                      <div className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-1">{s.label}</div>
                      <div className="font-display text-2xl uppercase">{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Transaction log */}
                <div className="bg-white border-4 border-ink shadow-pop overflow-hidden">
                  <div className="p-4 border-b-4 border-ink bg-accent-yellow">
                    <h3 className="font-display text-xl uppercase">Recent Transactions</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead className="bg-ink/5 border-b-2 border-ink">
                        <tr>
                          {["Date", "User", "Type", "Amount", "Note"].map((h) => (
                            <th key={h} className="text-left px-4 py-2 font-bold uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {creditData.transactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-ink/10 hover:bg-ink/5">
                            <td className="px-4 py-2 text-ink/50">{new Date(tx.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-2 font-bold">@{tx.username}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 border font-bold uppercase ${tx.type === "platform_fee" ? "border-ink/20 bg-ink/5 text-ink/50" : "border-ink bg-accent-yellow"}`}>
                                {TYPE_LABELS[tx.type] ?? tx.type}
                              </span>
                            </td>
                            <td className={`px-4 py-2 font-bold ${tx.amount >= 0 ? "text-green-600" : "text-magenta"}`}>
                              {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-ink/50 truncate max-w-[200px]">{tx.note ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {activeTab === "queue" && (listings.length === 0 ? (
          <div className="py-20 text-center border-4 border-dashed border-ink">
            <p className="font-display text-3xl uppercase text-ink/40">Queue Clear ✨</p>
            <p className="text-sm text-ink/60 mt-2">No flagged listings to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {listings.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white border-4 border-ink p-5 hover:shadow-pop transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display text-2xl uppercase">{listing.title}</h3>
                      <span className="bg-magenta text-white text-xs font-bold px-2 py-1 rounded">
                        {listing.reportCount} reports
                      </span>
                    </div>
                    <p className="text-xs text-ink/60 font-mono">ID: {listing.id}</p>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-ink/5 border-l-4 border-magenta">
                  <p className="text-xs font-bold uppercase mb-2 text-ink/70">Report reasons:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {listing.reasons.nsfw > 0 && (
                      <div className="text-xs">
                        <span className="font-bold">NSFW</span>
                        <div className="text-magenta">{listing.reasons.nsfw}</div>
                      </div>
                    )}
                    {listing.reasons.spam > 0 && (
                      <div className="text-xs">
                        <span className="font-bold">SPAM</span>
                        <div className="text-magenta">{listing.reasons.spam}</div>
                      </div>
                    )}
                    {listing.reasons.stolen > 0 && (
                      <div className="text-xs">
                        <span className="font-bold">STOLEN</span>
                        <div className="text-magenta">{listing.reasons.stolen}</div>
                      </div>
                    )}
                    {listing.reasons.misleading > 0 && (
                      <div className="text-xs">
                        <span className="font-bold">MISLEADING</span>
                        <div className="text-magenta">{listing.reasons.misleading}</div>
                      </div>
                    )}
                    {listing.reasons.other > 0 && (
                      <div className="text-xs">
                        <span className="font-bold">OTHER</span>
                        <div className="text-magenta">{listing.reasons.other}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleRestore(listing.id)}
                    disabled={processing === listing.id}
                    className="flex-1 bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                  >
                    {processing === listing.id ? "Processing…" : "✓ Restore"}
                  </button>
                  <button
                    onClick={() => handleRemove(listing.id)}
                    disabled={processing === listing.id}
                    className="flex-1 bg-magenta text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                  >
                    {processing === listing.id ? "Processing…" : "✕ Remove"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}
