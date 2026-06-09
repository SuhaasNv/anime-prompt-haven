interface CreditBalanceWidgetProps {
  balance: number | null;
  className?: string;
  onOpen?: () => void;
}

export function CreditBalanceWidget({ balance, className = "", onOpen }: CreditBalanceWidgetProps) {
  if (balance === null) {
    return <div className={`text-xs font-mono ${className}`}>…</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex items-center gap-2 px-3 py-1 bg-accent-yellow border-2 border-ink font-bold text-sm hover:shadow-[2px_2px_0_0_#0a0a0c] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all active:translate-x-0 active:translate-y-0 active:shadow-none ${className}`}
    >
      <span>✦</span>
      <span>{balance.toFixed(2)}</span>
    </button>
  );
}
