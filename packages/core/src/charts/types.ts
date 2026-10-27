import type { DbPos } from '../playerdb/types';

/** nflverse participation `route` values: the route the targeted receiver ran */
export const ROUTES = ['QUICK OUT', 'HITCH/CURL', 'GO', 'SCREEN', 'IN/DIG', 'DEEP OUT', 'SHALLOW CROSS/DRAG', 'SLANT', 'POST', 'SWING', 'CORNER', 'WHEEL', 'TEXAS/ANGLE'] as const;
export type Route = (typeof ROUTES)[number];
/** run lanes, offense's left to right */
export const LANES = ['LE', 'LT', 'LG', 'MID', 'RG', 'RT', 'RE'] as const;
export type Lane = (typeof LANES)[number];
/** air-yard bands: behind the line, 0–9, 10–19, 20+ */
export const BANDS = ['blos', 'short', 'mid', 'deep'] as const;
export type Band = (typeof BANDS)[number];
export const SIDES = ['left', 'middle', 'right'] as const;
export type Side = (typeof SIDES)[number];
export type Zone = `${Band}|${Side}`;
export const ZONES: readonly Zone[] = BANDS.flatMap((b) => SIDES.map((s) => `${b}|${s}` as Zone));
export const SPLITS = ['all', 'clean', 'pressured', 'noblitz', 'blitz', 'man', 'zone', 'COVER_0', 'COVER_1', 'COVER_2', 'COVER_3', 'COVER_4', 'COVER_6', 'quick', 'hold'] as const;
export type Split = (typeof SPLITS)[number];
export type Coverage = 'all' | 'man' | 'zone';
export type Box = 'all' | 'light' | 'heavy';
export type Pocket = 'all' | 'clean' | 'pressured';
/** red-zone opportunity keys: r = carry, t = target; a = yardline 1–5, b = 6–10, c = 11–20 */
export const RZ_KEYS = ['ra', 'rb', 'rc', 'ta', 'tb', 'tc'] as const;
export type RzKey = (typeof RZ_KEYS)[number];

/** target-map filters, from FTN charting except all */
export const TARGET_FILTERS = ['all', 'pa', 'nopa', 'motion', 'screen', 'blitz', 'contested'] as const;
export type TargetFilter = (typeof TARGET_FILTERS)[number];

/**
 * Season sums behind the grade cards, by name. Receiver keys are per target; QB keys per dropback unless named;
 * rusher keys per carry (scrambles excluded). ftn* count only plays FTN charted, and every FTN rate divides by them.
 */
export const GRADE_KEYS = [
  'tgt', 'rec', 'yds', 'epa', 'succ', 'fd', 'td', 'cpN', 'cpSum', 'cpRec', 'yacN', 'yacOe',
  'deep', 'deepRec', 'deepYds', 'deepEpa', 't3', 't3Conv', 'rzTgt', 'ezTgt',
  'ftnTgt', 'catchable', 'drops', 'contested', 'contestedRec', 'created', 'motionTgt', 'paTgt', 'screenTgt',
  'db', 'dbEpa', 'dbSucc', 'att', 'sacks', 'sackYds', 'passYds', 'passTd', 'int',
  'deepAtt', 'deepCmp', 'deepAttEpa', 'deepCpoeSum', 'deepCpoeN',
  't3Db', 't3DbConv','rzDb', 'rzTd', 'q4Db', 'q4Epa', 'trailDb', 'trailEpa',
  'scr', 'scrYds', 'drun', 'drunEpa', 'rushFd',
  'ftnDb', 'ftnAtt', 'iw', 'readN', 'firstRead', 'throwaway', 'faultSack', 'catchableThrown', 'recDrops', 'paDb', 'paEpa', 'blitzDb', 'blitzEpa', 'noBlitzDb', 'noBlitzEpa',
  'car', 'carYds', 'carEpa', 'carSucc', 'carFd', 'explosive', 'stuffed', 'in10', 'in5', 'in5Td', 'outside',
  'ftnCar', 'boxN', 'boxSum', 'lightCar', 'lightYds', 'heavyCar', 'heavyYds', 'rpo',
] as const;
export type GradeKey = (typeof GRADE_KEYS)[number];
export type GradeSums = Partial<Record<GradeKey, number>>;

/**
 * A fixed-order tuple of sums.
 * route: targets, catches, yards, epa, tds
 * lane:  carries, yards, epa, successes (epa > 0), tds
 * zone:  attempts, completions, yards, epa, tds, ints, cpoeSum, cpoeN
 * split: dropbacks, attempts, completions, yards, epa, sacks
 * plays.rush: carries, successes (yards-to-go rule), explosive (10+ yards), yards
 * plays.rz:   opportunities, PPR points
 * plays.qtr:  dropbacks Q1–3, their EPA, dropbacks Q4 + OT, their EPA
 */
export type Counts = number[];

export interface PlayCounts { rush?: Counts; rz?: Partial<Record<RzKey, Counts>>; qtr?: Counts }

export interface ChartPlayer {
  pos: DbPos;
  routes?: Record<Coverage, Partial<Record<Route, Counts>>>;
  lanes?: Record<Box, Partial<Record<Lane, Counts>>>;
  zones?: Record<Pocket, Partial<Record<Zone, Counts>>>;
  splits?: Partial<Record<Split, Counts>>;
  /** a QB's throws by the route his receiver ran (same tuple as routes: attempts, completions, yards, epa, tds) */
  throws?: Record<Coverage, Partial<Record<Route, Counts>>>;
  /** targets by zone for each target-map filter (same tuple as routes) */
  targets?: Partial<Record<TargetFilter, Partial<Record<Zone, Counts>>>>;
  /** season sums for the grade cards */
  grades?: GradeSums;
  /** from play-by-play alone, so present for the current season too; `weeks` holds the same counts per week */
  plays?: PlayCounts & { weeks?: Record<string, PlayCounts> };
}

/** One season of play-by-play chart counts, keyed by gsis id. Regular season, weeks 1–18. */
export interface ChartDb {
  year: number;
  builtAt: string;
  /** whether the participation file existed: routes, splits and throws need it; lanes and zones are built from play-by-play without it */
  participation: boolean;
  /** whether FTN charting rows were joined (optional: files built before FTN lack it) */
  ftn?: boolean;
  /** per team (player-database code) and week: [red-zone targets, inside-10 carries], the denominators of the share tiles */
  teams?: Record<string, Record<string, [number, number]>>;
  /** nflverse weekly injury report: gsis → week → [status (IR as Out; '' when listed without a game status), injury] */
  injuries: Record<string, Record<string, [string, string]>>;
  players: Record<string, ChartPlayer>;
}
