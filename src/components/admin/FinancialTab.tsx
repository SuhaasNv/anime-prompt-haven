import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  getPendingPayouts,
  updatePayoutStatus,
  getDisputes,
  resolveDispute,
  exportUserDataGDPR,
  deleteUserAccount,
} from "@/lib/api/admin.functions";

type FinancialSubTab = "payouts" | "disputes" | "compliance";

export interface CreatorPayout {
  id: string;
  creator_id: string;
  creator_email: string;
  creator_username: string;
  amount: number;
  status: string;
  bank_account: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface DisputeInfo {
  id: string;
  purchase_id: string;
  buyer_email: string;
  seller_email: string;
  listing_title: string;
  amount_paid: number;
  reason: string;
  status: string;
  winner: string | null;
  created_at: string;
}

interface FinancialTabProps {
  payouts: CreatorPayout[];
  disputes: DisputeInfo[];
  payoutsLoading: boolean;
  disputesLoading: boolean;
  onPayoutUpdated: () => void;
  onDisputeResolved: () => void;
}

export function FinancialTab({
  payouts,
  disputes,
  payoutsLoading,
  disputesLoading,
  onPayoutUpdated,
  onDisputeResolved,
}: FinancialTabProps) {
  const [subTab, setSubTab] = useState<FinancialSubTab>("payouts");
  const [processing, setProcessing] = useState<string | null>(null);
  const [resolvingDispute, setResolvingDispute] = useState<{
    disputeId: string;
    winner: string;
    resolution: string;
  } | null>(null);
  const [gdprUserId, setGdprUserId] = useState("");
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const handlePayoutAction = async (payoutId: string, status: string) => {
    setProcessing(payoutId);
    try {
      await updatePayoutStatus({
        data: { payoutId, status: status as "approved" | "rejected" | "paid" },
      });
      onPayoutUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update payout");
    } finally {
      setProcessing(null);
    }
  };

  const handleResolveDispute = async () => {
    if (!resolvingDispute) return;

    setProcessing(resolvingDispute.disputeId);
    try {
      await resolveDispute({
        data: {
          disputeId: resolvingDispute.disputeId,
          winner: resolvingDispute.winner as "buyer" | "seller" | "settlement",
          resolution: resolvingDispute.resolution,
        },
      });
      setResolvingDispute(null);
      onDisputeResolved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve dispute");
    } finally {
      setProcessing(null);
    }
  };

  const handleGdprExport = async () => {
    if (!gdprUserId) return;
    try {
      const data = await exportUserDataGDPR({ data: { userId: gdprUserId } });
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-${gdprUserId}-export.json`;
      a.click();
      setGdprUserId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export user data");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId || !deleteReason) {
      toast.error("Please fill in all fields");
      return;
    }

    const confirmed = await confirm({
      title: "Delete user account?",
      description: `Are you sure? This will anonymize all user data for ${deleteUserId}`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    setProcessing(deleteUserId);
    try {
      await deleteUserAccount({
        data: { userId: deleteUserId, reason: deleteReason },
      });
      setDeleteUserId("");
      setDeleteReason("");
      toast.success("User account deleted and data archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b-4 border-ink">
        {(["payouts", "disputes", "compliance"] as FinancialSubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 font-display uppercase text-sm border-2 border-b-0 transition-all ${
              subTab === tab
                ? "bg-magenta text-white border-ink"
                : "bg-white text-ink border-ink/30 hover:border-ink"
            }`}
          >
            {tab === "payouts" && "💳 Payouts"}
            {tab === "disputes" && "⚖️ Disputes"}
            {tab === "compliance" && "📋 Compliance"}
          </button>
        ))}
      </div>

      {/* Payouts */}
      {subTab === "payouts" && (
        <div>
          {payoutsLoading ? (
            <p className="text-ink/50 py-10 text-center font-mono">Loading payouts…</p>
          ) : payouts.length === 0 ? (
            <div className="py-20 text-center border-4 border-dashed border-ink">
              <p className="font-display text-3xl uppercase text-ink/40">All Caught Up ✨</p>
              <p className="text-sm text-ink/60 mt-2">No pending payouts.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payouts.map((payout, i) => (
                <motion.div
                  key={payout.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white border-4 border-ink p-5 hover:shadow-pop transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display text-2xl uppercase">
                          ✦ {payout.amount.toFixed(2)}
                        </h3>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded ${
                            payout.status === "pending"
                              ? "bg-accent-yellow text-ink"
                              : "bg-holo-purple text-white"
                          }`}
                        >
                          {payout.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-ink/60">
                        To: {payout.creator_username} ({payout.creator_email})
                      </p>
                      <p className="text-xs text-ink/60 mt-1 font-mono">
                        Payout ID: {payout.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-ink/5 border-l-4 border-magenta">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-bold">Requested</span>
                        <div className="text-ink/60">
                          {new Date(payout.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <span className="font-bold">Bank Account</span>
                        <div className="text-ink/60 font-mono">
                          {payout.bank_account
                            ? payout.bank_account.slice(-4).padStart(8, "*")
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {payout.status === "pending" && (
                      <>
                        <button
                          onClick={() => handlePayoutAction(payout.id, "approved")}
                          disabled={processing === payout.id}
                          className="flex-1 bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                        >
                          {processing === payout.id ? "…" : "✓ Approve"}
                        </button>
                        <button
                          onClick={() => handlePayoutAction(payout.id, "rejected")}
                          disabled={processing === payout.id}
                          className="flex-1 bg-magenta text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                        >
                          {processing === payout.id ? "…" : "✕ Reject"}
                        </button>
                      </>
                    )}
                    {payout.status === "approved" && (
                      <button
                        onClick={() => handlePayoutAction(payout.id, "paid")}
                        disabled={processing === payout.id}
                        className="flex-1 bg-accent-yellow text-ink py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#ffff00] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                      >
                        {processing === payout.id ? "…" : "💰 Mark Paid"}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disputes */}
      {subTab === "disputes" && (
        <div>
          {disputesLoading ? (
            <p className="text-ink/50 py-10 text-center font-mono">Loading disputes…</p>
          ) : disputes.length === 0 ? (
            <div className="py-20 text-center border-4 border-dashed border-ink">
              <p className="font-display text-3xl uppercase text-ink/40">Harmony Reigns ✨</p>
              <p className="text-sm text-ink/60 mt-2">No open disputes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute, i) => (
                <motion.div
                  key={dispute.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white border-4 border-ink p-5 hover:shadow-pop transition-shadow"
                >
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display text-2xl uppercase">{dispute.listing_title}</h3>
                      <span className="bg-magenta text-white text-xs font-bold px-2 py-1 rounded">
                        ✦ {dispute.amount_paid.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-ink/60">Dispute ID: {dispute.id.slice(0, 8)}</p>
                  </div>

                  <div className="mb-4 p-3 bg-ink/5 border-l-4 border-magenta">
                    <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                      <div>
                        <span className="font-bold">Buyer</span>
                        <div className="text-ink/60">{dispute.buyer_email}</div>
                      </div>
                      <div>
                        <span className="font-bold">Seller</span>
                        <div className="text-ink/60">{dispute.seller_email}</div>
                      </div>
                    </div>
                    <div className="text-xs">
                      <span className="font-bold">Reason</span>
                      <p className="text-ink/70 mt-1">{dispute.reason}</p>
                    </div>
                  </div>

                  {resolvingDispute?.disputeId === dispute.id ? (
                    <div className="mb-4 p-4 bg-accent-yellow border-2 border-ink space-y-3">
                      <div>
                        <label className="block text-xs font-bold uppercase text-ink/70 mb-2">
                          Winner
                        </label>
                        <select
                          value={resolvingDispute.winner}
                          onChange={(e) =>
                            setResolvingDispute({ ...resolvingDispute, winner: e.target.value })
                          }
                          className="w-full px-3 py-2 border-2 border-ink font-mono text-sm"
                        >
                          <option value="">Select…</option>
                          <option value="buyer">Buyer Wins (Refund)</option>
                          <option value="seller">Seller Wins</option>
                          <option value="settlement">Settlement</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-ink/70 mb-2">
                          Resolution
                        </label>
                        <textarea
                          value={resolvingDispute.resolution}
                          onChange={(e) =>
                            setResolvingDispute({ ...resolvingDispute, resolution: e.target.value })
                          }
                          placeholder="Explain the resolution…"
                          className="w-full px-3 py-2 border-2 border-ink font-mono text-sm"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResolveDispute}
                          disabled={processing === dispute.id || !resolvingDispute.winner}
                          className="flex-1 bg-magenta text-white py-2 font-bold uppercase border-2 border-ink text-xs shadow-[2px_2px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                        >
                          {processing === dispute.id ? "…" : "Resolve"}
                        </button>
                        <button
                          onClick={() => setResolvingDispute(null)}
                          className="flex-1 bg-white text-ink py-2 font-bold uppercase border-2 border-ink text-xs shadow-[2px_2px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setResolvingDispute({ disputeId: dispute.id, winner: "", resolution: "" })
                      }
                      className="w-full bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                    >
                      ⚖️ Review & Resolve
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance */}
      {subTab === "compliance" && (
        <div className="space-y-6">
          {/* GDPR Export */}
          <div className="bg-white border-4 border-ink p-6 shadow-pop">
            <h3 className="font-display text-xl uppercase mb-4">📋 GDPR Data Export</h3>
            <p className="text-xs text-ink/70 mb-4">Export all user data for GDPR requests</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={gdprUserId}
                onChange={(e) => setGdprUserId(e.target.value)}
                placeholder="User ID (UUID)"
                className="flex-1 px-3 py-2 border-2 border-ink font-mono text-sm"
              />
              <button
                onClick={handleGdprExport}
                disabled={!gdprUserId}
                className="bg-holo-purple text-white py-2 px-6 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
              >
                Download JSON
              </button>
            </div>
          </div>

          {/* Account Deletion */}
          <div className="bg-white border-4 border-ink p-6 shadow-pop">
            <h3 className="font-display text-xl uppercase mb-4 text-magenta">
              🗑️ Account Deletion & Anonymization
            </h3>
            <p className="text-xs text-ink/70 mb-4">
              Permanently anonymize user account. Data archived for 2 years per GDPR.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={deleteUserId}
                  onChange={(e) => setDeleteUserId(e.target.value)}
                  placeholder="User ID (UUID)"
                  className="w-full px-3 py-2 border-2 border-ink font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70 mb-2">
                  Reason for Deletion
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Why is this account being deleted?"
                  className="w-full px-3 py-2 border-2 border-ink font-mono text-sm"
                  rows={3}
                />
              </div>
              <button
                onClick={handleDeleteUser}
                disabled={!deleteUserId || !deleteReason || processing === deleteUserId}
                className="w-full bg-magenta text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
              >
                {processing === deleteUserId ? "Processing…" : "⚠️ Delete Account Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
