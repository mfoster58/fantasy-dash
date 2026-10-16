import type { PlayerId } from '@fantasy-dash/core';
import { byeWeeksOf, longestWeekRun, weekKey, weeksOf, type StartRun } from '../ironman';
import type { PlayerLine } from '../playerLines';
import { longestLineRun } from '../runs';
import type { BoardContext, BoardMode, BoardRow, Direction } from './shared';
import { managersOf, rank, skillOnly, soleManager, started } from './shared';

const span = (r: { from: { year: number; week: number }; to: { year: number; week: number } }) => `${r.from.year} Wk ${r.from.week} – ${r.to.year} Wk ${r.to.week}`;

function lineRunBoard(lines: PlayerLine[], pred: (l: PlayerLine) => boolean): BoardRow[] {
  const items = [...longestLineRun(lines, pred).entries()].map(([playerId, r]) => ({ playerId, r, value: r.length, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => {
    const managers = managersOf(i.r.lines);
    return { key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: span(i.r), detail: null, userId: soleManager(managers) ?? managers[0]?.userId ?? null, to: null, managers };
  });
}

/** started lines that were not a bye: a start on a bye week is invisible to a run, neither extending nor breaking it */
const realStarts = (ctx: BoardContext) => started(ctx).filter((l) => !l.bye);
export const run15 = (ctx: BoardContext): BoardRow[] => lineRunBoard(realStarts(ctx), (l) => l.points >= 15);
export const run20 = (ctx: BoardContext): BoardRow[] => lineRunBoard(realStarts(ctx), (l) => l.points >= 20);
export const drought = (ctx: BoardContext): BoardRow[] => lineRunBoard(skillOnly(started(ctx)).filter((l) => l.played), (l) => l.points < 5);

export const TOP_MODES: readonly BoardMode[] = [
  { id: '1', label: 'Top scorer', valueHeader: 'Weeks' }, { id: '3', label: 'Top 3', valueHeader: 'Weeks' }, { id: '5', label: 'Top 5', valueHeader: 'Weeks' }, { id: '10', label: 'Top 10', valueHeader: 'Weeks' },
];

/**
 * Consecutive league weeks ranked in the top N scorers at the player's position among every rostered player, started or
 * benched (the mode id, 1 by default); ties share a rank. A week outside the top N ends the run. The player's bye weeks are skipped.
 */
export const posTopRun = (ctx: BoardContext, _direction?: Direction, mode?: string): BoardRow[] => {
  const topN = Number(mode ?? TOP_MODES[0].id);
  const lines = ctx.lines.filter((l) => !l.bye);
  const has = new Map<PlayerId, Set<number>>();
  const topLines = new Map<PlayerId, PlayerLine[]>();
  const byWeekPos = new Map<string, PlayerLine[]>();
  for (const l of lines) { const k = `${weekKey(l)}|${l.position}`; const arr = byWeekPos.get(k) ?? []; arr.push(l); byWeekPos.set(k, arr); }
  for (const ls of byWeekPos.values()) {
    const rankOf = (l: PlayerLine) => 1 + ls.filter((o) => o.points > l.points).length;
    for (const l of ls) {
      if (rankOf(l) > topN) continue;
      const set = has.get(l.playerId) ?? new Set<number>(); set.add(weekKey(l)); has.set(l.playerId, set);
      const mine = topLines.get(l.playerId) ?? []; mine.push(l); topLines.set(l.playerId, mine);
    }
  }
  const runs: Map<PlayerId, StartRun> = longestWeekRun(weeksOf(ctx.lines), has, byeWeeksOf(ctx.lines));
  const mayBeActive = ctx.year === null || ctx.year === ctx.currentYear;
  const items = [...runs.entries()].map(([playerId, r]) => ({ playerId, r, value: r.length, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => {
    const inRun = (topLines.get(i.playerId) ?? []).filter((l) => weekKey(l) >= weekKey(i.r.from) && weekKey(l) <= weekKey(i.r.to));
    const managers = managersOf(inRun);
    return { key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: span(i.r), detail: mayBeActive && i.r.active ? 'active' : null, userId: soleManager(managers) ?? managers[0]?.userId ?? null, to: null, managers };
  });
};
