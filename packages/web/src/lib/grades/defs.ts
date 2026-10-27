import type { GradeKey, GradeSums } from '@fantasy-dash/core';
import type { Agg } from '../playerdb/aggregate';
import { COLUMNS, columnValue } from '../playerdb/columns';
import { fmtDec1, fmtPct, fmtSigned } from '../charts/scale';

export type Group = 'Opportunity' | 'Production' | 'How he plays';
export const GROUPS: readonly Group[] = ['Opportunity', 'Production', 'How he plays'];

/**
 * `team`: his teams' red-zone targets, inside-10 carries and red-zone carries, summed over the weeks he played for them.
 * `scoring`: the league's scoring settings (Sleeper keys), for the fantasy tiles.
 */
export interface GradeInput { agg: Agg; g: GradeSums; ftn: boolean; team: { rzTgt: number; in10: number; rzCar: number }; scoring: Record<string, number> }

export interface TileDef {
  key: string;
  label: string;
  /** the ranked quantity: a rate for "c / t" tiles, the season total for per-game count tiles */
  value: (x: GradeInput) => number | null;
  /** the big number */
  text: (x: GradeInput) => string;
  /** the muted line under the label */
  detail: (x: GradeInput) => string;
  /** the tile's own sample: under 5 it is not ranked; for FTN tiles 0 means FTN charted none of his plays */
  denom?: (x: GradeInput) => number;
  /** a count: ranked per game played, shown as the season total */
  perGame?: true;
  /** describes how he plays, not how well: ranked but not coloured */
  style?: true;
  /** lower is better: the percentile is flipped */
  low?: true;
  /** needs FTN charting */
  ftnOnly?: true;
}

export interface CardDef { key: string; title: string; group: Group; tiles: [TileDef, TileDef, TileDef, TileDef] }

const g = (k: GradeKey) => (x: GradeInput): number => x.g[k] ?? 0;
const per = (n: GradeKey, d: GradeKey) => (x: GradeInput): number | null => { const den = x.g[d] ?? 0; return den > 0 ? (x.g[n] ?? 0) / den : null; };
/** his share of his teams' total over the weeks he played */
const teamShare = (k: GradeKey, t: keyof GradeInput['team']) => (x: GradeInput): number | null => (x.team[t] > 0 ? Math.min(1, (x.g[k] ?? 0) / x.team[t]) : null);
/** a Players-table column's value over the season */
const col = (key: string) => (x: GradeInput): number | null => columnValue(COLUMNS[key], x.agg, 'total');
const ngs = (k: keyof Agg['w']) => (x: GradeInput): number | null => x.agg.w[k] ?? null;
const n0 = (v: number) => String(Math.round(v));
const n1 = (v: number) => v.toFixed(1);
const signedPct = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(1)}%`;
const unit = (fmt: (v: number) => string, u: string) => (v: number) => `${fmt(v)} ${u}`;
const signed = (places: number) => (v: number) => fmtSigned(v, places).replace('-', '−');

type Opts = Partial<Pick<TileDef, 'denom' | 'perGame' | 'style' | 'low' | 'ftnOnly' | 'text'>>;
/** A tile whose big number is its value through `fmt`; '—' when there is none. */
function tile(key: string, label: string, value: TileDef['value'], fmt: (v: number) => string, detail: TileDef['detail'], o: Opts = {}): TileDef {
  return { key, label, value, text: (x) => { const v = value(x); return v === null ? '—' : fmt(v); }, detail, ...o };
}
/** "c / t": shown as the two counts, ranked on the rate */
function ofTile(key: string, label: string, n: GradeKey, d: GradeKey, o: Opts = {}): TileDef {
  return tile(key, label, per(n, d), fmtPct, (x) => (g(d)(x) > 0 ? fmtPct(g(n)(x) / g(d)(x)) : 'none'), { denom: g(d), text: (x) => `${n0(g(n)(x))} / ${n0(g(d)(x))}`, ...o });
}
/** a season count, ranked per game */
function countTile(key: string, label: string, value: TileDef['value'], o: Opts = {}): TileDef {
  return tile(key, label, value, n0, (x) => { const v = value(x); return v === null || x.agg.games === 0 ? 'none' : `${(v / x.agg.games).toFixed(1)} per game`; }, { perGame: true, ...o });
}
const of = (n: GradeKey, d: GradeKey, tail = '') => (x: GradeInput) => `${n0(g(n)(x))} of ${n0(g(d)(x))}${tail}`;
const fixed = (s: string) => () => s;
/** per-route tiles: the route count, or a warning while the season's routes are estimated */
const routeNote = (x: GradeInput) => (x.agg.routesEst ? 'est. routes' : `${n0(x.agg.routes)} routes`);

const card = (key: string, title: string, group: Group, tiles: CardDef['tiles']): CardDef => ({ key, title, group, tiles });
const S = (x: GradeInput, k: keyof Agg['s']) => x.agg.s[k] ?? 0;
const w = (x: GradeInput, k: string) => x.scoring[k] ?? 0;
/** league-scoring points from his rushing and from his receiving */
const rushPts = (x: GradeInput) => S(x, 'ru_yds') * w(x, 'rush_yd') + S(x, 'ru_td') * w(x, 'rush_td') + S(x, 'ru_fd') * w(x, 'rush_fd') + S(x, 'ru_2pt') * w(x, 'rush_2pt');
const recPts = (x: GradeInput) => S(x, 're_rec') * w(x, 'rec') + S(x, 're_yds') * w(x, 'rec_yd') + S(x, 're_td') * w(x, 'rec_td') + S(x, 're_fd') * w(x, 'rec_fd') + S(x, 're_2pt') * w(x, 'rec_2pt');
const shareOfPts = (part: (x: GradeInput) => number) => (x: GradeInput): number | null => { const pts = x.agg.s.pts ?? 0; return pts > 0 ? Math.max(0, Math.min(1, part(x) / pts)) : null; };
const games = (x: GradeInput) => `${x.agg.games}G`;

/** Points per game, expected points per game and points over expected, with one position-specific fourth tile. */
const fantasy = (fourth: TileDef): CardDef => card('fantasy', 'Fantasy', 'Production', [
  tile('ppg', 'Points per game', col('ppg'), fmtDec1, games),
  tile('xfpPg', 'Expected points per game', col('xfpPg'), fmtDec1, fixed('xFP: what his volume should score')),
  tile('fpoePg', 'Points over expected per game', col('fpoePg'), signed(1), fixed('FPOE')),
  fourth,
]);

const RECEIVER: CardDef[] = [
  card('opportunity', 'Opportunity', 'Opportunity', [
    tile('tgtShare', 'Target share', col('tgtPct'), fmtPct, (x) => `${n0(x.agg.s.re_tgt ?? 0)} targets`),
    tile('wopr', 'WOPR', col('wopr'), (v) => v.toFixed(2), fixed('targets + air yards')),
    tile('snapShare', 'Snap share', col('snapPct'), fmtPct, (x) => `${n0(x.agg.s.snaps ?? 0)} snaps`),
    tile('tprr', 'Targets per route run', col('tprr'), (v) => v.toFixed(2), routeNote),
  ]),
  card('usage', 'Usage', 'Opportunity', [
    tile('ayShare', 'Team air yards share', ngs('re_iayShare'), (v) => `${Math.round(v)}%`, fixed('NGS')),
    tile('adot', 'Average depth of target', col('adotRe'), unit(fmtDec1, 'yds'), fixed('air yards per target'), { style: true }),
    tile('motion', 'Targets after motion', per('motionTgt', 'ftnTgt'), fmtPct, of('motionTgt', 'ftnTgt'), { style: true, ftnOnly: true, denom: g('ftnTgt') }),
    tile('playAction', 'Play-action targets', per('paTgt', 'ftnTgt'), fmtPct, of('paTgt', 'ftnTgt'), { style: true, ftnOnly: true, denom: g('ftnTgt') }),
  ]),
  card('efficiency', 'Efficiency', 'Production', [
    tile('yprr', 'Yards per route run', col('yprr'), (v) => v.toFixed(2), routeNote),
    tile('epaTgt', 'EPA per target', per('epa', 'tgt'), signed(2), (x) => `${n0(g('tgt')(x))} targets`),
    tile('success', 'Success rate', per('succ', 'tgt'), fmtPct, of('succ', 'tgt')),
    tile('fdrr', 'First downs per route run', col('fdrr'), (v) => v.toFixed(2), routeNote),
  ]),
  card('expectation', 'Beating expectation', 'Production', [
    tile('croe', 'Catch rate over expected', (x) => (g('cpN')(x) > 0 ? (g('cpRec')(x) - g('cpSum')(x)) / g('cpN')(x) : null), signedPct,
      (x) => `${n0(g('cpRec')(x))} catches vs ${n1(g('cpSum')(x))} expected`, { denom: g('cpN') }),
    tile('yacoe', 'YAC over expected', col('yacoe'), signed(1), fixed('per catch · NGS')),
    tile('racr', 'RACR', col('racr'), (v) => v.toFixed(2), fixed('rec yds per air yard')),
    countTile('brokenTackles', 'Broken tackles', (x) => x.agg.s.re_bt ?? null),
  ]),
  card('deep', 'Deep threat', 'Production', [
    tile('deepRate', 'Deep target rate', per('deep', 'tgt'), fmtPct, of('deep', 'tgt'), { style: true }),
    ofTile('deepCatches', 'Deep catches', 'deepRec', 'deep'),
    countTile('deepYds', 'Deep yards', g('deepYds'), { denom: g('deep') }),
    tile('deepEpa', 'EPA per deep target', per('deepEpa', 'deep'), signed(2), (x) => `${n0(g('deep')(x))} deep targets`, { denom: g('deep') }),
  ]),
  card('bigPlays', 'Big plays', 'Production', [
    countTile('rec20', '20+ yard catches', (x) => x.agg.s.re_20 ?? null),
    countTile('rec40', '40+ yard catches', (x) => x.agg.s.re_40 ?? null),
    tile('explosiveRate', 'Explosive catch rate', (x) => (S(x, 're_tgt') > 0 ? S(x, 're_20') / S(x, 're_tgt') : null), fmtPct, fixed('20+ yard catches per target')),
    tile('yacRec', 'YAC per catch', col('yacRec'), fmtDec1, fixed('yards after the catch')),
  ]),
  card('money', 'Money downs', 'Production', [
    tile('thirdDown', '3rd-down conversions', per('t3Conv', 't3'), fmtPct, of('t3Conv', 't3', ' targets'), { denom: g('t3') }),
    tile('rzShare', 'Red-zone target share', teamShare('rzTgt', 'rzTgt'), fmtPct, (x) => `${n0(g('rzTgt')(x))} of ${n0(x.team.rzTgt)}`, { denom: (x) => x.team.rzTgt }),
    countTile('endZone', 'End-zone targets', g('ezTgt')),
    tile('tdRate', 'TD rate', per('td', 'tgt'), fmtPct, (x) => `${n0(g('td')(x))} TD on ${n0(g('tgt')(x))} targets`),
  ]),
  card('ballSkills', 'Ball skills & separation', 'How he plays', [
    tile('dropRate', 'Drop rate', per('drops', 'catchable'), fmtPct, of('drops', 'catchable', ' catchable'), { low: true, ftnOnly: true, denom: g('catchable') }),
    ofTile('contested', 'Contested catches', 'contestedRec', 'contested', { ftnOnly: true }),
    countTile('created', 'Created receptions', g('created'), { ftnOnly: true, denom: g('ftnTgt') }),
    tile('separation', 'Separation', col('sep'), unit(fmtDec1, 'yds'), fixed('NGS')),
  ]),
  fantasy(tile('fpTgt', 'Points per target', col('fpTgt'), (v) => v.toFixed(2), (x) => `${n0(S(x, 're_tgt'))} targets`)),
];

const QB: CardDef[] = [
  card('efficiency', 'Efficiency', 'Production', [
    tile('epaDb', 'EPA per dropback', per('dbEpa', 'db'), signed(2), (x) => `${n0(g('db')(x))} dropbacks`),
    tile('success', 'Success rate', per('dbSucc', 'db'), fmtPct, of('dbSucc', 'db')),
    tile('anya', 'ANY/A', (x) => { const d = g('att')(x) + g('sacks')(x); return d > 0 ? (g('passYds')(x) + 20 * g('passTd')(x) - 45 * g('int')(x) - g('sackYds')(x)) / d : null; }, fmtDec1, fixed('adjusted net yds per attempt')),
    tile('sackRate', 'Sack rate', per('sacks', 'db'), fmtPct, (x) => `${n0(g('sacks')(x))} sacks`, { low: true }),
  ]),
  card('accuracy', 'Accuracy & aggressiveness', 'Production', [
    tile('cpoe', 'Completion % over expected', col('cpoe'), signed(1), fixed('NGS')),
    tile('catchable', 'Catchable balls', per('catchableThrown', 'ftnAtt'), fmtPct, of('catchableThrown', 'ftnAtt'), { ftnOnly: true, denom: g('ftnAtt') }),
    tile('badThrows', 'Bad throws', col('badPct'), fmtPct, fixed('PFR'), { low: true }),
    tile('tightWindow', 'Tight-window throws', ngs('pa_aggr'), (v) => `${Math.round(v)}%`, fixed('NGS aggressiveness'), { style: true }),
  ]),
  card('deep', 'Deep ball', 'Production', [
    tile('deepRate', 'Deep attempt rate', per('deepAtt', 'att'), fmtPct, of('deepAtt', 'att'), { style: true }),
    ofTile('deepCompletions', 'Deep completions', 'deepCmp', 'deepAtt'),
    tile('deepEpa', 'EPA per deep attempt', per('deepAttEpa', 'deepAtt'), signed(2), (x) => `${n0(g('deepAtt')(x))} deep attempts`, { denom: g('deepAtt') }),
    tile('deepCpoe', 'Deep CPOE', per('deepCpoeSum', 'deepCpoeN'), signed(1), (x) => `${n0(g('deepCpoeN')(x))} deep attempts`, { denom: g('deepCpoeN') }),
  ]),
  card('clutch', 'Clutch & situational', 'Production', [
    tile('thirdDown', '3rd-down conversions', per('t3DbConv', 't3Db'), fmtPct, of('t3DbConv', 't3Db'), { denom: g('t3Db') }),
    tile('rzTd', 'Red-zone TD rate', per('rzTd', 'rzDb'), fmtPct, of('rzTd', 'rzDb', ' dropbacks'), { denom: g('rzDb') }),
    tile('q4', '4th-quarter EPA / dropback', per('q4Epa', 'q4Db'), signed(2), (x) => `${n0(g('q4Db')(x))} dropbacks`, { denom: g('q4Db') }),
    tile('trailing', 'EPA / dropback when trailing', per('trailEpa', 'trailDb'), signed(2), (x) => `${n0(g('trailDb')(x))} dropbacks`, { denom: g('trailDb') }),
  ]),
  card('pocket', 'Pocket & pressure', 'How he plays', [
    tile('pressure', 'Pressure rate faced', col('pressPct'), fmtPct, fixed('PFR'), { style: true }),
    tile('ttt', 'Time to throw', col('ttt'), (v) => `${v.toFixed(2)} s`, fixed('NGS'), { style: true }),
    tile('blitz', 'EPA / dropback vs blitz', per('blitzEpa', 'blitzDb'), signed(2), (x) => `${n0(g('blitzDb')(x))} dropbacks`, { ftnOnly: true, denom: g('blitzDb') }),
    tile('noBlitz', 'EPA / dropback, no blitz', per('noBlitzEpa', 'noBlitzDb'), signed(2), (x) => `${n0(g('noBlitzDb')(x))} dropbacks`, { ftnOnly: true, denom: g('noBlitzDb') }),
  ]),
  card('legs', 'Legs', 'How he plays', [
    tile('scrambleRate', 'Scramble rate', per('scr', 'db'), fmtPct, (x) => `${n0(g('scr')(x))} scrambles`, { style: true }),
    tile('ypScramble', 'Yards per scramble', per('scrYds', 'scr'), fmtDec1, (x) => (g('scr')(x) > 0 ? `${n0(g('scr')(x))} scrambles` : 'none'), { denom: g('scr') }),
    tile('designedRun', 'EPA per designed run', per('drunEpa', 'drun'), signed(2), (x) => `${n0(g('drun')(x))} runs`, { denom: g('drun') }),
    countTile('rushFd', 'Rushing first downs', g('rushFd')),
  ]),
  card('decisions', 'Decision making', 'How he plays', [
    tile('iw', 'Interception-worthy throws', per('iw', 'ftnAtt'), fmtPct, of('iw', 'ftnAtt', ' throws'), { low: true, ftnOnly: true, denom: g('ftnAtt') }),
    tile('firstRead', 'Thrown to his first read', per('firstRead', 'readN'), fmtPct, of('firstRead', 'readN'), { style: true, ftnOnly: true, denom: g('readN') }),
    tile('throwaways', 'Throwaways', per('throwaway', 'ftnAtt'), fmtPct, (x) => `${n0(g('throwaway')(x))} throws`, { style: true, ftnOnly: true, denom: g('ftnAtt') }),
    tile('faultSacks', 'Sacks he caused', per('faultSack', 'ftnDb'), fmtPct, (x) => `${n0(g('faultSack')(x))} of ${n0(g('sacks')(x))} sacks`, { low: true, ftnOnly: true, denom: g('ftnDb') }),
  ]),
  card('scheme', 'Scheme', 'How he plays', [
    tile('paRate', 'Play-action dropbacks', per('paDb', 'ftnDb'), fmtPct, of('paDb', 'ftnDb'), { style: true, ftnOnly: true, denom: g('ftnDb') }),
    tile('paEpa', 'EPA on play-action', per('paEpa', 'paDb'), signed(2), (x) => `${n0(g('paDb')(x))} dropbacks`, { ftnOnly: true, denom: g('paDb') }),
    tile('sticks', 'Air yards past the sticks', ngs('pa_ays'), unit(signed(1), 'yds'), fixed('NGS'), { style: true }),
    tile('recDrops', 'Receivers’ drops', per('recDrops', 'ftnAtt'), fmtPct, of('recDrops', 'ftnAtt'), { style: true, ftnOnly: true, denom: g('ftnAtt') }),
  ]),
  fantasy(tile('rushShare', 'Share of points from rushing', shareOfPts(rushPts), fmtPct, (x) => `${n1(rushPts(x))} of ${n1(S(x, 'pts'))} pts`, { style: true })),
];

const RB: CardDef[] = [
  card('workload', 'Workload', 'Opportunity', [
    tile('snapShare', 'Snap share', col('snapPct'), fmtPct, (x) => `${n0(x.agg.s.snaps ?? 0)} snaps`),
    tile('oppShare', 'Opportunity share', col('oppPct'), fmtPct, fixed('carries + targets')),
    tile('in10Share', 'Team carries inside the 10', teamShare('in10', 'in10'), fmtPct, (x) => `${n0(g('in10')(x))} of ${n0(x.team.in10)}`, { denom: (x) => x.team.in10 }),
    ofTile('in5Td', 'TDs on carries inside the 5', 'in5Td', 'in5'),
  ]),
  card('efficiency', 'Efficiency', 'Production', [
    tile('ypc', 'Yards per carry', per('carYds', 'car'), fmtDec1, (x) => `${n0(g('carYds')(x))} yds`),
    tile('epaCarry', 'EPA per carry', per('carEpa', 'car'), signed(2), (x) => `${n0(g('car')(x))} carries`),
    tile('success', 'Success rate', per('carSucc', 'car'), fmtPct, of('carSucc', 'car')),
    tile('fdCarry', 'First downs per carry', per('carFd', 'car'), fmtPct, of('carFd', 'car')),
  ]),
  card('expected', 'Rushing vs expected', 'Production', [
    tile('ryoe', 'Rush yards over expected / carry', col('ryoeAtt'), signed(2), fixed('NGS')),
    tile('beatExpected', 'Carries that beat expected', ngs('ru_pctOe'), fmtPct, fixed('NGS')),
    tile('explosive', 'Explosive runs (10+)', per('explosive', 'car'), fmtPct, of('explosive', 'car')),
    tile('stuffed', 'Stuffed (0 or less)', per('stuffed', 'car'), fmtPct, of('stuffed', 'car'), { low: true }),
  ]),
  card('contact', 'After contact', 'Production', [
    tile('ybc', 'Yards before contact / carry', col('ybc'), fmtDec1, fixed('PFR'), { style: true }),
    tile('yac', 'Yards after contact / carry', col('yacAtt'), fmtDec1, fixed('PFR')),
    countTile('brokenTackles', 'Broken tackles', (x) => x.agg.s.ru_bt ?? null),
    tile('btRate', 'Broken tackles per touch', col('btTouch'), (v) => v.toFixed(2), fixed('carries + catches')),
  ]),
  card('receiving', 'Receiving back', 'Production', [
    tile('tgtShare', 'Target share', col('tgtPct'), fmtPct, (x) => `${n0(x.agg.s.re_tgt ?? 0)} targets`),
    tile('tprr', 'Targets per route run', col('tprr'), (v) => v.toFixed(2), routeNote),
    tile('yacoe', 'YAC over expected', per('yacOe', 'yacN'), signed(1), fixed('per catch'), { denom: g('yacN') }),
    tile('epaTgt', 'EPA per target', per('epa', 'tgt'), signed(2), (x) => `${n0(g('tgt')(x))} targets`, { denom: g('tgt') }),
  ]),
  card('money', 'Money downs', 'Production', [
    ofTile('shortYardage', 'Short-yardage conversions', 'shortConv', 'shortAtt'),
    tile('thirdDown', '3rd-down conversions', (x) => { const n = g('t3Car')(x) + g('t3')(x); return n > 0 ? (g('t3CarConv')(x) + g('t3Conv')(x)) / n : null; }, fmtPct,
      (x) => `${n0(g('t3CarConv')(x) + g('t3Conv')(x))} of ${n0(g('t3Car')(x) + g('t3')(x))}`, { denom: (x) => g('t3Car')(x) + g('t3')(x) }),
    tile('rzCarShare', 'Team red-zone carries', teamShare('rzCar', 'rzCar'), fmtPct, (x) => `${n0(g('rzCar')(x))} of ${n0(x.team.rzCar)}`, { denom: (x) => x.team.rzCar }),
    tile('tdTouch', 'TDs per touch', (x) => { const t = S(x, 'ru_att') + S(x, 're_rec'); return t > 0 ? (S(x, 'ru_td') + S(x, 're_td')) / t : null; }, (v) => `${(v * 100).toFixed(1)}%`,
      (x) => `${n0(S(x, 'ru_td') + S(x, 're_td'))} TD on ${n0(S(x, 'ru_att') + S(x, 're_rec'))} touches`),
  ]),
  card('fronts', 'Fronts faced', 'How he plays', [
    tile('box8', 'Carries vs 8+ in the box', ngs('ru_box8'), (v) => `${Math.round(v)}%`, fixed('NGS'), { style: true }),
    tile('avgBox', 'Average defenders in the box', per('boxSum', 'boxN'), fmtDec1, fixed('FTN'), { style: true, ftnOnly: true, denom: g('boxN') }),
    tile('lightBox', 'Yds/carry vs light box (≤6)', per('lightYds', 'lightCar'), fmtDec1, (x) => `${n0(g('lightCar')(x))} carries`, { ftnOnly: true, denom: g('lightCar') }),
    tile('heavyBox', 'Yds/carry vs stacked box (8+)', per('heavyYds', 'heavyCar'), fmtDec1, (x) => `${n0(g('heavyCar')(x))} carries`, { ftnOnly: true, denom: g('heavyCar') }),
  ]),
  card('style', 'Running style', 'How he plays', [
    tile('ttl', 'Time to the line', ngs('ru_tlos'), (v) => `${v.toFixed(2)} s`, fixed('NGS'), { style: true }),
    tile('efficiency', 'Yards run per yard gained', ngs('ru_eff'), (v) => v.toFixed(2), fixed('NGS · lower is straighter'), { style: true }),
    tile('rpo', 'RPO carries', per('rpo', 'ftnCar'), fmtPct, of('rpo', 'ftnCar'), { style: true, ftnOnly: true, denom: g('ftnCar') }),
    tile('outside', 'Carries outside the tackles', per('outside', 'car'), fmtPct, of('outside', 'car'), { style: true }),
  ]),
  fantasy(tile('recShare', 'Share of points from receiving', shareOfPts(recPts), fmtPct, (x) => `${n1(recPts(x))} of ${n1(S(x, 'pts'))} pts`, { style: true })),
];

/** Cards per position, in page order; a TE uses the receiver set. */
export const CARDS: Record<'QB' | 'RB' | 'WR', CardDef[]> = { QB, RB, WR: RECEIVER };
