import { normalizeTeam } from '../crosswalk';
import { indexWeekly, numberOf, type FieldMap, type WeekFields } from '../fields';

/** stats_player_week columns → PlayerWeek keys. Air yards are intended (targeted) air yards. Keys Sleeper also provides (sacks, first downs, YAC) only fill gaps: the build merges base-first. */
export const NFLVERSE_FIELDS: FieldMap = {
  passing_epa: 'pa_epa', passing_cpoe: 'pa_cpoe', pacr: 'pa_pacr', passing_yards_after_catch: 'pa_yac', sacks_suffered: 'pa_sack', passing_first_downs: 'pa_fd', passing_air_yards: 'pa_air',
  rushing_epa: 'ru_epa', rushing_10: 'ru_10', rushing_20: 'ru_20', rushing_first_downs: 'ru_fd',
  receiving_epa: 're_epa', receiving_yards_after_catch: 're_yac', racr: 're_racr', target_share: 're_tgtShare', air_yards_share: 're_ayShare', wopr: 're_wopr', receiving_first_downs: 're_fd', receiving_air_yards: 're_air',
};

export function nflverseWeekly(rows: Iterable<Record<string, string>>): Map<string, WeekFields> {
  return indexWeekly(rows, 'player_id', NFLVERSE_FIELDS, (r) => r.season_type === 'REG');
}

/** `${team}|${week}` (Sleeper team codes) → the team's intended passing air yards, summed over its passers' regular-season rows. */
export function nflverseTeamAirYards(rows: Iterable<Record<string, string>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const week = numberOf(row.week);
    const air = numberOf(row.passing_air_yards);
    if (row.season_type !== 'REG' || !row.team || week === null || week < 1 || week > 18 || air === null) continue;
    const key = `${normalizeTeam(row.team)}|${week}`;
    out.set(key, (out.get(key) ?? 0) + air);
  }
  return out;
}
