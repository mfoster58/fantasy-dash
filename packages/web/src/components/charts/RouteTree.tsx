import { useMemo, useState } from 'react';
import type { ChartDb, Coverage, Route } from '@fantasy-dash/core';
import { chartItems, hasChart, type ChartItem } from '../../lib/charts/rank';
import { chipInk, heatColor, ordinal, pctColor } from '../../lib/charts/scale';
import { ROUTE_LABEL, ROUTE_SPEC } from '../../lib/charts/specs';
import ChartBars from './ChartBars';
import { Arrowhead, ChartCard, Chip, Seg, Sidelines, useHot } from './Field';

/** Route paths in yards from the receiver (x < 0 is inside), the label anchor, and a fixed label spot where the tip would collide. */
const SHAPES: Record<Route, { p: [number, number][]; a: 'start' | 'middle' | 'end'; l?: [number, number] }> = {
  GO: { p: [[0, 12], [0, 23]], a: 'middle' },
  POST: { p: [[0, 12], [-7, 20]], a: 'end' },
  CORNER: { p: [[0, 12], [6, 19]], a: 'start' },
  'IN/DIG': { p: [[0, 12], [-10, 12]], a: 'end' },
  'DEEP OUT': { p: [[0, 12], [7, 12]], a: 'start' },
  'HITCH/CURL': { p: [[0, 12], [-2.8, 9]], a: 'end', l: [-3.6, 9.4] },
  SLANT: { p: [[0, 3], [-5.5, 8]], a: 'end', l: [-6.3, 6.6] },
  'QUICK OUT': { p: [[0, 3], [5.5, 3]], a: 'start' },
  'SHALLOW CROSS/DRAG': { p: [[0, 0], [-2, 2.5], [-11.5, 3.5]], a: 'end' },
  'TEXAS/ANGLE': { p: [[0, 0], [2.5, 3], [-3, 6.5]], a: 'end', l: [-3.6, 5] },
  WHEEL: { p: [[0, 0], [3, 1], [5.5, 4], [6, 15]], a: 'start' },
  SCREEN: { p: [[0, 0], [-1, -1.5], [-4, -2.2]], a: 'end' },
  SWING: { p: [[0, 0], [3, -1.5], [7, -0.5], [9, 1.5]], a: 'start', l: [9.8, -0.9] },
};
const METRICS: [string, string][] = [['share', 'Target share'], ['ypt', 'Yds/tgt'], ['catch', 'Catch %'], ['epa', 'EPA/tgt']];
const COVERAGES: [Coverage, string][] = [['all', 'All'], ['man', 'vs Man'], ['zone', 'vs Zone']];
const W = 660, BAND = 30, OX = 365, OY = 272, SX = 12.5, SY = 10.2, H = 330;
const X = (x: number) => OX + x * SX, Y = (y: number) => OY - y * SY;

export default function RouteTree({ charts, gsis, pos }: { charts: ChartDb[]; gsis: string; pos: string }) {
  const years = useMemo(() => charts.filter((c) => hasChart(ROUTE_SPEC, c, gsis)).map((c) => c.year).sort((a, b) => b - a), [charts, gsis]);
  const [year, setYear] = useState(years[0] ?? 0);
  const [cov, setCov] = useState<Coverage>('all');
  const [metric, setMetric] = useState('share');
  const [hot, bind] = useHot();
  const db = charts.find((c) => c.year === year) ?? charts.find((c) => c.year === years[0]);
  const items = useMemo(() => (db ? chartItems(ROUTE_SPEC, db, gsis, cov, metric) ?? [] : []), [db, gsis, cov, metric]);
  if (!years.length || !db) return null;

  const share = metric === 'share';
  const def = share ? null : ROUTE_SPEC.metrics[metric];
  const colour = (i: ChartItem<Route>) => (share ? heatColor(i.share, ROUTE_SPEC.shareMax) : pctColor(i.pct));
  const main = (i: ChartItem<Route>) => (share ? `${Math.round(i.share * 100)}%` : def!.fmt(i.value!));
  const small = (i: ChartItem<Route>) => (share ? `${i.volume} tgt` : i.ranked ? `${ordinal(i.pct!)} · ${i.volume} tgt` : `${i.volume} tgt · too few to rank`);
  const pool = Object.values(db.players).filter((p) => p.pos === db.players[gsis]?.pos && (p.routes?.[cov] ? Object.keys(p.routes[cov]).length : 0) > 0).length;
  const hotItem = items.find((i) => i.key === hot);
  const marks = [0, 5, 10, 15, 20].map((v) => ({ y: Y(v), label: v === 0 ? 'LOS' : `+${v}` }));

  return (
    <ChartCard id="chart-routes" title="Route tree" years={years} year={year} onYear={setYear}
      controls={<><Seg label="Coverage" options={COVERAGES} value={cov} onChange={setCov} /><Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} /></>}
      tip={hotItem ? <>
        <b>{ROUTE_LABEL[hotItem.key]}</b> · {hotItem.counts[0]} targets, {hotItem.counts[1]} catches, {hotItem.counts[2]} yds, {hotItem.counts[4]} TD
        {' · '}{Math.round(hotItem.share * 100)}% of his targets
        {Object.entries(ROUTE_SPEC.metrics).map(([k, m]) => { const one = chartItems(ROUTE_SPEC, db, gsis, cov, k)!.find((x) => x.key === hotItem.key)!; return <span key={k}> · {m.label} <b>{m.fmt(one.value!)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
        <span className="text-muted"> · ranked against {pool} {pos}s</span>
      </> : <span className="text-muted">Hover a route for its numbers.</span>}
      legend={share ? <span>Share of his targets, 0% to 20%+ · switch metric to see how he ranks among {pos}s on each route</span>
        : <span>{def!.label} percentile among {pos}s · grey = under {ROUTE_SPEC.min} targets, not ranked</span>}>
      <div className="grid @4xl:grid-cols-[minmax(0,1.7fr)_minmax(15rem,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[760px] px-2 py-3" role="img" aria-label={`Route tree, ${year}`}>
          <rect x={BAND} y={Y(24)} width={W - 2 * BAND} height={H - Y(24)} style={{ fill: 'var(--field)' }} />
          {[5, 10, 15, 20].map((v) => <line key={v} x1={BAND} x2={W - BAND} y1={Y(v)} y2={Y(v)} strokeWidth={1} style={{ stroke: 'var(--field-line)' }} />)}
          <Sidelines width={W} top={Y(24)} bottom={H} band={BAND} marks={marks} />
          <line x1={BAND} x2={W - BAND} y1={Y(0)} y2={Y(0)} strokeWidth={2} style={{ stroke: 'var(--los)' }} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(12)} strokeWidth={3} strokeLinecap="round" style={{ stroke: 'var(--dim)' }} />
          <g className={hot ? '[&>g]:opacity-15 [&>g[data-hot=true]]:opacity-100' : ''}>
            {items.map((i) => {
              const s = SHAPES[i.key], c = colour(i);
              const pts = s.p.map(([x, y]) => [X(x), Y(y)] as [number, number]);
              const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
              const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
              const lx = s.l ? X(s.l[0]) : b[0] + Math.cos(ang) * 14;
              const ly = s.l ? Y(s.l[1]) : b[1] + Math.sin(ang) * 14 + (s.a === 'middle' ? -4 : 4);
              const name = ROUTE_LABEL[i.key], sm = small(i);
              const nameW = name.length * 6.6, chipText = main(i), chipW = chipText.length * 7 + 10, smW = sm.length * 5.4;
              const total = nameW + 5 + chipW + 4 + smW;
              const x0 = s.a === 'end' ? lx - total : s.a === 'middle' ? lx - total / 2 : lx;
              const chip = Chip({ x: x0 + nameW + 5, y: ly, text: chipText, fill: share || i.ranked ? c : 'var(--surface-2)', ink: share ? chipInk('heat', i.share) : i.ranked ? chipInk('pct') : 'var(--muted)' });
              return (
                <g key={i.key} data-route={i.key} data-pct={share ? '' : String(i.pct ?? '')} data-hot={hot === i.key} className="cursor-pointer transition-opacity" {...bind(i.key)}>
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="transparent" strokeWidth={16} />
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={!share && !i.ranked ? '2 6' : undefined} style={{ stroke: c }} />
                  <Arrowhead from={a} to={b} fill={c} />
                  <text x={x0} y={ly} fontSize={11.5} fontWeight={600} style={{ fill: 'var(--ink)' }}>{name}</text>
                  {chip.el}
                  <text x={x0 + nameW + 5 + chipW + 4} y={ly} fontSize={10} style={{ fill: 'var(--muted)' }}>{sm}</text>
                </g>
              );
            })}
          </g>
          <circle cx={X(0)} cy={Y(0)} r={8} style={{ fill: 'var(--ink)' }} />
          <text x={X(0)} y={Y(0) + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} style={{ fill: 'var(--bg)' }}>{pos === 'RB' ? 'RB' : pos}</text>
        </svg>
        <ChartBars hot={hot} bind={bind} rows={[...items].sort((p, q) => q.volume - p.volume).map((i) => ({
          key: i.key, label: ROUTE_LABEL[i.key], sub: share ? '' : String(i.volume),
          width: share ? (i.volume / Math.max(...items.map((x) => x.volume))) * 100 : i.pct ?? 0,
          fill: colour(i), value: share ? `${i.volume} tgt` : def!.fmt(i.value!), rank: share ? `${Math.round(i.share * 100)}%` : i.ranked ? String(i.pct) : '–',
        }))} />
      </div>
    </ChartCard>
  );
}
