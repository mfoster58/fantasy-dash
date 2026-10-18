import type { DbPos, PlayerWeekKey } from '@fantasy-dash/core';
import { fmtSigned } from '../format';
import type { Agg } from './aggregate';

export type Tab = 'all' | 'qb' | 'rb' | 'wr' | 'te';
export const TABS: readonly Tab[] = ['all', 'qb', 'rb', 'wr', 'te'];
export const tabPositions = (tab: Tab): DbPos[] => (tab === 'all' ? ['QB', 'RB', 'WR', 'TE'] : [tab.toUpperCase() as DbPos]);
export type Mode = 'total' | 'pg';
export type Fmt = 'int' | 'dec1' | 'dec2' | 'pct' | 'signed1';
export const DEFAULT_SORT = 'pts';

export interface ColumnDef {
  key: string;
  label: string;
  def: string;
  fmt: Fmt;
  value: (a: Agg) => number | null;
  /** counting stat: divided by games played in per-game mode */
  perGame?: boolean;
  lowerIsBetter?: boolean;
  /** default true; the anchors (G, Pts, PPG, Pos rank) are false */
  tinted?: boolean;
  /** rate columns: the denominator must reach perWeek × weeks in range to be tinted */
  min?: { denom: (a: Agg) => number; perWeek: number };
  /** route-based: estimated while the season's routes are */
  est?: boolean;
  /** counting stat: shows 0 rather than – for a player who played but recorded none */
  zeroFill?: boolean;
  /** lower-is-better counts: a 0 is tinted (as good) only when the player had the chance, e.g. threw a pass */
  tintZero?: (a: Agg) => boolean;
  /** higher-is-better counts: a 0 is painted full red only when the player had the chance, e.g. a target for a receiving stat */
  chance?: (a: Agg) => boolean;
  /** fixed colour scale instead of a percentile: −1 red, 0 yellow, 1 green; null = untinted */
  score?: (a: Agg) => number | null;
}

/** Per-week sample minimums. */
export const MIN = { tgt: 3, car: 5, routes: 10, db: 12, snaps: 10 } as const;

const S = (k: PlayerWeekKey) => (a: Agg): number => a.s[k] ?? 0;
const sum = (k: PlayerWeekKey) => (a: Agg): number | null => a.s[k] ?? null;
const W = (k: PlayerWeekKey) => (a: Agg): number | null => a.w[k] ?? null;
const ratio = (num: (a: Agg) => number | null, den: (a: Agg) => number) => (a: Agg): number | null => {
  const n = num(a), d = den(a);
  return n === null || d <= 0 ? null : n / d;
};
/** A share of a team total cannot exceed 100%; guards against a numerator that outruns its denominator. */
const capped = (f: (a: Agg) => number | null) => (a: Agg): number | null => { const v = f(a); return v === null ? null : Math.min(1, v); };
const add = (...ks: PlayerWeekKey[]) => (a: Agg): number => ks.reduce((t, k) => t + (a.s[k] ?? 0), 0);
const anySum = (...ks: PlayerWeekKey[]) => (a: Agg): number | null => (ks.some((k) => a.s[k] !== undefined) ? add(...ks)(a) : null);
const routes = (a: Agg) => a.routes;
const dropbacks = add('pa_att', 'pa_sack');
const touches = add('ru_att', 're_rec');
const drops = (a: Agg): number | null => a.s.re_drop ?? a.s.re_dropPfr ?? null;
const games = (a: Agg) => a.games;
const minTgt = { denom: S('re_tgt'), perWeek: MIN.tgt };
const minCar = { denom: S('ru_att'), perWeek: MIN.car };
const minRoutes = { denom: routes, perWeek: MIN.routes };
const minDb = { denom: dropbacks, perWeek: MIN.db };
const minSnaps = { denom: S('snaps'), perWeek: MIN.snaps };

const col = (key: string, label: string, def: string, fmt: Fmt, value: ColumnDef['value'], extra: Partial<ColumnDef> = {}): ColumnDef => ({ key, label, def, fmt, value, ...extra });
/** whether a player had the chance at a stat, by its family: a pass attempt, a carry or a target */
const chanceFor = (k: PlayerWeekKey): ((a: Agg) => boolean) | undefined =>
  k.startsWith('pa_') ? (a) => (a.s.pa_att ?? 0) > 0 : k.startsWith('ru_') ? (a) => (a.s.ru_att ?? 0) > 0 : k.startsWith('re_') ? (a) => (a.s.re_tgt ?? 0) > 0 : undefined;
const count = (key: string, label: string, def: string, k: PlayerWeekKey, extra: Partial<ColumnDef> = {}) => col(key, label, def, 'int', sum(k), { perGame: true, zeroFill: true, chance: chanceFor(k), ...extra });

/** Rushing or receiving TDs: any TD is clearly green, deepening to full green at one a game. */
const skillTdScore = (k: PlayerWeekKey) => (a: Agg): number | null => {
  const td = a.s[k] ?? 0;
  return a.games > 0 && td > 0 ? 0.8 + 0.2 * Math.min(td / a.games, 1) : null;
};
/** Passing TDs per game for a real passer (10+ attempts a game): 0 red, 1 yellow, 2 green, 3+ full green. */
const realPasser = (a: Agg): boolean => a.games > 0 && (a.s.pa_att ?? 0) >= 10 * a.games;
const passTdScore = (a: Agg): number | null => {
  if (!realPasser(a)) return null;
  const r = (a.s.pa_td ?? 0) / a.games;
  return r <= 1 ? r - 1 : r <= 2 ? 0.8 * (r - 1) : Math.min(1, 0.8 + 0.2 * (r - 2));
};

const list: ColumnDef[] = [
  // lead
  col('g', 'G', 'Games played in the range', 'int', games, { tinted: false }),
  col('pts', 'Pts', 'Fantasy points under league scoring', 'dec1', sum('pts'), { tinted: false }),
  col('ppg', 'PPG', 'Fantasy points per game played', 'dec1', ratio(sum('pts'), games), { tinted: false }),
  col('posRank', 'Rk', 'Rank by fantasy points among players at the position over the range', 'int', (a) => a.posRank, { tinted: false, lowerIsBetter: true }),
  col('projPlus', 'Proj±', 'Fantasy points minus Sleeper\'s projection, summed over weeks with a projection', 'signed1', (a) => a.projDiff),
  // passing
  count('cmp', 'Cmp', 'Completions', 'pa_cmp'),
  count('att', 'Att', 'Pass attempts', 'pa_att'),
  col('cmpPct', 'Cmp%', 'Completions per attempt', 'pct', ratio(sum('pa_cmp'), S('pa_att')), { min: minDb }),
  count('paYds', 'Yds', 'Passing yards', 'pa_yds'),
  col('ya', 'Y/A', 'Passing yards per attempt', 'dec1', ratio(sum('pa_yds'), S('pa_att')), { min: minDb }),
  count('paTd', 'TD', 'Passing touchdowns', 'pa_td', { score: passTdScore, chance: realPasser }),
  count('int', 'INT', 'Interceptions thrown', 'pa_int', { lowerIsBetter: true, tintZero: realPasser }),
  count('sacks', 'Sk', 'Sacks taken', 'pa_sack', { lowerIsBetter: true, tintZero: realPasser }),
  col('rtg', 'Rtg', 'Passer rating, weighted by attempts', 'dec1', W('pa_rtg'), { min: minDb }),
  col('adot', 'aDOT', 'Average depth of target: passing air yards per attempt', 'dec1', ratio(sum('pa_air'), S('pa_att')), { min: minDb }),
  count('paAir', 'Air', 'Passing air yards', 'pa_air'),
  count('paYac', 'YAC', 'Yards after the catch by his receivers', 'pa_yac'),
  col('cpoe', 'CPOE', 'Completion percentage over expected (Next Gen Stats), weighted by attempts', 'dec1', W('pa_cpoe'), { min: minDb }),
  col('epaDb', 'EPA/db', 'Passing expected points added per dropback (attempts plus sacks)', 'dec2', ratio(sum('pa_epa'), dropbacks), { min: minDb }),
  col('pacr', 'PACR', 'Passing air conversion ratio: passing yards per air yard', 'dec2', ratio(sum('pa_yds'), S('pa_air')), { min: minDb }),
  col('badPct', 'Bad%', 'Bad throws per attempt (Pro Football Reference)', 'pct', ratio(sum('pa_bad'), S('pa_att')), { lowerIsBetter: true, min: minDb }),
  col('pressPct', 'Press%', 'Dropbacks under pressure (Pro Football Reference)', 'pct', ratio(sum('pa_press'), dropbacks), { lowerIsBetter: true, min: minDb }),
  col('ttt', 'TTT', 'Average time to throw in seconds (Next Gen Stats)', 'dec2', W('pa_ttt'), { lowerIsBetter: true, min: minDb }),
  col('aggr', 'Aggr%', 'Aggressiveness: share of throws into tight coverage (Next Gen Stats)', 'dec1', W('pa_aggr'), { min: minDb }),
  count('deep', '40+', 'Completions of 40 yards or more', 'pa_cmp40'),
  count('rzAtt', 'RZ att', 'Pass attempts inside the red zone', 'pa_rz'),
  // rushing
  count('car', 'Car', 'Rushing attempts (carries)', 'ru_att'),
  count('ruYds', 'Yds', 'Rushing yards', 'ru_yds'),
  col('ypc', 'YPC', 'Rushing yards per carry', 'dec1', ratio(sum('ru_yds'), S('ru_att')), { min: minCar }),
  count('ruTd', 'TD', 'Rushing touchdowns', 'ru_td', { score: skillTdScore('ru_td') }),
  count('ruFd', 'FD', 'Rushing first downs', 'ru_fd'),
  count('ru10', '10+', 'Carries of 10 yards or more', 'ru_10'),
  count('ru20', '20+', 'Carries of 20 yards or more', 'ru_20'),
  col('ybc', 'YBC/att', 'Rushing yards before contact per carry (Pro Football Reference)', 'dec2', ratio(sum('ru_ybc'), S('ru_att')), { min: minCar }),
  col('yacAtt', 'YAC/att', 'Rushing yards after contact per carry', 'dec2', ratio((a) => a.s.ru_yac ?? a.s.ru_yacPfr ?? null, S('ru_att')), { min: minCar }),
  count('bt', 'BT', 'Broken tackles on carries', 'ru_bt'),
  col('btTouch', 'BT/touch', 'Broken tackles per touch, carries and catches together', 'dec2', ratio(anySum('ru_bt', 're_bt'), touches), { min: minCar }),
  col('ryoeAtt', 'RYOE/att', 'Rushing yards over expected per carry (Next Gen Stats)', 'dec2', W('ru_ryoeAtt'), { min: minCar }),
  col('box8', '8+ box', 'Share of carries against eight or more defenders in the box (Next Gen Stats)', 'dec1', W('ru_box8'), { min: minCar }),
  col('stuffPct', 'Stuff%', 'Carries tackled for a loss per carry', 'pct', ratio(sum('ru_tfl'), S('ru_att')), { lowerIsBetter: true, min: minCar }),
  col('ruEpa', 'Rush EPA', 'Rushing expected points added', 'dec1', sum('ru_epa')),
  count('fum', 'Fum', 'Fumbles committed', 'fum', { lowerIsBetter: true, tintZero: (a) => touches(a) + S('pa_att')(a) > 0 }),
  count('ruRz', 'RZ car', 'Carries inside the red zone', 'ru_rz'),
  // receiving
  count('tgt', 'Tgt', 'Pass targets', 're_tgt'),
  count('rec', 'Rec', 'Receptions', 're_rec'),
  count('reYds', 'Yds', 'Receiving yards', 're_yds'),
  count('reTd', 'TD', 'Receiving touchdowns', 're_td', { score: skillTdScore('re_td') }),
  count('reFd', 'FD', 'Receiving first downs', 're_fd'),
  col('catchPct', 'Catch%', 'Receptions per target', 'pct', ratio(sum('re_rec'), S('re_tgt')), { min: minTgt }),
  col('ypt', 'YPT', 'Receiving yards per target', 'dec1', ratio(sum('re_yds'), S('re_tgt')), { min: minTgt }),
  col('ypr', 'YPR', 'Receiving yards per reception', 'dec1', ratio(sum('re_yds'), S('re_rec')), { min: minTgt }),
  col('adotRe', 'aDOT', 'Average depth of target: air yards per target', 'dec1', ratio(sum('re_air'), S('re_tgt')), { min: minTgt }),
  count('reAir', 'Air', 'Receiving air yards', 're_air'),
  count('reYac', 'YAC', 'Yards after the catch', 're_yac'),
  col('yacRec', 'YAC/rec', 'Yards after the catch per reception', 'dec1', ratio(sum('re_yac'), S('re_rec')), { min: minTgt }),
  col('yacoe', 'YACOE', 'Yards after the catch over expected per reception (Next Gen Stats)', 'dec2', W('re_yacoe'), { min: minTgt }),
  col('drops', 'Drops', 'Dropped passes', 'int', drops, { perGame: true, zeroFill: true, lowerIsBetter: true, tintZero: (a) => S('re_tgt')(a) > 0 }),
  col('dropPct', 'Drop%', 'Drops per target', 'pct', ratio(drops, S('re_tgt')), { lowerIsBetter: true, min: minTgt }),
  count('re20', '20+', 'Receptions of 20 yards or more', 're_20'),
  col('sep', 'Sep', 'Average separation from the nearest defender at the catch point, in yards (Next Gen Stats)', 'dec2', W('re_sep'), { min: minTgt }),
  col('cush', 'Cush', 'Average cushion from the nearest defender at the snap, in yards (Next Gen Stats)', 'dec2', W('re_cush'), { lowerIsBetter: true, min: minTgt }),
  col('racr', 'RACR', 'Receiver air conversion ratio: receiving yards per air yard', 'dec2', ratio(sum('re_yds'), S('re_air')), { min: minTgt }),
  col('reEpa', 'Rec EPA', 'Receiving expected points added', 'dec1', sum('re_epa')),
  col('epaTgt', 'EPA/tgt', 'Receiving expected points added per target', 'dec2', ratio(sum('re_epa'), S('re_tgt')), { min: minTgt }),
  count('reRz', 'RZ tgt', 'Targets inside the red zone', 're_rz'),
  col('rzTgtPct', 'RZ tgt%', 'Share of the team\'s red-zone looks that were targets to him', 'pct', ratio(sum('re_rz'), (a) => a.t.rzLooks)),
  // usage
  count('snaps', 'Snaps', 'Offensive snaps', 'snaps', { zeroFill: false }),
  col('touches', 'Tch', 'Touches: carries plus receptions', 'int', anySum('ru_att', 're_rec'), { perGame: true, zeroFill: true }),
  col('snapPct', 'Snap%', 'Offensive snaps per team offensive snap', 'pct', capped(ratio(sum('snaps'), S('teamSnaps'))), { min: minSnaps }),
  col('dbPg', 'DB/g', 'Dropbacks (attempts plus sacks) per game', 'dec1', ratio(dropbacks, games)),
  col('routes', 'Routes', 'Routes run: pass plays he was on the field for', 'int', routes, { perGame: true, est: true }),
  col('routePct', 'Route%', 'Routes run per team dropback', 'pct', capped(ratio(routes, (a) => a.t.dropbacks)), { est: true, min: minSnaps }),
  col('yprr', 'YPRR', 'Receiving yards per route run', 'dec2', ratio(sum('re_yds'), routes), { est: true, min: minRoutes }),
  col('tprr', 'TPRR', 'Targets per route run', 'dec2', ratio(sum('re_tgt'), routes), { est: true, min: minRoutes }),
  col('fdrr', 'FDRR', 'Receiving first downs per route run', 'dec2', ratio(sum('re_fd'), routes), { est: true, min: minRoutes }),
  col('tgtPct', 'Tgt%', 'Targets per team pass attempt', 'pct', ratio(sum('re_tgt'), (a) => a.t.passAtt)),
  col('ayPct', 'AY%', 'Share of the team\'s passing air yards', 'pct', ratio(sum('re_air'), (a) => a.t.airYds)),
  col('wopr', 'WOPR', 'Weighted opportunity rating: 1.5 × target share + 0.7 × air-yards share', 'dec2', (a) => {
    const tgt = ratio(sum('re_tgt'), (x) => x.t.passAtt)(a), ay = ratio(sum('re_air'), (x) => x.t.airYds)(a);
    return tgt === null ? null : 1.5 * tgt + 0.7 * (ay ?? 0);
  }),
  col('carryPct', 'Carry%', 'Carries per team rush attempt', 'pct', ratio(sum('ru_att'), (a) => a.t.rushAtt)),
  col('opp', 'Opp', 'Opportunities: carries plus targets', 'int', anySum('ru_att', 're_tgt'), { perGame: true, zeroFill: true }),
  col('oppPct', 'Opp%', 'Opportunities per team play (rush attempts plus pass attempts)', 'pct', ratio(anySum('ru_att', 're_tgt'), (a) => a.t.rushAtt + a.t.passAtt)),
  col('rzTouches', 'RZ', 'Red-zone carries plus red-zone targets', 'int', anySum('ru_rz', 're_rz'), { perGame: true, zeroFill: true }),
  col('rzPct', 'RZ%', 'Share of the team\'s red-zone looks (carries plus targets)', 'pct', ratio(anySum('ru_rz', 're_rz'), (a) => a.t.rzLooks)),
  col('touchesPg', 'Tch/g', 'Touches (carries plus receptions) per game', 'dec1', ratio(anySum('ru_att', 're_rec'), games)),
  // fantasy
  col('xfp', 'xFP', 'Expected fantasy points from opportunity (per-position model fitted on every NFL player-week this season)', 'dec1', sum('xfp'), { perGame: true }),
  col('xfpPg', 'xFP/g', 'Expected fantasy points per game', 'dec1', ratio(sum('xfp'), games)),
  col('fpoe', 'FPOE', 'Fantasy points over expected: points minus xFP', 'signed1', (a) => (a.s.xfp === undefined || a.s.pts === undefined ? null : a.s.pts - a.s.xfp), { perGame: true }),
  col('fpoePg', 'FPOE/g', 'Fantasy points over expected per game', 'signed1', ratio((a) => (a.s.xfp === undefined || a.s.pts === undefined ? null : a.s.pts - a.s.xfp), games)),
  col('fpTouch', 'FP/touch', 'Fantasy points per touch', 'dec2', ratio(sum('pts'), touches), { min: minCar }),
  col('fpSnap', 'FP/snap', 'Fantasy points per offensive snap', 'dec2', ratio(sum('pts'), S('snaps')), { min: minSnaps }),
  col('fpTgt', 'FP/tgt', 'Fantasy points per target', 'dec2', ratio(sum('pts'), S('re_tgt')), { min: minTgt }),
  col('fpRoute', 'FP/route', 'Fantasy points per route run', 'dec2', ratio(sum('pts'), routes), { est: true, min: minRoutes }),
];

export const COLUMNS: Readonly<Record<string, ColumnDef>> = Object.fromEntries(list.map((c) => [c.key, c]));

const LEAD = ['g', 'pts', 'ppg', 'posRank', 'projPlus'];
const FANTASY = ['xfp', 'xfpPg', 'fpoe', 'fpoePg'];
const WR_GROUPS = [
  { group: '', keys: LEAD },
  { group: 'Receiving', keys: ['tgt', 'rec', 'reYds', 'reTd', 'reFd', 'catchPct', 'ypt', 'ypr', 'adotRe', 'reAir', 'reYac', 'yacRec', 'yacoe', 'drops', 'dropPct', 're20', 'sep', 'cush', 'racr', 'reEpa', 'epaTgt'] },
  { group: 'Usage', keys: ['snaps', 'snapPct', 'routes', 'routePct', 'tgtPct', 'ayPct', 'wopr', 'yprr', 'tprr', 'fdrr', 'reRz', 'rzTgtPct'] },
  { group: 'Rushing', keys: ['car', 'ruYds', 'ruTd'] },
  { group: 'Fantasy', keys: [...FANTASY, 'fpTgt', 'fpRoute'] },
];
export const TAB_GROUPS: Readonly<Record<Tab, { group: string; keys: string[] }[]>> = {
  all: [
    { group: '', keys: LEAD },
    { group: 'Usage', keys: ['snapPct'] },
    { group: 'Rushing', keys: ['car', 'ruYds', 'ruTd'] },
    { group: 'Receiving', keys: ['tgt', 'rec', 'reYds', 'reTd'] },
    { group: 'Passing', keys: ['cmp', 'att', 'paYds', 'paTd', 'int'] },
  ],
  qb: [
    { group: '', keys: LEAD },
    { group: 'Passing', keys: ['cmp', 'att', 'cmpPct', 'paYds', 'ya', 'paTd', 'int', 'sacks', 'rtg'] },
    { group: 'Advanced', keys: ['adot', 'paAir', 'paYac', 'cpoe', 'epaDb', 'pacr', 'badPct', 'pressPct', 'ttt', 'aggr', 'deep', 'rzAtt'] },
    { group: 'Rushing', keys: ['car', 'ruYds', 'ruTd', 'ruRz', 'ruEpa'] },
    { group: 'Usage', keys: ['snaps', 'snapPct', 'dbPg'] },
    { group: 'Fantasy', keys: FANTASY },
  ],
  rb: [
    { group: '', keys: LEAD },
    { group: 'Rushing', keys: ['car', 'ruYds', 'ypc', 'ruTd', 'ruFd', 'ru10', 'ru20', 'ybc', 'yacAtt', 'bt', 'btTouch', 'ryoeAtt', 'box8', 'stuffPct', 'ruEpa', 'fum'] },
    { group: 'Receiving', keys: ['tgt', 'rec', 'reYds', 'reTd', 'ypt', 'yacRec', 'routes', 'routePct', 'yprr', 'tprr'] },
    { group: 'Usage', keys: ['snaps', 'snapPct', 'carryPct', 'tgtPct', 'opp', 'oppPct', 'rzTouches', 'rzPct', 'wopr', 'touchesPg'] },
    { group: 'Fantasy', keys: [...FANTASY, 'fpTouch', 'fpSnap'] },
  ],
  wr: WR_GROUPS,
  te: WR_GROUPS,
};

export const groupsFor = (tab: Tab): { group: string; cols: ColumnDef[] }[] => TAB_GROUPS[tab].map((g) => ({ group: g.group, cols: g.keys.map((k) => COLUMNS[k]) }));
export const columnsFor = (tab: Tab): ColumnDef[] => groupsFor(tab).flatMap((g) => g.cols);

export function columnValue(col: ColumnDef, a: Agg, mode: Mode): number | null {
  const v = col.value(a) ?? (col.zeroFill && a.games > 0 ? 0 : null);
  if (v === null) return null;
  if (col.perGame && mode === 'pg') return a.games > 0 ? v / a.games : null;
  return v;
}

export const belowMin = (col: ColumnDef, a: Agg): boolean => (col.min ? col.min.denom(a) < col.min.perWeek * a.weeks : false);

export function fmtValue(v: number | null, fmt: Fmt, mode: Mode): string {
  if (v === null || Number.isNaN(v)) return '–';
  const f = mode === 'pg' && fmt === 'int' ? 'dec1' : fmt;
  switch (f) {
    case 'int': return String(Math.round(v));
    case 'dec1': return v.toFixed(1);
    case 'dec2': return v.toFixed(2);
    case 'pct': return `${(v * 100).toFixed(1)}%`;
    case 'signed1': return fmtSigned(v, 1);
  }
}
