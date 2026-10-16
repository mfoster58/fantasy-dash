import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPpg } from '../../lib/format';

export interface ShapePoint { label: string; mine: number; league: number }

interface Props { label: string; points: ShapePoint[]; mineCaption: string; leagueCaption: string; /** twice as wide for a wide column */ wide?: boolean }

const H = 110, PAD = 10;

/** Small line chart: the team's points per period (accent, dotted) against the league average (dashed). */
export default function SeasonShape({ label, points, mineCaption, leagueCaption, wide = false }: Props) {
  const W = wide ? 720 : 320;
  const values = points.flatMap((p) => [p.mine, p.league]);
  const min = Math.min(...values, Infinity), max = Math.max(...values, -Infinity);
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? PAD + (i * (W - 2 * PAD)) / (points.length - 1) : W / 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const path = (pick: (p: ShapePoint) => number) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  return (
    <section className="card">
      <CardHeader label={label} title="Season shape" />
      {points.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nothing played yet.</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Points by week against the league average">
            <path d={path((p) => p.league)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
            <path d={path((p) => p.mine)} fill="none" stroke="var(--accent)" strokeWidth="2" />
            {points.map((p, i) => (
              <circle key={p.label} cx={x(i)} cy={y(p.mine)} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5">
                <title>{p.label}: {fmtPpg(p.mine)} (league {fmtPpg(p.league)})</title>
              </circle>
            ))}
          </svg>
          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
            <span><span className="num font-semibold text-ink">{mineCaption.split(' ')[0]}</span> {mineCaption.slice(mineCaption.indexOf(' ') + 1)}</span>
            <span><span aria-hidden="true">┄ </span>{leagueCaption}</span>
          </div>
        </>
      )}
    </section>
  );
}
