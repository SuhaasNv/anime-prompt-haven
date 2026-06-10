import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getReports, updateListingStatus } from "@/lib/api/admin.functions";

export interface ReportWithListing {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_status: string;
  reporter_email: string;
  reason: string;
  note: string | null;
  created_at: string;
  report_count: number;
}

const REASON_LABELS: Record<string, string> = {
  nsfw_undisclosed: "NSFW",
  spam: "SPAM",
  stolen_content: "STOLEN",
  misleading: "MISLEADING",
  other: "OTHER",
};

interface ReportsTabProps {
  reports: ReportWithListing[];
  loading: boolean;
  onRefresh: () => void;
}

export function ReportsTab({ reports, loading, onRefresh }: ReportsTabProps) {
  const [processing, setProcessing] = useState<string | null>(null);

  const handleApprove = async (reportId: string, listingId: string) => {
    setProcessing(reportId);
    try {
      await updateListingStatus({ data: { listingId, status: "removed" } });
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove listing");
    } finally {
      setProcessing(null);
    }
  };

  const handleDismiss = async (reportId: string) => {
    setProcessing(reportId);
    try {
      // In a real implementation, this would update report status in DB
      // For now, just show success and refresh
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dismiss report");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <p className="text-ink/50 py-10 text-center font-mono">Loading reports…</p>;
  }

  if (reports.length === 0) {
    return (
      <div className="py-20 text-center border-4 border-dashed border-ink">
        <p className="font-display text-3xl uppercase text-ink/40">All Clear ✨</p>
        <p className="text-sm text-ink/60 mt-2">No reports to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report, i) => (
        <motion.div
          key={report.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-white border-4 border-ink p-5 hover:shadow-pop transition-shadow"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-display text-2xl uppercase">{report.listing_title}</h3>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${
                    report.listing_status === "removed"
                      ? "bg-magenta text-white"
                      : "bg-accent-yellow text-ink"
                  }`}
                >
                  {report.listing_status.toUpperCase()}
                </span>
                <span className="bg-magenta text-white text-xs font-bold px-2 py-1 rounded">
                  {report.report_count} reports
                </span>
              </div>
              <p className="text-xs text-ink/60 font-mono">
                Listing ID: {report.listing_id.slice(0, 8)}
              </p>
              <p className="text-xs text-ink/60 mt-1">Reported by: {report.reporter_email}</p>
            </div>
          </div>

          <div className="mb-4 p-3 bg-ink/5 border-l-4 border-magenta">
            <p className="text-xs font-bold uppercase mb-2 text-ink/70">Report Details:</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-bold">{REASON_LABELS[report.reason] || report.reason}</span>
                <span className="text-ink/60">
                  {new Date(report.created_at).toLocaleDateString()}
                </span>
              </div>
              {report.note && <p className="text-xs text-ink/70">{report.note}</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleApprove(report.id, report.listing_id)}
              disabled={processing === report.id}
              className="flex-1 bg-magenta text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {processing === report.id ? "Processing…" : "✕ Remove Listing"}
            </button>
            <button
              onClick={() => handleDismiss(report.id)}
              disabled={processing === report.id}
              className="flex-1 bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {processing === report.id ? "Processing…" : "← Dismiss"}
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
