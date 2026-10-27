import { useState } from 'react';
import type { ChartDb } from '@fantasy-dash/core';
import { CHART_CONTROLS, CHARTS_BY_GROUP, type ChartControl, type ChartKind } from '../../lib/charts/controls';
import type { PosGroup } from '../../lib/compare/url';
import PassingZones from '../charts/PassingZones';
import PressureCard from '../charts/PressureCard';
import RouteTree from '../charts/RouteTree';
import RunLanes from '../charts/RunLanes';
import TargetMap from '../charts/TargetMap';
import { Seg } from '../charts/Field';

export const COMPARE_CREDIT = 'Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse';

function Chart({ kind, charts, gsis, pos, control }: { kind: ChartKind; charts: ChartDb[]; gsis: string; pos: string; control: ChartControl }) {
  switch (kind) {
    case 'lanes': return <RunLanes charts={charts} gsis={gsis} control={control} />;
    case 'routes': return <RouteTree charts={charts} gsis={gsis} pos={pos} control={control} />;
    case 'throws': return <RouteTree charts={charts} gsis={gsis} pos="QB" control={control} />;
    case 'targets': return <TargetMap charts={charts} gsis={gsis} control={control} />;
    case 'zones': return <PassingZones charts={charts} gsis={gsis} control={control} />;
    case 'pressure': return <PressureCard charts={charts} gsis={gsis} control={control} />;
  }
}

/** Each player's full-size chart, one set of filters for all of them. */
export default function CompareCharts({ group, players, chart }: { group: PosGroup; players: { gsis: string | null; name: string; pos: string }[]; chart: ChartDb | null }) {
  const kinds = CHARTS_BY_GROUP[group];
  const [picked, setKind] = useState<ChartKind>(kinds[0]);
  const kind = kinds.includes(picked) ? picked : kinds[0];
  const ctl = CHART_CONTROLS[kind];
  const [filter, setFilter] = useState('all');
  const [metric, setMetric] = useState(ctl.metrics[0][0]);
  const pick = (k: ChartKind) => { setKind(k); setFilter('all'); setMetric(CHART_CONTROLS[k].metrics[0][0]); };
  const m = ctl.metrics.some(([k]) => k === metric) ? metric : ctl.metrics[0][0];
  // filters the season can't answer: pocket and coverage need participation, the play filters need FTN, the box split either
  const needs = kind === 'targets' ? chart?.ftn : kind === 'lanes' ? chart?.participation || chart?.ftn : chart?.participation;
  const disabled = chart && !needs ? ctl.filters.map(([k]) => k).filter((k) => k !== 'all') : [];
  const f = disabled.includes(filter) ? 'all' : filter;
  const control: ChartControl = { year: chart?.year ?? 0, filter: f, metric: m };

  return (
    <section aria-labelledby="cmp-charts" className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cmp-charts" className="text-sm font-semibold uppercase tracking-wide">Charts</h2>
        <Seg label="Chart" options={kinds.map((k) => [k, CHART_CONTROLS[k].label] as [ChartKind, string])} value={kind} onChange={pick} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ctl.filterLabel && <Seg label={ctl.filterLabel} options={ctl.filters} value={f} onChange={setFilter} disabled={disabled} disabledTitle={kind === 'targets' ? 'No FTN charting for this season' : 'No pressure or coverage data for this season yet'} />}
        <Seg label="Metric" options={ctl.metrics} value={m} onChange={setMetric} />
      </div>
      {!chart ? <p className="text-sm text-muted">No chart data for this season yet.</p> : (
        <div className={`grid gap-3 ${kind === 'lanes' ? '' : 'lg:grid-cols-2'}`}>
          {players.map((p, i) => (
            <div key={p.gsis ?? i} className="min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: `color-mix(in srgb, var(--slot-${i}) 35%, var(--line))` }}>
              <div className="px-3 py-1.5 text-[13px] font-semibold" style={{ background: `linear-gradient(90deg, color-mix(in srgb, var(--slot-${i}) 35%, var(--surface)), var(--surface))` }}>{p.name}</div>
              {p.gsis ? <Chart kind={kind} charts={[chart]} gsis={p.gsis} pos={p.pos} control={control} /> : <p className="px-3 py-6 text-sm text-muted">No play-by-play id for this player.</p>}
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted">{COMPARE_CREDIT}</p>
    </section>
  );
}
