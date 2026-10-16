import type { ManagerSeason, TeamGame } from '../../managerGames';
import type { BoardContext, BoardRow } from '../shared';
import { rank } from '../shared';
import { byManager, type CareerAgg } from './shared';

export interface Run { length: number; from: { year: number; week: number }; to: { year: number; week: number }; active: boolean }
const gameSpan = (r: Run) => `${r.from.year} Wk ${r.from.week} – ${r.to.year} Wk ${r.to.week}`;
const seasonSpan = (r: Run) => (r.from.year === r.to.year ? String(r.from.year) : `${r.from.year}–${r.to.year}`);

/** Longest run of consecutive games (chronological) passing `pred`; a failing game ends it. The later of two equal runs wins. Active when the run reaches the last game. */
export function longestGameRun(games: TeamGame[], pred: (g: TeamGame) => boolean): Run | null {
  const sorted = [...games].sort((a, b) => a.year - b.year || a.week - b.week);
  let best: Run | null = null;
  let run: TeamGame[] = [];
  const flush = (endsAtLatest: boolean) => {
    if (run.length && (!best || run.length >= best.length)) best = { length: run.length, from: { year: run[0].year, week: run[0].week }, to: { year: run[run.length - 1].year, week: run[run.length - 1].week }, active: endsAtLatest };
    run = [];
  };
  sorted.forEach((g, i) => { if (pred(g)) run.push(g); else flush(false); if (i === sorted.length - 1) flush(true); });
  return best;
}

/** Same over a manager's complete seasons in year order. */
function longestSeasonRun(seasons: ManagerSeason[], pred: (s: ManagerSeason) => boolean, latestYear: number): Run | null {
  const sorted = seasons.filter((s) => s.complete).sort((a, b) => a.year - b.year);
  let best: Run | null = null;
  let run: ManagerSeason[] = [];
  const flush = () => {
    if (run.length && (!best || run.length >= best.length)) best = { length: run.length, from: { year: run[0].year, week: 0 }, to: { year: run[run.length - 1].year, week: 0 }, active: run[run.length - 1].year === latestYear };
    run = [];
  };
  for (const s of sorted) { if (pred(s)) run.push(s); else flush(); }
  flush();
  return best;
}

const latestComplete = (ctx: BoardContext) => Math.max(0, ...ctx.managerSeasons.filter((s) => s.complete).map((s) => s.year));

function runRows(ctx: BoardContext, runOf: (a: CareerAgg) => Run | null, span: (r: Run) => string, activeLabel = 'active'): BoardRow[] {
  const mayBeActive = ctx.year === null || ctx.year === ctx.currentYear;
  const items = byManager(ctx).flatMap((a) => { const r = runOf(a); return r ? [{ userId: a.userId, r, value: r.length, latestYear: r.to.year, latestWeek: r.to.week }] : []; });
  return rank(items).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: String(i.value), meta: span(i.r), detail: mayBeActive && i.r.active ? activeLabel : null, userId: i.userId, to: null }));
}

export const mWinStreak = (ctx: BoardContext): BoardRow[] => runRows(ctx, (a) => longestGameRun(a.games, (g) => g.result === 'W'), gameSpan);
export const mLoseStreak = (ctx: BoardContext): BoardRow[] => runRows(ctx, (a) => longestGameRun(a.games, (g) => g.result === 'L'), gameSpan);
export const mRun100 = (ctx: BoardContext): BoardRow[] => runRows(ctx, (a) => longestGameRun(a.games, (g) => g.points >= 100), gameSpan);
export const mHighRun = (ctx: BoardContext): BoardRow[] => runRows(ctx, (a) => longestGameRun(a.games, (g) => g.weekHigh), gameSpan);
export const mPlayoffStreak = (ctx: BoardContext): BoardRow[] => runRows(ctx, (a) => longestSeasonRun(a.seasons, (s) => s.playoffBerth, latestComplete(ctx)), seasonSpan);

/** Complete seasons since the manager's last title (or since their first season). */
export const mDrought = (ctx: BoardContext): BoardRow[] => runRows(ctx, (a) => {
  const sorted = a.seasons.filter((s) => s.complete).sort((x, y) => x.year - y.year);
  const lastTitle = sorted.map((s) => s.champion).lastIndexOf(true);
  const since = sorted.slice(lastTitle + 1);
  return since.length ? { length: since.length, from: { year: since[0].year, week: 0 }, to: { year: since[since.length - 1].year, week: 0 }, active: since[since.length - 1].year === latestComplete(ctx) } : null;
}, seasonSpan, 'and counting');
