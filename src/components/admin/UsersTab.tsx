import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { searchUsers, adjustUserCredits } from "@/lib/api/admin.functions";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  balance: number;
  listing_count: number;
  purchase_count: number;
  average_rating: number;
  created_at: string;
}

interface UsersTabProps {
  users: UserProfile[];
  loading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  onUserUpdated: () => void;
}

export function UsersTab({ users, loading, search, onSearchChange, onUserUpdated }: UsersTabProps) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [adjustingCredits, setAdjustingCredits] = useState<{
    userId: string;
    amount: string;
    reason: string;
  } | null>(null);

  const handleAdjustCredits = async (userId: string) => {
    if (!adjustingCredits || adjustingCredits.userId !== userId) {
      setAdjustingCredits({ userId, amount: "0", reason: "" });
      return;
    }

    setProcessing(userId);
    try {
      await adjustUserCredits({
        data: {
          userId,
          amount: parseFloat(adjustingCredits.amount),
          reason: adjustingCredits.reason,
        },
      });
      setAdjustingCredits(null);
      onUserUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust credits");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white border-4 border-ink p-4 shadow-pop">
        <label className="block text-xs font-bold uppercase text-ink/70 mb-2">Search Users</label>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Email or username…"
          className="w-full px-3 py-2 border-2 border-ink font-mono text-sm"
        />
      </div>

      {/* Results */}
      {loading ? (
        <p className="text-ink/50 py-10 text-center font-mono">Loading users…</p>
      ) : users.length === 0 ? (
        <div className="py-20 text-center border-4 border-dashed border-ink">
          <p className="font-display text-3xl uppercase text-ink/40">No Results</p>
          <p className="text-sm text-ink/60 mt-2">Try a different search term.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((userProfile, i) => (
            <motion.div
              key={userProfile.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border-4 border-ink p-5 hover:shadow-pop transition-shadow"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display text-2xl uppercase">@{userProfile.username}</h3>
                    <span className="text-xs font-bold px-2 py-1 bg-accent-yellow rounded">
                      {userProfile.email}
                    </span>
                  </div>
                  <p className="text-xs text-ink/60 font-mono">ID: {userProfile.id.slice(0, 8)}</p>
                  <p className="text-xs text-ink/60 mt-1">
                    Member since: {new Date(userProfile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mb-4 p-3 bg-ink/5 border-l-4 border-magenta">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <span className="font-bold">Balance</span>
                    <div className="text-magenta">
                      ✦{parseFloat(userProfile.balance.toString()).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="font-bold">Listings</span>
                    <div className="text-magenta">{userProfile.listing_count}</div>
                  </div>
                  <div>
                    <span className="font-bold">Purchases</span>
                    <div className="text-magenta">{userProfile.purchase_count}</div>
                  </div>
                  <div>
                    <span className="font-bold">Rating</span>
                    <div className="text-magenta">
                      {parseFloat(userProfile.average_rating.toString()).toFixed(1)}★
                    </div>
                  </div>
                  <div>
                    <span className="font-bold">Status</span>
                    <div className="text-ink/60">Active</div>
                  </div>
                </div>
              </div>

              {/* Credit adjustment form */}
              {adjustingCredits?.userId === userProfile.id
                ? (() => {
                    const parsed = parseFloat(adjustingCredits.amount);
                    const delta = Number.isFinite(parsed) ? parsed : 0;
                    const balanceAfter = userProfile.balance + delta;
                    const invalid = delta === 0 || balanceAfter < 0 || !adjustingCredits.reason.trim();
                    return (
                      <div className="mb-4 p-4 bg-accent-yellow border-2 border-ink">
                        {/* Preset chips */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {[5, 10, 50, -5].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                setAdjustingCredits({ ...adjustingCredits, amount: String(preset) })
                              }
                              className="px-3 py-1 border-2 border-ink bg-white text-xs font-bold hover:bg-ink hover:text-white transition-colors"
                            >
                              {preset > 0 ? `+${preset}` : preset}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <input
                            type="number"
                            step="0.01"
                            value={adjustingCredits.amount}
                            onChange={(e) =>
                              setAdjustingCredits({ ...adjustingCredits, amount: e.target.value })
                            }
                            placeholder="Amount (+ or -)"
                            className="px-3 py-2 border-2 border-ink font-mono text-sm"
                          />
                          <input
                            type="text"
                            value={adjustingCredits.reason}
                            onChange={(e) =>
                              setAdjustingCredits({ ...adjustingCredits, reason: e.target.value })
                            }
                            placeholder="Reason (required)"
                            className="px-3 py-2 border-2 border-ink font-mono text-sm"
                          />
                          <button
                            onClick={() => handleAdjustCredits(userProfile.id)}
                            disabled={processing === userProfile.id || invalid}
                            className="bg-magenta text-white py-2 font-bold uppercase border-2 border-ink text-xs shadow-[2px_2px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-40"
                          >
                            {processing === userProfile.id ? "…" : "Apply"}
                          </button>
                        </div>
                        {/* Balance-after preview */}
                        <p className="text-xs font-bold uppercase mb-2">
                          Balance: ✦ {userProfile.balance.toFixed(2)}
                          {delta !== 0 && (
                            <>
                              {" → "}
                              <span className={balanceAfter < 0 ? "text-magenta" : "text-ink"}>
                                ✦ {balanceAfter.toFixed(2)}
                              </span>
                              {balanceAfter < 0 && " (insufficient)"}
                            </>
                          )}
                        </p>
                        <button
                          onClick={() => setAdjustingCredits(null)}
                          className="text-xs font-bold text-ink/60 hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  })()
                : null}

              <div className="flex gap-3">
                <button
                  onClick={() => handleAdjustCredits(userProfile.id)}
                  className="flex-1 bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink text-sm shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  {adjustingCredits?.userId === userProfile.id ? "Close" : "✦ Adjust Credits"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
