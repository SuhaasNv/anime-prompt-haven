import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUser, CURRENT_USER_QUERY_KEY } from "@/lib/api/auth.functions";
import { listCollections, addPromptToCollection } from "@/lib/api/collections.functions";

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
    mutationFn: async (collectionId: string) => {
      if (!selected) throw new Error("No collection selected");
      return addPromptToCollection({ data: { collectionId, promptId: listingId } });
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save");
    },
  });

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSaved(false);
      setError(null);
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

                <div className="space-y-2 mb-6">
                  {isLoading ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-ink/60">Loading collections...</p>
                    </div>
                  ) : collections.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-ink/60">No collections yet.</p>
                      <p className="text-xs text-ink/50 mt-1">Create one in your dashboard.</p>
                    </div>
                  ) : (
                    collections.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c.id)}
                        className={`w-full flex items-center justify-between p-3 border-2 border-ink font-bold uppercase text-sm transition-all ${
                          selected === c.id
                            ? "bg-magenta text-white shadow-[4px_4px_0_0_#0a0a0c]"
                            : "bg-white hover:bg-accent-yellow"
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-xs font-mono opacity-70">{c.promptIds.length} items</span>
                      </button>
                    ))
                  )}
                </div>

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
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
