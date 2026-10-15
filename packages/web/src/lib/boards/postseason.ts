import type { UserId } from '@fantasy-dash/core';
import { fmtPts } from '../format';
import type { PlayerLine } from '../playerLines';
import type { Direction, BoardContext, BoardRow } from './shared';
import { MIN_POST_GAMES, careerBoard, intLabel, plural, pointsBoard, round2, started, sum, yearsOf } from './shared';

export const postseasonStarted = (ctx: BoardContext) => started(ctx).filter((l) => l.postseason);

export const postPoints = (ctx: BoardContext, _direction?: Direction, mode?: string): BoardRow[] => pointsBoard(postseasonStarted(ctx), mode, MIN_POST_GAMES, yearsOf);
export const postStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => ls.length, intLabel, (ls) => `${fmtPts(sum(ls, (l) => l.points))} pts`, yearsOf);
export const postTouchdowns = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.touchdowns), intLabel, (ls) => plural(ls.length, 'start'), yearsOf);
export const postYards = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.yards), intLabel, (ls) => plural(ls.length, 'start'), yearsOf);
export const postReceptions = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.receptions), intLabel, (ls) => plural(ls.length, 'start'), yearsOf);

/** Seasons a player spent on `owner[year]`'s roster in the `tag` game, starters and bench, one per year. Ties fall to the player's points in that owner's `bracket` games those seasons. */
function rosterSeasons(ctx: BoardContext, tag: PlayerLine['tag'], bracket: (l: PlayerLine) => boolean, owner: Record<number, UserId | null>): BoardRow[] {
  const onOwner = (l: PlayerLine) => owner[l.year] != null && owner[l.year] === l.userId;
  const pointsBy = new Map<string, number>();
  for (const l of ctx.lines) if (bracket(l) && onOwner(l)) pointsBy.set(l.playerId, round2((pointsBy.get(l.playerId) ?? 0) + l.points));
  const on = ctx.lines.filter((l) => l.tag === tag && onOwner(l));
  const seen = new Set<string>();
  const unique = on.filter((l) => { const k = `${l.playerId}|${l.year}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const pts = (ls: PlayerLine[]) => pointsBy.get(ls[0].playerId) ?? 0;
  return careerBoard(unique, (ls) => ls.length, String, (ls) => `${fmtPts(pts(ls))} pts`, yearsOf, pts);
}

export const championshipRosters = (ctx: BoardContext): BoardRow[] => rosterSeasons(ctx, 'Final', (l) => l.postseason, ctx.champions);
export const lastPlaceRosters = (ctx: BoardContext): BoardRow[] => rosterSeasons(ctx, 'Toilet Bowl', (l) => l.consolation, ctx.lastPlaces);

export const postToiletBowl = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx).filter((l) => l.consolation), (ls) => ls.length, intLabel, (ls) => `${fmtPts(sum(ls, (l) => l.points))} pts`, yearsOf);
