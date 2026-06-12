import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUser, CURRENT_USER_QUERY_KEY } from "@/lib/api/auth.functions";
import { listCollections, addPromptToCollection, createCollection } from "@/lib/api/collections.functions";

export function SaveToCollectionModal({
  open,
  onClose,
  promptTitle,
  listingId,
}: {
  open: boolean;
  onClose: () => void;
  promptTitle: string;
  listingId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  // Load current user to check auth
  const { data: user } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });

  // Load user's collections
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
    enabled: !!user,
  });

  // Save to collection mutation
  const saveMutation = useMutation({
    mutationFn: (collectionId: string) =>
      addPromptToCollection({ data: { collectionId, promptId: listingId } }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save");
    },
  });

  // Create a new collection inline (no need to leave and come back from the
  // dashboard) and immediately save this prompt into it.
  const createCollectionMutation = useMutation({
    mutationFn: (name: string) => createCollection({ data: { name } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
      setShowCreateForm(false);
      setNewCollectionName("");
      setSelected(result.id);
      saveMutation.mutate(result.id);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Couldn't create that collection.");
    },
  });

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSaved(false);
      setError(null);
      setShowCreateForm(false);
      setNewCollectionName("");
    }
  }, [open]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (open && !user && !isLoading) {
      router.navigate({ to: "/auth" });
      onClose();
    }
  }, [open, user, isLoading, router, onClose]);

  if (!user) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-4 border-ink shadow-pop-lg w-full max-w-md p-6"
          >
            <div className="flex justify-between items-start mb-4 border-b-2 border-ink pb-3">
              <h2 className="font-display text-2xl uppercase leading-tight">Save to Binder</h2>
              <button
                onClick={onClose}
                className="size-8 bg-accent-yellow border-2 border-ink font-bold hover:bg-accent-orange transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-sm font-medium text-ink/70 mb-4 uppercase tracking-wider">
              {promptTitle}
            </p>

            {saved ? (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-10 text-center"
              >
                <div className="text-6xl mb-3">✨</div>
                <p className="font-display text-2xl uppercase text-magenta">Saved!</p>
                <p className="text-sm text-ink/60 mt-2">Added to your collection.</p>
              </motion.div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 bg-magenta/10 border-2 border-magenta text-magenta text-sm font-bold">
                    {error}
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  {isLoading ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-ink/60">Loading collections...</p>
                    </div>
                  ) : collections.length === 0 ? (
                    !showCreateForm && (
                      <div className="text-center py-4">
                        <p className="text-sm text-ink/60">You don't have a binder yet.</p>
                        <p className="text-xs text-ink/50 mt-1">
                          Create one below — we'll save this prompt into it right away.
                        </p>
                      </div>
                    )
                  ) : (
                    collections.map((c) => {
                      const alreadySaved = c.promptIds.includes(listingId);
                      return (
                        <button
                          key={c.id}
                          onClick={() => !alreadySaved && setSelected(c.id)}
                          disabled={alreadySaved}
                          className={`w-full flex items-center justify-between p-3 border-2 border-ink font-bold uppercase text-sm transition-all ${
                            alreadySaved
                              ? "bg-ink/10 text-ink/40 cursor-not-allowed"
                              : selected === c.id
                                ? "bg-magenta text-white shadow-[4px_4px_0_0_#0a0a0c]"
                                : "bg-white hover:bg-accent-yellow"
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className="text-xs font-mono opacity-70">
                            {alreadySaved ? "Already saved here" : `${c.promptIds.length} items`}
                          </span>
                        </button>
                      );
                    })
                  )}
                  {collections.length > 0 &&
                    collections.every((c) => c.promptIds.includes(listingId)) && (
                      <p className="text-xs text-ink/50 text-center pt-1">
                        Already saved to all your binders. Create a new one below to save it
                        somewhere else.
                      </p>
                    )}
                </div>

                {showCreateForm ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = newCollectionName.trim();
                      if (name) createCollectionMutation.mutate(name);
                    }}
                    className="space-y-2 mb-4 p-3 border-2 border-dashed border-ink/30"
                  >
                    <label className="text-xs font-bold uppercase tracking-widest block">
                      New collection name
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      maxLength={60}
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Magical Girl Arc"
                      className="w-full border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={createCollectionMutation.isPending}
                        className="flex-1 bg-magenta text-white py-2 font-display uppercase text-sm border-2 border-ink shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                      >
                        {createCollectionMutation.isPending ? "Creating…" : "Create & Save Here"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        disabled={createCollectionMutation.isPending}
                        className="px-4 bg-white text-ink py-2 font-display uppercase text-sm border-2 border-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="w-full mb-4 p-3 border-2 border-dashed border-ink/30 font-bold uppercase text-sm text-ink/60 hover:border-ink hover:text-ink transition-colors"
                  >
                    + New Collection
                  </button>
                )}

                {collections.length > 0 && !showCreateForm && (
                  <button
                    disabled={!selected || saveMutation.isPending}
                    onClick={() => {
                      if (selected) {
                        saveMutation.mutate(selected);
                      }
                    }}
                    className="w-full bg-accent-orange text-white py-3 font-display uppercase tracking-wide border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save"}
                  </button>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
