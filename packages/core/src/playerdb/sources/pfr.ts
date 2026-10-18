import { normalizeTeam } from '../crosswalk';
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

/**
 * `${team}|${week}` → the team's offensive snaps that week, from the snap-count file: a player's offense_snaps ÷ offense_pct.
 * Read from the player with the most snaps (a lineman at 100% gives it exactly): offense_pct is rounded to the
 * hundredth, so a bit player's 1 snap at 0.01 would read as 100. Fills the weeks where Sleeper has no team snaps.
 */
export function snapCountTeamSnaps(rows: Iterable<Record<string, string>>): Map<string, number> {
  const best = new Map<string, { snaps: number; team: number }>();
  for (const r of rows) {
    if (r.game_type !== 'REG') continue;
    const week = Number(r.week), snaps = Number(r.offense_snaps), pct = Number(r.offense_pct);
    if (!(week >= 1 && week <= 18) || !(snaps > 0) || !(pct > 0) || !r.team) continue;
    const key = `${normalizeTeam(r.team)}|${week}`;
    const prev = best.get(key);
    if (!prev || snaps > prev.snaps) best.set(key, { snaps, team: Math.round(snaps / pct) });
  }
  return new Map([...best].map(([k, v]) => [k, v.team]));
}
