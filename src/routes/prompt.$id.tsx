import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { SaveToCollectionModal } from "@/components/SaveToCollectionModal";
import { getPrompt, PROMPTS } from "@/lib/mock-data";

export const Route = createFileRoute("/prompt/$id")({
  loader: ({ params }) => {
    const prompt = getPrompt(params.id);
    if (!prompt) throw notFound();
    return { prompt: prompt! };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.prompt.title} — PromptStar` },
            { name: "description", content: loaderData.prompt.description },
            { property: "og:title", content: loaderData.prompt.title },
            { property: "og:description", content: loaderData.prompt.description },
            { property: "og:image", content: loaderData.prompt.image },
            { name: "twitter:image", content: loaderData.prompt.image },
          ],
        }
      : {},
  component: PromptDetail,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-5xl uppercase text-magenta">Prompt vanished</h1>
        <Link to="/" className="mt-4 inline-block underline font-bold">Back to market</Link>
      </div>
    </div>
  ),
  errorComponent: () => <div className="p-10">Something glitched.</div>,
});

function PromptDetail() {
  const { prompt } = Route.useLoaderData();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);

  const related = PROMPTS.filter((p) => p.id !== prompt.id).slice(0, 3);

  const copy = () => {
    navigator.clipboard.writeText(prompt.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <Link
          to="/"
          className="inline-block text-sm font-bold uppercase tracking-wider mb-6 hover:text-magenta transition-colors"
        >
          ← Back to Market
        </Link>

        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-12 lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="border-4 border-ink shadow-pop-lg bg-white"
            >
              <img
                src={prompt.image}
                alt={prompt.title}
                width={1024}
                height={768}
                className="w-full aspect-[4/3] object-cover"
              />
            </motion.div>

            <div className="mt-8 bg-ink text-white p-6 border-4 border-magenta">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display uppercase text-magenta">The Prompt</span>
                <button
                  onClick={copy}
                  className="bg-accent-yellow text-ink px-3 py-1 border-2 border-white font-bold uppercase text-xs hover:bg-accent-orange hover:text-white transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed text-white/90">
{prompt.body}
              </pre>
            </div>

            <div className="mt-8">
              <h3 className="font-display text-2xl uppercase mb-4 border-b-2 border-ink pb-2">Reviews</h3>
              <div className="space-y-3">
                {[
                  { name: "kiri_arts", text: "Absolutely cinematic. Used it for a whole zine cover.", stars: 5 },
                  { name: "mochi_dev", text: "Color palette is *chef's kiss*. Tweaked slightly for my OC.", stars: 5 },
                  { name: "ryo_3000", text: "Solid base prompt. Needs --ar tweak for portrait.", stars: 4 },
                ].map((r) => (
                  <div key={r.name} className="bg-white border-2 border-ink p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold uppercase text-sm">@{r.name}</span>
                      <span className="text-accent-orange text-sm">{"★".repeat(r.stars)}</span>
                    </div>
                    <p className="text-sm text-ink/80">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-5">
            <div className="sticky top-24">
              <div className="bg-white border-4 border-ink p-6 shadow-pop">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="bg-ink text-white text-[10px] font-bold uppercase px-2 py-1 tracking-widest">
                    {prompt.model}
                  </span>
                  <span className="bg-accent-yellow text-ink text-[10px] font-bold uppercase px-2 py-1 tracking-widest border border-ink">
                    {prompt.category}
                  </span>
                </div>
                <h1 className="font-display text-4xl uppercase leading-tight mb-3">{prompt.title}</h1>
                <p className="text-ink/70 mb-5">{prompt.description}</p>

                <div className="flex items-center gap-3 mb-5 pb-5 border-b-2 border-ink">
                  <div className="size-12 rounded-full bg-ink text-white flex items-center justify-center text-2xl border-2 border-ink">
                    {prompt.creatorEmoji}
                  </div>
                  <div>
                    <div className="font-bold uppercase text-sm">@{prompt.creator}</div>
                    <div className="text-xs text-ink/60">Verified Creator</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-accent-orange font-bold">★ {prompt.rating.toFixed(1)}</div>
                    <div className="text-xs text-ink/60">{prompt.reviews} reviews</div>
                  </div>
                </div>

                <div className="flex items-baseline justify-between mb-5">
                  <span className="font-display text-3xl text-magenta">
                    {prompt.price === 0 ? "FREE" : `$${prompt.price}`}
                  </span>
                  <button
                    onClick={() => setLiked((l) => !l)}
                    aria-label="Favorite"
                    className="text-2xl"
                  >
                    <motion.span
                      key={String(liked)}
                      initial={{ scale: liked ? 0.6 : 1 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 12 }}
                      className="inline-block"
                    >
                      {liked ? "❤️" : "🤍"}
                    </motion.span>
                  </button>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => (prompt.price === 0 ? copy() : setModalOpen(true))}
                    className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                  >
                    {prompt.price === 0 ? (copied ? "Copied! ✨" : "Copy & Use") : `Buy for $${prompt.price}`}
                  </button>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="w-full bg-white text-ink py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                  >
                    Save to Binder
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t-2 border-ink">
                  {prompt.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-bold px-2 py-1 bg-white border-2 border-ink"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-20">
          <h2 className="font-display text-3xl uppercase mb-6 border-b-4 border-ink pb-2">You might also love</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {related.map((p) => (
              <Link
                key={p.id}
                to="/prompt/$id"
                params={{ id: p.id }}
                className="block group"
              >
                <div className="border-2 border-ink overflow-hidden bg-white">
                  <img src={p.image} alt={p.title} loading="lazy" className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="mt-2 flex justify-between items-start">
                  <span className="font-bold uppercase text-sm">{p.title}</span>
                  <span className="text-magenta font-display">{p.price === 0 ? "FREE" : `$${p.price}`}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SaveToCollectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        promptTitle={prompt.title}
      />
    </div>
  );
}
