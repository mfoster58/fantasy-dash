import { useMemo, useState } from 'react';
import type { ChartDb, Split } from '@fantasy-dash/core';
import { chartItems, hasChart } from '../../lib/charts/rank';
import { CHART_CONTROLS, type ChartControl } from '../../lib/charts/controls';
import { ordinal, pctColor } from '../../lib/charts/scale';
import { SPLIT_GROUPS, SPLIT_SPEC } from '../../lib/charts/specs';
import { ChartCard, useChartSeason, Seg, useHot } from './Field';

const METRICS = CHART_CONTROLS.pressure.metrics;

export default function PressureCard({ charts, gsis, current = 0, control }: { charts: ChartDb[]; gsis: string; current?: number; control?: ChartControl }) {
  const { years, year, setYear, db, latest } = useChartSeason(charts, (c) => hasChart(SPLIT_SPEC, c, gsis), current, control?.year);
  const [metricPicked, setMetric] = useState('epa');
  const metric = control?.metric ?? metricPicked;
  const [hot, bind] = useHot();
  const items = useMemo(() => (db ? chartItems(SPLIT_SPEC, db, gsis, 'all', metric) ?? [] : []), [db, gsis, metric]);
  if (!years.length) return null;
  const empty = db ? null : { title: `No pressure data for ${year} yet`, body: `It arrives when the season is complete. Pick ${latest} or earlier to see how he did under pressure.` };

  const def = SPLIT_SPEC.metrics[metric];
  const by = new Map(items.map((i) => [i.key, i]));
  const all = by.get('all');
  const hotItem = hot ? by.get(hot as Split) : undefined;
  const row = (k: Split, label: string, strong = false) => {
    const i = by.get(k);
    if (!i) return null;
    return (
      <li key={k} data-key={k} data-pct={String(i.pct ?? '')} {...bind(k)}
        className={`grid cursor-pointer grid-cols-[8rem_minmax(0,1fr)_3.6rem_2.4rem] items-center gap-2.5 rounded px-1.5 py-1 text-xs ${hot === k ? 'bg-surface-2' : ''}`}>
        <span className="truncate">{strong ? <b>{label}</b> : label} <span className="text-muted">{i.volume}</span></span>
        <span className="relative h-1.5 rounded-full bg-surface-2">
          {i.ranked && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, i.pct!)}%`, background: pctColor(i.pct) }} />}
          {k !== 'all' && all?.ranked && <span className="absolute -inset-y-1 w-0.5 rounded bg-muted" style={{ left: `calc(${all.pct}% - 1px)` }} />}
        </span>
        <span className="num text-right text-muted">{i.value === null ? '–' : def.fmt(i.value)}</span>
        <span className="num text-right font-semibold">{i.ranked ? i.pct : '–'}</span>
      </li>
    );
  };

  return (
    <ChartCard id={control ? `chart-pressure-${gsis}` : 'chart-pressure'} bare={!!control} title="Under pressure & vs coverage" years={years} year={year} onYear={setYear} empty={empty}
      controls={<Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} />}
      tip={hotItem ? <>
        {hotItem.counts[0]} dropbacks, {hotItem.counts[1]} att, {hotItem.counts[2]} comp, {hotItem.counts[3]} yds, {hotItem.counts[5]} sacks
        {Object.entries(SPLIT_SPEC.metrics).map(([k, m]) => { const one = chartItems(SPLIT_SPEC, db!, gsis, 'all', k)!.find((x) => x.key === hotItem.key)!; return one.value === null ? null : <span key={k}> · {m.label} <b>{m.fmt(one.value)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
      </> : <span className="text-muted">Each row ranks him only against QBs in the same situation, not against his own other rows.</span>}
      legend={<><span>{def.label} percentile among QBs in the same situation · under {SPLIT_SPEC.min} dropbacks, not ranked</span><span>Tick = his All dropbacks percentile</span>{metric === 'sack' && <span>Lower sack % ranks higher</span>}</>}>
      <ul className="px-3 py-2" aria-label="Splits">
        {row('all', 'All dropbacks', true)}
        {SPLIT_GROUPS.map((g) => {
          const rows = g.rows.map(([k, label]) => row(k, label)).filter(Boolean);
          return rows.length ? [<li key={g.label} className="px-1.5 pb-0.5 pt-2.5 text-[10px] uppercase tracking-wide text-muted">{g.label}</li>, ...rows] : null;
        })}
      </ul>
    </ChartCard>
  );
}
