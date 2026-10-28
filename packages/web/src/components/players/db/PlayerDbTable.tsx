import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerDb, PlayerId, UserId } from '@fantasy-dash/core';
import Headshot from '../../Headshot';
import PosPill from '../../PosPill';
import { PlayerLink } from '../../NameLink';
import type { Agg } from '../../../lib/playerdb/aggregate';
import { COLUMNS, belowMin, columnValue, groupsFor, type ColumnDef, type Tab } from '../../../lib/playerdb/columns';
import { dbDirectory } from '../../../lib/playerdb/directory';
import { poolTints } from '../../../lib/playerdb/percentile';
import type { DbState } from '../../../lib/playerdb/url';
import { ColumnHeaderCells, GroupHeaderCells, HeaderCell, StatCells, th } from './GridParts';
import TintCell from './TintCell';
import WeekRows from './WeekRows';
import { useIsPhone } from '../../../lib/useIsPhone';

export const PAGE = 25;

interface Props {
  db: PlayerDb;
  aggs: Agg[];
  /** everyone the rows are coloured against (the position tab before any filter or search); defaults to the rows themselves */
  pool?: Agg[];
  state: DbState;
  onSort: (key: string) => void;
  /** who holds each player now; absent = free agent */
  rosters: Record<PlayerId, UserId>;
  collapsed: ReadonlySet<string>;
  onToggleGroup: (group: string) => void;
  /** how an expanded row names its weeks; all-time passes season and week */
  weekLabel?: (week: number) => string;
}

/** Sort by the state's column, nulls last whichever way, ties by points then id. */
export function sortAggs(aggs: Agg[], state: DbState): Agg[] {
  const col = COLUMNS[state.sort] ?? COLUMNS.pts;
  const sign = state.dir === 'asc' ? 1 : -1;
  return [...aggs].sort((a, b) => {
    const va = belowMin(col, a) ? null : columnValue(col, a, state.mode), vb = belowMin(col, b) ? null : columnValue(col, b, state.mode);
    if (va === null && vb === null) return (b.s.pts ?? 0) - (a.s.pts ?? 0);
    if (va === null) return 1;
    if (vb === null) return -1;
    return sign * (va - vb) || (b.s.pts ?? 0) - (a.s.pts ?? 0) || (a.id < b.id ? -1 : 1);
  });
}

/** Collapsed column groups for a tab, remembered in localStorage (ignored when storage is unavailable). */
export function useCollapsedGroups(tab: Tab): [ReadonlySet<string>, (group: string) => void] {
  const key = `playerdb.collapsed.${tab}`;
  const [set, setSet] = useState<ReadonlySet<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]); } catch { return new Set(); }
  });
  useEffect(() => {
    try { setSet(new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[])); } catch { setSet(new Set()); }
  }, [key]);
  const toggle = useCallback((group: string) => {
    setSet((c) => {
      const n = new Set(c);
      if (n.has(group)) n.delete(group); else n.add(group);
      try { localStorage.setItem(key, JSON.stringify([...n])); } catch { /* storage unavailable */ }
      return n;
    });
  }, [key]);
  return [set, toggle];
}

const lead = 'sticky bg-surface';
/** the rank and position stay put beside the player on a wide screen; on a phone only the player does */
const leadWide = 'sm:sticky bg-surface';
/** "Smith-Njigba" from "Jaxon Smith-Njigba": everything after the first name */
const surname = (name: string) => name.split(' ').slice(1).join(' ') || name;

export default function PlayerDbTable({ db, aggs, pool, state, onSort, rosters, collapsed, onToggleGroup, weekLabel }: Props) {
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  // on a phone, once the stats are scrolled in, the fixed name column shrinks to the surname to give them room
  const phone = useIsPhone();
  const [scrolled, setScrolled] = useState(false);
  const tight = phone && scrolled;
  useEffect(() => { setShown(PAGE); setOpen(null); }, [state.tab, state.from, state.to, state.roster, state.q]);

  const groups = useMemo(() => groupsFor(state.tab), [state.tab]);
  const leadCols = groups[0].cols;
  const bodyGroups = groups.slice(1);
  const visibleCols: ColumnDef[] = useMemo(
    () => [...groups[0].cols, ...groups.slice(1).filter((g) => !collapsed.has(g.group)).flatMap((g) => g.cols)],
    [groups, collapsed],
  );
  const sorted = useMemo(() => sortAggs(aggs, state), [aggs, state]);
  const tints = useMemo(() => poolTints(visibleCols, pool ?? aggs, state.mode), [pool, aggs, visibleCols, state.mode]);
  const tintOf = (key: string, id: string) => tints.get(key)?.get(id) ?? 'transparent';
  const dir = dbDirectory(db);
  const span = 3 + visibleCols.length;
  const sortArrow = (key: string) => (state.sort === key ? (state.dir === 'desc' ? ' ▾' : ' ▴') : '');
  const headerTitle = (c: ColumnDef) => (c.est && !db.routesReal ? `${c.def}. Estimated from snap share × team dropbacks until the NFL publishes participation data.` : c.def);
  const cell = (c: ColumnDef, a: Agg) => (
    <TintCell key={c.key} value={columnValue(c, a, state.mode)} col={c} mode={state.mode} tint={tintOf(c.key, a.id)} dim={belowMin(c, a)} est={Boolean(c.est) && a.routesEst} />
  );

  return (
    <div data-testid="db-scroll" onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 8)} className="card overflow-auto lg:max-h-[calc(100vh-10rem)]">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-[2] bg-surface">
          <tr>
            <th colSpan={3} className="sm:sticky left-0 z-[3] bg-surface border-b border-line" />
            <th colSpan={leadCols.length} className="border-b border-line" />
            <GroupHeaderCells groups={bodyGroups} collapsed={collapsed} onToggleGroup={onToggleGroup} />
          </tr>
          <tr>
            <th className={`${leadWide} left-0 z-[3] w-8 min-w-8 border-b border-line px-1.5 py-2 sm:w-10 sm:min-w-10 sm:px-2 text-left section-label`}>#</th>
            <th className={`${leadWide} left-8 z-[3] w-12 min-w-12 border-b border-line px-1 py-2 sm:left-10 sm:w-14 sm:min-w-14 sm:px-2 text-left section-label`}>Pos</th>
            <th className={`${lead} left-0 z-[3] ${tight ? 'min-w-0' : 'min-w-32'} border-b shadow-[inset_-1px_0_0_var(--line)] sm:left-24 sm:min-w-48 sm:shadow-none border-line px-2 py-2 text-left section-label`}>Player</th>
            {leadCols.map((c) => <HeaderCell key={c.key} col={c} title={headerTitle(c)} arrow={sortArrow(c.key)} onSort={onSort} />)}
            <ColumnHeaderCells groups={bodyGroups} collapsed={collapsed} title={headerTitle} arrow={sortArrow} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, shown).map((a, i) => {
            const p = db.players[a.id];
            const isOpen = open === a.id;
            return (
              <Fragment key={a.id}>
                <tr data-testid="db-row" className="border-t border-line transition-colors hover:bg-surface-2/60">
                  <td className={`${leadWide} left-0 num w-8 min-w-8 border-b border-line px-1.5 py-1.5 text-muted sm:w-10 sm:min-w-10 sm:px-2`}>{i + 1}</td>
                  <td data-testid="db-pos" className={`${leadWide} left-8 w-12 min-w-12 border-b border-line px-1 py-1.5 sm:left-10 sm:w-14 sm:min-w-14 sm:px-2`}><PosPill pos={p?.pos ?? '?'} /></td>
                  <td className={`${lead} left-0 z-[1] border-b border-line px-2 py-1.5 shadow-[inset_-1px_0_0_var(--line)] sm:left-24 sm:shadow-none`}>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {/* the chevron and headshot open his weeks; the name opens his page */}
                      <button type="button" aria-expanded={isOpen} aria-label={`Show weeks for ${p?.name ?? a.id}`} onClick={() => setOpen(isOpen ? null : a.id)} className="flex items-center gap-1.5 text-muted hover:text-accent">
                        <span aria-hidden="true" className="w-2 text-[10px]">{isOpen ? '▾' : '▸'}</span>
                        <span className="hidden sm:inline"><Headshot players={dir} id={a.id} size={24} /></span>
                      </button>
                      <PlayerLink id={a.id} aria-label={p?.name ?? a.id} className={`min-w-0 truncate font-medium ${tight ? 'max-w-[5.5rem]' : 'max-sm:max-w-[6.5rem]'}`}><span data-testid="db-name">{tight ? surname(p?.name ?? a.id) : p?.name ?? a.id}</span></PlayerLink>
                      {!tight && <span data-testid="db-team" className="text-xs text-muted">{a.team}</span>}
                      {!rosters[a.id] && <span data-testid="fa-tag" title="Free agent: on no roster in the league" className="rounded border border-win/50 px-1 text-[10px] font-semibold leading-4 tracking-wide text-win">FA</span>}
                    </span>
                  </td>
                  {leadCols.map((c) => cell(c, a))}
                  <StatCells groups={bodyGroups} collapsed={collapsed} agg={a} mode={state.mode} tint={(k) => tintOf(k, a.id)} />
                </tr>
                {isOpen && <WeekRows db={db} agg={a} cols={visibleCols} mode={state.mode} span={span} weekLabel={weekLabel} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && <p className="px-4 py-6 text-sm text-muted">No players match.</p>}
      {shown < sorted.length && (
        <div className="border-t border-line px-4 py-3">
          <button type="button" onClick={() => setShown((s) => s + PAGE)} className="text-sm text-accent hover:underline">Show {PAGE} more</button>
        </div>
      )}
    </div>
  );
}
