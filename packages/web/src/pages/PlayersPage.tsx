import { useCallback, useMemo } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { PlayerDb, Season } from '@fantasy-dash/core';
import PlayerDbToolbar from '../components/players/db/PlayerDbToolbar';
import PlayerDbTable, { PAGE, useCollapsedGroups } from '../components/players/db/PlayerDbTable';
import SeasonPicker from '../components/SeasonPicker';
import { history } from '../data/load';
import { aggregate } from '../lib/playerdb/aggregate';
import { aggregateAllTime, weekLabel, type SeasonSpan } from '../lib/playerdb/merge';
import { COLUMNS, groupsFor } from '../lib/playerdb/columns';
import { filterAggs, tabPool } from '../lib/playerdb/filter';
import { rosterMap } from '../lib/playerdb/rosters';
import { parseState, serializeState, type DbState } from '../lib/playerdb/url';

/** spans is set for All-time: db is then every season merged end to end */
export interface PlayersData { season: Season; db: PlayerDb | null; spans?: SeasonSpan[] }

export default function PlayersPage() {
  const { season, db, spans } = useLoaderData() as PlayersData;
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const onYear = (y: number | 'all') => navigate(`/players/${y}`);

  if (!db) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight">Players</h1><SeasonPicker years={years} value={season.year} onChange={onYear} allTime /></div>
        <p className="card px-4 py-6 text-sm text-muted">No player data yet for {season.year}</p>
      </div>
    );
  }
  return <Loaded season={season} db={db} spans={spans} years={years} onYear={onYear} />;
}

function Loaded({ season, db, spans, years, onYear }: { season: Season; db: PlayerDb; spans?: SeasonSpan[]; years: number[]; onYear: (y: number | 'all') => void }) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params, db.throughWeek), [params, db.throughWeek]);
  const onChange = useCallback((patch: Partial<DbState>) => {
    setParams((prev) => serializeState({ ...parseState(prev, db.throughWeek), ...patch }, db.throughWeek), { replace: true });
  }, [setParams, db.throughWeek]);
  const onSort = (key: string) => onChange(state.sort === key ? { dir: state.dir === 'desc' ? 'asc' : 'desc' } : { sort: key, dir: COLUMNS[key]?.lowerIsBetter ? 'asc' : 'desc' });
  const [collapsed, toggleGroup] = useCollapsedGroups(state.tab);

  const rosters = useMemo(() => rosterMap(season), [season]);
  const managerList = season.standings.map((r) => ({ userId: r.userId, name: season.managers[r.userId]?.teamName ?? season.managers[r.userId]?.displayName ?? r.userId }));
  const allAggs = useMemo(() => (spans ? aggregateAllTime({ db, spans }) : aggregate(db, state.from, state.to)), [db, spans, state.from, state.to]);
  const labelWeek = useMemo(() => (spans ? (w: number) => { const l = weekLabel(spans, w); return `'${String(l.year).slice(-2)} W${l.week}`; } : undefined), [spans]);
  const range = spans ? `All-time · ${spans[0]?.year}–${spans[spans.length - 1]?.year}` : `weeks ${state.from}–${state.to} · ${db.year}`;
  const now = years[years.length - 1];
  // every row is coloured against its whole position tab, so the filters and search below never recolour it
  const pool = useMemo(() => tabPool(allAggs, db, state), [allAggs, db, state]);
  const aggs = useMemo(() => filterAggs(allAggs, db, state, rosters, now), [allAggs, db, state, rosters, now]);
  const teams = useMemo(() => [...new Set(pool.map((a) => a.team).filter(Boolean))].sort(), [pool]);
  const shown = Math.min(PAGE, aggs.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="text-sm text-muted">Showing {shown} of {aggs.length} · {range}{db.routesReal ? '' : ' · routes estimated'}</p>
      </div>
      <PlayerDbToolbar state={state} onChange={onChange} years={years} year={spans ? 'all' : db.year} onYear={onYear} throughWeek={db.throughWeek} playoffAt={season.playoffWeekStart} managers={managerList} teams={teams} />
      <PlayerDbTable db={db} aggs={aggs} pool={pool} state={state} onSort={onSort} rosters={rosters} collapsed={collapsed} onToggleGroup={toggleGroup} weekLabel={labelWeek} />
      <details className="card px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Column definitions</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {groupsFor(state.tab).flatMap((g) => g.cols).map((c) => (
            <div key={c.key} className="flex gap-2"><dt className="num shrink-0 font-medium">{c.label}</dt><dd className="text-muted">{c.def}{c.est && !db.routesReal ? (spans ? ' (estimated in seasons without tracking data)' : ' (estimated this season)') : ''}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-muted">Rates are summed numerators over summed denominators across the chosen weeks. Cells are tinted by percentile among every player in the position tab, whatever the filters or search; a rate under its sample minimum (targets 3, carries 5, routes 10, dropbacks 12, snaps 10 per week) is greyed. xFP is refitted every sync, so early-season values move until the sample settles.</p>
      </details>
    </div>
  );
}
