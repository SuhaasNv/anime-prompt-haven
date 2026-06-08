import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { getCollection, PROMPTS } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/collection/$id")({
  loader: ({ params }) => {
    const collection = getCollection(params.id);
    if (!collection) throw notFound();
    return { collection: collection! };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.collection.name} — My Binder` },
            { name: "description", content: loaderData.collection.vibe },
          ],
        }
      : {},
  component: CollectionDetail,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-5xl uppercase text-magenta">Collection not found</h1>
        <Link to="/dashboard" className="mt-4 inline-block underline font-bold">Back to binder</Link>
      </div>
    </div>
  ),
  errorComponent: () => <div className="p-10">Something glitched.</div>,
});

const colorMap = {
  magenta: { bg: "bg-magenta", border: "border-magenta", shadow: "shadow-pop-magenta" },
  yellow: { bg: "bg-accent-yellow", border: "border-accent-yellow", shadow: "shadow-pop-yellow" },
  orange: { bg: "bg-accent-orange", border: "border-accent-orange", shadow: "shadow-pop-orange" },
  purple: { bg: "bg-holo-purple", border: "border-holo-purple", shadow: "shadow-pop-purple" },
} as const;

function CollectionDetail() {
  const { collection } = Route.useLoaderData();
  const prompts = collection.promptIds
    .map((id) => PROMPTS.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const colors = colorMap[collection.color];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <Link to="/dashboard" className="inline-block text-sm font-bold uppercase tracking-wider mb-6 hover:text-magenta transition-colors">
          ← Back to Binder
        </Link>

        <div className={`bg-white border-4 border-ink p-8 ${colors.shadow} mb-10`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-ink/60">{collection.vibe}</div>
              <h1 className="font-display text-5xl md:text-7xl uppercase leading-none mt-2">
                {collection.name}
              </h1>
              <p className="mt-3 font-mono text-sm">{prompts.length} prompts saved</p>
            </div>
            <div className="flex gap-3">
              <button className="bg-white text-ink px-4 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm">
                Share
              </button>
              <button className={`${colors.bg} text-ink px-4 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm`}>
                Edit Vibe
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prompts.map((p) => (
            <Link
              key={p.id}
              to="/prompt/$id"
              params={{ id: p.id }}
              className="block bg-white border-2 border-ink p-4 hover:rotate-[-1deg] hover:shadow-pop transition-all"
            >
              <div className="flex gap-4">
                <img src={p.image} alt={p.title} loading="lazy" className="size-24 object-cover border-2 border-ink shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold uppercase truncate">{p.title}</h3>
                  <p className="text-xs text-ink/60 mt-1 line-clamp-2">{p.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold uppercase">@{p.creator}</span>
                    <span className="text-xs text-accent-orange font-bold">★ {p.rating}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t-2 border-dashed border-ink/20 flex justify-between items-center">
                <span className="text-xs font-mono uppercase text-ink/60">Saved 2d ago</span>
                <div className="flex gap-1">
                  <span className="px-2 py-0.5 bg-accent-yellow border border-ink text-[10px] font-bold uppercase">Copy</span>
                  <span className="px-2 py-0.5 bg-white border border-ink text-[10px] font-bold uppercase">Edit</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
