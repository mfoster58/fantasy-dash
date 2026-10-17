import { indexWeekly, type FieldMap, type WeekFields } from '../fields';

/** stats_player_week columns → PlayerWeek keys. Keys Sleeper also provides (sacks, first downs, YAC) only fill gaps: the build merges base-first. */
export const NFLVERSE_FIELDS: FieldMap = {
  passing_epa: 'pa_epa', passing_cpoe: 'pa_cpoe', pacr: 'pa_pacr', passing_yards_after_catch: 'pa_yac', sacks_suffered: 'pa_sack', passing_first_downs: 'pa_fd',
  rushing_epa: 'ru_epa', rushing_10: 'ru_10', rushing_20: 'ru_20', rushing_first_downs: 'ru_fd',
  receiving_epa: 're_epa', receiving_yards_after_catch: 're_yac', racr: 're_racr', target_share: 're_tgtShare', air_yards_share: 're_ayShare', wopr: 're_wopr', receiving_first_downs: 're_fd',
};

export function nflverseWeekly(rows: Iterable<Record<string, string>>): Map<string, WeekFields> {
  return indexWeekly(rows, 'player_id', NFLVERSE_FIELDS, (r) => r.season_type === 'REG');
}
