import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { purchaseListing } from "@/lib/api/purchases.functions";

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  listingId: string;
  title: string;
  price: number;
  userCredits: number;
  onSuccess: (newBalance: number) => void;
}

export function PurchaseModal({ open, onClose, listingId, title, price, userCredits, onSuccess }: PurchaseModalProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const insufficientCredits = userCredits < price;

  const handleClose = () => {
    if (purchasing) return;
    onClose();
  };

  const handleConfirm = async () => {
    setPurchasing(true);
    setError(null);
    try {
      const result = await purchaseListing({ data: { listingId } });
      onSuccess(result.newBalance);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-4 border-ink shadow-pop-lg w-full max-w-sm p-6"
            role="dialog"
            aria-modal="true"
          >
            {success ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="font-display text-2xl uppercase mb-2">Purchase successful!</h2>
                <p className="text-sm text-ink/70 mb-5">
                  "{title}" has been added to your collection.
                </p>
                <button
                  onClick={onClose}
                  className="w-full bg-accent-orange text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  Awesome!
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl uppercase mb-2 leading-tight">Confirm Purchase</h2>
                <p className="text-sm text-ink/70 mb-5">
                  Buy <span className="font-bold text-ink">"{title}"</span> for{" "}
                  <span className="font-bold text-magenta">{price} ✦</span>?
                </p>

                {insufficientCredits ? (
                  <p className="text-xs font-bold text-magenta mb-4">
                    Insufficient credits. You need {price} ✦, you have {userCredits} ✦.
                  </p>
                ) : error ? (
                  <p className="text-xs font-bold text-magenta mb-4">{error}</p>
                ) : null}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={purchasing || insufficientCredits}
                    className="flex-1 bg-accent-orange text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                  >
                    {purchasing ? "Processing…" : "Yes, Buy It"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={purchasing}
                    className="px-5 bg-white text-ink py-3 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
