import { COLUMNS, DEFAULT_SORT, TABS, columnsFor, type Mode, type Tab } from './columns';

/** 'all' | 'rostered' | 'fa' | a manager's user id */
export type RosterFilter = string;

/** team: an NFL team code or 'all'; rookies: first-year players only */
export interface DbState { tab: Tab; from: number; to: number; mode: Mode; roster: RosterFilter; sort: string; dir: 'asc' | 'desc'; q: string; team: string; rookies: boolean }

const clampWeek = (v: string | null, fallback: number, max: number): number => {
  // Number('') is 0, so blank values must fall back rather than clamp to week 1.
  if (v === null || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(max, Math.max(1, n)) : fallback;
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
  const t: Tab = tab && TABS.includes(tab) ? tab : 'all';
  // A sort column the tab does not show (e.g. after switching tabs) falls back to points, descending.
  const sortOk = sort !== null && Object.hasOwn(COLUMNS, sort) && columnsFor(t).some((c) => c.key === sort);
  return {
    tab: t,
    from, to,
    mode: mode === 'pg' ? 'pg' : 'total',
    roster: params.get('roster') || 'all',
    sort: sortOk ? sort : DEFAULT_SORT,
    dir: sortOk && dir === 'asc' ? 'asc' : 'desc',
    q: params.get('q') ?? '',
    team: params.get('team') || 'all',
    rookies: params.get('rookies') === '1',
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
  if (s.team !== 'all') p.set('team', s.team);
  if (s.rookies) p.set('rookies', '1');
  return p;
}
