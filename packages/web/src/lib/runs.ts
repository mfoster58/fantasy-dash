import type { PlayerId } from '@fantasy-dash/core';
import type { WeekRef } from './ironman';
import type { PlayerLine } from './playerLines';

export interface LineRun { length: number; from: WeekRef; to: WeekRef; lines: PlayerLine[] }

/**
 * Longest run over each player's lines in chronological order where every line passes `pred`.
 * A line that fails ends the run; weeks with no line for the player are simply absent. Earliest run wins ties.
 */
export function longestLineRun(lines: PlayerLine[], pred: (l: PlayerLine) => boolean): Map<PlayerId, LineRun> {
  const byPlayer = new Map<PlayerId, PlayerLine[]>();
  for (const l of lines) { const arr = byPlayer.get(l.playerId) ?? []; arr.push(l); byPlayer.set(l.playerId, arr); }
  const out = new Map<PlayerId, LineRun>();
  for (const [playerId, ls] of byPlayer) {
    ls.sort((a, b) => a.year - b.year || a.week - b.week);
    let best: LineRun | null = null;
    let run: PlayerLine[] = [];
    const flush = () => {
      if (run.length && (!best || run.length > best.length)) best = { length: run.length, from: { year: run[0].year, week: run[0].week }, to: { year: run[run.length - 1].year, week: run[run.length - 1].week }, lines: run };
      run = [];
    };
    for (const l of ls) { if (pred(l)) run.push(l); else flush(); }
    flush();
    if (best) out.set(playerId, best);
  }
  return out;
}
