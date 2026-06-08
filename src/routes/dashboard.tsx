import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { COLLECTIONS, PROMPTS } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
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

const sidebarLinks = [
  { label: "Collections", icon: "📚", to: "/dashboard" as const, active: true },
  { label: "All Saved", icon: "⭐", to: "/dashboard" as const, count: PROMPTS.length },
  { label: "Purchased", icon: "💎", to: "/dashboard" as const, count: 4 },
  { label: "My Studio", icon: "🎨", to: "/profile" as const },
  { label: "Settings", icon: "⚙️", to: "/profile" as const },
];

function Dashboard() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          <aside className="col-span-12 md:col-span-3">
            <div className="bg-ink text-white p-5 border-4 border-magenta sticky top-24">
              <div className="flex items-center gap-3 pb-4 border-b-2 border-white/10">
                <div className="size-12 rounded-full bg-magenta border-2 border-white flex items-center justify-center text-2xl">
                  ✨
                </div>
                <div>
                  <div className="font-display uppercase text-sm">Senpai</div>
                  <div className="text-xs text-white/50">Prompt Collector</div>
                </div>
              </div>
              <nav className="mt-4 space-y-1">
                {sidebarLinks.map((l, i) => (
                  <Link
                    key={i}
                    to={l.to}
                    className={`flex items-center justify-between px-3 py-2 font-bold uppercase text-xs tracking-wider transition-colors ${
                      l.active ? "bg-magenta text-white" : "text-white/80 hover:bg-white/5 hover:text-magenta"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{l.icon}</span>
                      {l.label}
                    </span>
                    {l.count !== undefined && (
                      <span className="text-[10px] font-mono opacity-70">{l.count}</span>
                    )}
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
              <button className="bg-accent-orange text-white px-5 py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all whitespace-nowrap">
                + New Collection
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-10">
              {[
                { label: "Collections", value: COLLECTIONS.length, color: "magenta" as const },
                { label: "Prompts", value: PROMPTS.length, color: "orange" as const },
                { label: "This week", value: "+4", color: "yellow" as const },
              ].map((s) => (
                <div key={s.label} className={`bg-white border-2 border-ink p-4 ${colorMap[s.color].shadow}`}>
                  <div className="text-xs font-bold uppercase tracking-widest text-ink/60">{s.label}</div>
                  <div className={`font-display text-4xl ${colorMap[s.color].text}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Collections grid */}
            <h2 className="font-display text-2xl uppercase mb-5 border-b-4 border-ink pb-2">Your Collections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {COLLECTIONS.map((c, i) => {
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
                              {c.vibe}
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

              <button className="border-2 border-dashed border-ink p-5 min-h-[230px] flex flex-col items-center justify-center hover:border-magenta hover:text-magenta transition-colors">
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
          </section>
        </div>
      </main>
    </div>
  );
}
