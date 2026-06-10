import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { PromptCard } from "@/components/PromptCard";
import {
  getTrendingTags,
  getFeaturedCreators,
  getNewArrivals,
  getTrendingPrompts,
} from "@/lib/api/explore.functions";
import { listListings, MODEL_VALUES } from "@/lib/api/listings.functions";
import { MASCOTS } from "@/lib/mascots";
import type { Prompt } from "@/lib/mock-data";

export const Route = createFileRoute("/explore")({
  loader: async () => {
    const [trendingTags, featuredCreators, newArrivals, trendingPrompts] = await Promise.all([
      getTrendingTags({ data: { limit: 12 } }),
      getFeaturedCreators({ data: { limit: 6 } }),
      getNewArrivals({ data: { limit: 8 } }),
      getTrendingPrompts({ data: { limit: 8 } }),
    ]);
    return { trendingTags, featuredCreators, newArrivals, trendingPrompts };
  },
  head: () => ({
    meta: [
      { title: "Explore — PromptStar" },
      { name: "description", content: "Discover trending tags, featured creators, and new prompts on PromptStar." },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const { trendingTags, featuredCreators, newArrivals, trendingPrompts } = Route.useLoaderData();
  const [activeModel, setActiveModel] = useState<(typeof MODEL_VALUES)[number] | null>(null);
  const [modelResults, setModelResults] = useState<Prompt[]>([]);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  useEffect(() => {
    if (!activeModel) {
      setModelResults([]);
      return;
    }
    let cancelled = false;
    setIsLoadingModel(true);
    listListings({ data: { model: activeModel, sort: "newest", limit: 8 } })
      .then((results) => {
        if (!cancelled) setModelResults(results);
      })
      .catch((err) => {
        console.error("Failed to fetch listings by model", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingModel(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeModel]);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="relative z-10 px-6 md:px-12 py-12">
        {/* Hero */}
        <section className="mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-[14vw] md:text-[8vw] leading-[0.85] uppercase text-ink italic"
          >
            EXPLORE THE <span className="text-magenta">MULTIVERSE</span>
          </motion.h1>
          <p className="mt-6 max-w-xl text-base text-ink/70 font-medium">
            Trending tags, top creators, and the freshest drops — all in one place.
          </p>
        </section>

        {/* Trending Tags */}
        {trendingTags.length > 0 && (
          <section className="mb-16">
            <h2 className="font-display text-3xl uppercase mb-5 border-b-4 border-ink pb-2">
              Trending Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  to="/"
                  search={{ tag }}
                  className="px-4 py-1.5 font-bold rounded-full text-xs border-2 border-ink bg-white text-ink hover:bg-accent-yellow transition-all"
                >
                  {tag} <span className="text-ink/40">({count})</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Creators */}
        {featuredCreators.length > 0 && (
          <section className="mb-16">
            <h2 className="font-display text-3xl uppercase mb-5 border-b-4 border-ink pb-2">
              Featured Creators
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {featuredCreators.map((creator) => (
                <Link
                  key={creator.id}
                  to="/u/$username"
                  params={{ username: creator.username }}
                  className="group bg-white border-2 border-ink p-4 text-center shadow-pop hover:shadow-pop-magenta transition-all"
                >
                  <img
                    src={MASCOTS[creator.mascot].image}
                    alt=""
                    width={64}
                    height={64}
                    className="size-16 mx-auto border-2 border-ink rounded-full bg-accent-yellow object-contain"
                  />
                  <div className="font-bold uppercase text-xs mt-2 truncate group-hover:text-magenta">
                    @{creator.username}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* New Arrivals */}
        {newArrivals.length > 0 && (
          <section className="mb-16">
            <h2 className="font-display text-3xl uppercase mb-5 border-b-4 border-ink pb-2">
              New Arrivals
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {newArrivals.map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
            </div>
          </section>
        )}

        {/* Trending Now */}
        {trendingPrompts.length > 0 && (
          <section className="mb-16">
            <h2 className="font-display text-3xl uppercase mb-5 border-b-4 border-ink pb-2">
              Trending Now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {trendingPrompts.map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
            </div>
          </section>
        )}

        {/* Filter by Model */}
        <section>
          <h2 className="font-display text-3xl uppercase mb-5 border-b-4 border-ink pb-2">
            Filter by Model
          </h2>
          <div className="flex flex-wrap gap-0 mb-8">
            {MODEL_VALUES.map((model) => {
              const active = activeModel === model;
              return (
                <button
                  key={model}
                  onClick={() => setActiveModel(active ? null : model)}
                  className={`px-5 py-2.5 font-bold uppercase text-xs border-2 border-ink whitespace-nowrap transition-all ${
                    active ? "bg-ink text-white" : "bg-white text-ink hover:bg-accent-orange hover:text-white"
                  }`}
                >
                  {model}
                </button>
              );
            })}
          </div>

          {activeModel && (
            isLoadingModel ? (
              <p className="text-sm font-bold uppercase text-ink/60 animate-pulse">Loading…</p>
            ) : modelResults.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-ink">
                <p className="font-display text-2xl uppercase text-ink/40">No prompts found</p>
                <p className="text-sm text-ink/60 mt-2">No published prompts for {activeModel} yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {modelResults.map((p) => (
                  <PromptCard key={p.id} prompt={p} />
                ))}
              </div>
            )
          )}
        </section>
      </main>
    </div>
  );
}
