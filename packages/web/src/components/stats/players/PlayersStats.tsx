import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import { seasonStats, type Pos, type WeekRange } from '../../../lib/stats/players/season';
import { trends } from '../../../lib/stats/players/trends';
import { STAT_OPTIONS, customView, viewPool, viewsFor } from '../../../lib/stats/players/views';
import WeekPicker from '../../players/db/WeekPicker';
import SeasonPicker from '../../SeasonPicker';
import QuadrantChart from './QuadrantChart';
import TrendsTable from './TrendsTable';
import YprrChart from './YprrChart';

const POSITIONS: Pos[] = ['QB', 'RB', 'WR', 'TE'];
const PBP_VIEWS = new Set(['clutch', 'rz', 'boom', 'ryoe']);
const NFL_WEEKS = 18;
/** trends need a late pair of weeks and earlier weeks to compare against */
const MIN_TREND_WEEKS = 3;

interface Props { dbs: PlayerDb[]; charts: ChartDb[]; currentYear: number; lastWeeks?: Record<number, number>; playoffStarts?: Record<number, number | null> }

/** Players stats: a quadrant view per position, volume trends and yards per route run, for the season or a range of weeks. */
export default function PlayersStats({ dbs, charts, currentYear, lastWeeks = {}, playoffStarts = {} }: Props) {
  const [params, setParams] = useSearchParams();
  const years = dbs.map((d) => d.year).sort((a, b) => b - a);
  const season = Number(params.get('season')) || (years.includes(currentYear) ? currentYear : years[0]);
  const pos = (POSITIONS.find((p) => p === params.get('pos')) ?? 'RB') as Pos;
  const views = viewsFor(pos);
  const custom = params.get('view') === 'custom';
  const view = custom ? customView(pos, params.get('x'), params.get('y')) : views.find((v) => v.id === params.get('view')) ?? views[0];
  const db = dbs.find((d) => d.year === season) ?? dbs[0];
  const chart = charts.find((c) => c.year === season);
  const through = Math.max(1, db?.throughWeek ?? 1);
  const from = Math.min(through, Math.max(1, Number(params.get('from')) || 1));
  const to = Math.max(from, Math.min(through, Number(params.get('to')) || through));
  const full = from === 1 && to === through;
  const range: WeekRange | undefined = full ? undefined : { from, to };
  const stats = useMemo(() => (db ? seasonStats(db, chart, range) : []), [db, chart, range?.from, range?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const shortRange = !full && to - from + 1 < MIN_TREND_WEEKS;
  const trend = useMemo(() => {
    if (!db || pos === 'QB' || shortRange) return null;
    return full ? trends(db, chart, pos, lastWeeks[db.year] ?? db.throughWeek) : trends(db, chart, pos, to, from);
  }, [db, chart, pos, lastWeeks, full, shortRange, from, to]);
  const set = (next: Record<string, string | null>) => setParams((p) => {
    const q = new URLSearchParams(p);
    for (const [k, v] of Object.entries(next)) { if (v === null) q.delete(k); else q.set(k, v); }
    return q;
  }, { replace: true });
  if (!db) return <p className="text-muted">No player data yet.</p>;

  const noPart = !chart?.participation;
  const note = view.participation && noPart ? 'Coverage and pressure data arrives after the season ends, when nflverse publishes its participation file. Pick an earlier season.'
    : view.participation && !full ? 'Coverage and pressure numbers are full season only. Pick the whole season to see them.'
      : PBP_VIEWS.has(view.id) && !chart ? 'No data yet for this season.' : undefined;
  const pool = note ? [] : viewPool(view, stats, pos);

  return (
    <div className="space-y-4">
      <div className="z-[5] -mx-4 sm:sticky sm:top-12 space-y-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <SeasonPicker years={years} value={season} onChange={(v) => { if (v !== 'all') set({ season: String(v), from: null, to: null }); }} />
          <div role="group" aria-label="Position" className="inline-flex gap-0.5 rounded-md bg-surface-2 p-0.5">
            {POSITIONS.map((p) => <button key={p} type="button" aria-pressed={p === pos} onClick={() => set(custom ? { pos: p, x: null, y: null } : { pos: p, view: viewsFor(p)[0].id })} className={`rounded px-3 py-1 text-sm ${p === pos ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`}>{p}</button>)}
          </div>
        </div>
        <WeekPicker from={from} to={to} throughWeek={through} lastWeek={NFL_WEEKS} playoffAt={playoffStarts[season] ?? null}
          onChange={(r) => set(r.from === 1 && r.to === through ? { from: null, to: null } : { from: String(r.from), to: String(r.to) })} />
      </div>
      <div role="group" aria-label="View" className="flex flex-wrap gap-1.5">
        {views.map((v) => {
          const off = v.participation && (noPart || !full);
          return (
            <button key={v.id} type="button" aria-pressed={v.id === view.id} aria-disabled={off || undefined} onClick={() => set({ view: v.id })}
              title={off ? (noPart ? 'Needs the participation file, which arrives after the season ends' : 'Full season only') : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${v.id === view.id ? 'border-win bg-[color-mix(in_srgb,var(--win)_12%,transparent)] text-ink' : 'border-line text-muted hover:text-ink'} ${off ? 'opacity-50' : ''}`}>
              {v.label}
            </button>
          );
        })}
        <button type="button" aria-pressed={custom} onClick={() => set({ view: 'custom' })}
          className={`rounded-full border border-dashed px-3 py-1 text-xs ${custom ? 'border-win bg-[color-mix(in_srgb,var(--win)_12%,transparent)] text-ink' : 'border-line text-muted hover:text-ink'}`}>Custom</button>
      </div>
      {custom && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {(['x', 'y'] as const).map((axis) => (
            <label key={axis} className="flex items-center gap-2 text-muted">{axis === 'x' ? 'X axis' : 'Y axis'}
              <select aria-label={`${axis.toUpperCase()} axis stat`} value={String(view[axis])} onChange={(e) => set({ [axis]: e.target.value })}
                className="rounded border border-line bg-surface px-2 py-1 text-ink">
                {STAT_OPTIONS[pos].map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      <QuadrantChart key={`${season}|${pos}|${view.id}|${String(view.x)}|${String(view.y)}|${from}|${to}`} view={view} pool={pool} note={note ?? (pool.length ? undefined : 'No data yet for this season.')} />
      {(pos === 'WR' || pos === 'TE') && <YprrChart stats={stats} pos={pos} estimated={!db.routesReal} />}
      {trend && <TrendsTable data={trend} pos={pos as 'RB' | 'WR' | 'TE'} season={season} />}
      {pos !== 'QB' && shortRange && <p className="card px-4 py-6 text-center text-sm text-muted">Pick at least three weeks to see volume trends.</p>}
    </div>
  );
}
