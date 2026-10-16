import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPpg } from '../../lib/format';

export interface ShapePoint {
  label: string; mine: number; league: number;
  /** colours the dot green / red / grey; accent when absent */
  result?: 'W' | 'L' | 'T';
  /** shades the chart from the first playoff point on */
  playoff?: boolean;
}

interface Props { label: string; points: ShapePoint[]; mineCaption: string; leagueCaption: string; /** twice as wide for a wide column */ wide?: boolean }

const H = 110, PAD = 10;
const DOT: Record<'W' | 'L' | 'T', string> = { W: 'var(--win)', L: 'var(--loss)', T: 'var(--muted)' };

/** Small line chart: the team's points per period against the league average (dashed), dots coloured by result and the playoff weeks shaded. */
export default function SeasonShape({ label, points, mineCaption, leagueCaption, wide = false }: Props) {
  const W = wide ? 720 : 320;
  const values = points.flatMap((p) => [p.mine, p.league]);
  const min = Math.min(...values, Infinity), max = Math.max(...values, -Infinity);
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? PAD + (i * (W - 2 * PAD)) / (points.length - 1) : W / 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const path = (pick: (p: ShapePoint) => number) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  const firstPlayoff = points.findIndex((p) => p.playoff);
  const bandX = firstPlayoff > 0 ? (x(firstPlayoff - 1) + x(firstPlayoff)) / 2 : firstPlayoff === 0 ? 0 : null;
  const hasResults = points.some((p) => p.result);
  return (
    <section className="card">
      <CardHeader label={label} title="Season shape" />
      {points.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nothing played yet.</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Points by week against the league average">
            {bandX !== null && (
              <g data-testid="playoff-band">
                <rect x={bandX} y={0} width={W - bandX} height={H} fill="var(--accent)" opacity="0.08" />
                <line x1={bandX} x2={bandX} y1={0} y2={H} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                <text x={W - 6} y={10} textAnchor="end" fontSize="7.5" fontWeight="600" letterSpacing="0.08em" fill="var(--accent)" style={{ textTransform: 'uppercase' }}>Playoffs</text>
              </g>
            )}
            <path d={path((p) => p.league)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
            <path d={path((p) => p.mine)} fill="none" stroke="var(--accent)" strokeWidth="2" />
            {points.map((p, i) => (
              <circle key={p.label} cx={x(i)} cy={y(p.mine)} r={p.result ? 4 : 3.5} fill={p.result ? DOT[p.result] : 'var(--accent)'} stroke="var(--surface)" strokeWidth="1.5">
                <title>{p.label}: {fmtPpg(p.mine)} (league {fmtPpg(p.league)}){p.result ? ` · ${p.result}` : ''}{p.playoff ? ' · playoffs' : ''}</title>
              </circle>
            ))}
          </svg>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-muted">
            <span><span className="num font-semibold text-ink">{mineCaption.split(' ')[0]}</span> {mineCaption.slice(mineCaption.indexOf(' ') + 1)}</span>
            <span className="flex items-center gap-3">
              {hasResults && <span className="flex items-center gap-2"><span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-win" aria-hidden="true" /><span>W</span></span><span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-loss" aria-hidden="true" /><span>L</span></span></span>}
              <span><span aria-hidden="true">┄ </span>{leagueCaption}</span>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
