import type { GradeKey, GradeSums } from '@fantasy-dash/core';
import type { Agg } from '../playerdb/aggregate';
import { COLUMNS, columnValue } from '../playerdb/columns';
import { fmtDec1, fmtPct, fmtSigned } from '../charts/scale';

export type Group = 'Opportunity' | 'Production' | 'How he plays';
export const GROUPS: readonly Group[] = ['Opportunity', 'Production', 'How he plays'];

export interface GradeInput { agg: Agg; g: GradeSums; ftn: boolean }

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

export interface CardDef { key: string; title: string; question: string; group: Group; tiles: [TileDef, TileDef, TileDef, TileDef] }

const g = (k: GradeKey) => (x: GradeInput): number => x.g[k] ?? 0;
const per = (n: GradeKey, d: GradeKey) => (x: GradeInput): number | null => { const den = x.g[d] ?? 0; return den > 0 ? (x.g[n] ?? 0) / den : null; };
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

const card = (key: string, title: string, question: string, group: Group, tiles: CardDef['tiles']): CardDef => ({ key, title, question, group, tiles });

const RECEIVER: CardDef[] = [
  card('opportunity', 'Opportunity', 'How much of the offence runs through him?', 'Opportunity', [
    tile('tgtShare', 'Target share', col('tgtPct'), fmtPct, (x) => `${n0(x.agg.s.re_tgt ?? 0)} targets`),
    tile('wopr', 'WOPR', col('wopr'), (v) => v.toFixed(2), fixed('targets + air yards')),
    tile('snapShare', 'Snap share', col('snapPct'), fmtPct, (x) => `${n0(x.agg.s.snaps ?? 0)} snaps`),
    tile('tprr', 'Targets per route run', col('tprr'), (v) => v.toFixed(2), (x) => (x.agg.routesEst ? 'est. routes' : 'per route')),
  ]),
  card('usage', 'Usage', 'How is the offence getting him the ball?', 'Opportunity', [
    tile('ayShare', 'Team air yards share', ngs('re_iayShare'), (v) => `${Math.round(v)}%`, fixed('NGS')),
    tile('adot', 'Average depth of target', col('adotRe'), unit(fmtDec1, 'yds'), fixed('air yards per target'), { style: true }),
    tile('motion', 'Targets after motion', per('motionTgt', 'ftnTgt'), fmtPct, of('motionTgt', 'ftnTgt'), { style: true, ftnOnly: true, denom: g('ftnTgt') }),
    tile('playAction', 'Play-action targets', per('paTgt', 'ftnTgt'), fmtPct, of('paTgt', 'ftnTgt'), { style: true, ftnOnly: true, denom: g('ftnTgt') }),
  ]),
  card('efficiency', 'Efficiency', 'What does a target to him earn?', 'Production', [
    tile('ypt', 'Yards per target', per('yds', 'tgt'), fmtDec1, (x) => `${n0(g('yds')(x))} yds`),
    tile('epaTgt', 'EPA per target', per('epa', 'tgt'), signed(2), (x) => `${n0(g('tgt')(x))} targets`),
    tile('success', 'Success rate', per('succ', 'tgt'), fmtPct, of('succ', 'tgt')),
    tile('fdTgt', 'First downs per target', per('fd', 'tgt'), fmtPct, of('fd', 'tgt')),
  ]),
  card('expectation', 'Beating expectation', 'Does he do more than the throw gives him?', 'Production', [
    tile('croe', 'Catch rate over expected', (x) => (g('cpN')(x) > 0 ? (g('cpRec')(x) - g('cpSum')(x)) / g('cpN')(x) : null), signedPct,
      (x) => `${n0(g('cpRec')(x))} catches vs ${n1(g('cpSum')(x))} expected`, { denom: g('cpN') }),
    tile('yacoe', 'YAC over expected', col('yacoe'), signed(1), fixed('per catch · NGS')),
    tile('racr', 'RACR', col('racr'), (v) => v.toFixed(2), fixed('rec yds per air yard')),
    countTile('brokenTackles', 'Broken tackles', (x) => x.agg.s.re_bt ?? null),
  ]),
  card('deep', 'Deep threat', 'What happens when they throw it 20+?', 'Production', [
    tile('deepRate', 'Deep target rate', per('deep', 'tgt'), fmtPct, of('deep', 'tgt'), { style: true }),
    ofTile('deepCatches', 'Deep catches', 'deepRec', 'deep'),
    countTile('deepYds', 'Deep yards', g('deepYds'), { denom: g('deep') }),
    tile('deepEpa', 'EPA per deep target', per('deepEpa', 'deep'), signed(2), (x) => `${n0(g('deep')(x))} deep targets`, { denom: g('deep') }),
  ]),
  card('money', 'Money downs', 'Is he there when it matters?', 'Production', [
    tile('thirdDown', '3rd-down conversions', per('t3Conv', 't3'), fmtPct, of('t3Conv', 't3', ' targets'), { denom: g('t3') }),
    tile('rzShare', 'Red-zone target share', per('rzTgt', 'teamRzTgt'), fmtPct, of('rzTgt', 'teamRzTgt'), { denom: g('teamRzTgt') }),
    countTile('endZone', 'End-zone targets', g('ezTgt')),
    tile('tdRate', 'TD rate', per('td', 'tgt'), fmtPct, (x) => `${n0(g('td')(x))} TD on ${n0(g('tgt')(x))} targets`),
  ]),
  card('ballSkills', 'Ball skills & separation', 'Can he get open and finish the catch?', 'How he plays', [
    tile('dropRate', 'Drop rate', per('drops', 'catchable'), fmtPct, of('drops', 'catchable', ' catchable'), { low: true, ftnOnly: true, denom: g('catchable') }),
    ofTile('contested', 'Contested catches', 'contestedRec', 'contested', { ftnOnly: true }),
    countTile('created', 'Created receptions', g('created'), { ftnOnly: true, denom: g('ftnTgt') }),
    tile('separation', 'Separation', col('sep'), unit(fmtDec1, 'yds'), fixed('NGS')),
  ]),
];

const QB: CardDef[] = [
  card('efficiency', 'Efficiency', 'What does a dropback earn?', 'Production', [
    tile('epaDb', 'EPA per dropback', per('dbEpa', 'db'), signed(2), (x) => `${n0(g('db')(x))} dropbacks`),
    tile('success', 'Success rate', per('dbSucc', 'db'), fmtPct, of('dbSucc', 'db')),
    tile('anya', 'ANY/A', (x) => { const d = g('att')(x) + g('sacks')(x); return d > 0 ? (g('passYds')(x) + 20 * g('passTd')(x) - 45 * g('int')(x) - g('sackYds')(x)) / d : null; }, fmtDec1, fixed('adjusted net yds per attempt')),
    tile('sackRate', 'Sack rate', per('sacks', 'db'), fmtPct, (x) => `${n0(g('sacks')(x))} sacks`, { low: true }),
  ]),
  card('accuracy', 'Accuracy & aggressiveness', 'Is he putting it where receivers can catch it?', 'Production', [
    tile('cpoe', 'Completion % over expected', col('cpoe'), signed(1), fixed('NGS')),
    tile('catchable', 'Catchable balls', per('catchableThrown', 'ftnAtt'), fmtPct, of('catchableThrown', 'ftnAtt'), { ftnOnly: true, denom: g('ftnAtt') }),
    tile('badThrows', 'Bad throws', col('badPct'), fmtPct, fixed('PFR'), { low: true }),
    tile('tightWindow', 'Tight-window throws', ngs('pa_aggr'), (v) => `${Math.round(v)}%`, fixed('NGS aggressiveness'), { style: true }),
  ]),
  card('deep', 'Deep ball', 'Can he hurt you 20+ downfield?', 'Production', [
    tile('deepRate', 'Deep attempt rate', per('deepAtt', 'att'), fmtPct, of('deepAtt', 'att'), { style: true }),
    ofTile('deepCompletions', 'Deep completions', 'deepCmp', 'deepAtt'),
    tile('deepEpa', 'EPA per deep attempt', per('deepAttEpa', 'deepAtt'), signed(2), (x) => `${n0(g('deepAtt')(x))} deep attempts`, { denom: g('deepAtt') }),
    tile('deepCpoe', 'Deep CPOE', per('deepCpoeSum', 'deepCpoeN'), signed(1), (x) => `${n0(g('deepCpoeN')(x))} deep attempts`, { denom: g('deepCpoeN') }),
  ]),
  card('clutch', 'Clutch & situational', 'Does he deliver when it counts?', 'Production', [
    tile('thirdDown', '3rd-down conversions', per('t3DbConv', 't3Db'), fmtPct, of('t3DbConv', 't3Db'), { denom: g('t3Db') }),
    tile('rzTd', 'Red-zone TD rate', per('rzTd', 'rzDb'), fmtPct, of('rzTd', 'rzDb', ' dropbacks'), { denom: g('rzDb') }),
    tile('q4', '4th-quarter EPA / dropback', per('q4Epa', 'q4Db'), signed(2), (x) => `${n0(g('q4Db')(x))} dropbacks`, { denom: g('q4Db') }),
    tile('trailing', 'EPA / dropback when trailing', per('trailEpa', 'trailDb'), signed(2), (x) => `${n0(g('trailDb')(x))} dropbacks`, { denom: g('trailDb') }),
  ]),
  card('decisions', 'Decision making', 'Does he protect the ball and take what is there?', 'How he plays', [
    tile('iw', 'Interception-worthy throws', per('iw', 'ftnAtt'), fmtPct, of('iw', 'ftnAtt', ' throws'), { low: true, ftnOnly: true, denom: g('ftnAtt') }),
    tile('firstRead', 'Thrown to his first read', per('firstRead', 'readN'), fmtPct, of('firstRead', 'readN'), { style: true, ftnOnly: true, denom: g('readN') }),
    tile('throwaways', 'Throwaways', per('throwaway', 'ftnAtt'), fmtPct, (x) => `${n0(g('throwaway')(x))} throws`, { style: true, ftnOnly: true, denom: g('ftnAtt') }),
    tile('faultSacks', 'Sacks he caused', per('faultSack', 'ftnDb'), fmtPct, (x) => `${n0(g('faultSack')(x))} of ${n0(g('sacks')(x))} sacks`, { low: true, ftnOnly: true, denom: g('ftnDb') }),
  ]),
  card('pocket', 'Pocket & pressure', 'How does he handle the rush?', 'How he plays', [
    tile('pressure', 'Pressure rate faced', col('pressPct'), fmtPct, fixed('PFR'), { style: true }),
    tile('ttt', 'Time to throw', col('ttt'), (v) => `${v.toFixed(2)} s`, fixed('NGS'), { style: true }),
    tile('blitz', 'EPA / dropback vs blitz', per('blitzEpa', 'blitzDb'), signed(2), (x) => `${n0(g('blitzDb')(x))} dropbacks`, { ftnOnly: true, denom: g('blitzDb') }),
    tile('noBlitz', 'EPA / dropback, no blitz', per('noBlitzEpa', 'noBlitzDb'), signed(2), (x) => `${n0(g('noBlitzDb')(x))} dropbacks`, { ftnOnly: true, denom: g('noBlitzDb') }),
  ]),
  card('legs', 'Legs', 'Does he add anything running?', 'How he plays', [
    tile('scrambleRate', 'Scramble rate', per('scr', 'db'), fmtPct, (x) => `${n0(g('scr')(x))} scrambles`, { style: true }),
    tile('ypScramble', 'Yards per scramble', per('scrYds', 'scr'), fmtDec1, (x) => (g('scr')(x) > 0 ? `${n0(g('scr')(x))} scrambles` : 'none'), { denom: g('scr') }),
    tile('designedRun', 'EPA per designed run', per('drunEpa', 'drun'), signed(2), (x) => `${n0(g('drun')(x))} runs`, { denom: g('drun') }),
    countTile('rushFd', 'Rushing first downs', g('rushFd')),
  ]),
  card('scheme', 'Scheme', 'What does the offence ask of him?', 'How he plays', [
    tile('paRate', 'Play-action dropbacks', per('paDb', 'ftnDb'), fmtPct, of('paDb', 'ftnDb'), { style: true, ftnOnly: true, denom: g('ftnDb') }),
    tile('paEpa', 'EPA on play-action', per('paEpa', 'paDb'), signed(2), (x) => `${n0(g('paDb')(x))} dropbacks`, { ftnOnly: true, denom: g('paDb') }),
    tile('sticks', 'Air yards past the sticks', ngs('pa_ays'), unit(signed(1), 'yds'), fixed('NGS'), { style: true }),
    tile('recDrops', 'Receivers’ drops', per('recDrops', 'ftnAtt'), fmtPct, of('recDrops', 'ftnAtt'), { style: true, ftnOnly: true, denom: g('ftnAtt') }),
  ]),
];

const RB: CardDef[] = [
  card('workload', 'Workload', 'How much of the backfield is his?', 'Opportunity', [
    tile('snapShare', 'Snap share', col('snapPct'), fmtPct, (x) => `${n0(x.agg.s.snaps ?? 0)} snaps`),
    tile('oppShare', 'Opportunity share', col('oppPct'), fmtPct, fixed('carries + targets')),
    tile('in10Share', 'Carries inside the 10', per('in10', 'teamIn10'), fmtPct, of('in10', 'teamIn10'), { denom: g('teamIn10') }),
    ofTile('in5Td', 'TDs on carries inside the 5', 'in5Td', 'in5'),
  ]),
  card('efficiency', 'Efficiency', 'What does a carry earn?', 'Production', [
    tile('ypc', 'Yards per carry', per('carYds', 'car'), fmtDec1, (x) => `${n0(g('carYds')(x))} yds`),
    tile('epaCarry', 'EPA per carry', per('carEpa', 'car'), signed(2), (x) => `${n0(g('car')(x))} carries`),
    tile('success', 'Success rate', per('carSucc', 'car'), fmtPct, of('carSucc', 'car')),
    tile('fdCarry', 'First downs per carry', per('carFd', 'car'), fmtPct, of('carFd', 'car')),
  ]),
  card('expected', 'Rushing vs expected', 'Is he beating what the blocking gives him?', 'Production', [
    tile('ryoe', 'Rush yards over expected / carry', col('ryoeAtt'), signed(2), fixed('NGS')),
    tile('beatExpected', 'Carries that beat expected', ngs('ru_pctOe'), fmtPct, fixed('NGS')),
    tile('explosive', 'Explosive runs (10+)', per('explosive', 'car'), fmtPct, of('explosive', 'car')),
    tile('stuffed', 'Stuffed (0 or less)', per('stuffed', 'car'), fmtPct, of('stuffed', 'car'), { low: true }),
  ]),
  card('contact', 'After contact', 'What does he make on his own?', 'Production', [
    tile('ybc', 'Yards before contact / carry', col('ybc'), fmtDec1, fixed('PFR'), { style: true }),
    tile('yac', 'Yards after contact / carry', col('yacAtt'), fmtDec1, fixed('PFR')),
    countTile('brokenTackles', 'Broken tackles', (x) => x.agg.s.ru_bt ?? null),
    tile('btRate', 'Broken tackles per touch', col('btTouch'), (v) => v.toFixed(2), fixed('carries + catches')),
  ]),
  card('receiving', 'Receiving back', 'Does he matter in the passing game?', 'Production', [
    tile('tgtShare', 'Target share', col('tgtPct'), fmtPct, (x) => `${n0(x.agg.s.re_tgt ?? 0)} targets`),
    tile('tprr', 'Targets per route run', col('tprr'), (v) => v.toFixed(2), (x) => (x.agg.routesEst ? 'est. routes' : 'per route')),
    tile('yacoe', 'YAC over expected', per('yacOe', 'yacN'), signed(1), fixed('per catch'), { denom: g('yacN') }),
    tile('epaTgt', 'EPA per target', per('epa', 'tgt'), signed(2), (x) => `${n0(g('tgt')(x))} targets`, { denom: g('tgt') }),
  ]),
  card('fronts', 'Fronts faced', 'How hard is the box he runs into?', 'How he plays', [
    tile('box8', 'Carries vs 8+ in the box', ngs('ru_box8'), (v) => `${Math.round(v)}%`, fixed('NGS'), { style: true }),
    tile('avgBox', 'Average defenders in the box', per('boxSum', 'boxN'), fmtDec1, fixed('FTN'), { style: true, ftnOnly: true, denom: g('boxN') }),
    tile('lightBox', 'Yds/carry vs light box (≤6)', per('lightYds', 'lightCar'), fmtDec1, (x) => `${n0(g('lightCar')(x))} carries`, { ftnOnly: true, denom: g('lightCar') }),
    tile('heavyBox', 'Yds/carry vs stacked box (8+)', per('heavyYds', 'heavyCar'), fmtDec1, (x) => `${n0(g('heavyCar')(x))} carries`, { ftnOnly: true, denom: g('heavyCar') }),
  ]),
  card('style', 'Running style', 'How does he get there?', 'How he plays', [
    tile('ttl', 'Time to the line', ngs('ru_tlos'), (v) => `${v.toFixed(2)} s`, fixed('NGS'), { style: true }),
    tile('efficiency', 'Yards run per yard gained', ngs('ru_eff'), (v) => v.toFixed(2), fixed('NGS · lower is straighter'), { style: true }),
    tile('rpo', 'RPO carries', per('rpo', 'ftnCar'), fmtPct, of('rpo', 'ftnCar'), { style: true, ftnOnly: true, denom: g('ftnCar') }),
    tile('outside', 'Carries outside the tackles', per('outside', 'car'), fmtPct, of('outside', 'car'), { style: true }),
  ]),
];

/** Cards per position, in page order; a TE uses the receiver set. */
export const CARDS: Record<'QB' | 'RB' | 'WR', CardDef[]> = { QB, RB, WR: RECEIVER };
