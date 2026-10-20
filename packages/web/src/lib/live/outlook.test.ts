import type { Game, GameSide, PlayerLine } from '@fantasy-dash/core';
import type { PlayerGame } from './gameState';
import { gameOutlook, phi, playerOutlook } from './outlook';

const live = (period: number, clock: string): PlayerGame => ({ kind: 'live', period, clock, halftime: false });
const UP: PlayerGame = { kind: 'upcoming', kickoff: '2026-10-25T17:00Z' };
const line = (playerId: string, points: number, projected: number | null): PlayerLine => ({ playerId, points, projected, stats: {} });
const side = (userId: string, lines: PlayerLine[]): GameSide => ({
  userId, points: lines.reduce((t, l) => t + l.points, 0), projected: 0, ceiling: 0, efficiency: 0,
  starters: lines.map((p) => ({ slot: 'FLEX', player: p })), bench: [], optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 0,
});
const game = (a: GameSide, b: GameSide): Game => ({ id: '2026-8-1', matchupId: 1, week: 8, tag: null, sides: [a, b], winner: null, margin: 0 });

describe('phi', () => {
  it('is the standard normal CDF', () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
    expect(phi(-1)).toBeCloseTo(0.1587, 3);
  });
});

describe('playerOutlook', () => {
  it('adds the share of his projection still to play while his game is on', () => {
    expect(playerOutlook(10, 20, live(3, '0:00'))).toEqual({ final: 15, remaining: 5 });
  });
  it('is his points when his game is over or he is on a bye, his projection before kickoff', () => {
    expect(playerOutlook(12, 20, { kind: 'final' })).toEqual({ final: 12, remaining: 0 });
    expect(playerOutlook(0, 20, { kind: 'bye' })).toEqual({ final: 0, remaining: 0 });
    expect(playerOutlook(0, 20, UP)).toEqual({ final: 20, remaining: 20 });
  });
  it('never drops below his points when the game state is unknown', () => {
    expect(playerOutlook(25, 20, { kind: 'unknown' })).toEqual({ final: 25, remaining: 20 });
    expect(playerOutlook(0, 20, { kind: 'unknown' })).toEqual({ final: 20, remaining: 20 });
  });
  it('counts only points for a player with no projection (added after the sync)', () => {
    expect(playerOutlook(7, null, live(2, '5:00'))).toEqual({ final: 7, remaining: 0 });
  });
});

describe('gameOutlook', () => {
  it('at kickoff, gives the win % from the projection gap and the points still to play', () => {
    const o = gameOutlook(game(side('a', [line('a1', 0, 130)]), side('b', [line('b1', 0, 120)])), () => UP);
    // sigma = sqrt(4.4 x 250) = 33.17; z = 10 / 33.17 = 0.3015; phi = 0.618
    expect(o).toEqual({ projected: [130, 120], win: [62, 38], status: 'upcoming' });
  });
  it('a big lead with almost nothing left is near certain, but held at 99', () => {
    const o = gameOutlook(game(side('a', [line('a1', 150, 20)]), side('b', [line('b1', 90, 20)])), () => live(4, '0:30'));
    expect(o.status).toBe('live');
    expect(o.win).toEqual([99, 1]);
  });
  it('when every game is over, gives 100 to the leader or 50/50 on a tie', () => {
    const fin = () => ({ kind: 'final' }) as PlayerGame;
    expect(gameOutlook(game(side('a', [line('a1', 101, 90)]), side('b', [line('b1', 100, 90)])), fin))
      .toEqual({ projected: [101, 100], win: [100, 0], status: 'final' });
    expect(gameOutlook(game(side('a', [line('a1', 100, 90)]), side('b', [line('b1', 100, 90)])), fin).win).toEqual([50, 50]);
  });
  it('is live once any starter has played, and treats empty slots as nothing', () => {
    const a = side('a', [line('a1', 8, 20)]);
    a.starters.push({ slot: 'FLEX', player: null });
    const o = gameOutlook(game(a, side('b', [line('b1', 0, 20)])), (id) => (id === 'a1' ? { kind: 'final' } : UP));
    expect(o.status).toBe('live');
    expect(o.projected).toEqual([8, 20]);
  });
});
