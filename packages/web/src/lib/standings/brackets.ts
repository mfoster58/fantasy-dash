import type { BracketGame, Season, UserId } from '@fantasy-dash/core';
import { hasRanks } from '../home/pick';

export interface StandingsBrackets {
  /** final: the season is over; set: the playoffs are under way; projected: seeded from today's table; none: nothing to show yet */
  kind: 'final' | 'set' | 'projected' | 'none';
  winners: BracketGame[];
  consolation: BracketGame[];
  /** each team's seed: its place in the regular-season table */
  seeds: Record<UserId, number>;
}

const key = (g: BracketGame) => `${g.bracket}-${g.matchNo}`;

/**
 * Where each seed goes, read off a finished bracket: a team in its first game of the bracket (round 1,
 * or later after a bye) sits at its seed's spot. Teams that got there by winning
 * or losing are left out: those spots wait on results.
 */
function seedPlan(template: Season): Map<string, [number | null, number | null]> {
  const seed = new Map(template.standings.map((r) => [r.userId, r.rank]));
  const plan = new Map<string, [number | null, number | null]>();
  for (const games of [template.brackets.winners, template.brackets.consolation]) {
    const playedBefore = (id: UserId, round: number) => games.some((x) => x.round < round && (x.home === id || x.away === id));
    const placed = (id: UserId | null, round: number) => (id && !playedBefore(id, round) ? seed.get(id) ?? null : null);
    for (const g of games) plan.set(key(g), [placed(g.home, g.round), placed(g.away, g.round)]);
  }
  return plan;
}

/**
 * The playoff and toilet-bowl brackets for the standings page: the real ones once Sleeper has set them,
 * otherwise "if the season ended today", seeded from the table the way the last finished season's bracket was.
 */
export function standingsBrackets(season: Season, template: Season | null): StandingsBrackets {
  const seeds = Object.fromEntries(season.standings.map((r) => [r.userId, r.rank]));
  const { winners, consolation } = season.brackets;
  if (winners.some((g) => g.home !== null)) return { kind: season.status === 'complete' ? 'final' : 'set', winners, consolation, seeds };
  const none: StandingsBrackets = { kind: 'none', winners: [], consolation: [], seeds: {} };
  if (!template || !hasRanks(season) || winners.length === 0) return none;
  if (template.playoffTeams !== season.playoffTeams || template.standings.length !== season.standings.length) return none;
  const plan = seedPlan(template);
  if ([...winners, ...consolation].some((g) => !plan.has(key(g)))) return none;
  const bySeed = new Map(season.standings.map((r) => [r.rank, r.userId]));
  const fill = (g: BracketGame): BracketGame => {
    const [h, a] = plan.get(key(g))!;
    return { ...g, home: h === null ? null : bySeed.get(h) ?? null, away: a === null ? null : bySeed.get(a) ?? null };
  };
  return { kind: 'projected', winners: winners.map(fill), consolation: consolation.map(fill), seeds };
}
