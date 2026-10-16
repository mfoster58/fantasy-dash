import type { UserId } from '@fantasy-dash/core';
import { fmtRecord, fmtTag } from '../../format';
import type { ManagerSeason, TeamGame } from '../../managerGames';
import type { BoardContext, BoardRow, Direction } from '../shared';
import { plural, rank } from '../shared';

export const managerName = (ctx: BoardContext, id: UserId): string => ctx.managers[id]?.displayName ?? id;
/** "2024 · Wk 5 · Championship" */
export const whenGame = (g: TeamGame): string => `${g.year} · Wk ${g.week}${g.tag ? ` · ${fmtTag(g.tag)}` : ''}`;
export const gameLink = (g: TeamGame): string => `/scores/${g.year}/${g.week}/${g.matchupId}`;
export const score = (g: TeamGame): string => `${g.points.toFixed(2)}–${g.oppPoints.toFixed(2)}`;
export const vs = (ctx: BoardContext, g: TeamGame): string => `vs ${managerName(ctx, g.opponentId)}, ${score(g)}`;
/** "2023–2026 · 4 seasons" or "2025 · 1 season" */
export function careerMeta(years: number[]): string {
  const ys = [...new Set(years)].sort((a, b) => a - b);
  const span = ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : String(ys[0] ?? '');
  return `${span} · ${plural(ys.length, 'season')}`;
}
export const recordOf = (ms: ManagerSeason): string => fmtRecord({ w: ms.row.w, l: ms.row.l, t: ms.row.t });
/** whole-season rows: complete seasons under All-time, the chosen year's seasons otherwise */
export const seasonScope = (ctx: BoardContext): ManagerSeason[] => ctx.managerSeasons.filter((ms) => ctx.year !== null || ms.complete);
export const seasonGames = (ctx: BoardContext, ms: ManagerSeason): TeamGame[] => ctx.teamGames.filter((g) => g.year === ms.year && g.userId === ms.userId);

export interface CareerAgg { userId: UserId; seasons: ManagerSeason[]; games: TeamGame[] }
export const hasComplete = (a: CareerAgg): boolean => a.seasons.some((s) => s.complete);

export function byManager(ctx: BoardContext): CareerAgg[] {
  const map = new Map<UserId, CareerAgg>();
  const get = (id: UserId): CareerAgg => { let a = map.get(id); if (!a) { a = { userId: id, seasons: [], games: [] }; map.set(id, a); } return a; };
  for (const ms of ctx.managerSeasons) get(ms.userId).seasons.push(ms);
  for (const g of ctx.teamGames) get(g.userId).games.push(g);
  return [...map.values()];
}
const latest = (a: CareerAgg): { latestYear: number; latestWeek: number } => {
  let y = 0; let w = 0;
  for (const g of a.games) if (g.year > y || (g.year === y && g.week > w)) { y = g.year; w = g.week; }
  for (const s of a.seasons) if (s.year > y) { y = s.year; w = 0; }
  return { latestYear: y, latestWeek: w };
};
const row = (userId: UserId, value: number, valueLabel: string, meta: string, detail: string | null, to: string | null): BoardRow => ({ key: `${meta}-${userId}`, playerId: null, value, valueLabel, meta, detail, userId, to });

/** One row per manager over every season and game in scope. `value` returns null to drop a manager. */
export function careerRows(ctx: BoardContext, value: (a: CareerAgg) => number | null, label: (v: number) => string, detail: (a: CareerAgg) => string | null, direction: Direction = 'desc', secondary?: (a: CareerAgg) => number): BoardRow[] {
  const items = byManager(ctx)
    .map((a) => ({ a, userId: a.userId, value: value(a), secondary: secondary?.(a), ...latest(a) }))
    .filter((i): i is typeof i & { value: number } => i.value !== null);
  return rank(items, direction).map((i) => ({ ...row(i.userId, i.value, label(i.value), careerMeta(i.a.seasons.map((s) => s.year)), detail(i.a), null), key: i.userId }));
}

/** One row per manager-season in `scope` (the in-progress rule by default), linking to that season's standings. */
export function seasonRows(ctx: BoardContext, value: (ms: ManagerSeason) => number | null, label: (v: number) => string, detail: (ms: ManagerSeason) => string | null, direction: Direction = 'desc', scope: ManagerSeason[] = seasonScope(ctx), secondary?: (ms: ManagerSeason) => number): BoardRow[] {
  const items = scope
    .map((ms) => ({ ms, userId: ms.userId, value: value(ms), secondary: secondary?.(ms), latestYear: ms.year, latestWeek: 0 }))
    .filter((i): i is typeof i & { value: number } => i.value !== null);
  return rank(items, direction).map((i) => ({ ...row(i.userId, i.value, label(i.value), String(i.ms.year), detail(i.ms), `/standings/${i.ms.year}`), key: `${i.ms.year}-${i.userId}` }));
}

/** One row per team game, linking to the box score. */
export function gameRows(ctx: BoardContext, games: TeamGame[], value: (g: TeamGame) => number | null, label: (v: number) => string, direction: Direction = 'desc', detail: (g: TeamGame) => string | null = (g) => vs(ctx, g)): BoardRow[] {
  const items = games
    .map((g) => ({ g, userId: g.userId, value: value(g), latestYear: g.year, latestWeek: g.week }))
    .filter((i): i is typeof i & { value: number } => i.value !== null);
  return rank(items, direction).map((i) => ({ ...row(i.userId, i.value, label(i.value), whenGame(i.g), detail(i.g), gameLink(i.g)), key: `${i.g.gameId}-${i.userId}` }));
}

/** One side per game: the higher scorer, or the first side listed on a tie. */
export function matchups(games: TeamGame[]): TeamGame[] {
  const best = new Map<string, TeamGame>();
  for (const g of games) {
    const cur = best.get(g.gameId);
    if (!cur || g.points > cur.points) best.set(g.gameId, g);
  }
  return [...best.values()];
}
