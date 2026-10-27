import type { Field, NflGame } from './espn';

/** Who a player's team plays: the opponent and whether it's at home. */
export interface Versus { opp: string; home: boolean }
/** A finished game from the player's side: his team's score first. */
export interface NflResult { outcome: 'W' | 'L' | 'T'; us: number; them: number }

/** Where a player's NFL game stands. `unknown` when ESPN couldn't be read. `vs` when ESPN said who's home. */
export type PlayerGame =
  | { kind: 'live'; period: number; clock: string; halftime: boolean; field?: Field; vs?: Versus }
  | { kind: 'final'; vs?: Versus; result?: NflResult }
  | { kind: 'upcoming'; kickoff: string; vs?: Versus }
  | { kind: 'bye' }
  | { kind: 'unknown' };

function versus(team: string, g: NflGame): Versus | null {
  const opp = g.teams.find((t) => t !== team);
  return opp && g.home ? { opp, home: g.home === team } : null;
}

function result(team: string, opp: string, g: NflGame): NflResult | null {
  if (!g.score || g.score[team] === undefined || g.score[opp] === undefined) return null;
  const [us, them] = [g.score[team], g.score[opp]];
  return { outcome: us > them ? 'W' : us < them ? 'L' : 'T', us, them };
}

export function gameFor(team: string, games: NflGame[] | null): PlayerGame {
  if (!games) return { kind: 'unknown' };
  const g = team ? games.find((x) => x.teams.includes(team)) : undefined;
  if (!g) return { kind: 'bye' };
  const vs = versus(team, g);
  const withVs = vs ? { vs } : {};
  if (g.state === 'post') {
    const r = vs ? result(team, vs.opp, g) : null;
    return { kind: 'final', ...withVs, ...(r ? { result: r } : {}) };
  }
  if (g.state === 'pre') return { kind: 'upcoming', kickoff: g.kickoff, ...withVs };
  return { kind: 'live', period: g.period, clock: g.clock, halftime: g.halftime, ...(g.field ? { field: g.field } : {}), ...withVs };
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
