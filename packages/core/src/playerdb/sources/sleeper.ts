import type { SleeperWeekStat } from '../../sleeper/types';
import { scoreStats } from '../../scoring';
import { isDbPos, type DbPos, type PlayerWeek, type PlayerWeekKey } from '../types';

/**
 * Sleeper weekly stat key → PlayerWeek key. Keys Sleeper lacks for a player are simply absent.
 * Sleeper's pass_air_yd / rec_air_yd are completed air yards (air + YAC = yards), so intended air yards come from nflverse instead.
 */
export const SLEEPER_FIELDS: Readonly<Record<string, PlayerWeekKey>> = {
  gs: 'gs', off_snp: 'snaps', tm_off_snp: 'teamSnaps', pts_ppr: 'ppr', pos_rank_ppr: 'posRankPpr',
  pass_att: 'pa_att', pass_cmp: 'pa_cmp', pass_yd: 'pa_yds', pass_td: 'pa_td', pass_int: 'pa_int', pass_sack: 'pa_sack', pass_sack_yds: 'pa_sackYds',
  pass_fd: 'pa_fd', pass_rz_att: 'pa_rz', pass_cmp_40p: 'pa_cmp40', pass_rtg: 'pa_rtg', pass_2pt: 'pa_2pt',
  rush_att: 'ru_att', rush_yd: 'ru_yds', rush_td: 'ru_td', rush_fd: 'ru_fd', rush_rz_att: 'ru_rz', rush_btkl: 'ru_bt', rush_yac: 'ru_yac',
  rush_tkl_loss: 'ru_tfl', rush_40p: 'ru_40', rush_2pt: 'ru_2pt',
  rec_tgt: 're_tgt', rec: 're_rec', rec_yd: 're_yds', rec_td: 're_td', rec_fd: 're_fd', rec_yar: 're_yac', rec_drop: 're_drop',
  rec_rz_tgt: 're_rz', rec_40p: 're_40', rec_2pt: 're_2pt',
  fum: 'fum', fum_lost: 'fumLost',
};

const REC_20_BUCKETS = ['rec_20_29', 'rec_30_39', 'rec_40p'];

/** One PlayerWeek from a Sleeper weekly row; null when he did not play or has no team. */
export function sleeperRow(raw: SleeperWeekStat, week: number, scoring: Record<string, number>, projection: Record<string, number> | undefined): PlayerWeek | null {
  const stats = raw.stats;
  if (!stats || (stats.gp ?? 0) < 1 || !raw.team) return null;
  const row: PlayerWeek = { id: raw.player_id, week, team: raw.team, gp: stats.gp };
  if (raw.opponent) row.opp = raw.opponent;
  for (const [k, key] of Object.entries(SLEEPER_FIELDS)) {
    const v = stats[k];
    if (typeof v === 'number') row[key] = v;
  }
  if (REC_20_BUCKETS.some((k) => k in stats)) row.re_20 = REC_20_BUCKETS.reduce((s, k) => s + (stats[k] ?? 0), 0);
  row.pts = scoreStats(stats, scoring);
  if (projection) row.proj = scoreStats(projection, scoring);
  return row;
}

/** The table position: league override, then the weekly row, then the Sleeper directory; null outside QB/RB/WR/TE. */
export function positionOf(raw: SleeperWeekStat, directoryPos: string | null, overrides: Readonly<Record<string, string>>): DbPos | null {
  const pos = overrides[raw.player_id] ?? raw.player?.position ?? directoryPos;
  return isDbPos(pos) ? pos : null;
}
