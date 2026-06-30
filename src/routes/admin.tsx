import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { confirm } from "@/components/ui/confirm-dialog";
import { Navbar } from "@/components/Navbar";
import { CURRENT_USER_QUERY_KEY, getCurrentUser } from "@/lib/api/auth.functions";
import { listReports, moderateListing } from "@/lib/api/reports.functions";
import { listAllTransactions } from "@/lib/api/credits.functions";
import {
  getDashboardMetrics,
  getAuditLogs,
  getReports,
  searchListings,
  searchUsers,
  getPendingPayouts,
  getDisputes,
} from "@/lib/api/admin.functions";
import { ReportsTab } from "@/components/admin/ReportsTab";
import { ListingsTab } from "@/components/admin/ListingsTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { FinancialTab } from "@/components/admin/FinancialTab";
import { StatCard } from "@/components/ui/StatCard";
import { DonutChart } from "@/components/ui/charts/DonutChart";
import { BarChart } from "@/components/ui/charts/BarChart";

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

type AdminTab =
  | "dashboard"
  | "reports"
  | "listings"
  | "users"
  | "financial"
  | "queue"
  | "audit"
  | "credits";

const TYPE_LABELS: Record<string, string> = {
  bonus: "Bonus",
  sale_earn: "Sale Earn",
  copy_earn: "Copy Earn",
  purchase: "Purchase",
  platform_fee: "Platform Fee",
  refund: "Refund",
  withdrawal: "Withdrawal",
  adjustment: "Admin Adjustment",
};

const NAV_ITEMS: { key: AdminTab; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "reports", label: "Reports", icon: "⚡" },
  { key: "listings", label: "Listings", icon: "📝" },
  { key: "users", label: "Users", icon: "👥" },
  { key: "financial", label: "Financial", icon: "💰" },
  { key: "queue", label: "Queue", icon: "⚠️" },
  { key: "audit", label: "Audit Log", icon: "🔍" },
  { key: "credits", label: "Transactions", icon: "✦" },
];

/** Bar-chart x labels: weekday letters from a YYYY-MM-DD date. */
function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
}

/** % change between the last value and the mean of the prior window. */
function trendPct(series: { value: number }[]): number | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1].value;
  const prior = series.slice(0, -1);
  const avg = prior.reduce((s, p) => s + p.value, 0) / prior.length;
  if (avg === 0) return last > 0 ? 100 : null;
  return ((last - avg) / avg) * 100;
}

function AdminDashboard() {
  const { flagged } = Route.useLoaderData() as { flagged: FlaggedListing[] };
  const [listings, setListings] = useState<FlaggedListing[]>(flagged);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [creditData, setCreditData] = useState<Awaited<
    ReturnType<typeof listAllTransactions>
  > | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getDashboardMetrics>> | null>(
    null,
  );
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof getAuditLogs>> | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [reports, setReports] = useState<Awaited<ReturnType<typeof getReports>> | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportRefresh, setReportRefresh] = useState(0);
  const [listingsData, setListingsData] = useState<Awaited<
    ReturnType<typeof searchListings>
  > | null>(null);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingsSearch, setListingsSearch] = useState("");
  const [listingsStatus, setListingsStatus] = useState<
    "all" | "published" | "flagged" | "removed" | "draft"
  >("all");
  const [usersData, setUsersData] = useState<Awaited<ReturnType<typeof searchUsers>> | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRefresh, setUsersRefresh] = useState(0);
  const [payouts, setPayouts] = useState<Awaited<ReturnType<typeof getPendingPayouts>> | null>(
    null,
  );
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [payoutsRefresh, setPayoutsRefresh] = useState(0);
  const [disputesData, setDisputesData] = useState<Awaited<ReturnType<typeof getDisputes>> | null>(
    null,
  );
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [disputesRefresh, setDisputesRefresh] = useState(0);

  useEffect(() => {
    if (activeTab === "dashboard" && !metrics) {
      setLoadingMetrics(true);
      getDashboardMetrics()
        .then(setMetrics)
        .catch((err) => console.error("Failed to load dashboard metrics:", err))
        .finally(() => setLoadingMetrics(false));
    }
  }, [activeTab, metrics]);

  useEffect(() => {
    if (activeTab === "audit" && !auditLogs) {
      setLoadingAudit(true);
      getAuditLogs()
        .then(setAuditLogs)
        .catch((err) => console.error("Failed to load audit logs:", err))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab, auditLogs]);

  useEffect(() => {
    if (activeTab !== "credits" || creditData) return;
    setLoadingCredits(true);
    listAllTransactions()
      .then(setCreditData)
      .catch((err) => console.error("Failed to load transactions:", err))
      .finally(() => setLoadingCredits(false));
  }, [activeTab, creditData]);

  useEffect(() => {
    if (activeTab === "reports") {
      setLoadingReports(true);
      getReports()
        .then(setReports)
        .catch((err) => console.error("Failed to load reports:", err))
        .finally(() => setLoadingReports(false));
    }
  }, [activeTab, reportRefresh]);

  useEffect(() => {
    if (activeTab === "listings") {
      setLoadingListings(true);
      searchListings({
        data: { search: listingsSearch, status: listingsStatus },
      })
        .then(setListingsData)
        .catch((err) => console.error("Failed to load listings:", err))
        .finally(() => setLoadingListings(false));
    }
  }, [activeTab, listingsSearch, listingsStatus]);

  useEffect(() => {
    if (activeTab === "users") {
      setLoadingUsers(true);
      searchUsers({ data: { search: usersSearch } })
        .then(setUsersData)
        .catch((err) => console.error("Failed to load users:", err))
        .finally(() => setLoadingUsers(false));
    }
  }, [activeTab, usersSearch, usersRefresh]);

  useEffect(() => {
    if (activeTab === "financial") {
      setLoadingPayouts(true);
      getPendingPayouts()
        .then(setPayouts)
        .catch((err) => console.error("Failed to load payouts:", err))
        .finally(() => setLoadingPayouts(false));
      setLoadingDisputes(true);
      getDisputes()
        .then(setDisputesData)
        .catch((err) => console.error("Failed to load disputes:", err))
        .finally(() => setLoadingDisputes(false));
    }
  }, [activeTab, payoutsRefresh, disputesRefresh]);

  const handleRestore = async (id: string) => {
    setProcessing(id);
    try {
      await moderateListing({ data: { listingId: id, action: "restore" } });
      setListings(listings.filter((l) => l.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore listing");
    } finally {
      setProcessing(null);
    }
  };

  const handleRemove = async (id: string) => {
    const confirmed = await confirm({
      title: "Remove listing?",
      description: "Permanently remove this listing?",
      confirmText: "Remove",
      destructive: true,
    });
    if (!confirmed) return;
    setProcessing(id);
    try {
      await moderateListing({ data: { listingId: id, action: "remove" } });
      setListings(listings.filter((l) => l.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove listing");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10">
        <div className="mb-8">
          <Link
            to="/"
            className="text-sm font-bold uppercase tracking-wider mb-6 inline-block hover:text-magenta"
          >
            ← Back to Market
          </Link>
          <h1 className="font-display text-5xl md:text-6xl uppercase mb-2">
            Admin <span className="text-magenta">Dashboard</span>
          </h1>
          <p className="text-ink/70">Moderation tools and platform activity.</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar nav */}
          <aside className="col-span-12 lg:col-span-3 xl:col-span-2">
            <div className="lg:sticky lg:top-24 bg-white border-4 border-ink shadow-pop">
              <nav className="flex lg:flex-col gap-1 p-2 overflow-x-auto">
                {NAV_ITEMS.map((item) => {
                  const count =
                    item.key === "queue"
                      ? listings.length
                      : item.key === "reports"
                        ? (reports?.length ?? 0)
                        : 0;
                  const active = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 px-3 py-2.5 font-bold uppercase text-xs whitespace-nowrap border-2 transition-all ${
                        active
                          ? "bg-magenta text-white border-ink"
                          : "bg-white text-ink border-transparent hover:border-ink"
                      }`}
                    >
                      <span aria-hidden>{item.icon}</span>
                      <span>{item.label}</span>
                      {count > 0 && (
                        <span
                          className={`ml-auto text-[10px] px-1.5 py-0.5 border font-bold ${
                            active ? "border-white" : "border-ink bg-accent-yellow"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content pane */}
          <div className="col-span-12 lg:col-span-9 xl:col-span-10 min-w-0">

        {activeTab === "dashboard" && (
          <div>
            {loadingMetrics ? (
              <p className="text-ink/50 py-10 text-center font-mono">Loading metrics…</p>
            ) : metrics ? (
              <DashboardOverview metrics={metrics} />
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
                          <th
                            key={h}
                            className="text-left px-4 py-2 font-bold uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="border-b border-ink/10 hover:bg-ink/5">
                            <td className="px-4 py-2 text-ink/50">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 font-bold">{log.admin_email}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 border border-ink bg-accent-yellow font-bold uppercase">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-ink/70">
                              {log.target_id ? log.target_id.slice(0, 8) : "—"}
                            </td>
                            <td className="px-4 py-2 text-ink/50 truncate max-w-[200px]">
                              {log.details ?? "—"}
                            </td>
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

        {activeTab === "reports" && (
          <ReportsTab
            reports={reports || []}
            loading={loadingReports}
            onRefresh={() => setReportRefresh((prev) => prev + 1)}
          />
        )}

        {activeTab === "listings" && (
          <ListingsTab
            listings={listingsData || []}
            loading={loadingListings}
            search={listingsSearch}
            onSearchChange={setListingsSearch}
            onStatusChange={setListingsStatus}
            statusFilter={listingsStatus}
          />
        )}

        {activeTab === "users" && (
          <UsersTab
            users={usersData || []}
            loading={loadingUsers}
            search={usersSearch}
            onSearchChange={setUsersSearch}
            onUserUpdated={() => setUsersRefresh((prev) => prev + 1)}
          />
        )}

        {activeTab === "financial" && (
          <FinancialTab
            payouts={payouts || []}
            disputes={disputesData || []}
            payoutsLoading={loadingPayouts}
            disputesLoading={loadingDisputes}
            onPayoutUpdated={() => setPayoutsRefresh((prev) => prev + 1)}
            onDisputeResolved={() => setDisputesRefresh((prev) => prev + 1)}
          />
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
                    {
                      label: "Distributed (24h)",
                      value: `✦ ${creditData.stats.totalDistributed.toFixed(2)}`,
                    },
                    {
                      label: "Platform Fees (24h)",
                      value: `✦ ${creditData.stats.totalPlatformFees.toFixed(2)}`,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="bg-white border-4 border-ink p-4 text-center shadow-pop"
                    >
                      <div className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-1">
                        {s.label}
                      </div>
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
                            <th
                              key={h}
                              className="text-left px-4 py-2 font-bold uppercase tracking-wide"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {creditData.transactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-ink/10 hover:bg-ink/5">
                            <td className="px-4 py-2 text-ink/50">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 font-bold">@{tx.username}</td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-0.5 border font-bold uppercase ${tx.type === "platform_fee" ? "border-ink/20 bg-ink/5 text-ink/50" : "border-ink bg-accent-yellow"}`}
                              >
                                {TYPE_LABELS[tx.type] ?? tx.type}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-2 font-bold ${tx.amount >= 0 ? "text-green-600" : "text-magenta"}`}
                            >
                              {tx.amount >= 0 ? "+" : ""}
                              {tx.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-ink/50 truncate max-w-[200px]">
                              {tx.note ?? "—"}
                            </td>
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

        {activeTab === "queue" &&
          (listings.length === 0 ? (
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
          </div>
        </div>
      </main>
    </div>
  );
}

type Metrics = Awaited<ReturnType<typeof getDashboardMetrics>>;

const STATUS_COLORS: Record<string, string> = {
  published: "#16a34a",
  flagged: "#ff6600",
  removed: "#0a0a0c",
  draft: "#ffcc00",
  hidden: "#9d00ff",
};

function DashboardOverview({ metrics }: { metrics: Metrics }) {
  const revSeries = metrics.series.revenueDaily.map((d) => d.value);
  const signupSeries = metrics.series.signupsDaily.map((d) => d.value);
  const listingSeries = metrics.series.listingsDaily.map((d) => d.value);
  const sumSignups = signupSeries.reduce((s, v) => s + v, 0);
  const sumListings = listingSeries.reduce((s, v) => s + v, 0);

  const statusSegments = metrics.listingStatus.map((s) => ({
    label: s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] ?? "#9d00ff",
  }));

  const splitSegments = [
    { label: "Authors", value: metrics.revenueSplit.authorEarnings, color: "#d400ff" },
    { label: "Platform", value: metrics.revenueSplit.platformFees, color: "#ffcc00" },
  ];
  const splitTotal = metrics.revenueSplit.authorEarnings + metrics.revenueSplit.platformFees;

  return (
    <div className="space-y-6">
      {/* Hero + headline stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-magenta text-white border-4 border-ink p-5 shadow-pop flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Platform pulse</p>
            <p className="font-display text-2xl uppercase mt-2 leading-none">Welcome back ✨</p>
          </div>
          <div className="mt-4">
            <div className="font-display text-4xl leading-none">✦ {metrics.revenue.total30d.toFixed(0)}</div>
            <p className="text-xs font-bold uppercase opacity-80 mt-1">Revenue · last 30 days</p>
          </div>
        </div>
        <StatCard
          label="Revenue (30d)"
          value={`✦ ${metrics.revenue.total30d.toFixed(2)}`}
          icon="💰"
          series={revSeries}
          delta={trendPct(metrics.series.revenueDaily)}
          shadowClass="shadow-pop-magenta"
        />
        <StatCard
          label="New users (14d)"
          value={String(sumSignups)}
          icon="👥"
          series={signupSeries}
          seriesColor="#9d00ff"
          delta={trendPct(metrics.series.signupsDaily)}
          shadowClass="shadow-pop-purple"
        />
        <StatCard
          label="New listings (14d)"
          value={String(sumListings)}
          icon="📝"
          series={listingSeries}
          seriesColor="#ff6600"
          delta={trendPct(metrics.series.listingsDaily)}
          shadowClass="shadow-pop-orange"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue (24h)" value={`✦ ${metrics.revenue.total24h.toFixed(2)}`} />
        <StatCard label="Active buyers (24h)" value={String(metrics.users.activeBuyers24h)} />
        <StatCard label="Total users" value={String(metrics.users.totalUsers)} />
        <StatCard
          label="Avg rating"
          value={metrics.health.reviewCount > 0 ? `${metrics.health.averageRating.toFixed(1)} ★` : "—"}
        />
      </div>

      {/* Revenue bar + listing-health donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border-4 border-ink shadow-pop p-5 min-w-0">
          <h3 className="font-display text-xl uppercase mb-4">Revenue · last 14 days</h3>
          <BarChart
            data={metrics.series.revenueDaily.map((d) => ({ label: dayLabel(d.date), value: d.value }))}
            height={220}
          />
        </div>
        <div className="bg-white border-4 border-ink shadow-pop p-5">
          <h3 className="font-display text-xl uppercase mb-4">Listing health</h3>
          <div className="flex flex-col items-center">
            <DonutChart
              segments={statusSegments}
              size={180}
              centerValue={String(metrics.content.totalListings)}
              centerLabel="Listings"
            />
            <ul className="mt-4 w-full space-y-1 text-xs font-bold uppercase">
              {statusSegments.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className="size-3 border border-ink shrink-0" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <span className="ml-auto text-ink/60">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Revenue split donut + content health stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border-4 border-ink shadow-pop p-5 flex flex-col items-center">
          <h3 className="font-display text-xl uppercase mb-4 self-start">Revenue split (30d)</h3>
          <DonutChart
            segments={splitSegments}
            size={180}
            centerValue={`✦ ${splitTotal.toFixed(0)}`}
            centerLabel="Total"
          />
          <ul className="mt-4 w-full space-y-1 text-xs font-bold uppercase">
            {splitSegments.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className="size-3 border border-ink shrink-0" style={{ background: s.color }} />
                <span>{s.label}</span>
                <span className="ml-auto text-ink/60">✦ {s.value.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
          <StatCard
            label="Flagged listings"
            value={String(metrics.content.flaggedListings)}
            icon="⚠️"
            shadowClass={metrics.content.flaggedListings > 0 ? "shadow-pop-orange" : "shadow-pop"}
          />
          <StatCard label="Pending reports" value={String(metrics.content.pendingReports)} icon="⚡" />
          <StatCard label="Active creators (24h)" value={String(metrics.users.activeCreators24h)} />
          <StatCard label="Platform fees (24h)" value={`✦ ${metrics.revenue.platformFees24h.toFixed(2)}`} />
        </div>
      </div>
    </div>
  );
}
