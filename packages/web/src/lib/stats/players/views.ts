import type { PlayerStat, Pos } from './season';

export type Fmt = (v: number) => string;
export interface View {
  id: string; pos: Pos[]; label: string; question: string;
  x: keyof PlayerStat; y: keyof PlayerStat; xLabel: string; yLabel: string; fx: Fmt; fy: Fmt;
  min: (p: PlayerStat) => boolean; diagonal?: boolean; participation?: boolean;
  /** top-right, top-left, bottom-right, bottom-left */
  quads: [string, string, string, string];
}

const pct: Fmt = (v) => `${Math.round(v * 100)}%`;
const f1: Fmt = (v) => v.toFixed(1);
const f2: Fmt = (v) => v.toFixed(2);
const signed: Fmt = (v) => { const r = Number(v.toFixed(2)); return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(2)}`; };
const signed1: Fmt = (v) => { const r = Number(v.toFixed(1)); return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(1)}`; };
const te = (p: PlayerStat, wr: number, tight: number) => (p.pos === 'TE' ? tight : wr);
const REC: Pos[] = ['WR', 'TE'];

export const VIEWS: View[] = [
  { id: 'anya', pos: ['QB'], label: 'ANY/A vs CPOE', question: 'Who is accurate, and who actually produces?', x: 'cpoe', y: 'anya', xLabel: 'Completion % over expected', yLabel: 'Adjusted net yards per attempt', fx: signed1, fy: f2, min: (p) => p.att >= 80, quads: ['Elite', 'Big plays, loose accuracy', 'Accurate, little output', 'Struggling'] },
  { id: 'aggr', pos: ['QB'], label: 'Tight windows vs EPA', question: 'Who threads tight windows, and does it pay off?', x: 'aggr', y: 'epaDb', xLabel: 'Throws into tight windows (%)', yLabel: 'EPA per dropback', fx: (v) => `${v.toFixed(1)}%`, fy: signed, min: (p) => p.att >= 80, quads: ['Gunslinger who wins', 'Efficient, plays it safe', 'Forcing it', 'Struggling'] },
  { id: 'clutch', pos: ['QB'], label: 'Closers: Q1–3 vs Q4', question: 'Who gets better when the game is on the line?', x: 'epa13', y: 'epa4', xLabel: 'EPA per dropback, quarters 1–3', yLabel: 'EPA per dropback, 4th quarter and overtime', fx: signed, fy: signed, diagonal: true, min: (p) => p.att >= 80 && p.db4 >= 15, quads: ['Good all game', 'Closer', 'Fades late', 'Struggling'] },
  { id: 'press', pos: ['QB'], label: 'Clean vs pressured', question: 'Who holds up when the pocket breaks down?', x: 'clean', y: 'press', xLabel: 'EPA per dropback, clean pocket', yLabel: 'EPA per dropback, under pressure', fx: signed, fy: signed, participation: true, min: (p) => p.cleanDb >= 40 && p.pressDb >= 40, quads: ['Unflappable', 'Thrives in chaos', 'Needs a clean pocket', 'Struggling'] },
  { id: 'cov', pos: ['QB'], label: 'vs Zone vs vs Man', question: 'Who solves man coverage, and who only beats zone?', x: 'zoneEpa', y: 'manEpa', xLabel: 'EPA per dropback vs zone', yLabel: 'EPA per dropback vs man', fx: signed, fy: signed, diagonal: true, participation: true, min: (p) => p.manDb >= 40 && p.zoneDb >= 40, quads: ['Beats everything', 'Man beater', 'Zone beater', 'Struggling'] },
  { id: 'xfp', pos: ['RB'], label: 'Expected vs actual', question: 'Who scored more, or less, than his opportunities were worth?', x: 'xppg', y: 'ppg', xLabel: 'Expected fantasy points per game (xFP/G)', yLabel: 'Actual fantasy points per game', fx: f1, fy: f1, diagonal: true, min: (p) => p.car >= 20, quads: ['Producing', 'Overachiever', 'Underachiever', 'Low volume'] },
  { id: 'rz', pos: ['RB'], label: 'Red zone expected vs actual', question: 'Who cashes in his red-zone chances?', x: 'rzX', y: 'rzA', xLabel: 'Red-zone expected fantasy points per game', yLabel: 'Red-zone actual fantasy points per game', fx: f1, fy: f1, diagonal: true, min: (p) => (p.rzX ?? 0) >= 1.5, quads: ['Goal-line hammer', 'Finds the end zone', 'Wasting chances', 'Limited role'] },
  { id: 'boom', pos: ['RB'], label: 'Success % vs explosive %', question: 'Who keeps the offence on schedule, and who breaks the big one?', x: 'succ', y: 'expl', xLabel: 'Rushing success rate (yards-to-go rule)', yLabel: 'Explosive runs (10+ yards)', fx: pct, fy: pct, min: (p) => p.car >= 20, quads: ['Elite', 'Boom or bust', 'Chain mover', 'Struggling'] },
  { id: 'ryoe', pos: ['RB'], label: 'Success % vs RYOE', question: 'Is his success the blocking, or him?', x: 'succ', y: 'ryoe', xLabel: 'Rushing success rate', yLabel: 'Rushing yards over expected per carry', fx: pct, fy: signed, min: (p) => p.car >= 20, quads: ['Creates and converts', 'Creates, inconsistent', 'System back', 'Struggling'] },
  { id: 'opp', pos: ['RB'], label: 'Snap share vs workload', question: 'Who is on the field, and who is actually fed the ball?', x: 'snapPct', y: 'wopg', xLabel: 'Snap share', yLabel: 'Weighted opportunities per game (carries + 1.5 × targets)', fx: pct, fy: f1, min: (p) => p.car >= 20, quads: ['Workhorse', 'Fed in a small role', 'On the field, not fed', 'Committee'] },
  { id: 'ypc', pos: ['RB'], label: 'Yards per carry vs per target', question: 'Who is efficient as a runner, a receiver, or both?', x: 'ypc', y: 'ypt', xLabel: 'Yards per carry', yLabel: 'Yards per target', fx: f1, fy: f1, min: (p) => p.car >= 30 && p.tgt >= 8, quads: ['Dual threat', 'Receiving back', 'Runner', 'Struggling'] },
  { id: 'xfp', pos: REC, label: 'Expected vs actual', question: 'Who scored more, or less, than his opportunities were worth?', x: 'xppg', y: 'ppg', xLabel: 'Expected fantasy points per game', yLabel: 'Actual fantasy points per game', fx: f1, fy: f1, diagonal: true, min: (p) => p.tgt >= te(p, 15, 12), quads: ['Producing', 'Overachiever', 'Underachiever', 'Low volume'] },
  { id: 'role', pos: REC, label: 'Role map', question: 'What kind of receiver is each one?', x: 'adot', y: 'tgtShare', xLabel: 'Average depth of target (yards)', yLabel: 'Share of team targets', fx: f1, fy: pct, min: (p) => p.tgt >= te(p, 15, 12), quads: ['Alpha deep threat', 'Volume underneath', 'Field stretcher', 'Gadget / checkdown'] },
  { id: 'yprr', pos: REC, label: 'YPRR vs target rate', question: 'Who earns targets, and who does the most with each route?', x: 'tprr', y: 'yprr', xLabel: 'Targets per route run', yLabel: 'Yards per route run', fx: pct, fy: f2, min: (p) => p.routes >= te(p, 60, 40), quads: ['Alpha', 'Efficient, under-fed', 'Volume, not efficient', 'Struggling'] },
  { id: 'sep', pos: REC, label: 'Separation vs catch rate', question: 'Who gets open, and who catches it anyway?', x: 'sep', y: 'catchPct', xLabel: 'Average separation at the catch point (yards)', yLabel: 'Catch rate', fx: f1, fy: pct, min: (p) => p.tgt >= te(p, 15, 12), quads: ['Open and reliable', 'Contested-catch winner', 'Open, leaves plays out there', 'Struggling'] },
  { id: 'fd', pos: REC, label: 'First downs/route vs aDOT', question: 'Who moves the chains, at what depth?', x: 'adot', y: 'fdrr', xLabel: 'Average depth of target', yLabel: 'First downs per route run', fx: f1, fy: pct, min: (p) => p.routes >= te(p, 60, 40), quads: ['Downfield chain mover', 'Underneath chain mover', 'Field stretcher', 'Struggling'] },
  { id: 'cov', pos: REC, label: 'vs Zone vs vs Man', question: 'Who beats man coverage, and who feasts on zone?', x: 'zoneYpt', y: 'manYpt', xLabel: 'Yards per target vs zone', yLabel: 'Yards per target vs man', fx: f1, fy: f1, diagonal: true, participation: true, min: (p) => p.manTgt >= 20 && p.zoneTgt >= 30, quads: ['Beats everything', 'Man beater', 'Zone beater', 'Struggling'] },
];

export const viewsFor = (pos: Pos): View[] => VIEWS.filter((v) => v.pos.includes(pos));
export const volume = (p: PlayerStat): number => (p.pos === 'QB' ? p.dropbacks : p.pos === 'RB' ? p.car + p.tgt : p.tgt);

/** The view's players: right position, over the minimum, both values present, the 40 with the most volume. */
export function viewPool(view: View, stats: PlayerStat[], pos: Pos): PlayerStat[] {
  const ok = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return stats.filter((p) => p.pos === pos && view.min(p) && ok(p[view.x]) && ok(p[view.y])).sort((a, b) => volume(b) - volume(a)).slice(0, 40);
}
