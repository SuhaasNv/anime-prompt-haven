import { createFileRoute, Link, notFound, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { getCurrentUser } from "@/lib/api/auth.functions";
import { addPromptToCollection, listCollections } from "@/lib/api/collections.functions";
import { getListing } from "@/lib/api/listings.functions";
import { getPrompt, PROMPTS, type Prompt } from "@/lib/mock-data";

// Helper to resolve a prompt ID to a full Prompt object
// Checks if it's a UUID (DB listing) or slug (mock data)
async function resolvePrompt(promptId: string): Promise<Prompt | null> {
  const isUUID = /^[0-9a-f-]{36}$/i.test(promptId);

  if (isUUID) {
    // Try to load from DB
    try {
      return await getListing({ data: { id: promptId } });
    } catch {
      // Listing doesn't exist or was deleted
      return null;
    }
  } else {
    // Fall back to mock data
    return getPrompt(promptId) ?? null;
  }
}

export const Route = createFileRoute("/dashboard/collection/$id")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/auth" });
    }
    return { user };
  },
  loader: async ({ params }) => {
    const collections = await listCollections();
    const collection = collections.find((c) => c.id === params.id);
    if (!collection) throw notFound();

    // Resolve all prompts in the collection (from both DB and mock data)
    const resolvedPrompts = await Promise.all(
      collection.promptIds.map((id) => resolvePrompt(id))
    );
    // Filter out null values (deleted prompts)
    const prompts = resolvedPrompts.filter((p): p is Prompt => p !== null);

    return { collection, prompts };
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

function AddPromptPicker({ collectionId, savedIds, onClose }: { collectionId: string; savedIds: string[]; onClose: () => void }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = PROMPTS.filter((p) => !savedIds.includes(p.id));

  const handleAdd = async (promptId: string) => {
    setError(null);
    setPendingId(promptId);
    try {
      await addPromptToCollection({ data: { collectionId, promptId } });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that prompt.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="bg-white border-4 border-ink p-6 shadow-pop-lg mb-10">
      <div className="flex justify-between items-start mb-4">
        <h2 className="font-display text-2xl uppercase">Add prompts to this collection</h2>
        <button onClick={onClose} className="font-bold uppercase text-xs hover:text-magenta">Close ✕</button>
      </div>
      {error && <p className="text-xs font-bold text-magenta mb-3">{error}</p>}
      {available.length === 0 ? (
        <p className="text-sm text-ink/60">Every prompt is already saved here.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {available.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-2 border-ink p-2">
              <img src={p.image} alt={p.title} loading="lazy" className="size-14 object-cover border-2 border-ink shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold uppercase text-sm truncate">{p.title}</div>
                <div className="text-xs text-ink/60">@{p.creator}</div>
              </div>
              <button
                onClick={() => handleAdd(p.id)}
                disabled={pendingId === p.id}
                className="bg-accent-yellow text-ink px-3 py-1.5 font-display uppercase text-xs border-2 border-ink shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {pendingId === p.id ? "Saving…" : "+ Save"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionDetail() {
  const { collection, prompts } = Route.useLoaderData();
  const [adding, setAdding] = useState(false);
  const colors = colorMap[collection.color];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10">
        <Link to="/dashboard" className="inline-block text-sm font-bold uppercase tracking-wider mb-6 hover:text-magenta transition-colors">
          ← Back to Binder
        </Link>

        <div className={`bg-white border-4 border-ink p-8 ${colors.shadow} mb-10`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-ink/60">{collection.vibe || "No vibe yet"}</div>
              <h1 className="font-display text-5xl md:text-7xl uppercase leading-none mt-2">
                {collection.name}
              </h1>
              <p className="mt-3 font-mono text-sm">{prompts.length} prompts saved</p>
            </div>
            <div className="flex gap-3">
              <button className="bg-white text-ink px-4 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm">
                Share
              </button>
              <button
                onClick={() => setAdding((v) => !v)}
                className={`${colors.bg} text-ink px-4 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm`}
              >
                {adding ? "Hide picker" : "+ Add prompts"}
              </button>
            </div>
          </div>
        </div>

        {adding && (
          <AddPromptPicker collectionId={collection.id} savedIds={collection.promptIds} onClose={() => setAdding(false)} />
        )}

        {prompts.length === 0 ? (
          <p className="text-center text-ink/60 font-medium py-10">No prompts saved here yet — add some above.</p>
        ) : (
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
                  <span className="text-xs font-mono uppercase text-ink/60">Saved to binder</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-accent-yellow border border-ink text-[10px] font-bold uppercase">Copy</span>
                    <span className="px-2 py-0.5 bg-white border border-ink text-[10px] font-bold uppercase">Edit</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
