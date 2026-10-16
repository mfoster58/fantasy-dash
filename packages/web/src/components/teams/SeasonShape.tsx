import { CardHeader } from '../draft/DraftAnalysis';
import { FinishGlyph, type FinishKind } from '../Icons';
import { fmtPpg } from '../../lib/format';

export interface ShapePoint {
  label: string;
  /** null for a week without a game (a playoff bye): a grey dot on the league line and a break in the team's line */
  mine: number | null; league: number;
  /** colours the dot green / red / grey; accent when absent */
  result?: 'W' | 'L' | 'T';
  /** a dashed divider sits before the first playoff point */
  playoff?: boolean;
  /** written above the dot, with the trophy or toilet when there is one */
  finish?: { label: string; icon: FinishKind | null };
}

interface Props { title?: string; label: string; points: ShapePoint[]; mineCaption: string; leagueCaption: string; /** twice as wide for a wide column */ wide?: boolean }

const H = 110, PAD = 10, GLYPH = 20, LABEL = 11;
/** room above the plot for the finish label and its icon */
const FINISH_PAD = PAD + LABEL + GLYPH + 14;
const DOT: Record<'W' | 'L' | 'T', string> = { W: 'var(--win)', L: 'var(--loss)', T: 'var(--muted)' };

/** Small line chart: the team's points per period against the league average (dashed), dots coloured by result, a dashed line where the playoffs start and, when given, each period's finish above its dot. */
export default function SeasonShape({ title = 'Season shape', label, points, mineCaption, leagueCaption, wide = false }: Props) {
  const W = wide ? 720 : 320;
  const hasFinish = points.some((p) => p.finish);
  const top = hasFinish ? FINISH_PAD : PAD;
  const height = H + top - PAD;
  const values = points.flatMap((p) => (p.mine === null ? [p.league] : [p.mine, p.league]));
  const min = Math.min(...values, Infinity), max = Math.max(...values, -Infinity);
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? PAD + (i * (W - 2 * PAD)) / (points.length - 1) : W / 2);
  const y = (v: number) => height - PAD - ((v - min) / span) * (H - 2 * PAD);
  /** one segment per run of points with a value, so a bye breaks the line */
  const path = (pick: (p: ShapePoint) => number | null) => {
    let out = '', pen = false;
    points.forEach((p, i) => {
      const v = pick(p);
      if (v === null) { pen = false; return; }
      out += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return out.trim();
  };
  const firstPlayoff = points.findIndex((p) => p.playoff);
  const bandX = firstPlayoff > 0 ? (x(firstPlayoff - 1) + x(firstPlayoff)) / 2 : firstPlayoff === 0 ? 0 : null;
  const hasResults = points.some((p) => p.result);
  const hasBye = points.some((p) => p.mine === null);
  return (
    <section className="card">
      <CardHeader label={label} title={title} />
      {points.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nothing played yet.</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${height}`} className="block w-full" role="img" aria-label="Points by week against the league average">
            {bandX !== null && (
              <line data-testid="playoff-line" x1={bandX} x2={bandX} y1={0} y2={height} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.8"><title>Playoffs</title></line>
            )}
            <path d={path((p) => p.league)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
            <path d={path((p) => p.mine)} fill="none" stroke="var(--accent)" strokeWidth="2" />
            {points.map((p, i) => p.mine === null ? (
              <circle key={p.label} cx={x(i)} cy={y(p.league)} r="4" fill="var(--muted)" stroke="var(--surface)" strokeWidth="1.5" data-testid="bye-dot">
                <title>{p.label}: bye (league {fmtPpg(p.league)})</title>
              </circle>
            ) : (
              <circle key={p.label} cx={x(i)} cy={y(p.mine)} r={p.result ? 4 : 3.5} fill={p.result ? DOT[p.result] : 'var(--accent)'} stroke="var(--surface)" strokeWidth="1.5">
                <title>{p.label}: {fmtPpg(p.mine)} (league {fmtPpg(p.league)}){p.result ? ` · ${p.result}` : ''}{p.playoff ? ' · playoffs' : ''}</title>
              </circle>
            ))}
            {points.map((p, i) => p.finish && p.mine !== null && (
              <g key={`f-${p.label}`} data-testid="finish-label">
                <text x={x(i)} y={y(p.mine) - 9} textAnchor="middle" fontSize={LABEL} fontWeight="600" fill="var(--ink)" className="num">{p.finish.label}</text>
                {p.finish.icon && <FinishGlyph kind={p.finish.icon} x={x(i) - GLYPH / 2} y={y(p.mine) - 9 - LABEL - 2 - GLYPH} size={GLYPH} />}
              </g>
            ))}
          </svg>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-muted">
            <span><span className="num font-semibold text-ink">{mineCaption.split(' ')[0]}</span> {mineCaption.slice(mineCaption.indexOf(' ') + 1)}</span>
            <span className="flex items-center gap-3">
              {hasResults && <span className="flex items-center gap-2"><span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-win" aria-hidden="true" /><span>W</span></span><span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-loss" aria-hidden="true" /><span>L</span></span>{hasBye && <span className="flex items-center gap-1"><i className="inline-block size-2 rounded-full bg-muted" aria-hidden="true" /><span>Bye</span></span>}</span>}
              <span><span aria-hidden="true">┄ </span>{leagueCaption}</span>
            </span>
          </div>
        </>
      )}
    </section>
  );
}
