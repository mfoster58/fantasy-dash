import { fmtPts } from '../../format';
import type { TeamGame } from '../../managerGames';
import type { BoardContext, BoardRow } from '../shared';
import { round2 } from '../shared';
import { careerRows, gameRows, managerName, matchups, recordOf, score, seasonRows, yearsList, type CareerAgg } from './shared';

const post = (ctx: BoardContext) => ctx.teamGames.filter((g) => g.postseason);
const decided = (games: TeamGame[]) => matchups(games).filter((g) => g.result !== 'T');
const over = (ctx: BoardContext) => (g: TeamGame) => `over ${managerName(ctx, g.opponentId)}, ${score(g)}`;
const toilet = (a: CareerAgg) => a.games.filter((g) => g.tag === 'Toilet Bowl');
const toiletWon = (a: CareerAgg) => `${toilet(a).filter((g) => g.result === 'W').length} won`;
/** seasons with a game on the path to the Toilet Bowl: round 1 or the bowl itself; the seventh-place game is a placement game */
const consolationYears = (a: CareerAgg) => [...new Set(a.games.filter((g) => g.consolation).map((g) => g.year))];

export const mpHigh = (ctx: BoardContext): BoardRow[] => gameRows(ctx, post(ctx), (g) => g.points, fmtPts);
export const mpLow = (ctx: BoardContext): BoardRow[] => gameRows(ctx, post(ctx), (g) => g.points, fmtPts, 'asc');
export const mpBlowout = (ctx: BoardContext): BoardRow[] => gameRows(ctx, decided(post(ctx)), (g) => round2(g.points - g.oppPoints), fmtPts, 'desc', over(ctx));
export const mpClosest = (ctx: BoardContext): BoardRow[] => gameRows(ctx, decided(post(ctx)), (g) => round2(g.points - g.oppPoints), fmtPts, 'asc', over(ctx));
export const mpLowSeed = (ctx: BoardContext): BoardRow[] =>
  seasonRows(ctx, (ms) => ms.seed, (v) => `#${v}`, (ms) => `${recordOf(ms)} · ${fmtPts(ms.row.pf)} pts`, 'desc', ctx.managerSeasons.filter((ms) => ms.complete && ms.champion));
export const mpFinalsLost = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => a.seasons.filter((s) => s.runnerUp).length || null, String, (a) => `${a.seasons.filter((s) => s.champion).length} won`);
export const mpConsolationApps = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => consolationYears(a).length || null, String, (a) => yearsList(consolationYears(a)));
export const mpToiletApps = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => toilet(a).length || null, String, toiletWon);
export const mpToiletWins = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => toilet(a).filter((g) => g.result === 'W').length || null, String, (a) => `of ${toilet(a).length}`);
