import type { PlayerStat } from '../../../lib/stats/players/season';
import { placeLabels, shortName } from '../../../lib/stats/players/quadrant';
import TeamLogo from './TeamLogo';

const W = 1180, H = 460, M = { l: 62, r: 24, t: 20, b: 50 };
const RAYS = [1, 1.5, 2, 2.5, 3];

/** Routes run against receiving yards, with rays at fixed yards per route run. */
export default function YprrChart({ stats, pos, estimated }: { stats: PlayerStat[]; pos: 'WR' | 'TE'; estimated: boolean }) {
  const pool = stats.filter((p) => p.pos === pos && p.routes >= (pos === 'TE' ? 40 : 60));
  const xm = Math.max(100, ...pool.map((p) => p.routes)) * 1.05, ym = Math.max(100, ...pool.map((p) => p.yds)) * 1.08;
  const x = (v: number) => M.l + (v / xm) * (W - M.l - M.r), y = (v: number) => H - M.b - (v / ym) * (H - M.t - M.b);
  const top = [...pool].sort((a, b) => b.yds - a.yds).slice(0, 22);
  const labels = placeLabels(top.map((p) => ({ x: x(p.routes) + 15, y: y(p.yds) + 4, text: shortName(p.name) })));
  return (
    <section aria-labelledby={`yprr-${pos}`} className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 id={`yprr-${pos}`} className="text-sm font-semibold uppercase tracking-wide">Yards per route run, visualised</h2>
        {estimated && <span className="text-xs text-muted">routes estimated until the participation file is out</span>}
      </div>
      <p className="px-4 text-sm text-muted">Volume and efficiency in one picture: further right is more routes, steeper is more yards per route.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Routes run against receiving yards, ${pool.length} players`}>
        {RAYS.map((r) => { const xe = Math.min(xm, ym / r); return (
          <g key={r}><line x1={x(0)} y1={y(0)} x2={x(xe)} y2={y(xe * r)} strokeDasharray="3 5" style={{ stroke: 'var(--muted)', strokeOpacity: 0.4 }} />
            <text x={x(xe) - 4} y={y(xe * r) + (xe < xm ? 12 : -4)} textAnchor="end" fontSize={11} style={{ fill: 'var(--muted)' }}>{r.toFixed(1)} YPRR</text></g>); })}
        <text x={(M.l + W - M.r) / 2} y={H - 10} textAnchor="middle" fontSize={13} style={{ fill: 'var(--muted)' }}>Routes run</text>
        <text x={16} y={(M.t + H - M.b) / 2} textAnchor="middle" fontSize={13} transform={`rotate(-90 16 ${(M.t + H - M.b) / 2})`} style={{ fill: 'var(--muted)' }}>Receiving yards</text>
        {pool.map((p) => <g key={p.id} data-player={p.id}><title>{`${p.name}: ${p.yds} yds on ${Math.round(p.routes)} routes`}</title><TeamLogo team={p.team} x={x(p.routes)} y={y(p.yds)} size={24} /></g>)}
        {labels.map((l) => <text key={`${l.text}${l.y}`} x={l.x} y={l.y} fontSize={11} style={{ fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{l.text}</text>)}
      </svg>
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">The dashed rays are yards per route run. A player above the 2.5 ray is elite per route, wherever he sits on volume.</p>
    </section>
  );
}
