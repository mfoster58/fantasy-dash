import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PlayerStat } from '../../../lib/stats/players/season';
import { extent, fitLine, placeLabels, shortName } from '../../../lib/stats/players/quadrant';
import type { View } from '../../../lib/stats/players/views';
import { PlayerLink } from '../../NameLink';
import TeamLogo from './TeamLogo';

const W = 1180, H = 620, M = { l: 62, r: 24, t: 20, b: 52 };
const TINT = ['var(--win)', 'var(--accent)', 'var(--warn)', 'var(--loss)'];
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
function ticks(lo: number, hi: number, n = 6): number[] {
  const st = 10 ** Math.floor(Math.log10((hi - lo) / n || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * st).find((s) => (hi - lo) / s <= n) ?? st * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/** a formatted value, or a dash when it is missing */
const show = (f: (v: number) => string, v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? f(v) : '–');

/** One stat pairing as a quadrant chart of team logos: league-average lines, named quadrants, a trend line or an "equal" diagonal. */
export default function QuadrantChart({ view, pool, note }: { view: View; pool: PlayerStat[]; note?: string }) {
  const [table, setTable] = useState(false);
  const [hot, setHot] = useState<{ p: PlayerStat; x: number; y: number } | null>(null);
  const lastPointer = useRef('mouse');
  const navigate = useNavigate();
  const xv = (p: PlayerStat) => p[view.x] as number, yv = (p: PlayerStat) => p[view.y] as number;
  const geo = useMemo(() => {
    if (!pool.length) return null;
    let [x0, x1] = extent(pool.map(xv)), [y0, y1] = extent(pool.map(yv));
    if (view.diagonal) { const lo = Math.min(x0, y0), hi = Math.max(x1, y1); x0 = y0 = lo; x1 = y1 = hi; }
    const x = lin(x0, x1, M.l, W - M.r), y = lin(y0, y1, H - M.b, M.t);
    const mx = pool.reduce((s, p) => s + xv(p), 0) / pool.length, my = pool.reduce((s, p) => s + yv(p), 0) / pool.length;
    const fit = view.diagonal ? null : fitLine(pool.map(xv), pool.map(yv));
    const labels = placeLabels(pool.map((p) => ({ x: x(xv(p)) + 16, y: y(yv(p)) + 4, text: shortName(p.name) })), 6.4, 12, { top: M.t + 12, bottom: H - M.b - 4 });
    return { x0, x1, y0, y1, x, y, mx, my, fit, labels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, view]);
  const id = `quad-${view.id}`;

  return (
    <section aria-labelledby={id} className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 id={id} className="text-sm font-semibold uppercase tracking-wide">{view.label}</h2>
        {!note && <button type="button" aria-pressed={table} onClick={() => setTable((t) => !t)} className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:text-ink">Table</button>}
      </div>
      <p className="px-4 text-sm text-muted">{view.question}</p>
      {note ? <p className="px-4 py-16 text-center text-sm text-muted">{note}</p> : table ? (
        <div className="overflow-x-auto px-4 py-3">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Player</th><th>Team</th><th className="text-right">{view.xLabel}</th><th className="text-right">{view.yLabel}</th></tr></thead>
            <tbody>{[...pool].sort((a, b) => yv(b) - yv(a)).map((p) => (
              <tr key={p.id} className="border-t border-line"><td className="py-1"><PlayerLink id={p.id}>{p.name}</PlayerLink></td><td className="text-muted">{p.team}</td><td className="num text-right">{view.fx(xv(p))}</td><td className="num text-right">{view.fy(yv(p))}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : geo && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${view.label}: ${pool.length} players`}>
            {[[geo.x(geo.mx), M.t, W - M.r - geo.x(geo.mx), geo.y(geo.my) - M.t], [M.l, M.t, geo.x(geo.mx) - M.l, geo.y(geo.my) - M.t], [geo.x(geo.mx), geo.y(geo.my), W - M.r - geo.x(geo.mx), H - M.b - geo.y(geo.my)], [M.l, geo.y(geo.my), geo.x(geo.mx) - M.l, H - M.b - geo.y(geo.my)]].map(([a, b, w, h], i) => (
              <rect key={i} x={a} y={b} width={Math.max(0, w)} height={Math.max(0, h)} style={{ fill: TINT[i], fillOpacity: 0.07 }} />
            ))}
            {ticks(geo.y0, geo.y1).map((t) => <g key={`y${t}`}><line x1={M.l} x2={W - M.r} y1={geo.y(t)} y2={geo.y(t)} style={{ stroke: 'var(--line)' }} /><text x={M.l - 8} y={geo.y(t) + 4} textAnchor="end" fontSize={12} style={{ fill: 'var(--muted)' }}>{view.fy(t)}</text></g>)}
            {ticks(geo.x0, geo.x1).map((t) => <text key={`x${t}`} x={geo.x(t)} y={H - M.b + 18} textAnchor="middle" fontSize={12} style={{ fill: 'var(--muted)' }}>{view.fx(t)}</text>)}
            <text x={(M.l + W - M.r) / 2} y={H - 10} textAnchor="middle" fontSize={13} style={{ fill: 'var(--muted)' }}>{view.xLabel}</text>
            <text x={16} y={(M.t + H - M.b) / 2} textAnchor="middle" fontSize={13} transform={`rotate(-90 16 ${(M.t + H - M.b) / 2})`} style={{ fill: 'var(--muted)' }}>{view.yLabel}</text>
            <line x1={geo.x(geo.mx)} x2={geo.x(geo.mx)} y1={M.t} y2={H - M.b} strokeDasharray="5 5" style={{ stroke: 'var(--muted)' }} />
            <line x1={M.l} x2={W - M.r} y1={geo.y(geo.my)} y2={geo.y(geo.my)} strokeDasharray="5 5" style={{ stroke: 'var(--muted)' }} />
            {view.diagonal
              ? <line x1={geo.x(geo.x0)} y1={geo.y(geo.x0)} x2={geo.x(geo.x1)} y2={geo.y(geo.x1)} strokeDasharray="2 6" strokeWidth={2} style={{ stroke: 'var(--ink)', strokeOpacity: 0.45 }} />
              : geo.fit && <line x1={geo.x(geo.x0)} y1={geo.y(geo.fit.a + geo.fit.b * geo.x0)} x2={geo.x(geo.x1)} y2={geo.y(geo.fit.a + geo.fit.b * geo.x1)} strokeWidth={1.5} style={{ stroke: 'var(--ink)', strokeOpacity: 0.35 }} />}
            {view.quads.map((q, i) => {
              const w = q.length * 7.2 + 22, right = i % 2 === 0, top = i < 2;
              const xx = right ? W - M.r - 10 - w : M.l + 10, yy = top ? M.t + 8 : H - M.b - 32;
              return <g key={q}><rect x={xx} y={yy} width={w} height={24} rx={12} style={{ fill: TINT[i], fillOpacity: 0.9 }} /><text x={xx + w / 2} y={yy + 16} textAnchor="middle" fontSize={12} fontWeight={800} style={{ fill: 'var(--bg)' }}>{q.toUpperCase()}</text></g>;
            })}
            {pool.map((p) => (
              <g key={p.id} data-player={p.id} className="cursor-pointer"
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHot({ p, x: geo.x(xv(p)), y: geo.y(yv(p)) }); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHot(null); }}
                onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
                onClick={() => { if (lastPointer.current === 'mouse') navigate(`/player/${p.id}`); else setHot((h) => (h?.p.id === p.id ? null : { p, x: geo.x(xv(p)), y: geo.y(yv(p)) })); }}>
                <TeamLogo team={p.team} x={geo.x(xv(p))} y={geo.y(yv(p))} />
              </g>
            ))}
            {geo.labels.map((l) => (
              <g key={`${l.text}${l.x}${l.y}`}>
                {l.dy !== 0 && <line x1={l.x - 3} y1={l.y - 4 - l.dy} x2={l.x - 1} y2={l.y - 4} strokeWidth={1} style={{ stroke: 'var(--muted)' }} />}
                <text x={l.x} y={l.y} fontSize={11} style={{ fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{l.text}</text>
              </g>
            ))}
          </svg>
          {hot && (
            <div role="tooltip" className="pointer-events-auto absolute z-10 rounded-md border border-line bg-bg px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${(hot.x / W) * 100}%`, top: `${(hot.y / H) * 100}%`, transform: 'translate(12px, 12px)' }}>
              <PlayerLink id={hot.p.id} className="font-semibold">{hot.p.name}</PlayerLink> <span className="text-muted">· {hot.p.team}</span>
              <div>{view.xLabel}: <b>{show(view.fx, xv(hot.p))}</b></div>
              <div>{view.yLabel}: <b>{show(view.fy, yv(hot.p))}</b></div>
            </div>
          )}
        </div>
      )}
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
        Dashed lines are the league average{view.diagonal ? '; the dotted diagonal is where both are equal' : '; the solid line is the trend across these players'}. The 40 players with the most volume. Hover a logo for his numbers; click to open his page.
      </p>
    </section>
  );
}
