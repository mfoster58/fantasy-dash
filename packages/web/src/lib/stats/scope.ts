import type { Season, UserId } from '@fantasy-dash/core';
import type { TeamGame } from '../managerGames';

export type Scope = number | 'all';
export interface ManagerRef { id: UserId; name: string; avatar: string | null }
export interface WeekGroup { key: string; year: number; week: number; playoff: boolean; games: TeamGame[] }

/** the seasons a scope covers, oldest first */
export const scopeSeasons = (seasons: Season[], scope: Scope): Season[] =>
  seasons.filter((s) => scope === 'all' || s.year === scope).sort((a, b) => a.year - b.year);

/** every manager in the seasons: the latest season's standings order first, then anyone who only played earlier, by name */
export function managerRefs(seasons: Season[]): ManagerRef[] {
  const sorted = scopeSeasons(seasons, 'all');
  const latest = sorted[sorted.length - 1];
  if (!latest) return [];
  const refOf = (s: Season, id: UserId): ManagerRef => ({ id, name: s.managers[id]?.displayName ?? id, avatar: s.managers[id]?.avatar ?? null });
  const refs = new Map<UserId, ManagerRef>(latest.standings.map((r) => [r.userId, refOf(latest, r.userId)]));
  const rest: ManagerRef[] = [];
  for (const s of sorted) for (const m of Object.values(s.managers)) if (!refs.has(m.userId) && !rest.some((r) => r.id === m.userId)) rest.push(refOf(s, m.userId));
  rest.sort((x, y) => x.name.localeCompare(y.name));
  return [...refs.values(), ...rest];
}

export const weekKey = (year: number, week: number): string => `${year}-${week}`;

/** middle value, or the mean of the two middle values; 0 for nothing */
export function medianOf(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const m = v.length / 2;
  return v.length % 2 ? v[Math.floor(m)] : (v[m - 1] + v[m]) / 2;
}

export const regular = (games: TeamGame[]): TeamGame[] => games.filter((g) => !g.isPlayoff);

/** games grouped by (year, week) in order; each group holds one game per manager who played */
export function byWeek(games: TeamGame[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  for (const g of games) {
    const key = weekKey(g.year, g.week);
    let group = map.get(key);
    if (!group) { group = { key, year: g.year, week: g.week, playoff: g.isPlayoff, games: [] }; map.set(key, group); }
    group.games.push(g);
  }
  return [...map.values()].sort((x, y) => x.year - y.year || x.week - y.week);
}
