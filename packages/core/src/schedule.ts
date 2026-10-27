import { z } from 'zod';
import { normalizeTeam } from './playerdb/crosswalk';

export interface ScheduleGame { week: number; home: string; away: string }
/** One season's regular-season NFL games, team codes as the player database writes them. */
export interface Schedule { year: number; games: ScheduleGame[] }

export const ScheduleSchema = z.object({
  year: z.number(),
  games: z.array(z.object({ week: z.number(), home: z.string(), away: z.string() })),
});

/** nflverse games.csv rows narrowed to one regular season. */
export function parseSchedule(rows: Iterable<Record<string, string>>, year: number): Schedule {
  const games: ScheduleGame[] = [];
  for (const r of rows) {
    if (r.season !== String(year) || r.game_type !== 'REG') continue;
    games.push({ week: Number(r.week), home: normalizeTeam(r.home_team), away: normalizeTeam(r.away_team) });
  }
  return { year, games };
}
