import { fmtPts } from '../format';
import type { Direction, BoardContext, BoardRow } from './shared';
import { careerBoard, groupBy, metaOf, minGames, momentBoard, plural, pointsBoard, rank, started, sum } from './shared';

export const bestWeek = (ctx: BoardContext): BoardRow[] => momentBoard(started(ctx), (l) => l.points, fmtPts);

export const bestSeason = (ctx: BoardContext): BoardRow[] => {
  const groups = groupBy(started(ctx), (l) => `${l.playerId}|${l.userId}|${l.year}`);
  const items = [...groups.entries()].map(([k, g]) => {
    const [playerId, userId, year] = k.split('|');
    return { playerId, userId, year: Number(year), value: sum(g.lines, (l) => l.points), starts: g.lines.length, latestYear: g.latestYear, latestWeek: g.latestWeek };
  });
  return rank(items).map((i) => ({
    key: `${i.playerId}-${i.userId}-${i.year}`, playerId: i.playerId, value: i.value, valueLabel: fmtPts(i.value),
    meta: String(i.year), detail: plural(i.starts, 'start'), userId: i.userId, to: `/scores/${i.year}`,
  }));
};

export const careerPoints = (ctx: BoardContext, _direction?: Direction, mode?: string): BoardRow[] => pointsBoard(started(ctx), mode, minGames(ctx), metaOf(ctx));

export const weeksStarted = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.length, String, (ls) => plural(ls.length, 'start'), metaOf(ctx));

export const benchBlunder = (ctx: BoardContext): BoardRow[] => momentBoard(ctx.lines.filter((l) => !l.started), (l) => l.points, fmtPts);
