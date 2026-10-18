import { LANES, ROUTES, SPLITS, ZONES, type Box, type Coverage, type Lane, type Pocket, type Route, type Split, type Zone } from '@fantasy-dash/core';
import type { ChartSpec } from './rank';
import { fmtDec1, fmtPct, fmtSigned } from './scale';

const per = (num: number, den: number) => (c: number[]) => (c[den] ? c[num] / c[den] : null);

export const ROUTE_SPEC: ChartSpec<Route, Coverage> = {
  keys: ROUTES, table: (p) => p.routes, min: 5, sharePool: { all: 50, man: 20, zone: 20 }, shareMax: 0.2, unit: 'tgt',
  metrics: {
    ypt: { label: 'Yds/tgt', value: per(2, 0), fmt: fmtDec1 },
    catch: { label: 'Catch %', value: per(1, 0), fmt: fmtPct },
    epa: { label: 'EPA/tgt', value: per(3, 0), fmt: (v) => fmtSigned(v, 2) },
  },
};

export const LANE_SPEC: ChartSpec<Lane, Box> = {
  keys: LANES, table: (p) => p.lanes, min: 10, sharePool: { all: 100, light: 30, heavy: 30 }, shareMax: 0.25, unit: 'car',
  metrics: {
    ypc: { label: 'Yds/carry', value: per(1, 0), fmt: fmtDec1 },
    succ: { label: 'Success %', value: per(3, 0), fmt: fmtPct },
    epa: { label: 'EPA/carry', value: per(2, 0), fmt: (v) => fmtSigned(v, 2) },
  },
};

export const ZONE_SPEC: ChartSpec<Zone, Pocket> = {
  keys: ZONES, table: (p) => p.zones, min: 10, sharePool: { all: 150, clean: 50, pressured: 50 }, shareMax: 0.2, unit: 'att',
  metrics: {
    comp: { label: 'Comp %', value: per(1, 0), fmt: fmtPct },
    ypa: { label: 'Yds/att', value: per(2, 0), fmt: fmtDec1 },
    epa: { label: 'EPA/att', value: per(3, 0), fmt: (v) => fmtSigned(v, 2) },
    cpoe: { label: 'CPOE', value: per(6, 7), fmt: (v) => fmtSigned(v, 1) },
  },
};

/** Splits have no filter: one table under 'all'. */
export const SPLIT_SPEC: ChartSpec<Split, 'all'> = {
  keys: SPLITS, table: (p) => (p.splits ? { all: p.splits } : undefined), min: 20, sharePool: { all: Infinity }, shareMax: 1, unit: 'db',
  metrics: {
    epa: { label: 'EPA/dropback', value: per(4, 0), fmt: (v) => fmtSigned(v, 2) },
    comp: { label: 'Comp %', value: per(2, 1), fmt: fmtPct },
    ypa: { label: 'Yds/att', value: per(3, 1), fmt: fmtDec1 },
    sack: { label: 'Sack %', value: per(5, 0), fmt: (v) => `${(v * 100).toFixed(1)}%`, lowerIsBetter: true },
  },
};

export const ROUTE_LABEL: Record<Route, string> = {
  'QUICK OUT': 'Quick out', 'HITCH/CURL': 'Hitch', GO: 'Go', SCREEN: 'Screen', 'IN/DIG': 'Dig', 'DEEP OUT': 'Deep out',
  'SHALLOW CROSS/DRAG': 'Drag', SLANT: 'Slant', POST: 'Post', SWING: 'Swing', CORNER: 'Corner', WHEEL: 'Wheel', 'TEXAS/ANGLE': 'Angle',
};
export const LANE_LABEL: Record<Lane, string> = { LE: 'Left end', LT: 'Left tackle', LG: 'Left guard', MID: 'Middle', RG: 'Right guard', RT: 'Right tackle', RE: 'Right end' };
export const SPLIT_GROUPS: { label: string; rows: [Split, string][] }[] = [
  { label: 'Pocket', rows: [['clean', 'Clean'], ['pressured', 'Pressured']] },
  { label: 'Pass rush', rows: [['noblitz', '4 or fewer'], ['blitz', 'Blitz (5+)']] },
  { label: 'Coverage', rows: [['man', 'Man'], ['zone', 'Zone']] },
  { label: 'Shell', rows: [['COVER_0', 'Cover 0'], ['COVER_1', 'Cover 1'], ['COVER_2', 'Cover 2'], ['COVER_3', 'Cover 3'], ['COVER_4', 'Cover 4'], ['COVER_6', 'Cover 6']] },
  { label: 'Time to throw', rows: [['quick', 'Under 2.5 s'], ['hold', '2.5 s or more']] },
];
