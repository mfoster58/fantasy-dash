import { indexWeekly, type FieldMap, type WeekFields } from '../fields';

export const NGS_RECEIVING_FIELDS: FieldMap = {
  avg_cushion: 're_cush', avg_separation: 're_sep', avg_intended_air_yards: 're_iay', percent_share_of_intended_air_yards: 're_iayShare',
  avg_expected_yac: 're_xyac', avg_yac_above_expectation: 're_yacoe',
};
export const NGS_RUSHING_FIELDS: FieldMap = {
  efficiency: 'ru_eff', percent_attempts_gte_eight_defenders: 'ru_box8', avg_time_to_los: 'ru_tlos',
  expected_rush_yards: 'ru_xyds', rush_yards_over_expected: 'ru_ryoe', rush_yards_over_expected_per_att: 'ru_ryoeAtt', rush_pct_over_expected: 'ru_pctOe',
};
export const NGS_PASSING_FIELDS: FieldMap = {
  avg_time_to_throw: 'pa_ttt', avg_intended_air_yards: 'pa_iay', avg_completed_air_yards: 'pa_cay', aggressiveness: 'pa_aggr',
  avg_air_yards_to_sticks: 'pa_ays', expected_completion_percentage: 'pa_xcmp', completion_percentage_above_expectation: 'pa_cpoe',
};

/** The all-seasons NGS file narrowed to one regular season; week 0 (season totals) is dropped by indexWeekly's week ≥ 1 rule. */
export function ngsWeekly(rows: Iterable<Record<string, string>>, year: number, fields: FieldMap): Map<string, WeekFields> {
  return indexWeekly(rows, 'player_gsis_id', fields, (r) => r.season === String(year) && r.season_type === 'REG');
}
