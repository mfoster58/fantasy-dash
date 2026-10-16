import { fmtPct, fmtPpg, fmtPts, fmtSigned, fmtWinPct } from '../../format';
import type { ManagerSeason } from '../../managerGames';
import type { BoardContext, BoardRow } from '../shared';
import { round1, round2, toneOf } from '../shared';
import { recordOf, seasonGames, seasonRows, seasonScope } from './shared';

const MIN_GAMES = 3;
const rated = <T>(f: (ms: ManagerSeason) => T) => (ms: ManagerSeason): T | null => (ms.games >= MIN_GAMES ? f(ms) : null);
const winPct = (ms: ManagerSeason) => Math.round(((ms.row.w + ms.row.t / 2) / ms.games) * 1000) / 1000;
const ptsDetail = (ms: ManagerSeason) => `${recordOf(ms)} · ${fmtPts(ms.row.pf)} pts`;
const allPlayDetail = (ms: ManagerSeason) => `${ms.row.allPlay.w}-${ms.row.allPlay.l}${ms.row.allPlay.t ? `-${ms.row.allPlay.t}` : ''} all-play`;
const luck = (ms: ManagerSeason) => round1(ms.row.w + ms.row.t / 2 - ms.row.allPlay.pct * ms.games);
const withTone = (rows: BoardRow[]): BoardRow[] => rows.map((r) => ({ ...r, tone: toneOf(r.value) }));
const efficiency = (ctx: BoardContext) => (ms: ManagerSeason) => {
  const played = seasonGames(ctx, ms).filter((g) => g.ceiling > 0);
  const ceiling = played.reduce((t, g) => t + g.ceiling, 0);
  return ceiling > 0 ? Math.round((played.reduce((t, g) => t + g.points, 0) / ceiling) * 10000) / 10000 : null;
};
const efficiencyDetail = (ctx: BoardContext) => (ms: ManagerSeason) => {
  const gs = seasonGames(ctx, ms);
  return `${fmtPts(round2(gs.reduce((t, g) => t + g.points, 0)))} of ${fmtPts(round2(gs.reduce((t, g) => t + g.ceiling, 0)))} possible`;
};

export const msPoints = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, (ms) => ms.row.pf, fmtPts, recordOf);
export const msFewest = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, (ms) => ms.row.pf, fmtPts, recordOf, 'asc');
export const msPpg = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, rated((ms) => round2(ms.row.pf / ms.games)), fmtPpg, ptsDetail);
export const msAgainst = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, (ms) => ms.row.pa, fmtPts, recordOf);
export const msRecord = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, rated(winPct), fmtWinPct, ptsDetail, 'desc', seasonScope(ctx), (ms) => ms.row.pf);
export const msWorstRecord = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, rated(winPct), fmtWinPct, ptsDetail, 'asc', seasonScope(ctx), (ms) => -ms.row.pf);
export const msDiff = (ctx: BoardContext): BoardRow[] => withTone(seasonRows(ctx, (ms) => round2(ms.row.pf - ms.row.pa), (v) => fmtSigned(v, 1), ptsDetail));
export const msAllPlay = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, rated((ms) => ms.row.allPlay.pct), fmtWinPct, allPlayDetail);
export const msWorstAllPlay = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, rated((ms) => ms.row.allPlay.pct), fmtWinPct, allPlayDetail, 'asc');
export const msLucky = (ctx: BoardContext): BoardRow[] => withTone(seasonRows(ctx, rated(luck), (v) => fmtSigned(v, 1), (ms) => `${recordOf(ms)} · ${allPlayDetail(ms)}`));
export const msUnlucky = (ctx: BoardContext): BoardRow[] => withTone(seasonRows(ctx, rated(luck), (v) => fmtSigned(v, 1), (ms) => `${recordOf(ms)} · ${allPlayDetail(ms)}`, 'asc'));
export const msNoTitle = (ctx: BoardContext): BoardRow[] =>
  seasonRows(ctx, rated((ms) => ms.row.allPlay.pct), fmtWinPct, (ms) => `${recordOf(ms)} · ${allPlayDetail(ms)}`, 'desc', seasonScope(ctx).filter((ms) => ms.complete && !ms.champion));
export const msEfficiency = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, efficiency(ctx), fmtPct, efficiencyDetail(ctx));
export const msWorstEfficiency = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, efficiency(ctx), fmtPct, efficiencyDetail(ctx), 'asc');
export const msBench = (ctx: BoardContext): BoardRow[] => seasonRows(ctx, (ms) => ms.benchPoints || null, fmtPts, efficiencyDetail(ctx));
