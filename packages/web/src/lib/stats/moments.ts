import type { UserId } from '@fantasy-dash/core';
import type { TeamGame } from '../managerGames';

export interface Moment { year: number; week: number; matchupId: number; winnerId: UserId; loserId: UserId; winPts: number; losePts: number; margin: number }
export interface Moments { robbed: Moment[]; stolen: Moment[]; flattened: Moment[]; close: Moment[] }

/** every decided game once, from the winner's side */
function decided(games: TeamGame[]): Moment[] {
  return games.filter((g) => g.result === 'W').map((g) => ({
    year: g.year, week: g.week, matchupId: g.matchupId, winnerId: g.userId, loserId: g.opponentId, winPts: g.points, losePts: g.oppPoints, margin: Math.round((g.points - g.oppPoints) * 100) / 100,
  }));
}
const chrono = (x: Moment, y: Moment) => x.year - y.year || x.week - y.week || x.matchupId - y.matchupId;

/** the season's injustices and demolitions: highest score in a loss, lowest in a win, biggest and smallest margins */
export function moments(games: TeamGame[], n = 4): Moments {
  const all = decided(games);
  const top = (by: (x: Moment, y: Moment) => number) => [...all].sort((x, y) => by(x, y) || chrono(x, y)).slice(0, n);
  return {
    robbed: top((x, y) => y.losePts - x.losePts),
    stolen: top((x, y) => x.winPts - y.winPts),
    flattened: top((x, y) => y.margin - x.margin),
    close: top((x, y) => x.margin - y.margin),
  };
}
