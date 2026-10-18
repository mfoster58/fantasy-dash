import type { Draft, DraftPick, Season, Transaction } from '@fantasy-dash/core';
import { game, line, season, side, week } from './playerFixtures';

const mgrs = { A: { userId: 'A', displayName: 'Alice', teamName: 'Team A', avatar: null, rosterId: 1 }, B: { userId: 'B', displayName: 'Bob', teamName: null, avatar: null, rosterId: 2 } };
export const pick = (round: number, pickNo: number, userId: string, playerId: string, isKeeper: boolean): DraftPick =>
  ({ round, pickNo, slot: 1, userId, playerId, isKeeper, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: true, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null, tradedTo: null });
export const draft = (picks: DraftPick[]): Draft => ({ draftId: 'd', type: 'snake', rounds: 15, slotOrder: ['A', 'B'], picks, expectedCurve: null, baselines: {} });
export const tx = (type: Transaction['type'], week: number, created: number, adds: [string, string][], drops: [string, string][], bid: number | null = null): Transaction =>
  ({ id: `t${created}`, type, week, created, adds: adds.map(([playerId, userId]) => ({ playerId, userId })), drops: drops.map(([playerId, userId]) => ({ playerId, userId })), bid });

/**
 * w1 (WR): drafted by Alice (A) in 2025 R3 #25, started wk1 (W), benched wk2 in a 5-point loss scoring 30,
 * traded to Bob (B) in wk3 for r1, started for Bob in the wk3 Final (Bob wins the title), kept by Bob in 2026, started wk1 (W) and wk2 (L).
 * r1 (RB): drafted by Bob 2025 R1 #2, traded to Alice wk3; in 2026 Alice drops him wk2 and re-adds him off waivers ($5) the same week.
 * k1 (K): on Bob's 2026 week-1 bench, so a kicker has league lines and no database rows.
 */
export function leagueSeasons(): Season[] {
  const s25 = season(2025, [
    week(1, [game(2025, 1, 1, side('A', 110, [line('w1', 20)]), side('B', 90, [line('r1', 12)]))]),
    week(2, [game(2025, 2, 1, side('A', 95, [line('q1', 18)], [line('w1', 30)]), side('B', 100, [line('r1', 25)]))]),
    week(3, [game(2025, 3, 1, side('A', 120, [line('r1', 22)]), side('B', 125, [line('w1', 8)]), 'Final')], true),
  ], 'B');
  s25.managers = mgrs;
  s25.draft = draft([pick(1, 2, 'B', 'r1', false), pick(3, 25, 'A', 'w1', false)]);
  s25.transactions = [tx('trade', 3, 300, [['w1', 'B'], ['r1', 'A']], [['w1', 'A'], ['r1', 'B']])];
  s25.playerSeasons = { r1: { points: 59, games: 3, posRank: 1 }, w1: { points: 58, games: 3, posRank: 2 }, q1: { points: 18, games: 1, posRank: 1 } };

  const s26 = season(2026, [
    week(1, [game(2026, 1, 1, side('A', 100, [line('r1', 10)]), side('B', 105, [line('w1', 15)], [line('k1', 7)]))]),
    week(2, [game(2026, 2, 1, side('A', 90, [line('r1', 9)]), side('B', 80, [line('w1', 4)]))]),
  ], null);
  s26.status = 'in_season';
  s26.managers = mgrs;
  s26.draft = draft([pick(2, 14, 'B', 'w1', true), pick(1, 1, 'A', 'r1', true)]);
  s26.transactions = [tx('free_agent', 2, 500, [], [['r1', 'A']]), tx('waiver', 2, 510, [['r1', 'A']], [], 5)];
  s26.playerSeasons = { w1: { points: 19, games: 2, posRank: 1 }, r1: { points: 19, games: 2, posRank: 1 } };
  return [s25, s26];
}
