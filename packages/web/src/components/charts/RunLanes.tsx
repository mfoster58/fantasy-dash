import { useMemo, useState } from 'react';
import type { Box, ChartDb, Lane } from '@fantasy-dash/core';
import { chartItems, hasChart, type ChartItem } from '../../lib/charts/rank';
import { chipInk, heatColor, ordinal, pctColor } from '../../lib/charts/scale';
import { LANE_LABEL, LANE_SPEC } from '../../lib/charts/specs';
import ChartBars from './ChartBars';
import { Arrowhead, ChartCard, Chip, Seg, Sidelines, useHot } from './Field';

/** gap: where he crosses the line (px from centre); tip: where the arrow ends */
const GEO: Record<Lane, { gap: number; tip: [number, number] }> = {
  LE: { gap: -158, tip: [-245, 150] }, LT: { gap: -62, tip: [-165, 78] }, LG: { gap: -21, tip: [-78, 128] },
  MID: { gap: 0, tip: [0, 62] },
  RG: { gap: 21, tip: [78, 128] }, RT: { gap: 62, tip: [165, 78] }, RE: { gap: 158, tip: [245, 150] },
};
const LINE: [string, number, boolean][] = [['TE', -118, true], ['LT', -82, false], ['LG', -41, false], ['C', 0, false], ['RG', 41, false], ['RT', 82, false], ['TE', 118, true]];
const METRICS: [string, string][] = [['share', 'Carry share'], ['ypc', 'Yds/carry'], ['succ', 'Success %'], ['epa', 'EPA/carry']];
const BOXES: [Box, string][] = [['all', 'All'], ['light', 'Light box (≤6)'], ['heavy', 'Heavy box (7+)']];
const W = 700, BAND = 30, CX = 350, LOS = 232, RB_Y = 330, H = 370;

export default function RunLanes({ charts, gsis }: { charts: ChartDb[]; gsis: string }) {
  const years = useMemo(() => charts.filter((c) => hasChart(LANE_SPEC, c, gsis)).map((c) => c.year).sort((a, b) => b - a), [charts, gsis]);
  const [year, setYear] = useState(years[0] ?? 0);
  const [box, setBox] = useState<Box>('all');
  const [metric, setMetric] = useState('share');
  const [hot, bind] = useHot();
  const db = charts.find((c) => c.year === year) ?? charts.find((c) => c.year === years[0]);
  const items = useMemo(() => (db ? chartItems(LANE_SPEC, db, gsis, box, metric) ?? [] : []), [db, gsis, box, metric]);
  if (!years.length || !db) return null;

  const share = metric === 'share';
  const def = share ? null : LANE_SPEC.metrics[metric];
  const colour = (i: ChartItem<Lane>) => (share ? heatColor(i.share, LANE_SPEC.shareMax) : pctColor(i.pct));
  const hotItem = items.find((i) => i.key === hot);

  return (
    <ChartCard id="chart-lanes" title="Run lanes" years={years} year={year} onYear={setYear}
      controls={<><Seg label="Box" options={BOXES} value={box} onChange={setBox} /><Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} /></>}
      tip={hotItem ? <>
        <b>{LANE_LABEL[hotItem.key]}</b> · {hotItem.counts[0]} carries, {hotItem.counts[1]} yds, {hotItem.counts[4]} TD · {Math.round(hotItem.share * 100)}% of his carries
        {Object.entries(LANE_SPEC.metrics).map(([k, m]) => { const one = chartItems(LANE_SPEC, db, gsis, box, k)!.find((x) => x.key === hotItem.key)!; return <span key={k}> · {m.label} <b>{m.fmt(one.value!)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
      </> : <span className="text-muted">Hover a lane for its numbers.</span>}
      legend={share ? <span>Share of his carries, 0% to 25%+</span>
        : <><span>{def!.label} percentile among RBs · grey = under {LANE_SPEC.min} carries, not ranked</span><span>Success = a carry that gained EPA</span></>}>
      <div className="grid @4xl:grid-cols-[minmax(0,1.7fr)_minmax(15rem,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[760px] px-2 py-3" role="img" aria-label={`Run lanes, ${year}`}>
          <rect x={BAND} y={20} width={W - 2 * BAND} height={H - 20} style={{ fill: 'var(--field)' }} />
          <Sidelines width={W} top={20} bottom={H} band={BAND} marks={[{ y: LOS, label: 'LOS' }]} />
          <line x1={BAND} x2={W - BAND} y1={LOS} y2={LOS} strokeWidth={2} style={{ stroke: 'var(--los)' }} />
          <g className={hot ? '[&>g]:opacity-15 [&>g[data-hot=true]]:opacity-100' : ''}>
            {items.map((i) => {
              const g = GEO[i.key], c = colour(i);
              const gap: [number, number] = [CX + g.gap, LOS], tip: [number, number] = [CX + g.tip[0], g.tip[1]];
              const ctrl = Math.abs(g.gap) > 100 ? [CX + g.gap * 0.55, LOS + 38] : [CX + g.gap * 0.6, LOS + 30];
              const d = `M${CX},${RB_Y - 12} Q${ctrl[0]},${ctrl[1]} ${gap[0]},${gap[1]} L${tip[0]},${tip[1]}`;
              const chipText = share ? `${Math.round(i.share * 100)}%` : def!.fmt(i.value!);
              const sm = share ? `${i.volume} car` : i.ranked ? `${ordinal(i.pct!)} · ${i.volume} car` : `${i.volume} car · too few to rank`;
              const ly = tip[1] - 14, chipW = chipText.length * 7 + 10, rowW = chipW + 4 + sm.length * 5.4, x0 = tip[0] - rowW / 2;
              const chip = Chip({ x: x0, y: ly, text: chipText, fill: share || i.ranked ? c : 'var(--surface-2)', ink: share ? chipInk('heat', i.share) : i.ranked ? chipInk('pct') : 'var(--muted)' });
              return (
                <g key={i.key} data-lane={i.key} data-pct={share ? '' : String(i.pct ?? '')} data-hot={hot === i.key} className="cursor-pointer transition-opacity" {...bind(i.key)}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={18} />
                  <path d={d} fill="none" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={!share && !i.ranked ? '2 6' : undefined} style={{ stroke: c }} />
                  <Arrowhead from={gap} to={tip} fill={c} size={10} />
                  <text x={tip[0]} y={ly - 17} textAnchor="middle" fontSize={11.5} fontWeight={600} style={{ fill: 'var(--ink)' }}>{LANE_LABEL[i.key]}</text>
                  {chip.el}
                  <text x={x0 + chipW + 4} y={ly} fontSize={10} style={{ fill: 'var(--muted)' }}>{sm}</text>
                </g>
              );
            })}
          </g>
          {LINE.map(([t, x, ghost]) => (
            <g key={`${t}${x}`}>
              <rect x={CX + x - 13} y={LOS + 4} width={26} height={22} rx={5} strokeDasharray={ghost ? '3 3' : undefined} style={{ fill: ghost ? 'var(--field)' : 'var(--line)', stroke: 'var(--field-line)' }} />
              <text x={CX + x} y={LOS + 19} textAnchor="middle" fontSize={9} fontWeight={600} style={{ fill: 'var(--muted)' }}>{t}</text>
            </g>
          ))}
          <circle cx={CX} cy={RB_Y} r={10} style={{ fill: 'var(--ink)' }} />
          <text x={CX} y={RB_Y + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} style={{ fill: 'var(--bg)' }}>RB</text>
          <text x={W - BAND - 6} y={H - 8} textAnchor="end" fontSize={9} style={{ fill: 'var(--muted)' }}>offense&apos;s left ← → offense&apos;s right</text>
        </svg>
        <ChartBars hot={hot} bind={bind} rows={items.map((i) => ({
          key: i.key, label: LANE_LABEL[i.key], sub: share ? '' : String(i.volume),
          width: share ? (i.volume / Math.max(...items.map((x) => x.volume))) * 100 : i.pct ?? 0,
          fill: colour(i), value: share ? `${i.volume} car` : def!.fmt(i.value!), rank: share ? `${Math.round(i.share * 100)}%` : i.ranked ? String(i.pct) : '–',
        }))} />
      </div>
    </ChartCard>
  );
}
