import { describe, it, expect } from 'vitest';
import type { Draft, DraftPick } from '@fantasy-dash/core';
import { BOARDS, boardsFor } from '../../playerBoards';
import { mctx } from './shared.test';
import { mdBestClass, mdBust, mdFirstRound, mdLate, mdRookies, mdSteal, mdWorstClass } from './draft';

const pick = (round: number, pickNo: number, userId: string, playerId: string, value: number | null): DraftPick =>
  ({ round, pickNo, slot: pickNo, userId, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value, tradedTo: null });
const keeper = (p: DraftPick): DraftPick => ({ ...p, isKeeper: true });
const draftOf = (picks: DraftPick[]): Draft => ({ draftId: 'D', type: 'snake', rounds: 10, slotOrder: ['a', 'b'], picks, expectedCurve: null, baselines: {} });
const drafts = {
  2023: draftOf([pick(1, 1, 'a', 't1', 10)]),
  2024: draftOf([pick(1, 1, 'a', 'q1', 20), { ...pick(1, 2, 'b', 'r1', -15), posDraftRank: 1, ppg: 6.25 }, { ...pick(9, 81, 'a', 'w1', 30), posDraftRank: 24, ppg: 14.2 }, pick(9, 82, 'b', 't1', 5), pick(10, 91, 'b', 'k1', null), keeper(pick(9, 83, 'b', 'KC', 99))]),
  2025: draftOf([pick(1, 1, 'b', 'q1', 40)]),
};
// 2023 is a complete season for a (a copy of the 2024 row); 2024 complete; 2025 in progress
const base = mctx();
const ctx = { ...base, drafts, managerSeasons: [...base.managerSeasons, { ...base.managerSeasons[0], year: 2023 }], playerSeasons: { 2024: { w1: { points: 170, games: 12, posRank: 4 }, r1: { points: 100, games: 16, posRank: 41 } } } };

describe('manager draft boards', () => {
  it('sums a manager\'s pick values per complete season under All-time and the chosen year otherwise', () => {
    // classes keep keepers (b's +99 kept KC) and link to the manager's own column on that draft board
    expect(mdBestClass(ctx).map((r) => [r.userId, r.meta, r.value, r.valueLabel, r.detail, r.to, r.tone])).toEqual([
      ['b', '2024', 89, '+89.0', '3 picks', '/draft/2024?team=b', 'win'], ['a', '2024', 50, '+50.0', '2 picks', '/draft/2024?team=a', 'win'], ['a', '2023', 10, '+10.0', '1 pick', '/draft/2023?team=a', 'win'],
    ]);
    expect(mdWorstClass(ctx)[0]).toMatchObject({ userId: 'a', value: 10 });
    expect(mdBestClass({ ...mctx(2025), drafts }).map((r) => [r.userId, r.value])).toEqual([['b', 40]]);
  });
  it('finds the single best and worst picks, keepers aside, naming the player, slot, position ranks and PPG', () => {
    expect(mdSteal(ctx)[0]).toMatchObject({ userId: 'a', player: 'w1', value: 30, detail: 'Rd 9, pick 81 · WR24 → WR4 · 14.2 PPG', meta: '2024', to: '/draft/2024?team=a' });
    expect(mdBust(ctx)[0]).toMatchObject({ userId: 'b', player: 'r1', value: -15, detail: 'Rd 1, pick 2 · RB1 → RB41 · 6.3 PPG' });
    expect(mdSteal(ctx).some((r) => r.player === 'KC')).toBe(false);
    expect(mdSteal(ctx).find((r) => r.player === 'q1')).toMatchObject({ detail: 'Rd 1, pick 1' }); // no ranks or PPG known
    expect(mdSteal({ ...ctx, pos: 'RB' }).map((r) => r.player)).toEqual(['r1']); // the board's own position dropdown
  });
  it('sums late-round value from round 9 on, keepers aside', () => {
    expect(mdLate(ctx).map((r) => [r.userId, r.value, r.to])).toEqual([['a', 30, '/draft/2024?team=a'], ['b', 5, '/draft/2024?team=b']]);
  });
  it('averages first-round value over at least two complete seasons', () => {
    expect(mdFirstRound(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 15, valueLabel: '+15.0', meta: '2023–2024', detail: '2 first-round picks' })]);
    expect(mdFirstRound(base)).toEqual([]);
    expect(BOARDS.find((b) => b.id === 'mdFirstRound')!.empty!(base)).toMatch(/two complete seasons/);
  });
  it('is registered in order, the single-pick boards offering a position dropdown', () => {
    expect(boardsFor('managers', 'mdraft').map((b) => b.id)).toEqual(['mdBestClass', 'mdWorstClass', 'mdSteal', 'mdBust', 'mdLate', 'mdRookies', 'mdFirstRound']);
    expect(boardsFor('managers', 'mdraft').filter((b) => b.positions).map((b) => b.id)).toEqual(['mdSteal', 'mdBust']);
  });
  it('counts the rookies each manager drafted in one draft, keepers aside', () => {
    // yearsExp is today's (2025): a rookie of 2024 has 1 year, of 2025 none
    const rookie = (id: string, yearsExp: number) => ({ id, name: id, firstName: id, lastName: '', position: 'WR', team: 'KC', yearsExp, birthDate: null });
    const players = { ...ctx.players, q1: rookie('q1', 1), w1: rookie('w1', 1), r1: rookie('r1', 4), t1: rookie('t1', 1), k1: rookie('k1', 1), KC: rookie('KC', 1) };
    const rows = mdRookies({ ...ctx, players });
    expect(rows.map((r) => [r.userId, r.meta, r.value, r.valueLabel, r.detail, r.to])).toEqual([
      ['a', '2024', 2, '2', '2 of 2 picks', '/draft/2024?team=a'],
      ['b', '2024', 2, '2', '2 of 3 picks', '/draft/2024?team=b'],
    ]);
    expect(BOARDS.find((b) => b.id === 'mdRookies')).toMatchObject({ sub: 'mdraft', title: 'Most rookies drafted' });
  });
});
