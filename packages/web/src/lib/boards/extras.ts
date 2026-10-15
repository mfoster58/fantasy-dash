import { fmtSigned } from '../format';
import type { BoardContext, BoardRow, Direction, DraftValue } from './shared';
import { careerBoard, intLabel, matchesPos, metaOf, plural, rank, round1, skillOnly, started, toneOf } from './shared';

export const boomStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.filter((l) => l.points >= 30).length, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));
export const dudStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => ls.filter((l) => l.played && l.points < 5).length, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));
export const journeyman = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => new Set(ls.map((l) => l.userId)).size, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));

export const draftValue = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => {
  const byPlayer = new Map<string, DraftValue[]>();
  for (const p of ctx.picks) {
    if (!matchesPos(ctx.players[p.playerId]?.position ?? '?', ctx.pos)) continue;
    byPlayer.set(p.playerId, [...(byPlayer.get(p.playerId) ?? []), p]);
  }
  const items = [...byPlayer.entries()].map(([playerId, picks]) => ({
    playerId, value: round1(picks.reduce((s, p) => s + p.value, 0) / picks.length), seasons: picks.length,
    latestYear: Math.max(...picks.map((p) => p.year)), latestWeek: 0,
  }));
  return rank(items, direction).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: fmtSigned(i.value, 1),
    meta: plural(i.seasons, 'season'), detail: null, userId: null, to: null, tone: toneOf(i.value),
  }));
};
