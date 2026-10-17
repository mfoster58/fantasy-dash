import { weekKey } from '../fields';
import { teamWeekKey } from '../teamWeeks';
import { normalizeTeam } from '../crosswalk';

export interface Participation {
  /** `${gsis}|${week}` → routes run (pass plays he was on the field for) */
  routes: Map<string, number>;
  /** `${team}|${week}` → pass plays */
  passPlays: Map<string, number>;
}

/** nflverse game ids look like 2025_09_ARI_DAL. */
export const weekOfGame = (gameId: string): number => Number(gameId.split('_')[1]);

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** A pass play is a participation row with a time to throw. Only `routeRunners` (RB/WR/TE gsis ids) accrue routes. Weeks past 18 are ignored. */
export function countRoutes(rows: Iterable<Record<string, string>>, routeRunners: ReadonlySet<string>): Participation {
  const routes = new Map<string, number>();
  const passPlays = new Map<string, number>();
  for (const r of rows) {
    const week = weekOfGame(r.nflverse_game_id ?? '');
    if (!(week >= 1 && week <= 18) || !r.time_to_throw || !r.possession_team) continue;
    bump(passPlays, teamWeekKey(normalizeTeam(r.possession_team), week));
    for (const gsis of (r.offense_players ?? '').split(';')) if (routeRunners.has(gsis)) bump(routes, weekKey(gsis, week));
  }
  return { routes, passPlays };
}
