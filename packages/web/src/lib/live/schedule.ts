import type { NflGame } from './espn';

export const POLL_MS = 60_000;
/** while a box score is open on a game in progress: as often as its field reads the plays */
export const BOX_POLL_MS = 10_000;
const LEAD_MS = 15 * 60_000;

const eastern = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23', month: 'numeric' });

/** When NFL games are usually on (Eastern time): used only when ESPN can't say which games are. */
export function inFallbackWindow(now: number): boolean {
  const parts = Object.fromEntries(eastern.formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  switch (parts.weekday) {
    case 'Thu': case 'Mon': return hour >= 20;
    case 'Sun': return hour >= 9;
    case 'Sat': return Number(parts.month) === 12 && hour >= 13;
    default: return false;
  }
}

const STEP_MS = 15 * 60_000;
const WEEK_MS = 8 * 24 * 3600_000;

/**
 * When nothing is on, how long until it's worth checking again: 15 minutes before the next kickoff, or (without ESPN)
 * when the next game window opens. Null when every game this week is over.
 */
export function nextWake(now: number, games: NflGame[] | null): number | null {
  if (games) {
    const next = Math.min(...games.filter((g) => g.state === 'pre').map((g) => Date.parse(g.kickoff) - LEAD_MS));
    return Number.isFinite(next) ? Math.max(0, next - now) : null;
  }
  // windows open on the hour Eastern time, so quarter-hour steps land on each opening
  for (let t = Math.ceil(now / STEP_MS) * STEP_MS; t <= now + WEEK_MS; t += STEP_MS) {
    if (inFallbackWindow(t)) return t - now;
  }
  return null;
}

/** Poll while a game is on or about to kick off (a late kickoff still counts); fall back to the usual windows without ESPN. */
export function shouldPoll(now: number, games: NflGame[] | null): boolean {
  if (!games) return inFallbackWindow(now);
  return games.some((g) => g.state === 'in' || (g.state === 'pre' && Date.parse(g.kickoff) - now <= LEAD_MS));
}
