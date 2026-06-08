import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { PromptCard } from "@/components/PromptCard";
import { listListings } from "@/lib/api/listings.functions";
import { CATEGORIES, COLLECTIONS, PROMPTS, TAGS } from "@/lib/mock-data";
import { MASCOTS, type MascotKey } from "@/lib/mascots";

const MASCOT_KEYS = Object.keys(MASCOTS) as MascotKey[];

export const Route = createFileRoute("/")({
  loader: async () => {
    const listings = await listListings();
    return { listings };
  },
  head: () => ({
    meta: [
      { title: "PromptStar — AI Image Prompt Marketplace" },
      { name: "description", content: "Discover image-generation prompts in every style — for Midjourney, Stable Diffusion, DALL-E, Flux and more." },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const { listings } = Route.useLoaderData();
  const allPrompts = useMemo(() => [...listings, ...PROMPTS], [listings]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  // Picked client-side (post-mount) so the server-rendered markup never has to
  // guess — guarantees the choice matches what the visitor actually sees and
  // sidesteps any hydration mismatch from randomizing during render.
  const [heroMascot, setHeroMascot] = useState<MascotKey | null>(null);
  useEffect(() => {
    setHeroMascot(MASCOT_KEYS[Math.floor(Math.random() * MASCOT_KEYS.length)]);
  }, []);

  const filtered = useMemo(
    () =>
      allPrompts.filter((p) => {
        if (category !== "All" && p.category !== category) return false;
        if (activeTag && !p.tags.includes(activeTag)) return false;
        if (query && !`${p.title} ${p.description} ${p.creator}`.toLowerCase().includes(query.toLowerCase()))
          return false;
        return true;
      }),
    [allPrompts, query, category, activeTag],
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="relative z-10 px-6 md:px-12 py-12">
        {/* Hero */}
        <section className="relative mb-16">
          {heroMascot && (
            <motion.div
              aria-hidden="true"
              className="hidden lg:block absolute right-20 xl:right-32 top-24 xl:top-28 pointer-events-none select-none"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={
                reduceMotion
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 1, scale: 1, y: [0, -16, 0], rotate: [0, -3, 3, 0] }
              }
              transition={
                reduceMotion
                  ? { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
                  : {
                      opacity: { duration: 0.6 },
                      scale: { duration: 0.6 },
                      y: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
                      rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                    }
              }
            >
              <div className="absolute inset-0 bg-magenta/30 blur-3xl rounded-full" />
              <img
                src={MASCOTS[heroMascot].image}
                alt=""
                width={420}
                height={420}
                className="relative z-10 size-[22rem] xl:size-[26rem] object-contain drop-shadow-[8px_8px_0_rgba(0,0,0,1)]"
              />
            </motion.div>
          )}

          <div className="relative">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[14vw] md:text-[10vw] leading-[0.85] uppercase text-ink italic"
            >
              ULTRA <br />
              <span className="text-magenta">GLOSS</span> ENERGY
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, scale: 0, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 12 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="absolute -top-4 right-2 md:right-12 bg-accent-yellow border-2 border-ink p-3 md:p-4 shadow-pop"
            >
              <span className="font-display text-xl md:text-2xl">NEW DROPS!</span>
            </motion.div>
          </div>

          <p className="mt-6 max-w-xl text-base text-ink/70 font-medium">
            Image-generation prompts in every style, sorted by vibe. Browse the multiverse, save your
            favorites, and build collections that hit different.
          </p>

          <div className="mt-10 max-w-2xl">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="SEARCH THE MULTIVERSE..."
                className="w-full bg-white border-4 border-ink p-6 font-bold text-lg placeholder:text-ink/30 focus:outline-none focus:ring-4 focus:ring-magenta/30"
              />
              <button
                aria-label="Search"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-magenta text-white p-3 border-2 border-ink hover:bg-holo-purple transition-colors"
              >
                <div className="size-5 border-2 border-white rounded-full" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {TAGS.map((tag) => {
                const active = activeTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(active ? null : tag)}
                    className={`px-4 py-1.5 font-bold rounded-full text-xs border-2 border-ink transition-all ${
                      active
                        ? "bg-magenta text-white shadow-[3px_3px_0_0_#0a0a0c]"
                        : "bg-white text-ink hover:bg-accent-yellow"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Categories strip */}
        <section className="mb-10 -mx-6 px-6 overflow-x-auto">
          <div className="flex gap-2 min-w-min">
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 font-bold uppercase text-xs border-2 border-ink whitespace-nowrap transition-all ${
                    active
                      ? "bg-ink text-white shadow-[3px_3px_0_0_#d400ff]"
                      : "bg-white text-ink hover:bg-accent-orange hover:text-white"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-12 gap-10">
          {/* Marketplace grid */}
          <div className="col-span-12 lg:col-span-8">
            <div className="flex justify-between items-end mb-8 border-b-4 border-ink pb-2">
              <h2 className="font-display text-3xl md:text-4xl uppercase">Trending Prompts</h2>
              <span className="font-bold text-magenta text-sm">{filtered.length} RESULTS</span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-ink">
                <p className="font-display text-2xl uppercase text-ink/40">No prompts found</p>
                <p className="text-sm text-ink/60 mt-2">Try a different vibe.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filtered.map((p) => (
                  <PromptCard key={p.id} prompt={p} />
                ))}
              </div>
            )}
          </div>

          {/* Dashboard preview sidebar */}
          <aside className="col-span-12 lg:col-span-4">
            <div className="bg-ink text-white p-7 border-4 border-magenta sticky top-24">
              <h2 className="font-display text-2xl uppercase mb-6 flex items-center gap-3">
                <span className="size-4 bg-magenta animate-pulse" />
                My Binder
              </h2>

              <div className="space-y-5">
                {COLLECTIONS.map((c) => {
                  const colorMap = {
                    magenta: { text: "text-magenta", bg: "bg-magenta" },
                    yellow: { text: "text-accent-yellow", bg: "bg-accent-yellow" },
                    orange: { text: "text-accent-orange", bg: "bg-accent-orange" },
                    purple: { text: "text-holo-purple", bg: "bg-holo-purple" },
                  } as const;
                  const colors = colorMap[c.color];
                  return (
                    <div key={c.id} className="group cursor-pointer">
                      <div className="flex justify-between items-end mb-2">
                        <span className={`font-bold uppercase tracking-widest text-sm ${colors.text}`}>
                          {c.name}
                        </span>
                        <span className="text-xs font-mono">
                          {String(c.promptIds.length).padStart(2, "0")} ITEMS
                        </span>
                      </div>
                      <div className="h-3 w-full bg-white/10 overflow-hidden border border-white/20">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${c.progress}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                          className={`h-full ${colors.bg}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <a
                href="/dashboard"
                className="block text-center w-full mt-8 py-3 border-2 border-white font-bold uppercase hover:bg-white hover:text-ink transition-all"
              >
                Enter Private Vault
              </a>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-white py-12 px-6 mt-20 border-t-8 border-magenta">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="font-display text-4xl uppercase italic">PROMPT STAR</div>
        <div className="flex gap-8 font-bold uppercase text-xs tracking-[0.2em]">
          <a href="#" className="hover:text-magenta transition-colors">Terms</a>
          <a href="#" className="hover:text-magenta transition-colors">Discord</a>
          <a href="#" className="hover:text-magenta transition-colors">Twitter</a>
        </div>
        <div className="text-white/40 text-xs font-mono">© 2026 NEON BINDER CORP.</div>
      </div>
    </footer>
  );
}
