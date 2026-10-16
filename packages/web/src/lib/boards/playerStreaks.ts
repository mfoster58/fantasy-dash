import type { PlayerId } from '@fantasy-dash/core';
import { longestWeekRun, weekKey, weeksOf, type StartRun } from '../ironman';
import type { PlayerLine } from '../playerLines';
import { longestLineRun } from '../runs';
import type { BoardContext, BoardRow } from './shared';
import { managersOf, rank, skillOnly, soleManager, started } from './shared';

const span = (r: { from: { year: number; week: number }; to: { year: number; week: number } }) => `${r.from.year} Wk ${r.from.week} – ${r.to.year} Wk ${r.to.week}`;

function lineRunBoard(lines: PlayerLine[], pred: (l: PlayerLine) => boolean): BoardRow[] {
  const items = [...longestLineRun(lines, pred).entries()].map(([playerId, r]) => ({ playerId, r, value: r.length, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => {
    const managers = managersOf(i.r.lines);
    return { key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: span(i.r), detail: null, userId: soleManager(managers) ?? managers[0]?.userId ?? null, to: null, managers };
  });
}

export const run15 = (ctx: BoardContext): BoardRow[] => lineRunBoard(started(ctx), (l) => l.points >= 15);
export const run20 = (ctx: BoardContext): BoardRow[] => lineRunBoard(started(ctx), (l) => l.points >= 20);
export const drought = (ctx: BoardContext): BoardRow[] => lineRunBoard(skillOnly(started(ctx)).filter((l) => l.played), (l) => l.points < 5);

/** Consecutive league weeks as the top started scorer at the player's position; a week not on top, started or not, ends the run. */
export const posTopRun = (ctx: BoardContext): BoardRow[] => {
  const lines = started(ctx);
  const has = new Map<PlayerId, Set<number>>();
  const byWeekPos = new Map<string, PlayerLine[]>();
  for (const l of lines) { const k = `${weekKey(l)}|${l.position}`; const arr = byWeekPos.get(k) ?? []; arr.push(l); byWeekPos.set(k, arr); }
  for (const ls of byWeekPos.values()) {
    const top = Math.max(...ls.map((l) => l.points));
    for (const l of ls) if (l.points === top) { const set = has.get(l.playerId) ?? new Set<number>(); set.add(weekKey(l)); has.set(l.playerId, set); }
  }
  const runs: Map<PlayerId, StartRun> = longestWeekRun(weeksOf(ctx.lines), has);
  const mayBeActive = ctx.year === null || ctx.year === ctx.currentYear;
  const items = [...runs.entries()].map(([playerId, r]) => ({ playerId, r, value: r.length, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: span(i.r), detail: mayBeActive && i.r.active ? 'active' : null, userId: null, to: null }));
};
