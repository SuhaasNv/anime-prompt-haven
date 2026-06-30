export interface BarPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarPoint[];
  height?: number;
  color?: string;
  /** Show every Nth x-axis label to avoid crowding (default: auto). */
  labelEvery?: number;
  className?: string;
}

/**
 * Simple vertical bar chart. Pure SVG (SSR-safe), pop-styled (ink-bordered bars).
 * Bars are evenly spaced; the tallest fills the height.
 */
export function BarChart({
  data,
  height = 200,
  color = "var(--magenta)",
  labelEvery,
  className,
}: BarChartProps) {
  const width = Math.max(data.length * 28, 280);
  const pad = { top: 10, right: 8, bottom: 22, left: 8 };
  const plotH = height - pad.top - pad.bottom;
  const plotW = width - pad.left - pad.right;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.min(slot * 0.6, 26);
  const step = labelEvery ?? Math.ceil(data.length / 8);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Bar chart"
      preserveAspectRatio="none"
    >
      {/* baseline */}
      <line
        x1={pad.left}
        y1={pad.top + plotH}
        x2={width - pad.right}
        y2={pad.top + plotH}
        stroke="#0a0a0c"
        strokeOpacity={0.2}
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = pad.left + i * slot + (slot - barW) / 2;
        const y = pad.top + plotH - h;
        return (
          <g key={`${d.label}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, d.value > 0 ? 2 : 0)}
              fill={color}
              stroke="#0a0a0c"
              strokeWidth={1.5}
            />
            {i % step === 0 && (
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                fill="#0a0a0c"
                fillOpacity={0.55}
                fontSize={9}
                fontWeight={700}
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
