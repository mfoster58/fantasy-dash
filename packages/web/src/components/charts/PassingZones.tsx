import { useMemo, useState } from 'react';
import { SIDES, type ChartDb, type Pocket, type Zone } from '@fantasy-dash/core';
import { chartItems, hasChart, type ChartItem } from '../../lib/charts/rank';
import { heatColor, ordinal, pctColor } from '../../lib/charts/scale';
import { SPLIT_SPEC, ZONE_SPEC } from '../../lib/charts/specs';
import { ChartCard, Chevrons, Seg, Sidelines, useHot } from './Field';

const METRICS: [string, string][] = [['share', 'Throw share'], ['comp', 'Comp %'], ['ypa', 'Yds/att'], ['epa', 'EPA/att'], ['cpoe', 'CPOE']];
const POCKETS: [Pocket, string][] = [['all', 'All'], ['clean', 'Clean pocket'], ['pressured', 'Pressured']];
/** depth range in yards for each band, to scale: 7 behind the line to 35 past it */
const RANGE: Record<string, [number, number]> = { deep: [20, 35], mid: [10, 20], short: [0, 10], blos: [-7, 0] };
const BAND_LABEL: Record<string, string> = { deep: '20+ yds', mid: '10–19', short: '0–9', blos: 'Behind the line' };
const W = 460, SB = 34, FX = SB + 6, FW = W - 2 * FX, YD = 8, TOP = 10, CW = FW / 3;
const Y = (v: number) => TOP + (35 - v) * YD, H = Y(-7) + 8;
/** the tiles' stat for each metric: comp and ypa match, the rest show EPA per dropback */
const TILE: Record<string, string> = { share: 'epa', cpoe: 'epa', epa: 'epa', comp: 'comp', ypa: 'ypa' };

export default function PassingZones({ charts, gsis }: { charts: ChartDb[]; gsis: string }) {
  const years = useMemo(() => charts.filter((c) => hasChart(ZONE_SPEC, c, gsis)).map((c) => c.year).sort((a, b) => b - a), [charts, gsis]);
  const [year, setYear] = useState(years[0] ?? 0);
  const [pocket, setPocket] = useState<Pocket>('all');
  const [metric, setMetric] = useState('share');
  const [hot, bind] = useHot();
  const db = charts.find((c) => c.year === year) ?? charts.find((c) => c.year === years[0]);
  const items = useMemo(() => (db ? chartItems(ZONE_SPEC, db, gsis, pocket, metric) ?? [] : []), [db, gsis, pocket, metric]);
  const splits = useMemo(() => (db ? chartItems(SPLIT_SPEC, db, gsis, 'all', TILE[metric]) ?? [] : []), [db, gsis, metric]);
  if (!years.length || !db) return null;

  const share = metric === 'share';
  const def = share ? null : ZONE_SPEC.metrics[metric];
  const tileDef = SPLIT_SPEC.metrics[TILE[metric]];
  const colour = (i: ChartItem<Zone>) => (share ? heatColor(i.share, ZONE_SPEC.shareMax) : pctColor(i.pct));
  const hotItem = items.find((i) => i.key === hot);
  const uid = `zg-${year}`;

  return (
    <ChartCard id="chart-zones" title="Passing zones" years={years} year={year} onYear={setYear}
      controls={<><Seg label="Pocket" options={POCKETS} value={pocket} onChange={setPocket} /><Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} /></>}
      tip={hotItem ? <>
        <b>{BAND_LABEL[hotItem.key.split('|')[0]]} {hotItem.key.split('|')[1]}</b> · {hotItem.counts[0]} att, {hotItem.counts[1]} comp, {hotItem.counts[2]} yds, {hotItem.counts[4]} TD, {hotItem.counts[5]} INT · {Math.round(hotItem.share * 100)}% of his throws
        {Object.entries(ZONE_SPEC.metrics).map(([k, m]) => { const one = chartItems(ZONE_SPEC, db, gsis, pocket, k)!.find((x) => x.key === hotItem.key)!; return one.value === null ? null : <span key={k}> · {m.label} <b>{m.fmt(one.value)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
      </> : <span className="text-muted">Hover a zone for its numbers.</span>}
      legend={share ? <span>Share of his throws, 0% to 20%+ · depth is air yards, drawn to scale</span>
        : <><span>{def!.label} percentile among QBs · grey = under {ZONE_SPEC.min} throws, not ranked</span>{metric === 'cpoe' && <span>CPOE = completion % over what an average QB completes on the same throws</span>}</>}>
      <div className="px-3 pt-3">
        <svg viewBox={`0 0 ${W} ${H + 26}`} className="mx-auto block w-full max-w-[560px]" role="img" aria-label={`Passing zones, ${year}`}>
          <defs><filter id={uid} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={16} /></filter></defs>
          <rect x={FX} y={Y(35)} width={FW} height={H - Y(35)} style={{ fill: 'var(--field)' }} />
          <Sidelines width={W} top={Y(35)} bottom={H} band={SB} marks={[[0, 'LOS'], [10, '+10'], [20, '+20'], [30, '+30']].map(([v, l]) => ({ y: Y(v as number), label: l as string }))} />
          {Array.from({ length: 43 }, (_, n) => n - 7).map((v) => (
            <g key={v}>
              {v % 5 === 0 && v !== 0 && <line x1={FX} x2={FX + FW} y1={Y(v)} y2={Y(v)} strokeWidth={1.2} style={{ stroke: 'var(--field-line)' }} />}
              {[[FX, FX + 7], [FX + FW - 7, FX + FW], [FX + CW - 5, FX + CW + 5], [FX + 2 * CW - 5, FX + 2 * CW + 5]].map(([a, b]) => <line key={a} x1={a} x2={b} y1={Y(v)} y2={Y(v)} style={{ stroke: 'var(--field-line)' }} />)}
            </g>
          ))}
          {items.map((i) => {
            const [band, side] = i.key.split('|');
            const [lo, hi] = RANGE[band], cx = FX + SIDES.indexOf(side as (typeof SIDES)[number]) * CW + CW / 2, h = Y(lo) - Y(hi), cy = (Y(lo) + Y(hi)) / 2;
            const dim = !share && !i.ranked;
            return <ellipse key={i.key} cx={cx} cy={cy} rx={CW * 0.36} ry={Math.min(46, h * 0.42)} filter={`url(#${uid})`} opacity={dim ? 0.25 : share ? 0.3 + 0.32 * Math.min(1, i.share / ZONE_SPEC.shareMax) : 0.6} style={{ fill: colour(i) }} />;
          })}
          <line x1={FX} x2={FX + FW} y1={Y(0)} y2={Y(0)} strokeWidth={3} style={{ stroke: 'var(--los)' }} />
          <g className={hot ? '[&>g]:opacity-25 [&>g[data-hot=true]]:opacity-100' : ''}>
            {items.map((i) => {
              const [band, side] = i.key.split('|');
              const [lo, hi] = RANGE[band], cx = FX + SIDES.indexOf(side as (typeof SIDES)[number]) * CW + CW / 2, h = Y(lo) - Y(hi), cy = (Y(lo) + Y(hi)) / 2;
              const main = share ? `${Math.round(i.share * 100)}%` : i.value === null ? '–' : def!.fmt(i.value);
              const sub = share ? `${i.volume} att` : i.ranked ? `${ordinal(i.pct!)} · ${i.volume} att` : `${i.volume} att · too few to rank`;
              const small = h < 70, fs = main.length > 4 ? (small ? 17 : 20) : small ? 20 : 23, ny = cy + (small ? 2 : 4), c = colour(i), ranked = share || i.ranked;
              return (
                <g key={i.key} data-zone={i.key} data-pct={share ? '' : String(i.pct ?? '')} data-hot={hot === i.key} className="cursor-pointer transition-opacity" {...bind(i.key)}>
                  <rect x={cx - CW / 2 + 4} y={cy - h / 2 + 3} width={CW - 8} height={h - 6} fill="transparent" />
                  {ranked && <Chevrons cx={cx} y={ny - fs * 0.33} gap={50} fill={c} />}
                  <text data-main x={cx} y={ny} textAnchor="middle" fontSize={fs} fontWeight={800} style={{ fill: ranked ? 'var(--ink)' : 'var(--muted)' }}>{main}</text>
                  {ranked && <line x1={cx - 22} x2={cx + 22} y1={ny + 4} y2={ny + 4} strokeWidth={2.5} strokeLinecap="round" style={{ stroke: c }} />}
                  <text x={cx} y={ny + (small ? 16 : 19)} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)' }}>{sub}</text>
                </g>
              );
            })}
          </g>
          {SIDES.map((s, n) => <text key={s} x={FX + n * CW + CW / 2} y={H + 18} textAnchor="middle" fontSize={10.5} style={{ fill: 'var(--muted)' }}>{s[0].toUpperCase() + s.slice(1)}</text>)}
        </svg>
        <div className="grid grid-cols-3 gap-2 pb-3 pt-2">
          {([['all', 'All'], ['man', 'vs Man'], ['zone', 'vs Zone']] as const).map(([k, label]) => {
            const s = splits.find((x) => x.key === k);
            return (
              <div key={k} data-testid="zone-tile" className="overflow-hidden rounded-lg bg-surface-2 text-center">
                <div className="num py-2 text-2xl font-bold">{s?.value != null ? tileDef.fmt(s.value) : '–'}</div>
                <div className="flex items-center justify-center gap-1.5 bg-bg px-1 py-1.5 text-[11px] text-muted">
                  {label} · {tileDef.label}
                  {s?.ranked && <span className="rounded px-1 font-bold" style={{ background: pctColor(s.pct), color: 'var(--on-chip)' }}>{s.pct}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}
