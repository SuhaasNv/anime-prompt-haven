import { useEffect, useState } from "react";
import { getMyCredits, listTransactions, topUpCredits } from "@/lib/api/credits.functions";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  bonus:        { label: "Bonus",        color: "text-holo-purple" },
  sale_earn:    { label: "Sale Earn",    color: "text-green-600" },
  copy_earn:    { label: "Copy Earn",    color: "text-green-600" },
  purchase:     { label: "Purchase",     color: "text-magenta" },
  platform_fee: { label: "Platform Fee", color: "text-ink/40" },
  refund:       { label: "Refund",       color: "text-holo-purple" },
  withdrawal:   { label: "Withdrawal",   color: "text-magenta" },
};

interface CreditsModalProps {
  open: boolean;
  onClose: () => void;
  onBalanceChange?: (newBalance: number) => void;
}

export function CreditsModal({ open, onClose, onBalanceChange }: CreditsModalProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toppingUp, setToppingUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        const [credits, txns] = await Promise.all([getMyCredits(), listTransactions()]);
        setBalance(credits.balance);
        setTransactions(txns as Transaction[]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open]);

  const handleTopUp = async () => {
    setToppingUp(true);
    try {
      const result = await topUpCredits();
      setBalance(result.newBalance);
      onBalanceChange?.(result.newBalance);
      const txns = await listTransactions();
      setTransactions(txns as Transaction[]);
    } catch {
      // ignore
    } finally {
      setToppingUp(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="relative bg-white border-4 border-ink shadow-pop-lg w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-4 border-ink bg-accent-yellow">
          <h2 className="font-display text-3xl uppercase">✦ Credits</h2>
          <button onClick={onClose} className="font-bold text-lg hover:text-magenta transition-colors">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Balance */}
          <div className="text-center py-4 border-4 border-ink bg-white shadow-[4px_4px_0_0_#0a0a0c]">
            <div className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-1">Your Balance</div>
            <div className="font-display text-6xl uppercase">
              {loading ? "…" : `✦ ${balance?.toFixed(2)}`}
            </div>
          </div>

          {/* How you earn */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-3 border-b-2 border-ink/10 pb-1">How You Earn</h3>
            <ul className="space-y-2">
              {[
                { icon: "🎁", label: "Welcome bonus", amount: "+5.00 on sign up" },
                { icon: "📤", label: "Publish a prompt", amount: "+2.00 per listing" },
                { icon: "📋", label: "Someone copies your prompt", amount: "+0.07 per copy" },
                { icon: "💎", label: "Someone buys your prompt", amount: "70% of sale price" },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{row.icon}</span>
                    <span className="font-medium">{row.label}</span>
                  </span>
                  <span className="font-bold text-green-600 font-mono text-xs">{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Top-up */}
          <div>
            <button
              type="button"
              onClick={handleTopUp}
              disabled={toppingUp}
              className="w-full bg-accent-orange text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {toppingUp ? "Topping up…" : "✦ Demo Top-Up (+50.00)"}
            </button>
            <p className="text-[10px] text-ink/40 text-center mt-1 font-mono uppercase">Stripe integration coming soon</p>
          </div>

          {/* Transaction history */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink/60 mb-3 border-b-2 border-ink/10 pb-1">Transaction History</h3>
            {loading ? (
              <p className="text-sm text-ink/50 text-center py-4">Loading…</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-ink/50 text-center py-4">No transactions yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {transactions.map((tx) => {
                  const meta = TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-ink" };
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-ink/10 text-sm">
                      <div className="min-w-0">
                        <span className={`font-bold uppercase text-xs ${meta.color}`}>{meta.label}</span>
                        {tx.note && <span className="text-ink/50 ml-2 text-xs truncate">{tx.note}</span>}
                      </div>
                      <span className={`font-mono font-bold text-xs shrink-0 ml-2 ${tx.amount >= 0 ? "text-green-600" : "text-magenta"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
