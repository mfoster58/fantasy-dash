import type { NflGame } from './espn';

/** Where a player's NFL game stands. `unknown` when ESPN couldn't be read. */
export type PlayerGame =
  | { kind: 'live'; period: number; clock: string; halftime: boolean }
  | { kind: 'final' }
  | { kind: 'upcoming'; kickoff: string }
  | { kind: 'bye' }
  | { kind: 'unknown' };

export function gameFor(team: string, games: NflGame[] | null): PlayerGame {
  if (!games) return { kind: 'unknown' };
  const g = team ? games.find((x) => x.teams.includes(team)) : undefined;
  if (!g) return { kind: 'bye' };
  if (g.state === 'post') return { kind: 'final' };
  if (g.state === 'pre') return { kind: 'upcoming', kickoff: g.kickoff };
  return { kind: 'live', period: g.period, clock: g.clock, halftime: g.halftime };
}

export const playerGames = (teamOf: (id: string) => string, games: NflGame[] | null) =>
  (id: string): PlayerGame => gameFor(teamOf(id), games);

/** "4:12" -> 4.2 minutes; an unreadable clock counts as a full quarter */
function clockMinutes(clock: string): number {
  const m = /^(\d+):(\d{2})/.exec(clock);
  return m ? Number(m[1]) + Number(m[2]) / 60 : 15;
}

/** Share of the player's game still to play: drives how much of his projection is still to come. */
export function fractionLeft(g: PlayerGame): number {
  if (g.kind === 'upcoming' || g.kind === 'unknown') return 1;
  if (g.kind !== 'live' || g.period > 4) return 0;
  const left = ((4 - g.period) * 15 + Math.min(15, clockMinutes(g.clock))) / 60;
  return Math.max(0, Math.min(1, left));
}

/** "Q3 4:12", "Half", "OT 8:00", "Final", "Bye", "Sun 1:00 PM"; null without ESPN */
export function gameLabel(g: PlayerGame, timeZone?: string): string | null {
  switch (g.kind) {
    case 'live': return g.halftime ? 'Half' : g.period > 4 ? `OT ${g.clock}` : `Q${g.period} ${g.clock}`;
    case 'final': return 'Final';
    case 'bye': return 'Bye';
    case 'upcoming':
      return new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(g.kickoff));
    default: return null;
  }
}
