export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

/**
 * Donut chart from labeled segments. Pure SVG (SSR-safe). Center shows an
 * optional value + label. Empty/zero data renders an inert ring.
 */
export function DonutChart({
  segments,
  size = 200,
  thickness = 26,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let offset = 0;
  const arcs = segments.map((s) => {
    const fraction = total > 0 ? s.value / total : 0;
    const dash = fraction * circumference;
    const arc = {
      ...s,
      dasharray: `${dash} ${circumference - dash}`,
      dashoffset: -offset,
    };
    offset += dash;
    return arc;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
    >
      {/* track */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#0a0a0c" strokeOpacity={0.08} strokeWidth={thickness} />
      {total > 0 &&
        arcs.map((a) => (
          <circle
            key={a.label}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={a.dasharray}
            strokeDashoffset={a.dashoffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        ))}
      {(centerValue || centerLabel) && (
        <>
          {centerValue && (
            <text
              x={cx}
              y={centerLabel ? cy - 2 : cy + 6}
              textAnchor="middle"
              className="font-display"
              fill="#0a0a0c"
              fontSize={size * 0.16}
              style={{ textTransform: "uppercase" }}
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={cx}
              y={cy + size * 0.12}
              textAnchor="middle"
              fill="#0a0a0c"
              fillOpacity={0.6}
              fontSize={size * 0.06}
              fontWeight={700}
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              {centerLabel}
            </text>
          )}
        </>
      )}
    </svg>
  );
}
