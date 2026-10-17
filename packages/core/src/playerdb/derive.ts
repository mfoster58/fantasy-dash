import type { PlayerWeek, TeamWeek } from './types';

/** Routes guessed from snap share × team dropbacks, for seasons without participation data. */
export function routesEstimate(row: PlayerWeek, tw: TeamWeek | undefined): number | null {
  if (!tw || !row.snaps || !row.teamSnaps) return null;
  return Math.round((row.snaps / row.teamSnaps) * tw.dropbacks);
}
