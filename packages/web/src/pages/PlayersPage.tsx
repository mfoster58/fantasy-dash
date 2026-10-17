import { useCallback, useMemo } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { PlayerDb, Season } from '@fantasy-dash/core';
import PlayerDbToolbar from '../components/players/db/PlayerDbToolbar';
import PlayerDbTable, { PAGE, useCollapsedGroups } from '../components/players/db/PlayerDbTable';
import SeasonPicker from '../components/SeasonPicker';
import { history } from '../data/load';
import { aggregate } from '../lib/playerdb/aggregate';
import { COLUMNS, groupsFor, tabPositions } from '../lib/playerdb/columns';
import { rosterMap } from '../lib/playerdb/rosters';
import { parseState, serializeState, type DbState } from '../lib/playerdb/url';

export interface PlayersData { season: Season; db: PlayerDb | null }

export default function PlayersPage() {
  const { season, db } = useLoaderData() as PlayersData;
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const onYear = (y: number) => navigate(`/players/${y}`);

  if (!db) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight">Players</h1><SeasonPicker years={years} value={season.year} onChange={(v) => { if (v !== 'all') onYear(v); }} /></div>
        <p className="card px-4 py-6 text-sm text-muted">No player data yet for {season.year}</p>
      </div>
    );
  }
  return <Loaded season={season} db={db} years={years} onYear={onYear} />;
}

function Loaded({ season, db, years, onYear }: { season: Season; db: PlayerDb; years: number[]; onYear: (y: number) => void }) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params, db.throughWeek), [params, db.throughWeek]);
  const onChange = useCallback((patch: Partial<DbState>) => {
    setParams((prev) => serializeState({ ...parseState(prev, db.throughWeek), ...patch }, db.throughWeek), { replace: true });
  }, [setParams, db.throughWeek]);
  const onSort = (key: string) => onChange(state.sort === key ? { dir: state.dir === 'desc' ? 'asc' : 'desc' } : { sort: key, dir: COLUMNS[key]?.lowerIsBetter ? 'asc' : 'desc' });
  const [collapsed, toggleGroup] = useCollapsedGroups(state.tab);

  const rosters = useMemo(() => rosterMap(season), [season]);
  const managerList = season.standings.map((r) => ({ userId: r.userId, name: season.managers[r.userId]?.teamName ?? season.managers[r.userId]?.displayName ?? r.userId }));
  const allAggs = useMemo(() => aggregate(db, state.from, state.to), [db, state.from, state.to]);
  const aggs = useMemo(() => {
    const positions = tabPositions(state.tab);
    const q = state.q.trim().toLowerCase();
    return allAggs.filter((a) => {
      const p = db.players[a.id];
      if (!p || !positions.includes(p.pos)) return false;
      const owner = rosters[a.id];
      if (state.roster === 'rostered' && !owner) return false;
      if (state.roster === 'fa' && owner) return false;
      if (state.roster !== 'all' && state.roster !== 'rostered' && state.roster !== 'fa' && owner !== state.roster) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [allAggs, db, state.tab, state.roster, state.q, rosters]);
  const shown = Math.min(PAGE, aggs.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="text-sm text-muted">Showing {shown} of {aggs.length} · weeks {state.from}–{state.to} · {db.year}{db.routesReal ? '' : ' · routes estimated'}</p>
      </div>
      <PlayerDbToolbar state={state} onChange={onChange} years={years} year={db.year} onYear={onYear} throughWeek={db.throughWeek} managers={managerList} />
      <PlayerDbTable db={db} aggs={aggs} state={state} onSort={onSort} year={db.year} managers={season.managers} rosters={rosters} collapsed={collapsed} onToggleGroup={toggleGroup} />
      <details className="card px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Column definitions</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {groupsFor(state.tab).flatMap((g) => g.cols).map((c) => (
            <div key={c.key} className="flex gap-2"><dt className="num shrink-0 font-medium">{c.label}</dt><dd className="text-muted">{c.def}{c.est && !db.routesReal ? ' (estimated this season)' : ''}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-muted">Rates are summed numerators over summed denominators across the chosen weeks. Cells are tinted by percentile among the rows shown; a rate under its sample minimum (targets 3, carries 5, routes 10, dropbacks 12, snaps 10 per week) is greyed. xFP is refitted every sync, so early-season values move until the sample settles.</p>
      </details>
    </div>
  );
}
