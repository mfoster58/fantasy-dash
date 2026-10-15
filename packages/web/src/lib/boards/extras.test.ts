import { describe, it, expect } from 'vitest';
import { flattenLines } from '../playerLines';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import { BOARDS, benchWarmers, championsOf, lastPlacesOf, loyalty, ironman, type BoardContext } from '../playerBoards';

const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40), line('r1', 20)]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
    week(2, [game(2024, 2, 1, side('a', 25, [line('q1', 25)], [line('w1', 44, { rec: 9 })]), side('b', 12, [line('r1', 12)]))]),
    week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
  ], 'a'),
  season(2025, [
    week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35), line('t1', 0, {})]), side('a', 9, [line('r1', 9)]))]),
    week(2, [game(2025, 2, 1, side('b', 18, [line('q1', 18)]), side('a', 11, [line('r1', 11)]))]),
    week(3, [game(2025, 3, 1, side('b', 22, [line('r1', 22)], [line('q1', 50)]), side('a', 4, [line('w1', 4)]), 'Final')], true),
  ], 'b'),
];
export const ctx: BoardContext = {
  lines: flattenLines(seasons, players), players, champions: championsOf(seasons), lastPlaces: lastPlacesOf(seasons), year: null, currentYear: 2025, pos: 'All',
  picks: [], xfp: null, transactions: [], playerSeasons: {}, drafts: {},
};

describe('bench warmers', () => {
  it('sums points while benched', () => {
    expect(benchWarmers(ctx).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail])).toEqual([['q1', 50, '50.00', '1 season', '1 week benched'], ['w1', 44, '44.00', '1 season', '1 week benched'], ['t1', 3, '3.00', '1 season', '1 week benched']]);
  });
});

describe('loyalty', () => {
  it('is the most starts for one manager, with that manager; a tie goes to the manager with the newer start', () => {
    const rows = loyalty(ctx);
    // r1: a started him 2024 wk1, 2025 wk1, wk2 (3); b 2024 wk2, wk3, 2025 wk3 (3) → b, newest start
    expect(rows[0]).toMatchObject({ playerId: 'r1', value: 3, userId: 'b', detail: 'of 6 starts' });
    // q1: a 3 (2024), b 2 (2025)
    expect(rows[1]).toMatchObject({ playerId: 'q1', value: 3, userId: 'a', detail: 'of 5 starts' });
    expect(rows.some((r) => r.playerId === 'KC' || r.playerId === 'k1')).toBe(false);
  });
});

describe('ironman', () => {
  it('ranks the longest start runs with their span', () => {
    const rows = ironman(ctx);
    expect(rows[0]).toMatchObject({ playerId: 'r1', value: 6, valueLabel: '6', meta: '2024 Wk 1 – 2025 Wk 3', detail: 'active' });
    expect(rows[1]).toMatchObject({ playerId: 'q1', value: 5, meta: '2024 Wk 1 – 2025 Wk 2', detail: null });
  });
});

describe('registry', () => {
  it('lays out Extras in grid order', () => {
    expect(BOARDS.filter((b) => b.section === 'extras').map((b) => b.id).slice(0, 7)).toEqual(['boomStarts', 'dudStarts', 'benchBlunder', 'benchWarmers', 'journeyman', 'loyalty', 'ironman']);
    expect(BOARDS.filter((b) => b.section === 'career').map((b) => b.id)).toEqual(['bestWeek', 'bestSeason', 'careerPoints', 'weeksStarted']);
  });
});
