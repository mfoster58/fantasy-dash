import type { PlayerId } from '../types';

export type DbPos = 'QB' | 'RB' | 'WR' | 'TE';
export const DB_POSITIONS: readonly DbPos[] = ['QB', 'RB', 'WR', 'TE'];
export const isDbPos = (p: string | null | undefined): p is DbPos => (DB_POSITIONS as readonly string[]).includes(p ?? '');

/** Every numeric field a PlayerWeek may carry. Prefixes: pa_ passing, ru_ rushing, re_ receiving. */
export const PLAYER_WEEK_KEYS = [
  'gs', 'pts', 'proj', 'ppr', 'posRankPpr', 'xfp', 'snaps', 'teamSnaps', 'routes', 'routesEst',
  'pa_att', 'pa_cmp', 'pa_yds', 'pa_td', 'pa_int', 'pa_sack', 'pa_sackYds', 'pa_air', 'pa_fd', 'pa_rz', 'pa_cmp40', 'pa_rtg', 'pa_2pt',
  'pa_epa', 'pa_cpoe', 'pa_pacr', 'pa_yac',
  'pa_ttt', 'pa_iay', 'pa_cay', 'pa_aggr', 'pa_ays', 'pa_xcmp',
  'pa_bad', 'pa_badPct', 'pa_press', 'pa_pressPct', 'pa_blitz', 'pa_hurry', 'pa_hit', 'pa_drops',
  'ru_att', 'ru_yds', 'ru_td', 'ru_fd', 'ru_rz', 'ru_bt', 'ru_yac', 'ru_tfl', 'ru_40', 'ru_2pt',
  'ru_epa', 'ru_10', 'ru_20',
  'ru_ybc', 'ru_yacPfr',
  'ru_xyds', 'ru_ryoe', 'ru_ryoeAtt', 'ru_eff', 'ru_box8', 'ru_tlos', 'ru_pctOe',
  're_tgt', 're_rec', 're_yds', 're_td', 're_fd', 're_air', 're_yac', 're_drop', 're_rz', 're_20', 're_40', 're_2pt',
  're_epa', 're_racr', 're_tgtShare', 're_ayShare', 're_wopr',
  're_cush', 're_sep', 're_iay', 're_iayShare', 're_xyac', 're_yacoe',
  're_bt', 're_dropPfr', 're_dropPct', 're_int', 're_rtg',
  'fum', 'fumLost',
] as const;
export type PlayerWeekKey = (typeof PLAYER_WEEK_KEYS)[number];

/** One player's week. Only id, week, team and gp are always present; absent = null. */
export type PlayerWeek = { id: PlayerId; week: number; team: string; gp: number; opp?: string } & Partial<Record<PlayerWeekKey, number>>;

export interface DbPlayer {
  id: PlayerId;
  gsisId: string | null;
  pfrId: string | null;
  /** ESPN's id, for headshots; optional because files built before it lack it */
  espnId?: string | null;
  name: string;
  pos: DbPos;
  /** every team he had a row for this season, in week order */
  teams: string[];
  birthDate: string | null;
  yearsExp: number | null;
  draft: { year: number; round: number; pick: number } | null;
  college: string | null;
  height: number | null;
  weight: number | null;
}

/** One NFL team's offensive volume in one week, summed from every player's Sleeper row for that team. */
export interface TeamWeek {
  team: string; week: number; opp: string;
  offSnaps: number;
  passAtt: number; rushAtt: number;
  /** passAtt + sacks taken */
  dropbacks: number;
  /** red-zone carries + red-zone targets */
  rzLooks: number;
  /** passing air yards */
  airYds: number;
  /** pass plays from the participation feed; null while routes are estimated */
  passPlays: number | null;
}

export type XfpCoefficients = Record<DbPos, number[] | null>;

export interface PlayerDb {
  year: number;
  throughWeek: number;
  routesReal: boolean;
  builtAt: string;
  players: Record<PlayerId, DbPlayer>;
  teamWeeks: TeamWeek[];
  xfp: XfpCoefficients;
  rows: PlayerWeek[];
}
