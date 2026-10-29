/** Replaying a finished week as if it were live: each game as ESPN would have shown it at a moment. */
import { liveDrives } from './drives';
import type { EspnGameFeed } from './espnGame';

/** a finished game as it stood at `t`: null before its first snap, over once its last snap is in */
export function feedAt(feed: EspnGameFeed, t: number): EspnGameFeed | null {
  const timed = feed.plays.filter((p) => p.time !== null);
  if (!timed.length || Math.min(...timed.map((p) => p.time!)) > t) return null;
  if (Math.max(...timed.map((p) => p.time!)) <= t) return { ...feed, state: 'post' };
  const plays = timed.filter((p) => p.time! <= t);
  const shown = new Set(plays.map((p) => p.id));
  const drives = feed.drives.filter((d) => d.playIds.some((id) => shown.has(id))).map((d) => ({ ...d, playIds: d.playIds.filter((id) => shown.has(id)) }));
  const lastDrive = drives[drives.length - 1];
  drives[drives.length - 1] = { ...lastDrive, complete: false, result: null };
  return { ...feed, state: 'in', drives, plays };
}

/** a quiet stretch this long between snaps starts a new window of games (early, late, night) */
const WINDOW_GAP_MS = 90 * 60_000;
const STEP_MS = 60_000;

/**
 * For each window of games, the minute with the most going on for these lineups: a drive on counts one, a drive in
 * the red zone three.
 */
export function busiestMoments(feeds: EspnGameFeed[], teams: Set<string>[]): number[] {
  const times = feeds.flatMap((f) => f.plays.flatMap((p) => (p.time === null ? [] : [p.time]))).sort((a, b) => a - b);
  const windows: [number, number][] = [];
  for (const t of times) {
    const w = windows[windows.length - 1];
    if (w && t - w[1] < WINDOW_GAP_MS) w[1] = t; else windows.push([t, t]);
  }
  return windows.map(([a, b]) => {
    let best = a, score = -1;
    for (let t = a; t <= b; t += STEP_MS) {
      const now = feeds.flatMap((f) => feedAt(f, t) ?? []);
      const sc = teams.reduce((n, set) => n + liveDrives(now, set, t).reduce((m, d) => m + (d.result ? 0 : (d.spot ?? 100) <= 20 ? 3 : 1), 0), 0);
      if (sc > score) { score = sc; best = t; }
    }
    return best;
  });
}

/** from a minute before the first snap of any game to the last snap */
export function replaySpan(feeds: EspnGameFeed[]): [number, number] | null {
  const times = feeds.flatMap((f) => f.plays.flatMap((p) => (p.time === null ? [] : [p.time])));
  return times.length ? [Math.min(...times) - 60_000, Math.max(...times)] : null;
}
