import { fmtPts } from '../format';
import type { PlayerLine } from '../playerLines';
import type { BoardContext, BoardRow } from './shared';
import { careerBoard, groupBy, metaOf, momentBoard, skillOnly, started, when } from './shared';

export const bestStartInLoss = (ctx: BoardContext): BoardRow[] => momentBoard(started(ctx).filter((l) => l.result === 'L'), (l) => l.points, fmtPts);

export const worstStartInWin = (ctx: BoardContext): BoardRow[] =>
  momentBoard(skillOnly(started(ctx)).filter((l) => l.played && l.result === 'W'), (l) => l.points, fmtPts, 'asc');

/** Weeks in which the player was the top started scorer among the lines in scope (the league, or the chosen position); ties share. */
export const topScorerWeeks = (ctx: BoardContext): BoardRow[] => {
  const winners = [...groupBy(started(ctx), (l) => `${l.year}-${l.week}`).values()].flatMap((g) => {
    const top = Math.max(...g.lines.map((l) => l.points));
    return g.lines.filter((l) => l.points === top);
  });
  const best = (ls: PlayerLine[]) => ls.reduce((a, b) => (b.points > a.points ? b : a));
  return careerBoard(winners, (ls) => ls.length, String, (ls) => `best ${fmtPts(best(ls).points)} · ${when(best(ls))}`, metaOf(ctx));
};
