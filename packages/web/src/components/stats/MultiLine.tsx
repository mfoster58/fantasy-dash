import type { UserId } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import { lineStroke, lineWidth, markAttrs, usePinHover, type Pin } from './pin';

export interface LineSeries { id: UserId; values: (number | null)[] }
interface Guide { y: number; label?: string; tone: 'line' | 'win' | 'gold' }
interface Props {
  series: LineSeries[]; xLabels: string[]; yDomain: [number, number]; invertY?: boolean; guides?: Guide[];
  /** indexes a dashed vertical line sits before */ dividers?: number[];
  /** indexes drawn over a faint band (playoff weeks) */ bands?: number[];
  rightLabel: (s: LineSeries) => string; refs: ManagerRef[]; pin: Pin; ariaLabel: string; height?: number;
}
const W = 640, PAD = { l: 34, r: 96, t: 12, b: 24 };
const GUIDE: Record<Guide['tone'], string> = { line: 'var(--line)', win: 'var(--win)', gold: 'var(--gold)' };

/** Several lines over the same x axis; the active manager's is gold on top, the rest dim. Labels sit at the right edge, pushed apart so they never overlap. */
export default function MultiLine({ series, xLabels, yDomain, invertY = false, guides = [], dividers = [], bands = [], rightLabel, refs, pin, ariaLabel, height = 240 }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  const n = xLabels.length;
  const [lo, hi] = yDomain;
  const x = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * (W - PAD.l - PAD.r) : (W - PAD.l - PAD.r) / 2);
  const y = (v: number) => { const k = (v - lo) / (hi - lo || 1); return invertY ? PAD.t + k * (height - PAD.t - PAD.b) : height - PAD.b - k * (height - PAD.t - PAD.b); };
  const path = (vals: (number | null)[]) => { let d = '', pen = false; vals.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; }); return d.trim(); };
  // right-edge labels: sorted by their end value and nudged apart by 11px
  const ends = series.map((s) => { const last = [...s.values].reverse().find((v) => v !== null); return { s, y: last === null || last === undefined ? null : y(last) }; }).filter((e) => e.y !== null) as { s: LineSeries; y: number }[];
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
  const ordered = [...series].sort((a) => (a.id === active ? 1 : -1));
  const step = n > 1 ? (W - PAD.l - PAD.r) / (n - 1) : 0;
  const name = (id: UserId) => refs.find((r) => r.id === id)?.name ?? id;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="block w-full" role="img" aria-label={ariaLabel}>
      {bands.map((i) => <rect key={`b${i}`} data-band x={x(i) - step / 2} y={PAD.t} width={step} height={height - PAD.t - PAD.b} fill="var(--gold)" opacity="0.07" />)}
      {dividers.map((i) => <line key={`d${i}`} data-divider x1={x(i) - step / 2} x2={x(i) - step / 2} y1={PAD.t} y2={height - PAD.b} stroke="var(--gold)" strokeDasharray="4 4" opacity="0.8" />)}
      {guides.map((g, i) => (
        <g key={`g${i}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(g.y)} y2={y(g.y)} stroke={GUIDE[g.tone]} strokeDasharray="3 4" opacity={g.tone === 'line' ? 1 : 0.7} />
          {g.label && <text x={PAD.l + 2} y={y(g.y) - 4} fontSize="10" fill={GUIDE[g.tone]}>{g.label}</text>}
        </g>
      ))}
      {xLabels.map((l, i) => (n <= 12 || i % Math.ceil(n / 12) === 0) && <text key={l + i} x={x(i)} y={height - 6} fontSize="10" textAnchor="middle" fill="var(--muted)" className="num">{l}</text>)}
      {ordered.map((s) => (
        <path key={s.id} data-series={s.id} {...markAttrs(s.id, active)} {...hoverProps(s.id)} d={path(s.values)} fill="none" stroke={lineStroke(s.id, active)} strokeWidth={lineWidth(s.id, active)} strokeLinejoin="round" strokeLinecap="round" opacity={active !== null && active !== s.id ? 0.45 : 1} style={{ cursor: 'default' }}>
          <title>{name(s.id)}</title>
        </path>
      ))}
      {ends.map(({ s, y: ly }) => (
        <text key={`l${s.id}`} data-series-label={s.id} {...markAttrs(s.id, active)} {...hoverProps(s.id)} x={W - PAD.r + 6} y={ly + 3} fontSize="10" fill={s.id === active ? 'var(--gold)' : 'var(--muted)'} fontWeight={s.id === active ? 600 : 400} opacity={active !== null && active !== s.id ? 0.5 : 1}>{rightLabel(s)}</text>
      ))}
    </svg>
  );
}
