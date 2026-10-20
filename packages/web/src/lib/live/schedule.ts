import type { NflGame } from './espn';

export const POLL_MS = 60_000;
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

/** Poll while a game is on or about to kick off (a late kickoff still counts); fall back to the usual windows without ESPN. */
export function shouldPoll(now: number, games: NflGame[] | null): boolean {
  if (!games) return inFallbackWindow(now);
  return games.some((g) => g.state === 'in' || (g.state === 'pre' && Date.parse(g.kickoff) - now <= LEAD_MS));
}
