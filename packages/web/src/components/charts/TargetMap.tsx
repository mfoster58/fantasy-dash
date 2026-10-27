import { useMemo, useState } from 'react';
import { SIDES, type ChartDb, type TargetFilter, type Zone } from '@fantasy-dash/core';
import { chartItems, hasChart, type ChartItem } from '../../lib/charts/rank';
import { CHART_CONTROLS, type ChartControl } from '../../lib/charts/controls';
import { heatColor, ordinal, pctColor } from '../../lib/charts/scale';
import { TARGET_SPEC } from '../../lib/charts/specs';
import { ChartCard, Seg, Sidelines, useChartSeason, useHot } from './Field';

const FILTERS = CHART_CONTROLS.targets.filters as [TargetFilter, string][];
const FTN_FILTERS = FILTERS.map(([k]) => k).filter((k) => k !== 'all');
const METRICS = CHART_CONTROLS.targets.metrics;
/** depth range in yards for each band, to scale: 7 behind the line to 35 past it */
const RANGE: Record<string, [number, number]> = { deep: [20, 35], mid: [10, 20], short: [0, 10], blos: [-7, 0] };
const BAND_LABEL: Record<string, string> = { deep: '20+ yds', mid: '10–19', short: '0–9', blos: 'Behind the line' };
const W = 460, SB = 34, FX = SB + 6, FW = W - 2 * FX, YD = 8, TOP = 10, CW = FW / 3;
const Y = (v: number) => TOP + (35 - v) * YD, H = Y(-7) + 8;
export const FTN_CREDIT = 'Data: FTN Data via nflverse';

/** Where his targets went, by depth and side, with FTN play filters; every zone's number is always shown. Sits beside the route tree. */
export default function TargetMap({ charts, gsis, current = 0, control }: { charts: ChartDb[]; gsis: string; current?: number; control?: ChartControl }) {
  const { years, year, setYear, db, latest } = useChartSeason(charts, (c) => hasChart(TARGET_SPEC, c, gsis), current, control?.year);
  const [picked, setFilter] = useState<TargetFilter>('all');
  const noFtn = !!db && !db.ftn;
  const filter: TargetFilter = noFtn ? 'all' : (control?.filter as TargetFilter | undefined) ?? picked;
  const [metricPicked, setMetric] = useState('share');
  const metric = control?.metric ?? metricPicked;
  const [hot, bind] = useHot();
  const items = useMemo(() => (db ? chartItems(TARGET_SPEC, db, gsis, filter, metric) ?? [] : []), [db, gsis, filter, metric]);
  if (!years.length) return null;
  const empty = db ? null : { title: `No target data for ${year} yet`, body: `It arrives with the season's play-by-play. Pick ${latest} or earlier.` };

  const share = metric === 'share';
  const def = share ? null : TARGET_SPEC.metrics[metric];
  const colour = (i: ChartItem<Zone>) => (share ? heatColor(i.share, TARGET_SPEC.shareMax) : pctColor(i.pct));
  const hotItem = items.find((i) => i.key === hot);
  const uid = `tg-${year}`;

  return (
    <ChartCard id={control ? `chart-targets-${gsis}` : 'chart-targets'} bare={!!control} title="Target map" years={years} year={year} onYear={setYear} empty={empty}
      controls={<>
        <Seg label="Plays" options={FILTERS} value={filter} onChange={setFilter} disabled={noFtn ? FTN_FILTERS : []} disabledTitle="No FTN charting for this season" />
        <Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} />
      </>}
      tip={hotItem ? <>
        <b>{BAND_LABEL[hotItem.key.split('|')[0]]} {hotItem.key.split('|')[1]}</b> · {hotItem.counts[0]} targets, {hotItem.counts[1]} rec, {hotItem.counts[2]} yds, {hotItem.counts[4]} TD · {Math.round(hotItem.share * 100)}% of his targets
        {hotItem.counts[0] > 0 && <> · EPA/target <b>{(hotItem.counts[3] / hotItem.counts[0]).toFixed(2)}</b></>}
      </> : <span className="text-muted">Hover a zone for its numbers.</span>}
      legend={<>
        <span>{share ? 'Share of his targets, 0% to 25%+' : `${def!.label} percentile among his position in that zone · grey = under ${TARGET_SPEC.min} targets, not ranked`} · depth is air yards, drawn to scale</span>
        <span>{FTN_CREDIT}</span>
      </>}>
      {!db?.participation && <p className="px-4 pt-2 text-xs text-muted">Route tree arrives when the season's route data is published</p>}
      <div className="px-3 pt-2">
        <svg viewBox={`0 0 ${W} ${H + 26}`} className="mx-auto block w-full max-w-[560px]" role="img" aria-label={`Target map, ${year}`}>
          <defs><filter id={uid} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={16} /></filter></defs>
          <rect x={FX} y={Y(35)} width={FW} height={H - Y(35)} style={{ fill: 'var(--field)' }} />
          <Sidelines width={W} top={Y(35)} bottom={H} band={SB} marks={[[0, 'LOS'], [10, '+10'], [20, '+20'], [30, '+30']].map(([v, l]) => ({ y: Y(v as number), label: l as string }))} />
          {Array.from({ length: 43 }, (_, n) => n - 7).filter((v) => v % 5 === 0 && v !== 0).map((v) => (
            <line key={v} x1={FX} x2={FX + FW} y1={Y(v)} y2={Y(v)} strokeWidth={1.2} style={{ stroke: 'var(--field-line)' }} />
          ))}
          {items.map((i) => {
            const [band, side] = i.key.split('|');
            const [lo, hi] = RANGE[band], cx = FX + SIDES.indexOf(side as (typeof SIDES)[number]) * CW + CW / 2, h = Y(lo) - Y(hi), cy = (Y(lo) + Y(hi)) / 2;
            const dim = !share && !i.ranked;
            return <ellipse key={i.key} cx={cx} cy={cy} rx={CW * 0.36} ry={Math.min(46, h * 0.42)} filter={`url(#${uid})`} opacity={dim ? 0.25 : share ? 0.3 + 0.32 * Math.min(1, i.share / TARGET_SPEC.shareMax) : 0.6} style={{ fill: colour(i) }} />;
          })}
          <line x1={FX} x2={FX + FW} y1={Y(0)} y2={Y(0)} strokeWidth={3} style={{ stroke: 'var(--los)' }} />
          <g className={hot ? '[&>g]:opacity-40 [&>g[data-hot=true]]:opacity-100' : ''}>
            {items.map((i) => {
              const [band, side] = i.key.split('|');
              const [lo, hi] = RANGE[band], cx = FX + SIDES.indexOf(side as (typeof SIDES)[number]) * CW + CW / 2, h = Y(lo) - Y(hi), cy = (Y(lo) + Y(hi)) / 2;
              const main = share ? `${Math.round(i.share * 100)}%` : i.value === null ? '–' : def!.fmt(i.value);
              const tall = h > 50;
              const sub = share || i.ranked ? `${i.volume} tgt${!share ? ` · ${ordinal(i.pct!)}` : ''}` : `${i.volume} tgt · not ranked`;
              return (
                <g key={i.key} data-zone={i.key} data-pct={share ? '' : String(i.pct ?? '')} data-hot={hot === i.key} className="cursor-pointer transition-opacity" {...bind(i.key)}>
                  <rect x={cx - CW / 2 + 4} y={cy - h / 2 + 3} width={CW - 8} height={h - 6} fill="transparent" />
                  <text data-main x={cx} y={cy + (tall ? 3 : 5)} textAnchor="middle" fontSize={tall ? 18 : 15} fontWeight={700} style={{ fill: share || i.ranked ? 'var(--ink)' : 'var(--muted)' }}>{main}</text>
                  {tall && <text x={cx} y={cy + 19} textAnchor="middle" fontSize={10.5} style={{ fill: 'var(--muted)' }}>{sub}</text>}
                </g>
              );
            })}
          </g>
          {SIDES.map((s, n) => <text key={s} x={FX + n * CW + CW / 2} y={H + 18} textAnchor="middle" fontSize={10.5} style={{ fill: 'var(--muted)' }}>{s[0].toUpperCase() + s.slice(1)}</text>)}
        </svg>
      </div>
    </ChartCard>
  );
}
