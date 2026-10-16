import type { History } from '@fantasy-dash/core';
import { allTimeContext, managerRecords } from './managerRecords';
import { game, line, players, season, side, standing, week } from '../test/playerFixtures';

const s = season(2024, [
  week(1, [game(2024, 1, 1, side('a', 150, [line('q1', 30)]), side('b', 90, [line('r1', 10)]))]),
  week(2, [game(2024, 2, 1, side('a', 140, [line('q1', 28)]), side('b', 95, [line('r1', 12)]))]),
]);
s.standings = [standing('a', 1, 2, 0, 0, 290, 185), standing('b', 2, 0, 2, 0, 185, 290)];
s.honors = { champion: 'a', runnerUp: 'b', third: null, pointsTitle: 'a', lastPlace: 'b' };
const managers: History['managers'] = { a: { displayName: 'alice', avatar: null, seasons: [2024] }, b: { displayName: 'bob', avatar: null, seasons: [2024] } };

describe('managerRecords', () => {
  const ctx = allTimeContext([s], players, managers);

  it('keeps the boards where the manager ranks in the top three, grouped by sub-tab', () => {
    const recs = managerRecords(ctx, 'a');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.rank >= 1 && r.rank <= 3)).toBe(true);
    const wins = recs.find((r) => r.boardId === 'mCareerWins');
    expect(wins).toMatchObject({ sub: 'malltime', subTitle: 'All-time', rank: 1, valueLabel: '2' });
  });

  it('ranks the other manager second on the same board', () => {
    expect(managerRecords(ctx, 'b').find((r) => r.boardId === 'mCareerWins')).toBeUndefined();   // bob has 0 wins, no row
    expect(managerRecords(ctx, 'b').find((r) => r.boardId === 'mCareerPoints')).toMatchObject({ rank: 2 });
  });

  it('prefixes the detail with the player a row names, so the profile still says who', () => {
    const picked = { ...ctx, playerSeasons: { 2024: { q1: { points: 58, games: 2, posRank: 1 } } }, drafts: { 2024: { draftId: 'D', type: 'snake' as const, rounds: 1, slotOrder: ['a', 'b'], picks: [{ round: 1, pickNo: 1, slot: 1, userId: 'a', playerId: 'q1', isKeeper: false, posDraftRank: 1, seasonPoints: 58, gamesPlayed: 2, ppg: 29, healthy: true, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: 12, tradedTo: null }], expectedCurve: null, baselines: {} } } };
    expect(managerRecords(picked, 'a').find((r) => r.boardId === 'mdSteal')).toMatchObject({ rank: 1, detail: 'Quincy One · Rd 1, pick 1 · QB1 → QB1 · 29.0 PPG' });
  });

  it('shares a rank between tied rows, as the Records page crowns them', () => {
    // both managers have 1 season: mSeasons ties at 1, so each is rank 1
    expect(managerRecords(ctx, 'b').find((r) => r.boardId === 'mSeasons')).toMatchObject({ rank: 1 });
    expect(managerRecords(ctx, 'a').find((r) => r.boardId === 'mSeasons')).toMatchObject({ rank: 1 });
  });

  it('honours maxRank', () => {
    expect(managerRecords(ctx, 'b', 1).every((r) => r.rank === 1)).toBe(true);
  });
});
