/** Replaying a finished week as if it were live: each game as ESPN would have shown it at a moment. */
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

/** from a minute before the first snap of any game to the last snap */
export function replaySpan(feeds: EspnGameFeed[]): [number, number] | null {
  const times = feeds.flatMap((f) => f.plays.flatMap((p) => (p.time === null ? [] : [p.time])));
  return times.length ? [Math.min(...times) - 60_000, Math.max(...times)] : null;
}
