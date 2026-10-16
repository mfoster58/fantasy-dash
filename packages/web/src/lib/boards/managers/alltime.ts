import { fmtPct, fmtPpg, fmtPts, fmtRecord, fmtWinPct } from '../../format';
import type { TeamGame } from '../../managerGames';
import type { BoardContext, BoardRow } from '../shared';
import { plural, round2 } from '../shared';
import { careerRows, hasComplete, yearsList, type CareerAgg } from './shared';

const tot = (a: CareerAgg, f: (s: CareerAgg['seasons'][number]) => number) => a.seasons.reduce((t, s) => t + f(s), 0);
const games = (a: CareerAgg) => tot(a, (s) => s.games);
const record = (a: CareerAgg) => fmtRecord({ w: tot(a, (s) => s.row.w), l: tot(a, (s) => s.row.l), t: tot(a, (s) => s.row.t) });
const winPct = (a: CareerAgg) => (hasComplete(a) && games(a) > 0 ? Math.round(((tot(a, (s) => s.row.w) + tot(a, (s) => s.row.t) / 2) / games(a)) * 1000) / 1000 : null);
const count = (f: (s: CareerAgg['seasons'][number]) => boolean) => (a: CareerAgg) => tot(a, (s) => (f(s) ? 1 : 0)) || null;
/** "2023, 2025": the seasons that counted */
const yearsWhere = (f: (s: CareerAgg['seasons'][number]) => boolean) => (a: CareerAgg) => yearsList(a.seasons.filter(f).map((s) => s.year));
const gamesDetail = (a: CareerAgg) => plural(games(a), 'game');

export const mCareerWins = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => tot(a, (s) => s.row.w) || null, String, record);
export const mWinPct = (ctx: BoardContext): BoardRow[] => careerRows(ctx, winPct, fmtWinPct, record);
export const mWorstWinPct = (ctx: BoardContext): BoardRow[] => careerRows(ctx, winPct, fmtWinPct, record, 'asc');
export const mCareerPoints = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => round2(tot(a, (s) => s.row.pf)) || null, fmtPts, gamesDetail);
export const mCareerPpg = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => (hasComplete(a) && games(a) > 0 ? round2(tot(a, (s) => s.row.pf) / games(a)) : null), fmtPpg, (a) => `${fmtPts(round2(tot(a, (s) => s.row.pf)))} pts`);
export const mPointsAgainst = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => round2(tot(a, (s) => s.row.pa)) || null, fmtPts, gamesDetail);
export const mTitles = (ctx: BoardContext): BoardRow[] => careerRows(ctx, count((s) => s.champion), String, yearsWhere((s) => s.champion));
export const mFinals = (ctx: BoardContext): BoardRow[] => careerRows(ctx, count((s) => s.champion || s.runnerUp), String, (a) => `${tot(a, (s) => (s.champion ? 1 : 0))} won`);
export const mBerths = (ctx: BoardContext): BoardRow[] => careerRows(ctx, count((s) => s.playoffBerth), String, yearsWhere((s) => s.playoffBerth));
export const mPlayoffWins = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => a.games.filter((g) => g.postseason && g.result === 'W').length || null, String, (a) => plural(a.games.filter((g) => g.postseason).length, 'playoff game'));
export const mBerthsNoTitle = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => (tot(a, (s) => (s.champion ? 1 : 0)) === 0 ? count((s) => s.playoffBerth)(a) : null), String, yearsWhere((s) => s.playoffBerth));
export const mLastPlaces = (ctx: BoardContext): BoardRow[] => careerRows(ctx, count((s) => s.lastPlace), String, yearsWhere((s) => s.lastPlace));
const efficiency = (a: CareerAgg) => {
  const played = a.games.filter((g) => g.ceiling > 0);
  const ceiling = played.reduce((t, g) => t + g.ceiling, 0);
  return hasComplete(a) && ceiling > 0 ? Math.round((played.reduce((t, g) => t + g.points, 0) / ceiling) * 10000) / 10000 : null;
};
const efficiencyDetail = (a: CareerAgg) => plural(a.games.filter((g) => g.ceiling > 0).length, 'game');
export const mEfficiency = (ctx: BoardContext): BoardRow[] => careerRows(ctx, efficiency, fmtPct, efficiencyDetail);
export const mWorstEfficiency = (ctx: BoardContext): BoardRow[] => careerRows(ctx, efficiency, fmtPct, efficiencyDetail, 'asc');
export const mWeeklyHighs = (ctx: BoardContext): BoardRow[] => careerRows(ctx, (a) => tot(a, (s) => s.row.weeklyHighs) || null, String, gamesDetail);

const weekKey = (g: TeamGame) => `${g.year}-${g.week}`;
/** the league's median score each week, every game counted */
export function weekMedians(games: TeamGame[]): Map<string, number> {
  const byWeek = new Map<string, number[]>();
  for (const g of games) byWeek.set(weekKey(g), [...(byWeek.get(weekKey(g)) ?? []), g.points]);
  const out = new Map<string, number>();
  for (const [k, pts] of byWeek) {
    const s = [...pts].sort((x, y) => x - y);
    const m = s.length / 2;
    out.set(k, s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2);
  }
  return out;
}
const results = (a: CareerAgg, r: TeamGame['result']) => a.games.filter((g) => g.result === r);
/** wins while scoring under that week's median: the lucky ones */
export const mLuckyWins = (ctx: BoardContext): BoardRow[] => {
  const med = weekMedians(ctx.teamGames);
  return careerRows(ctx, (a) => results(a, 'W').filter((g) => g.points < (med.get(weekKey(g)) ?? 0)).length || null, String, (a) => `of ${plural(results(a, 'W').length, 'win')}`);
};
/** losses while scoring over that week's median: the unlucky ones */
export const mUnluckyLosses = (ctx: BoardContext): BoardRow[] => {
  const med = weekMedians(ctx.teamGames);
  return careerRows(ctx, (a) => results(a, 'L').filter((g) => g.points > (med.get(weekKey(g)) ?? Infinity)).length || null, String, (a) => { const n = results(a, 'L').length; return `of ${n} ${n === 1 ? 'loss' : 'losses'}`; });
};
