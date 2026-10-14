import type { Game, GameSide, PlayerId, UserId } from '@fantasy-dash/core';

export const METRIC_DEFS = {
  winPct: 'Win percentage. Wins plus half of ties, divided by games played.',
  pf: 'Points for. Total points scored in regular season games.',
  pa: 'Points against. Total points allowed in regular season games.',
  ppg: 'Points per game in the regular season.',
  max: 'Max points. The best possible lineup from the full roster each week, summed.',
  eff: 'Efficiency. Points for divided by max points.',
  strk: 'Current run of consecutive wins or losses. Regular season only.',
  allPlay: 'All-play record. Your record if you had played every other team each week.',
  highs: "Weeks with the league's top score.",
} as const;

export interface Performer { userId: UserId; playerId: PlayerId; points: number }

/** Highest-scoring starters across both sides of a game. */
export function topPerformers(game: Game, n = 3): Performer[] {
  return game.sides
    .flatMap((s) => s.starters.flatMap((e) => (e.player ? [{ userId: s.userId, playerId: e.player.playerId, points: e.player.points }] : [])))
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}

/** Highest-scoring starters on one side of a game, highest first. Empty slots are skipped. */
export function topPerformersBySide(side: GameSide, n = 3): Performer[] {
  return side.starters
    .flatMap((e) => (e.player ? [{ userId: side.userId, playerId: e.player.playerId, points: e.player.points }] : []))
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}
