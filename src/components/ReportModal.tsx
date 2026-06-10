import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { reportListing } from "@/lib/api/reports.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
}

const REPORT_REASONS = [
  { value: "nsfw_undisclosed", label: "Undisclosed adult content" },
  { value: "spam", label: "Spam or misleading" },
  { value: "stolen_content", label: "Stolen content" },
  { value: "misleading", label: "Misleading information" },
  { value: "other", label: "Other" },
] as const;

export function ReportModal({ open, onClose, listingId, listingTitle }: ReportModalProps) {
  const [reason, setReason] = useState<typeof REPORT_REASONS[number]["value"]>("spam");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await reportListing({
        data: {
          listingId,
          reason,
          note: note || undefined,
        },
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason("spam");
        setNote("");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report listing");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    setSuccess(false);
    setReason("spam");
    setNote("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-4 border-ink shadow-pop-lg w-full max-w-md p-6 my-8"
          >
            {success ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">✓</div>
                <h2 className="font-display text-2xl uppercase mb-2">Thanks for reporting</h2>
                <p className="text-sm text-ink/70">Our team will review this listing soon.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4 border-b-2 border-ink pb-3">
                  <div>
                    <h2 className="font-display text-2xl uppercase leading-tight">Report This Listing</h2>
                    <p className="text-xs text-ink/60 mt-1">Help keep the community safe</p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="size-8 bg-accent-yellow border-2 border-ink font-bold hover:bg-accent-orange transition-colors shrink-0"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest block mb-2">
                      Listing: <span className="text-ink/60">{listingTitle}</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest block mb-2">
                      What's wrong?
                    </label>
                    <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                      <SelectTrigger className="w-full h-auto bg-white border-2 border-ink rounded-none p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[210] border-2 border-ink rounded-none">
                        {REPORT_REASONS.map((r) => (
                          <SelectItem key={r.value} value={r.value} className="font-bold text-sm rounded-none cursor-pointer">
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest block mb-2">
                      Details (optional)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                      rows={3}
                      placeholder="Tell us more about why you're reporting this..."
                      className="w-full bg-white border-2 border-ink p-2 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                    />
                    <div className="text-xs text-ink/50 mt-1">{note.length}/300</div>
                  </div>

                  {error && <p className="text-xs font-bold text-magenta">{error}</p>}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-magenta text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                    >
                      {submitting ? "Submitting…" : "Report"}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-5 bg-white text-ink py-3 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
