import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ContributeModal } from "@/components/ContributeModal";
import { PromptCard } from "@/components/PromptCard";
import { CURRENT_USER_QUERY_KEY, getCurrentUser } from "@/lib/api/auth.functions";
import { createCollection, listCollections } from "@/lib/api/collections.functions";
import { PROMPTS } from "@/lib/mock-data";

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

const PURCHASED_PROMPTS = PROMPTS.filter((p) => p.price > 0);

// Local view-tabs switch which section of the binder is shown below — they
// stay on /dashboard rather than navigating, so each needs an explicit
// onClick + active-state instead of relying on router link matching.
const DASHBOARD_VIEWS = [
  { id: "collections", label: "Collections", icon: "📚" },
  { id: "saved", label: "All Saved", icon: "⭐", count: PROMPTS.length },
  { id: "purchased", label: "Purchased", icon: "💎", count: PURCHASED_PROMPTS.length },
] as const;

type DashboardView = (typeof DASHBOARD_VIEWS)[number]["id"];

const profileLinks = [
  { label: "My Studio", icon: "🎨" },
  { label: "Settings", icon: "⚙️" },
] as const;

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
    <form onSubmit={handleSubmit} className="border-2 border-dashed border-ink p-5 min-h-[230px] flex flex-col justify-center gap-3">
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
  const { user, collections } = Route.useLoaderData();
  const [creating, setCreating] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("collections");

  return (
    <div className="min-h-screen">
      <Navbar />
      <ContributeModal open={contributing} onClose={() => setContributing(false)} />
      <main className="relative z-10 px-6 md:px-12 py-10">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3">
            <div className="bg-ink text-white p-5 border-4 border-magenta sticky top-24">
              <div className="flex items-center gap-3 pb-4 border-b-2 border-white/10">
                <div className="size-12 rounded-full bg-magenta border-2 border-white flex items-center justify-center text-2xl">
                  ✨
                </div>
                <div>
                  <div className="font-display uppercase text-sm">{user.username}</div>
                  <div className="text-xs text-white/50">Prompt Collector</div>
                </div>
              </div>
              <nav className="mt-4 space-y-1">
                {DASHBOARD_VIEWS.map((v) => {
                  const active = activeView === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setActiveView(v.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 font-bold uppercase text-xs tracking-wider transition-colors ${
                        active ? "bg-magenta text-white" : "text-white/80 hover:bg-white/5 hover:text-magenta"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{v.icon}</span>
                        {v.label}
                      </span>
                      {"count" in v && (
                        <span className="text-[10px] font-mono opacity-70">{v.count}</span>
                      )}
                    </button>
                  );
                })}

                <div className="!mt-3 !mb-1 border-t border-white/10" />

                {profileLinks.map((l) => (
                  <Link
                    key={l.label}
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-2 font-bold uppercase text-xs tracking-wider text-white/80 hover:bg-white/5 hover:text-magenta transition-colors"
                    activeProps={{ className: "!bg-magenta !text-white" }}
                  >
                    <span className="text-base">{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
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
                { label: "Prompts", value: PROMPTS.length, color: "orange" as const },
                { label: "This week", value: "+4", color: "yellow" as const },
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
                    <Link to="/dashboard/collection/$id" params={{ id: c.id }} className="block group">
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

              {creating ? (
                <NewCollectionForm onClose={() => setCreating(false)} />
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="border-2 border-dashed border-ink p-5 min-h-[230px] flex flex-col items-center justify-center hover:border-magenta hover:text-magenta transition-colors"
                >
                  <div className="text-5xl">+</div>
                  <div className="font-display uppercase mt-2">New Collection</div>
                </button>
              )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {PROMPTS.map((p) => (
                    <PromptCard key={p.id} prompt={p} />
                  ))}
                </div>
              </>
            )}

            {activeView === "purchased" && (
              <>
                <h2 className="font-display text-2xl uppercase mb-5 border-b-4 border-ink pb-2">Purchased Prompts</h2>
                {PURCHASED_PROMPTS.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-ink">
                    <p className="font-display text-2xl uppercase text-ink/40">Nothing here yet</p>
                    <p className="text-sm text-ink/60 mt-2">Prompts you buy will show up in this tab.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {PURCHASED_PROMPTS.map((p) => (
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
