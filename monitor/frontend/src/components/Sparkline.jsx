/**
 * Sparkline — lightweight SVG line chart, no dependencies.
 * Renders a mini time-series of numeric values.
 *
 * Props:
 *   data      : Array<number>          — y values (latest last)
 *   width     : number  (default 120)
 *   height    : number  (default 32)
 *   color     : string  (default "var(--red)")
 *   fillColor : string  (default semi-transparent color)
 *   showDot   : bool    (default true) — show latest-value dot
 */
export function Sparkline({
  data = [],
  width = 120,
  height = 32,
  color = "var(--red)",
  fillColor,
  showDot = true,
}) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="sparkline-svg">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="var(--border-2)" strokeWidth={1} strokeDasharray="2 3" />
      </svg>
    );
  }

  const pad   = 2;
  const w     = width  - pad * 2;
  const h     = height - pad * 2;
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");

  // Closed area fill path: line down to baseline, then back
  const fillPath = [
    `M${pts[0][0]},${height - pad}`,
    ...pts.map(([x, y]) => `L${x},${y}`),
    `L${pts[pts.length - 1][0]},${height - pad}`,
    "Z",
  ].join(" ");

  const latestPt = pts[pts.length - 1];
  const fill = fillColor ?? color.replace(")", ", 0.15)").replace("var(", "rgba(");

  return (
    <svg width={width} height={height} className="sparkline-svg" style={{ overflow: "visible" }}>
      {/* Area fill */}
      <path d={fillPath} fill={fill} stroke="none" />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Latest-value dot */}
      {showDot && (
        <circle
          cx={latestPt[0]} cy={latestPt[1]}
          r={2.5}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}
