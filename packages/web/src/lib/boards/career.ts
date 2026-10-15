import { fmtPpg, fmtPts } from '../format';
import type { Direction, BoardContext, BoardRow } from './shared';
import { MIN_SEASON_GAMES, careerBoard, groupBy, metaOf, minGames, momentBoard, plural, pointsBoard, rank, round2, started, sum } from './shared';

export const bestWeek = (ctx: BoardContext): BoardRow[] => momentBoard(started(ctx), (l) => l.points, fmtPts);

/** One row per player, manager and season. PPG averages over played starts with the season minimum, since each row is one season. */
export const bestSeason = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] => {
  const groups = groupBy(started(ctx), (l) => `${l.playerId}|${l.userId}|${l.year}`);
  const ppg = mode === 'ppg';
  const items: { playerId: string; userId: string; year: number; value: number; starts: number; games: number; latestYear: number; latestWeek: number }[] = [];
  for (const [k, g] of groups) {
    const [playerId, userId, year] = k.split('|');
    const played = g.lines.filter((l) => l.played);
    if (ppg && played.length < MIN_SEASON_GAMES) continue;
    const value = ppg ? round2(sum(played, (l) => l.points) / played.length) : sum(g.lines, (l) => l.points);
    items.push({ playerId, userId, year: Number(year), value, starts: g.lines.length, games: played.length, latestYear: g.latestYear, latestWeek: g.latestWeek });
  }
  return rank(items).map((i) => ({
    key: `${i.playerId}-${i.userId}-${i.year}`, playerId: i.playerId, value: i.value, valueLabel: ppg ? fmtPpg(i.value) : fmtPts(i.value),
    meta: String(i.year), detail: ppg ? plural(i.games, 'game') : plural(i.starts, 'start'), userId: i.userId, to: `/scores/${i.year}`,
  }));
};

export const careerPoints = (ctx: BoardContext, _direction?: Direction, mode?: string): BoardRow[] => pointsBoard(started(ctx), mode, minGames(ctx), metaOf(ctx));

export const weeksStarted = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.length, String, (ls) => plural(ls.length, 'start'), metaOf(ctx));

export const benchBlunder = (ctx: BoardContext): BoardRow[] => momentBoard(ctx.lines.filter((l) => !l.started), (l) => l.points, fmtPts);
