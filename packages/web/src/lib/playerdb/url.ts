import { COLUMNS, DEFAULT_SORT, TABS, type Mode, type Tab } from './columns';

/** 'all' | 'rostered' | 'fa' | a manager's user id */
export type RosterFilter = string;

export interface DbState { tab: Tab; from: number; to: number; mode: Mode; roster: RosterFilter; sort: string; dir: 'asc' | 'desc'; q: string }

const clampWeek = (v: string | null, fallback: number, max: number): number => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
};

export function parseState(params: URLSearchParams, throughWeek: number): DbState {
  const max = Math.max(1, throughWeek);
  const tab = params.get('tab') as Tab | null;
  const mode = params.get('mode');
  const sort = params.get('sort');
  const dir = params.get('dir');
  let from = clampWeek(params.get('from'), 1, max);
  let to = clampWeek(params.get('to'), max, max);
  if (from > to) [from, to] = [to, from];
  return {
    tab: tab && TABS.includes(tab) ? tab : 'all',
    from, to,
    mode: mode === 'pg' ? 'pg' : 'total',
    roster: params.get('roster') || 'all',
    sort: sort && COLUMNS[sort] ? sort : DEFAULT_SORT,
    dir: dir === 'asc' ? 'asc' : 'desc',
    q: params.get('q') ?? '',
  };
}

export function serializeState(s: DbState, throughWeek: number): URLSearchParams {
  const p = new URLSearchParams();
  if (s.tab !== 'all') p.set('tab', s.tab);
  if (s.from !== 1) p.set('from', String(s.from));
  if (s.to !== Math.max(1, throughWeek)) p.set('to', String(s.to));
  if (s.mode !== 'total') p.set('mode', s.mode);
  if (s.roster !== 'all') p.set('roster', s.roster);
  if (s.sort !== DEFAULT_SORT) p.set('sort', s.sort);
  if (s.dir !== 'desc') p.set('dir', s.dir);
  if (s.q) p.set('q', s.q);
  return p;
}
