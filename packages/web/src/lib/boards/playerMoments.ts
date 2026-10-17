import type { UserId } from '@fantasy-dash/core';
import { fmtPts } from '../format';
import type { PlayerLine } from '../playerLines';
import type { BoardContext, BoardRow } from './shared';
import { careerBoard, groupBy, metaOf, momentBoard, skillOnly, started, when } from './shared';

export const bestStartInLoss = (ctx: BoardContext): BoardRow[] => momentBoard(started(ctx).filter((l) => l.result === 'L'), (l) => l.points, fmtPts);

export const worstStartInWin = (ctx: BoardContext): BoardRow[] =>
  momentBoard(skillOnly(started(ctx)).filter((l) => l.played && l.result === 'W'), (l) => l.points, fmtPts, 'asc');

/**
 * Started scores against a manager who had the player on a roster in an earlier week, any season. Ownership is read from
 * `allLines` (every line in the data) so a season filter still knows last year's managers; the opponent is the other side of the game.
 */
export const revengeGames = (ctx: BoardContext): BoardRow[] => {
  const history = ctx.allLines ?? ctx.lines;
  const order = (l: { year: number; week: number }) => l.year * 100 + l.week;
  const byGame = groupBy(history, (l) => l.gameId);
  const opponentOf = (l: PlayerLine): UserId | undefined => byGame.get(l.gameId)?.lines.find((o) => o.userId !== l.userId)?.userId;
  const owned = groupBy(history, (l) => l.playerId);
  const formerYears = (l: PlayerLine, opp: UserId) => [...new Set((owned.get(l.playerId)?.lines ?? []).filter((o) => o.userId === opp && order(o) < order(l)).map((o) => o.year))].sort((a, b) => a - b);
  const name = (id: UserId) => ctx.managers[id]?.displayName ?? id;
  const revenge = started(ctx).flatMap((l) => {
    const opp = opponentOf(l);
    if (opp === undefined) return [];
    const years = formerYears(l, opp);
    return years.length ? [{ l, opp, years }] : [];
  });
  return momentBoard(revenge.map((r) => r.l), (l) => l.points, fmtPts).map((row) => {
    const r = revenge.find((x) => `${x.l.gameId}-${x.l.playerId}` === row.key)!;
    return { ...row, detail: `vs ${name(r.opp)} · his manager in ${r.years.join(', ')}` };
  });
};

/** Weeks in which the player was the top started scorer among the lines in scope (the league, or the chosen position); ties share. */
export const topScorerWeeks = (ctx: BoardContext): BoardRow[] => {
  const winners = [...groupBy(started(ctx), (l) => `${l.year}-${l.week}`).values()].flatMap((g) => {
    const top = Math.max(...g.lines.map((l) => l.points));
    return g.lines.filter((l) => l.points === top);
  });
  const best = (ls: PlayerLine[]) => ls.reduce((a, b) => (b.points > a.points ? b : a));
  return careerBoard(winners, (ls) => ls.length, String, (ls) => `best ${fmtPts(best(ls).points)} · ${when(best(ls))}`, metaOf(ctx));
};
