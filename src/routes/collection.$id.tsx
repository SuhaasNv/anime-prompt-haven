import { createFileRoute, Link, notFound, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Switch } from "@/components/ui/switch";
import { CURRENT_USER_QUERY_KEY, getCurrentUser } from "@/lib/api/auth.functions";
import {
  addPromptToCollection,
  removePromptFromCollection,
  deleteCollection,
  listCollections,
  getPublicCollection,
  toggleCollectionVisibility,
} from "@/lib/api/collections.functions";
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

export const Route = createFileRoute("/collection/$id")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: getCurrentUser,
      staleTime: 60_000,
    });
    return { user };
  },
  loader: async ({ params, context }) => {
    try {
      // Public collections are viewable by anyone, including the owner.
      const publicCollection = await getPublicCollection({ data: { id: params.id } });
      if (publicCollection) {
        const resolvedPrompts = await Promise.all(
          publicCollection.promptIds.map((id) => resolvePrompt(id))
        );
        const prompts = resolvedPrompts.filter((p): p is Prompt => p !== null);
        return {
          collection: publicCollection,
          prompts,
          isOwner: context.user?.id === publicCollection.userId,
        };
      }

      // Not public (or doesn't exist) — fall back to the owner-only path.
      if (!context.user) {
        throw redirect({ to: "/auth" });
      }

      const collections = await listCollections();
      const collection = collections.find((c) => c.id === params.id);
      if (!collection) {
        console.warn(`Collection not found: ${params.id}`);
        throw notFound();
      }

      // Resolve all prompts in the collection (from both DB and mock data)
      const resolvedPrompts = await Promise.all(
        collection.promptIds.map((id) => resolvePrompt(id))
      );
      // Filter out null values (deleted prompts)
      const prompts = resolvedPrompts.filter((p): p is Prompt => p !== null);

      return {
        collection: { ...collection, userId: context.user.id, username: context.user.username },
        prompts,
        isOwner: true,
      };
    } catch (error) {
      console.error("Error loading collection:", error);
      throw error;
    }
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
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10 flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <h1 className="font-display text-5xl uppercase text-magenta mb-4">Collection Not Found</h1>
          <p className="text-ink/60 mb-6">This collection no longer exists or you don't have access to it.</p>
          <Link to="/dashboard" className="inline-block bg-magenta text-white px-6 py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all">
            ← Back to Binder
          </Link>
        </div>
      </main>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10 flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <h1 className="font-display text-5xl uppercase text-magenta mb-4">⚠️ Something Went Wrong</h1>
          <p className="text-ink/60 mb-2">Error: {error?.message || "Unknown error"}</p>
          <p className="text-sm text-ink/50 mb-6 font-mono">{error?.stack}</p>
          <Link to="/dashboard" className="inline-block bg-magenta text-white px-6 py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all">
            ← Back to Binder
          </Link>
        </div>
      </main>
    </div>
  ),
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
  const router = useRouter();
  const { collection, prompts, isOwner } = Route.useLoaderData();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [deletingCol, setDeletingCol] = useState(false);
  const [isPublic, setIsPublic] = useState(collection.isPublic);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [copied, setCopied] = useState(false);
  const colors = colorMap[collection.color];

  const handleRemovePrompt = async (promptId: string) => {
    setRemoving(promptId);
    try {
      await removePromptFromCollection({ data: { collectionId: collection.id, promptId } });
      await router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove prompt");
    } finally {
      setRemoving(null);
    }
  };

  const handleDeleteCollection = async () => {
    if (!confirm(`Delete "${collection.name}"? This cannot be undone.`)) return;
    setDeletingCol(true);
    try {
      await deleteCollection({ data: { id: collection.id } });
      await router.navigate({ to: "/dashboard" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete collection");
      setDeletingCol(false);
    }
  };

  const handleToggleVisibility = async () => {
    setTogglingVisibility(true);
    try {
      const result = await toggleCollectionVisibility({ data: { id: collection.id } });
      setIsPublic(result.isPublic);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update visibility");
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
              {!isOwner && (
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/60">
                  by{" "}
                  <Link to="/u/$username" params={{ username: collection.username }} className="text-magenta hover:underline">
                    @{collection.username}
                  </Link>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-3">
              {isOwner && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">{isPublic ? "🌐 Public" : "🔒 Private"}</span>
                  <Switch checked={isPublic} disabled={togglingVisibility} onCheckedChange={handleToggleVisibility} />
                </div>
              )}
              {isPublic && (
                <button
                  onClick={handleCopyLink}
                  className="bg-white text-ink px-4 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              )}
              {isOwner && (
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteCollection}
                    disabled={deletingCol}
                    className="bg-magenta text-white px-4 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm disabled:opacity-50"
                  >
                    {deletingCol ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    onClick={() => setAdding((v) => !v)}
                    className={`${colors.bg} text-ink px-4 py-2 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm`}
                  >
                    {adding ? "Hide picker" : "+ Add prompts"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isOwner && adding && (
          <AddPromptPicker collectionId={collection.id} savedIds={collection.promptIds} onClose={() => setAdding(false)} />
        )}

        {prompts.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-ink">
            <div className="text-5xl mb-3">📚</div>
            <p className="font-display text-2xl uppercase text-ink/40">Empty Collection</p>
            {isOwner ? (
              <>
                <p className="text-sm text-ink/60 mt-3 mb-6">Add your saved prompts to get started.</p>
                <button
                  onClick={() => setAdding(true)}
                  className={`${colors.bg} text-ink px-6 py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all`}
                >
                  + Add Prompts Now
                </button>
              </>
            ) : (
              <p className="text-sm text-ink/60 mt-3">This collection has no prompts yet.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prompts.map((p) => (
              <div key={p.id} className="relative bg-white border-2 border-ink hover:shadow-pop transition-all">
                <Link to="/prompt/$id" params={{ id: p.id }} className="block p-4">
                  <div className="flex gap-4">
                    <img src={p.image} alt={p.title} loading="lazy" className="size-24 object-cover border-2 border-ink shrink-0" />
                    <div className="min-w-0 flex-1 pr-6">
                      <h3 className="font-bold uppercase truncate">{p.title}</h3>
                      <p className="text-xs text-ink/60 mt-1 line-clamp-2">{p.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-bold uppercase">@{p.creator}</span>
                        <span className="text-xs text-accent-orange font-bold">★ {p.rating}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t-2 border-dashed border-ink/20">
                    <span className="text-xs font-mono uppercase text-ink/60">Saved to binder</span>
                  </div>
                </Link>
                {isOwner && (
                  <button
                    onClick={() => handleRemovePrompt(p.id)}
                    disabled={removing === p.id}
                    title="Remove from collection"
                    className="absolute top-3 right-3 size-7 flex items-center justify-center bg-white border-2 border-ink text-magenta font-bold text-xs hover:bg-magenta hover:text-white transition-colors disabled:opacity-50"
                  >
                    {removing === p.id ? "…" : "✕"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
