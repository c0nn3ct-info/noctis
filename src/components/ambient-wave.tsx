import { useId } from 'react';

// A decorative, self-rendering ambient speed wave for the landing-page popup
// mock — mirrors the extension's PopupAmbientTraffic look (smoothed sqrt-scaled
// gradient glow in the accent color). Pure renderer: the parent owns the rolling
// sample buffer so the readout and wave stay in sync.
const VW = 320;
const VH = 120;
const TOP_PAD = 0.16;

function smoothPath(coords: [number, number][]): string {
  if (coords.length < 2) return '';
  const t = 0.2;
  const d = [`M${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`];
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d.push(
      `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`,
    );
  }
  return d.join(' ');
}

export function AmbientWave({ points, max, className }: { points: number[]; max: number; className?: string }) {
  const gid = useId().replace(/:/g, '');
  if (points.length < 2) return null;

  const peak = Math.max(max, 1);
  const sqrtPeak = Math.sqrt(peak);
  const usableH = VH * (1 - TOP_PAD);
  const stepX = VW / (points.length - 1);
  const coords: [number, number][] = points.map((v, i) => [
    i * stepX,
    VH - (Math.sqrt(Math.max(0, v)) / sqrtPeak) * usableH,
  ]);
  const line = smoothPath(coords);
  const area = `${line} L${VW.toFixed(1)} ${VH} L0 ${VH} Z`;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.9} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
