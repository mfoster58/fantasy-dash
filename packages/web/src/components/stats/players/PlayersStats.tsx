import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import { seasonStats, type Pos } from '../../../lib/stats/players/season';
import { trends } from '../../../lib/stats/players/trends';
import { viewPool, viewsFor } from '../../../lib/stats/players/views';
import SeasonPicker from '../../SeasonPicker';
import QuadrantChart from './QuadrantChart';
import TrendsTable from './TrendsTable';
import YprrChart from './YprrChart';

const POSITIONS: Pos[] = ['QB', 'RB', 'WR', 'TE'];
const PBP_VIEWS = new Set(['clutch', 'rz', 'boom', 'ryoe']);

/** Players stats: a quadrant view per position, volume trends and yards per route run. */
export default function PlayersStats({ dbs, charts, currentYear, lastWeeks = {} }: { dbs: PlayerDb[]; charts: ChartDb[]; currentYear: number; lastWeeks?: Record<number, number> }) {
  const [params, setParams] = useSearchParams();
  const years = dbs.map((d) => d.year).sort((a, b) => b - a);
  const season = Number(params.get('season')) || (years.includes(currentYear) ? currentYear : years[0]);
  const pos = (POSITIONS.find((p) => p === params.get('pos')) ?? 'RB') as Pos;
  const views = viewsFor(pos);
  const view = views.find((v) => v.id === params.get('view')) ?? views[0];
  const db = dbs.find((d) => d.year === season) ?? dbs[0];
  const chart = charts.find((c) => c.year === season);
  const stats = useMemo(() => (db ? seasonStats(db, chart) : []), [db, chart]);
  const trend = useMemo(() => (db && pos !== 'QB' ? trends(db, chart, pos, lastWeeks[db.year] ?? db.throughWeek) : null), [db, chart, pos, lastWeeks]);
  const set = (next: Record<string, string>) => setParams((p) => { const q = new URLSearchParams(p); for (const [k, v] of Object.entries(next)) q.set(k, v); return q; }, { replace: true });
  if (!db) return <p className="text-muted">No player data yet.</p>;

  const noPart = !chart?.participation;
  const note = view.participation && noPart ? 'Coverage and pressure data arrives after the season ends, when nflverse publishes its participation file. Pick an earlier season.'
    : PBP_VIEWS.has(view.id) && !chart ? 'No data yet for this season.' : undefined;

  return (
    <div className="space-y-4">
      <div className="sticky top-12 z-[5] -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <SeasonPicker years={years} value={season} onChange={(v) => { if (v !== 'all') set({ season: String(v) }); }} />
        <div role="group" aria-label="Position" className="inline-flex gap-0.5 rounded-md bg-surface-2 p-0.5">
          {POSITIONS.map((p) => <button key={p} type="button" aria-pressed={p === pos} onClick={() => set({ pos: p, view: viewsFor(p)[0].id })} className={`rounded px-3 py-1 text-sm ${p === pos ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`}>{p}</button>)}
        </div>
      </div>
      <div role="group" aria-label="View" className="flex flex-wrap gap-1.5">
        {views.map((v) => {
          const off = v.participation && noPart;
          return (
            <button key={v.id} type="button" aria-pressed={v.id === view.id} aria-disabled={off || undefined} onClick={() => set({ view: v.id })}
              title={off ? 'Needs the participation file, which arrives after the season ends' : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${v.id === view.id ? 'border-win bg-[color-mix(in_srgb,var(--win)_12%,transparent)] text-ink' : 'border-line text-muted hover:text-ink'} ${off ? 'opacity-50' : ''}`}>
              {v.label}
            </button>
          );
        })}
      </div>
      <QuadrantChart key={`${season}|${pos}|${view.id}`} view={view} pool={note ? [] : viewPool(view, stats, pos)} note={note ?? (viewPool(view, stats, pos).length ? undefined : 'No data yet for this season.')} />
      {(pos === 'WR' || pos === 'TE') && <YprrChart stats={stats} pos={pos} estimated={!db.routesReal} />}
      {trend && <TrendsTable data={trend} pos={pos as 'RB' | 'WR' | 'TE'} season={season} />}
    </div>
  );
}
