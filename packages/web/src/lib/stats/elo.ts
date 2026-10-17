import type { Season, UserId } from '@fantasy-dash/core';
import { managerRefs, scopeSeasons, type Scope } from './scope';

export const ELO_START = 1500;
export const ELO_K = 32;
/** a margin this big doubles the move; the cap */
export const ELO_MARGIN = 40;
/** share of the distance from 1500 a rating keeps across an offseason */
export const ELO_CARRY = 2 / 3;

export interface EloPoint { year: number; week: number; playoff: boolean }
export interface EloSeries { id: UserId; ratings: (number | null)[] }
export interface EloHistory { points: EloPoint[]; series: EloSeries[] }

/** chance the first rating beats the second */
export const expectedScore = (me: number, opp: number): number => 1 / (1 + 10 ** ((opp - me) / 400));

/** how far `me` moves after a game: K scaled by the margin, times the surprise */
export function eloShift(me: number, opp: number, margin: number, actual: 1 | 0 | 0.5): number {
  const k = ELO_K * Math.min(2, 1 + margin / ELO_MARGIN);
  return k * (actual - expectedScore(me, opp));
}

/**
 * Every manager's rating after every played week, across the seasons given: 1500 at a manager's first season,
 * a third of the way back to 1500 at each later one, every game counted (regular, playoff and consolation).
 * A manager not in a season has null for its weeks.
 */
export function eloHistory(seasons: Season[]): EloHistory {
  const sorted = scopeSeasons(seasons, 'all');
  const ids = managerRefs(sorted).map((r) => r.id);
  const rating = new Map<UserId, number>();
  const points: EloPoint[] = [];
  const series = new Map<UserId, (number | null)[]>(ids.map((id) => [id, []]));
  for (const s of sorted) {
    const inSeason = new Set(Object.keys(s.managers));
    for (const id of inSeason) { const r = rating.get(id); rating.set(id, r === undefined ? ELO_START : ELO_START + (r - ELO_START) * ELO_CARRY); }
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        const [x, y] = g.sides;
        const rx = rating.get(x.userId) ?? ELO_START, ry = rating.get(y.userId) ?? ELO_START;
        const actual = x.points > y.points ? 1 : x.points < y.points ? 0 : 0.5;
        const shift = eloShift(rx, ry, Math.abs(x.points - y.points), actual);
        rating.set(x.userId, rx + shift);
        rating.set(y.userId, ry - shift);
      }
      points.push({ year: s.year, week: wk.week, playoff: wk.isPlayoff });
      for (const id of ids) series.get(id)!.push(inSeason.has(id) ? rating.get(id)! : null);
    }
  }
  return { points, series: ids.map((id) => ({ id, ratings: series.get(id)! })) };
}

/** the whole history, or one season's weeks of it with the ratings as they were carried in */
export function eloFor(history: EloHistory, scope: Scope): EloHistory {
  if (scope === 'all') return history;
  const keep = history.points.map((p, i) => (p.year === scope ? i : -1)).filter((i) => i >= 0);
  return { points: keep.map((i) => history.points[i]), series: history.series.map((s) => ({ id: s.id, ratings: keep.map((i) => s.ratings[i]) })) };
}
