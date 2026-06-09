import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { computeXP, computeLevel } from "@/lib/gamification";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ContributeModal } from "@/components/ContributeModal";
import { PromptCard } from "@/components/PromptCard";
import { CURRENT_USER_QUERY_KEY, getCurrentUser } from "@/lib/api/auth.functions";
import { createCollection, listCollections } from "@/lib/api/collections.functions";
import { listSavedPrompts } from "@/lib/api/saves.functions";
import { listPurchases } from "@/lib/api/purchases.functions";
import { getMyStats } from "@/lib/api/listings.functions";
import type { GamificationStats } from "@/lib/gamification";
import { PROMPTS } from "@/lib/mock-data";
import type { Prompt } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    // Reuses the Navbar's cached session (same query key/fn) when it's still
    // fresh, instead of firing a second `getCurrentUser` round-trip on every
    // navigation here — that redundant request was the source of the lag.
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: getCurrentUser,
      staleTime: 60_000,
    });
    if (!user) {
      throw redirect({ to: "/auth" });
    }
    return { user };
  },
  loader: async ({ context }) => {
    const collections = await listCollections();
    return { user: context.user, collections };
  },
  head: () => ({
    meta: [
      { title: "My Binder — PromptStar" },
      { name: "description", content: "Your private vault of saved AI prompts and collections." },
    ],
  }),
  component: Dashboard,
});

const colorMap = {
  magenta: { bg: "bg-magenta", text: "text-magenta", shadow: "shadow-pop-magenta" },
  yellow: { bg: "bg-accent-yellow", text: "text-accent-yellow", shadow: "shadow-pop-yellow" },
  orange: { bg: "bg-accent-orange", text: "text-accent-orange", shadow: "shadow-pop-orange" },
  purple: { bg: "bg-holo-purple", text: "text-holo-purple", shadow: "shadow-pop-purple" },
} as const;

// Local view-tabs switch which section of the binder is shown below — they
// stay on /dashboard rather than navigating, so each needs an explicit
// onClick + active-state instead of relying on router link matching.
const DASHBOARD_VIEWS = [
  { id: "collections", label: "Collections", icon: "📚" },
  { id: "saved", label: "All Saved", icon: "⭐" },
  { id: "purchased", label: "Purchased", icon: "💎" },
] as const;

type DashboardView = (typeof DASHBOARD_VIEWS)[number]["id"];


function NewCollectionForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCollection({ data: { name, vibe } });
      await router.invalidate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that collection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-bold uppercase tracking-widest block mb-1">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Magical Girl Arc"
          className="w-full bg-white border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest block mb-1">Vibe (optional)</label>
        <input
          type="text"
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          placeholder="Sparkle bloom and soft pastels"
          className="w-full bg-white border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
        />
      </div>
      {error && <p className="text-xs font-bold text-magenta">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-accent-orange text-white py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 bg-white text-ink py-2 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Dashboard() {
  const router = useRouter();
  const { user, collections } = Route.useLoaderData();
  const [creating, setCreating] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("collections");
  const [savedPrompts, setSavedPrompts] = useState<Prompt[]>([]);
  const [purchasedPrompts, setPurchasedPrompts] = useState<Prompt[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [gamificationStats, setGamificationStats] = useState<GamificationStats>({ listingsCount: 0, salesCount: 0, savesReceived: 0, reviewsWritten: 0 });

  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [saved, purchased, myStats] = await Promise.all([listSavedPrompts(), listPurchases(), getMyStats()]);
        setSavedPrompts(saved);
        setPurchasedPrompts(purchased);
        setGamificationStats({ listingsCount: myStats.listingsCount, salesCount: myStats.salesCount, savesReceived: myStats.savesReceived, reviewsWritten: 0 });
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <ContributeModal open={contributing} onClose={() => setContributing(false)} />
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setCreating(false)} />
          <div className="relative bg-white border-4 border-ink shadow-pop-lg w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b-4 border-ink bg-accent-yellow">
              <h2 className="font-display text-2xl uppercase">New Collection</h2>
              <button onClick={() => setCreating(false)} className="font-bold text-lg hover:text-magenta">✕</button>
            </div>
            <div className="p-5">
              <NewCollectionForm onClose={() => setCreating(false)} />
            </div>
          </div>
        </div>
      )}
      <main className="relative z-10 px-6 md:px-12 py-10">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3">
            <div className="bg-white border-4 border-ink shadow-pop-lg sticky top-24">
              {/* Profile header */}
              {(() => {
                const xp = computeXP(gamificationStats);
                const { level, xpInLevel } = computeLevel(xp);
                return (
                  <div className="p-5 border-b-4 border-ink bg-accent-yellow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-12 rounded-full bg-white border-4 border-ink flex items-center justify-center text-2xl shadow-[3px_3px_0_0_#0a0a0c]">
                        ✨
                      </div>
                      <div>
                        <div className="font-display uppercase text-base leading-none">{user.username}</div>
                        <div className="text-xs font-bold uppercase tracking-widest text-ink/60 mt-0.5">Lv. {level} — Prompt Collector</div>
                      </div>
                    </div>
                    {/* XP progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono font-bold text-ink/60">
                        <span>XP</span>
                        <span>{xpInLevel} / 1000</span>
                      </div>
                      <div className="h-2 bg-white border-2 border-ink overflow-hidden">
                        <div
                          className="h-full bg-magenta transition-all duration-700"
                          style={{ width: `${Math.min((xpInLevel / 1000) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Nav items */}
              <nav className="p-3 space-y-1">
                {DASHBOARD_VIEWS.map((v) => {
                  const active = activeView === v.id;
                  let count: number | null = null;
                  if (v.id === "saved") count = savedPrompts.length;
                  if (v.id === "purchased") count = purchasedPrompts.length;
                  if (v.id === "collections") count = collections.length;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setActiveView(v.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 font-bold uppercase text-xs tracking-wider border-2 transition-all ${
                        active
                          ? "bg-magenta text-white border-ink shadow-[3px_3px_0_0_#0a0a0c] -translate-x-0.5 -translate-y-0.5"
                          : "bg-white text-ink border-transparent hover:border-ink hover:bg-ink/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{v.icon}</span>
                        {v.label}
                      </span>
                      {count !== null && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${active ? "border-white/40 bg-white/20" : "border-ink/20 bg-ink/5"}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <section className="col-span-12 md:col-span-9">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <h1 className="font-display text-5xl md:text-6xl uppercase leading-none">
                  My <span className="text-magenta">Binder</span>
                </h1>
                <p className="mt-2 text-ink/70 font-medium">Your private vault of S-rank prompt drops.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setContributing(true)}
                  className="bg-magenta text-white px-5 py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all whitespace-nowrap"
                >
                  + Contribute
                </button>
                <button
                  onClick={() => setCreating(true)}
                  className="bg-accent-orange text-white px-5 py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all whitespace-nowrap"
                >
                  + New Collection
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-10">
              {[
                { label: "Collections", value: collections.length, color: "magenta" as const },
                { label: "Saved Prompts", value: savedPrompts.length, color: "orange" as const },
                { label: "Purchased", value: purchasedPrompts.length, color: "yellow" as const },
              ].map((s) => (
                <div key={s.label} className={`bg-white border-2 border-ink p-4 ${colorMap[s.color].shadow}`}>
                  <div className="text-xs font-bold uppercase tracking-widest text-ink/60">{s.label}</div>
                  <div className={`font-display text-4xl ${colorMap[s.color].text}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {activeView === "collections" && (
              <>
            {/* Collections grid */}
            <h2 className="font-display text-2xl uppercase mb-5 border-b-4 border-ink pb-2">Your Collections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {collections.map((c, i) => {
                const colors = colorMap[c.color];
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, type: "spring", stiffness: 240, damping: 22 }}
                  >
                    <Link
                      to="/collection/$id"
                      params={{ id: c.id }}
                      className="block group"
                    >
                      <div className={`bg-white border-2 border-ink p-5 ${colors.shadow} hover:rotate-[-1deg] transition-transform`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className={`text-xs font-bold uppercase tracking-widest ${colors.text}`}>
                              {c.vibe || "No vibe yet"}
                            </div>
                            <h3 className="font-display text-2xl uppercase mt-1">{c.name}</h3>
                          </div>
                          <div className={`size-10 ${colors.bg} border-2 border-ink flex items-center justify-center font-display text-xl text-ink`}>
                            {c.name.charAt(0)}
                          </div>
                        </div>

                        <div className="flex -space-x-3 mb-4">
                          {c.promptIds.slice(0, 4).map((pid) => {
                            const p = PROMPTS.find((x) => x.id === pid);
                            return p ? (
                              <img
                                key={pid}
                                src={p.image}
                                alt=""
                                loading="lazy"
                                className="size-12 object-cover border-2 border-ink bg-white"
                              />
                            ) : null;
                          })}
                        </div>

                        <div className="flex justify-between items-center text-xs font-mono uppercase">
                          <span>{c.promptIds.length} prompts</span>
                          <span className={`${colors.text} font-bold`}>OPEN →</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}

              <button
                onClick={() => setCreating(true)}
                className="border-2 border-dashed border-ink p-5 min-h-[230px] flex flex-col items-center justify-center hover:border-magenta hover:text-magenta transition-colors"
              >
                <div className="text-5xl">+</div>
                <div className="font-display uppercase mt-2">New Collection</div>
              </button>
            </div>

            {/* Recent prompts */}
            <h2 className="font-display text-2xl uppercase mt-14 mb-5 border-b-4 border-ink pb-2">Recently Saved</h2>
            <div className="space-y-3">
              {PROMPTS.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to="/prompt/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-4 bg-white border-2 border-ink p-3 hover:bg-accent-yellow hover:translate-x-1 transition-all"
                >
                  <img src={p.image} alt={p.title} loading="lazy" className="size-16 object-cover border-2 border-ink" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold uppercase truncate">{p.title}</div>
                    <div className="text-xs text-ink/60">@{p.creator} · {p.model}</div>
                  </div>
                  <span className="font-display text-magenta">{p.price === 0 ? "FREE" : `$${p.price}`}</span>
                </Link>
              ))}
            </div>
              </>
            )}

            {activeView === "saved" && (
              <>
                <h2 className="font-display text-2xl uppercase mb-5 border-b-4 border-ink pb-2">All Saved Prompts</h2>
                {loadingData ? (
                  <div className="py-16 text-center">
                    <p className="text-ink/60 animate-pulse">Loading your saved prompts…</p>
                  </div>
                ) : savedPrompts.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-ink">
                    <p className="font-display text-2xl uppercase text-ink/40">Nothing saved yet</p>
                    <p className="text-sm text-ink/60 mt-2">Tap the heart icon on prompts you love to save them.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {savedPrompts.map((p) => (
                      <PromptCard key={p.id} prompt={p} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeView === "purchased" && (
              <>
                <h2 className="font-display text-2xl uppercase mb-5 border-b-4 border-ink pb-2">Purchased Prompts</h2>
                {loadingData ? (
                  <div className="py-16 text-center">
                    <p className="text-ink/60 animate-pulse">Loading your purchases…</p>
                  </div>
                ) : purchasedPrompts.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-ink">
                    <p className="font-display text-2xl uppercase text-ink/40">Nothing here yet</p>
                    <p className="text-sm text-ink/60 mt-2">Browse the marketplace to find prompts to purchase.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {purchasedPrompts.map((p) => (
                      <PromptCard key={p.id} prompt={p} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
