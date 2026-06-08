import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COLLECTIONS } from "@/lib/mock-data";

export function SaveToCollectionModal({
  open,
  onClose,
  promptTitle,
}: {
  open: boolean;
  onClose: () => void;
  promptTitle: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSaved(false);
    }
  }, [open]);

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
                <div className="space-y-2 mb-6">
                  {COLLECTIONS.map((c) => (
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
                  ))}
                  <button className="w-full p-3 border-2 border-dashed border-ink font-bold uppercase text-sm text-ink/60 hover:text-magenta hover:border-magenta transition-colors">
                    + New Collection
                  </button>
                </div>

                <button
                  disabled={!selected}
                  onClick={() => setSaved(true)}
                  className="w-full bg-accent-orange text-white py-3 font-display uppercase tracking-wide border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
