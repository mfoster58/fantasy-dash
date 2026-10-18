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

/**
 * A fixed-order tuple of sums.
 * route: targets, catches, yards, epa, tds
 * lane:  carries, yards, epa, successes (epa > 0), tds
 * zone:  attempts, completions, yards, epa, tds, ints, cpoeSum, cpoeN
 * split: dropbacks, attempts, completions, yards, epa, sacks
 */
export type Counts = number[];

export interface ChartPlayer {
  pos: DbPos;
  routes?: Record<Coverage, Partial<Record<Route, Counts>>>;
  lanes?: Record<Box, Partial<Record<Lane, Counts>>>;
  zones?: Record<Pocket, Partial<Record<Zone, Counts>>>;
  splits?: Partial<Record<Split, Counts>>;
}

/** One season of play-by-play chart counts, keyed by gsis id. Regular season, weeks 1–18. */
export interface ChartDb {
  year: number;
  builtAt: string;
  players: Record<string, ChartPlayer>;
}
