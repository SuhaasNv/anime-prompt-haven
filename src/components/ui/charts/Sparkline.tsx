interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Stroke/fill color. Defaults to the live accent so it repaints with the theme. */
  color?: string;
  className?: string;
}

/**
 * Tiny area-line chart from a series of numbers. Pure SVG (SSR-safe), no deps.
 * Renders nothing meaningful for <2 points but stays a valid element.
 */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--magenta)",
  className,
}: SparklineProps) {
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const n = data.length;

  const x = (i: number) => pad + (n <= 1 ? 0 : (i / (n - 1)) * w);
  const y = (v: number) => pad + h - ((v - min) / span) * h;

  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${pad},${pad + h} ${line} ${pad + w},${pad + h}`;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
