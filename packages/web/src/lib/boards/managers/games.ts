import { fmtPts } from '../../format';
import type { TeamGame } from '../../managerGames';
import type { BoardContext, BoardRow } from '../shared';
import { round2 } from '../shared';
import { gameRows, managerName, matchups, score } from './shared';

const decided = (games: TeamGame[]) => matchups(games).filter((g) => g.result !== 'T');
const over = (ctx: BoardContext) => (g: TeamGame) => `over ${managerName(ctx, g.opponentId)}, ${score(g)}`;
const withOpp = (ctx: BoardContext) => (g: TeamGame) => `with ${managerName(ctx, g.opponentId)}, ${score(g)}`;
const possible = (g: TeamGame) => `${fmtPts(g.points)} of ${fmtPts(g.ceiling)} possible`;

export const mgHigh = (ctx: BoardContext): BoardRow[] => gameRows(ctx, ctx.teamGames, (g) => g.points, fmtPts);
export const mgLow = (ctx: BoardContext): BoardRow[] => gameRows(ctx, ctx.teamGames, (g) => g.points, fmtPts, 'asc');
export const mgLossHigh = (ctx: BoardContext): BoardRow[] => gameRows(ctx, ctx.teamGames.filter((g) => g.result === 'L'), (g) => g.points, fmtPts);
export const mgWinLow = (ctx: BoardContext): BoardRow[] => gameRows(ctx, ctx.teamGames.filter((g) => g.result === 'W'), (g) => g.points, fmtPts, 'asc');
export const mgBlowout = (ctx: BoardContext): BoardRow[] => gameRows(ctx, decided(ctx.teamGames), (g) => round2(g.points - g.oppPoints), fmtPts, 'desc', over(ctx));
export const mgClosest = (ctx: BoardContext): BoardRow[] => gameRows(ctx, decided(ctx.teamGames), (g) => round2(g.points - g.oppPoints), fmtPts, 'asc', over(ctx));
export const mgCombinedHigh = (ctx: BoardContext): BoardRow[] => gameRows(ctx, matchups(ctx.teamGames), (g) => round2(g.points + g.oppPoints), fmtPts, 'desc', withOpp(ctx));
export const mgCombinedLow = (ctx: BoardContext): BoardRow[] => gameRows(ctx, matchups(ctx.teamGames), (g) => round2(g.points + g.oppPoints), fmtPts, 'asc', withOpp(ctx));
export const mgPerfect = (ctx: BoardContext): BoardRow[] => gameRows(ctx, ctx.teamGames.filter((g) => g.ceiling > 0 && Math.abs(g.ceiling - g.points) < 0.005), (g) => g.points, fmtPts);
export const mgBench = (ctx: BoardContext): BoardRow[] => gameRows(ctx, ctx.teamGames, (g) => g.benchPoints || null, fmtPts, 'desc', possible);
