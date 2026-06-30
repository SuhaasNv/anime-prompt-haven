import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Sparkline } from "./charts/Sparkline";

interface StatCardProps {
  label: string;
  value: string;
  /** Optional period-over-period delta as a percentage; sign drives ▲/▼ + color. */
  delta?: number | null;
  icon?: ReactNode;
  /** Sparkline series + its color (defaults to the live accent). */
  series?: number[];
  seriesColor?: string;
  /** Tailwind shadow utility for category differentiation, e.g. "shadow-pop-magenta". */
  shadowClass?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  series,
  seriesColor,
  shadowClass = "shadow-pop",
  className,
}: StatCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = hasDelta && delta! >= 0;

  return (
    <div className={cn("bg-white border-4 border-ink p-4", shadowClass, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-widest text-ink/60">{label}</div>
        {icon && <div className="text-lg leading-none">{icon}</div>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="font-display text-3xl uppercase leading-none">{value}</div>
        {hasDelta && (
          <span
            className={cn(
              "text-xs font-bold whitespace-nowrap",
              up ? "text-green-600" : "text-magenta",
            )}
          >
            {up ? "▲" : "▼"} {Math.abs(delta!).toFixed(0)}%
          </span>
        )}
      </div>
      {series && series.length > 1 && (
        <div className="mt-3">
          <Sparkline data={series} width={240} height={32} color={seriesColor} className="w-full h-8" />
        </div>
      )}
    </div>
  );
}
