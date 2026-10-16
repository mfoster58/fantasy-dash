import type { PlayerId } from '@fantasy-dash/core';
import type { PlayerLine } from './playerLines';

export interface WeekRef { year: number; week: number }
export interface StartRun { length: number; from: WeekRef; to: WeekRef; active: boolean }

const key = (w: WeekRef) => w.year * 100 + w.week;
export const weekKey = key;

/** Every distinct (year, week) in `lines`, in order. */
export const weeksOf = (lines: PlayerLine[]): WeekRef[] => [...new Map(lines.map((l) => [key(l), { year: l.year, week: l.week }])).values()].sort((a, b) => key(a) - key(b));

/**
 * Longest run of consecutive entries of `weeks` whose key is in the player's set. A week not in the set ends
 * the run. A run reaching the final week is active. Earliest run wins ties.
 */
export function longestWeekRun(weeks: WeekRef[], has: Map<PlayerId, Set<number>>): Map<PlayerId, StartRun> {
  const out = new Map<PlayerId, StartRun>();
  const last = weeks[weeks.length - 1];
  for (const [playerId, set] of has) {
    let best: StartRun | null = null;
    let run: { from: WeekRef; to: WeekRef; length: number } | null = null;
    for (const w of weeks) {
      if (!set.has(key(w))) { run = null; continue; }
      if (run === null) run = { from: w, to: w, length: 1 };
      else { run.to = w; run.length += 1; }
      if (!best || run.length > best.length) best = { from: run.from, to: run.to, length: run.length, active: false };
    }
    if (best) out.set(playerId, { ...best, active: last !== undefined && key(best.to) === key(last) });
  }
  return out;
}

/**
 * Longest run of consecutive league weeks in which the player was started by any manager.
 * The week sequence is every distinct (year, week) in `lines`, in order; a week without a
 * started line ends the run. A run reaching the final week is active. Earliest run wins ties.
 */
export function longestStartRun(lines: PlayerLine[]): Map<PlayerId, StartRun> {
  const startedAt = new Map<PlayerId, Set<number>>();
  for (const l of lines) {
    if (!l.started) continue;
    const set = startedAt.get(l.playerId) ?? new Set<number>();
    set.add(key(l));
    startedAt.set(l.playerId, set);
  }
  return longestWeekRun(weeksOf(lines), startedAt);
}
