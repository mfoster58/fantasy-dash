import type { UserId } from '@fantasy-dash/core';
import { fmtPts, fmtSigned } from '../format';
import type { PlayerLine } from '../playerLines';
import { longestStartRun } from '../ironman';
import type { BoardContext, BoardRow, Direction, DraftValue } from './shared';
import { careerBoard, groupBy, intLabel, matchesPos, metaOf, momentBoard, plural, rank, round1, skillOnly, started, sum, toneOf } from './shared';

export const benchBlunder = (ctx: BoardContext): BoardRow[] => momentBoard(ctx.lines.filter((l) => !l.started), (l) => l.points, fmtPts);

export const benchWarmers = (ctx: BoardContext): BoardRow[] =>
  careerBoard(ctx.lines.filter((l) => !l.started), (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => `${plural(ls.length, 'week')} benched`, metaOf(ctx));

/** Most starts for a single manager; a tie between managers goes to the one with the newer start. */
export const loyalty = (ctx: BoardContext): BoardRow[] => {
  const meta = metaOf(ctx);
  const items: { playerId: string; value: number; userId: UserId; total: number; lines: PlayerLine[]; latestYear: number; latestWeek: number }[] = [];
  for (const [playerId, g] of groupBy(skillOnly(started(ctx)), (l) => l.playerId)) {
    let best: { userId: UserId; starts: number; latest: number } | null = null;
    for (const [userId, m] of groupBy(g.lines, (l) => l.userId)) {
      const latest = m.latestYear * 100 + m.latestWeek;
      if (!best || m.lines.length > best.starts || (m.lines.length === best.starts && latest > best.latest)) best = { userId, starts: m.lines.length, latest };
    }
    if (best) items.push({ playerId, value: best.starts, userId: best.userId, total: g.lines.length, lines: g.lines, latestYear: g.latestYear, latestWeek: g.latestWeek });
  }
  return rank(items).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: meta(i.lines), detail: `of ${plural(i.total, 'start')}`, userId: i.userId, to: null }));
};

export const ironman = (ctx: BoardContext): BoardRow[] => {
  const runs = longestStartRun(skillOnly(ctx.lines));
  const items = [...runs.entries()].map(([playerId, r]) => ({ playerId, value: r.length, run: r, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value),
    meta: `${i.run.from.year} Wk ${i.run.from.week} – ${i.run.to.year} Wk ${i.run.to.week}`, detail: i.run.active ? 'active' : null, userId: null, to: null,
  }));
};

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
