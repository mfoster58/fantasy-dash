import { indexWeekly, type FieldMap, type WeekFields } from '../fields';

export const PFR_REC_FIELDS: FieldMap = { receiving_broken_tackles: 're_bt', receiving_drop: 're_dropPfr', receiving_drop_pct: 're_dropPct', receiving_int: 're_int', receiving_rat: 're_rtg' };
export const PFR_RUSH_FIELDS: FieldMap = { rushing_yards_before_contact: 'ru_ybc', rushing_yards_after_contact: 'ru_yacPfr', rushing_broken_tackles: 'ru_bt' };
export const PFR_PASS_FIELDS: FieldMap = {
  passing_bad_throws: 'pa_bad', passing_bad_throw_pct: 'pa_badPct', times_pressured: 'pa_press', times_pressured_pct: 'pa_pressPct',
  times_blitzed: 'pa_blitz', times_hurried: 'pa_hurry', times_hit: 'pa_hit', passing_drops: 'pa_drops',
};
/** snap_counts: offensive snaps, used only where Sleeper's off_snp is missing. */
export const SNAP_FIELDS: FieldMap = { offense_snaps: 'snaps' };

export function pfrWeekly(rows: Iterable<Record<string, string>>, fields: FieldMap): Map<string, WeekFields> {
  return indexWeekly(rows, 'pfr_player_id', fields, (r) => r.game_type === 'REG');
}
