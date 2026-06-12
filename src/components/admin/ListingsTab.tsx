import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  searchListings,
  updateListingStatus,
  type ListingStatusFilter,
} from "@/lib/api/admin.functions";

export interface ListingWithStats {
  id: string;
  title: string;
  user_id: string;
  username: string;
  status: string;
  price: number;
  view_count: number;
  purchase_count: number;
  report_count: number;
  created_at: string;
}

interface ListingsTabProps {
  listings: ListingWithStats[];
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: ListingStatusFilter) => void;
  statusFilter: ListingStatusFilter;
}

export function ListingsTab({
  listings,
  loading,
  search,
  onSearchChange,
  onStatusChange,
  statusFilter,
}: ListingsTabProps) {
  const [processing, setProcessing] = useState<string | null>(null);

  const handleStatusChange = async (listingId: string, newStatus: string) => {
    setProcessing(listingId);
    try {
      await updateListingStatus({
        data: { listingId, status: newStatus as "published" | "flagged" | "removed" },
      });
      // Refresh will happen through parent component
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update listing");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter */}
      <div className="bg-white border-4 border-ink p-4 shadow-pop">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ink/70 mb-2">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Title, creator, email…"
              className="w-full px-3 py-2 border-2 border-ink font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-ink/70 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as ListingStatusFilter)}
              className="w-full px-3 py-2 border-2 border-ink font-mono text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="flagged">Flagged</option>
              <option value="removed">Removed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <p className="text-ink/50 py-10 text-center font-mono">Loading listings…</p>
      ) : listings.length === 0 ? (
        <div className="py-20 text-center border-4 border-dashed border-ink">
          <p className="font-display text-3xl uppercase text-ink/40">No Results</p>
          <p className="text-sm text-ink/60 mt-2">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing, i) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border-4 border-ink p-5 hover:shadow-pop transition-shadow"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display text-2xl uppercase">{listing.title}</h3>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        listing.status === "published"
                          ? "bg-holo-purple text-white"
                          : listing.status === "flagged"
                            ? "bg-accent-yellow text-ink"
                            : "bg-magenta text-white"
                      }`}
                    >
                      {listing.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-ink/60">
                    By @{listing.username} · ✦{listing.price}
                  </p>
                  <p className="text-xs text-ink/60 font-mono mt-1">ID: {listing.id.slice(0, 8)}</p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-ink/5 border-l-4 border-magenta">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="font-bold">Views</span>
                    <div className="text-magenta">{listing.view_count}</div>
                  </div>
                  <div>
                    <span className="font-bold">Purchases</span>
                    <div className="text-magenta">{listing.purchase_count}</div>
                  </div>
                  <div>
                    <span className="font-bold">Reports</span>
                    <div
                      className={
                        listing.report_count > 0 ? "text-magenta font-bold" : "text-ink/50"
                      }
                    >
                      {listing.report_count}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold">Created</span>
                    <div className="text-ink/60">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleStatusChange(listing.id, "published")}
                  disabled={processing === listing.id || listing.status === "published"}
                  className="flex-1 bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {processing === listing.id ? "…" : "Publish"}
                </button>
                <button
                  onClick={() => handleStatusChange(listing.id, "flagged")}
                  disabled={processing === listing.id || listing.status === "flagged"}
                  className="flex-1 bg-accent-yellow text-ink py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#ffff00] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {processing === listing.id ? "…" : "Flag"}
                </button>
                <button
                  onClick={() => handleStatusChange(listing.id, "removed")}
                  disabled={processing === listing.id || listing.status === "removed"}
                  className="flex-1 bg-magenta text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {processing === listing.id ? "…" : "Remove"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
