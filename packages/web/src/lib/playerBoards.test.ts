import { describe, it, expect } from 'vitest';
import { flattenLines } from './playerLines';
import { game, line, players, season, side, week } from '../test/playerFixtures';
import {
  BOARDS, bestSeason, bestWeek, benchBlunder, careerPoints, careerPpg, championshipRosters, championsOf, weeksStarted,
  boomStarts, dudStarts, journeyman, leadPoints, leadTouchdowns, leadYards, postPoints, postReceptions, postStarts, postTouchdowns, postYards,
  type BoardContext,
} from './playerBoards';

// Two seasons, managers a and b. q1 is the star QB, r1 a steady RB, w1 a benched boom, t1 unplayed often.
const s2024 = season(2024, [
  week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40), line('r1', 20)]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
  week(2, [game(2024, 2, 1, side('a', 25, [line('q1', 25)], [line('w1', 44, { rec: 9 })]), side('b', 12, [line('r1', 12)]))]),
  week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
], 'a');
const s2025 = season(2025, [
  week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35), line('t1', 0, {})]), side('a', 9, [line('r1', 9)]))]),
  week(2, [game(2025, 2, 1, side('b', 18, [line('q1', 18)]), side('a', 11, [line('r1', 11)]))]),
  week(3, [game(2025, 3, 1, side('b', 22, [line('r1', 22)], [line('q1', 50)]), side('a', 4, [line('w1', 4)]), 'Final')], true),
], 'b');
const seasons = [s2024, s2025];
const ctx: BoardContext = { lines: flattenLines(seasons, players), players, champions: championsOf(seasons), currentYear: 2025 };

describe('championsOf', () => {
  it('maps year to champion', () => {
    expect(championsOf(seasons)).toEqual({ 2024: 'a', 2025: 'b' });
  });
});

describe('bestWeek', () => {
  it('ranks started lines by points, newest first on ties, with a box score link', () => {
    const rows = bestWeek(ctx);
    expect(rows.slice(0, 3).map((r) => [r.playerId, r.value, r.meta, r.userId])).toEqual([
      ['q1', 40, '2024 · Wk 1', 'a'],
      ['q1', 35, '2025 · Wk 1', 'b'],
      ['q1', 31, '2024 · Wk 3 · Championship', 'a'],
    ]);
    expect(rows[0]).toMatchObject({ valueLabel: '40.00', to: '/scores/2024/1/1', detail: null });
    expect(rows.some((r) => r.playerId === 'w1' && r.value === 44)).toBe(false); // benched
  });
});

describe('bestSeason', () => {
  it('sums started points per player, manager and season with a starts count', () => {
    const rows = bestSeason(ctx);
    expect(rows[0]).toMatchObject({ playerId: 'q1', value: 96, valueLabel: '96.00', meta: '2024', detail: '3 starts', userId: 'a', to: '/scores/2024' });
    expect(rows[1]).toMatchObject({ playerId: 'q1', value: 53, meta: '2025', userId: 'b', detail: '2 starts' });
  });
});

describe('careerPoints and weeksStarted', () => {
  it('aggregates across seasons and managers', () => {
    const pts = careerPoints(ctx);
    expect(pts[0]).toMatchObject({ playerId: 'q1', value: 149, valueLabel: '149.00', meta: '2024, 2025', detail: '5 starts', userId: null, to: null });
    expect(pts[1]).toMatchObject({ playerId: 'r1', value: 81 });
    const wk = weeksStarted(ctx);
    expect(wk[0]).toMatchObject({ playerId: 'r1', value: 6, valueLabel: '6' });
    expect(wk[1]).toMatchObject({ playerId: 'q1', value: 5 });
  });
});

describe('championshipRosters', () => {
  it('counts seasons on the champion roster in the final, bench included, and lists the years', () => {
    const rows = championshipRosters(ctx);
    // 2024 final: a (champion) started q1, benched t1. 2025 final: b (champion) started r1, benched q1.
    expect(rows[0]).toMatchObject({ playerId: 'q1', value: 2, valueLabel: '2', meta: '2024, 2025' });
    expect(rows.map((r) => r.playerId).sort()).toEqual(['q1', 'r1', 't1']);
    expect(rows.find((r) => r.playerId === 'r1')).toMatchObject({ value: 1, meta: '2025' });
  });
});

describe('benchBlunder', () => {
  it('ranks benched lines by points with the manager and game', () => {
    const rows = benchBlunder(ctx);
    expect(rows[0]).toMatchObject({ playerId: 'q1', value: 50, meta: '2025 · Wk 3 · Championship', userId: 'b', to: '/scores/2025/3/1' });
    expect(rows[1]).toMatchObject({ playerId: 'w1', value: 44, userId: 'a' });
  });
});

describe('careerPpg', () => {
  it('averages points over played lines, started or benched, with a minimum of games', () => {
    expect(careerPpg(ctx)).toEqual([]); // nobody has 12 played games in the fixture
    const many = Array.from({ length: 12 }, (_, i) => week(i + 1, [game(2023, i + 1, 1, side('a', 10, [line('r1', 10)]), side('b', 1, [line('t1', 0, {})]))]));
    const big = { ...ctx, lines: flattenLines([season(2023, many), ...seasons], players) };
    const r1 = careerPpg(big).find((r) => r.playerId === 'r1')!;
    // 12 × 10 in 2023 + 20, 12, 7, 9, 11, 22 = 201 over 18 played games
    expect(r1).toMatchObject({ value: 11.17, valueLabel: '11.2', detail: '18 games', meta: '2023, 2024, 2025' });
    expect(careerPpg(big).find((r) => r.playerId === 't1')).toBeUndefined(); // 12 unplayed weeks do not count
  });
});

describe('BOARDS registry', () => {
  it('lists the all-time boards in order with sections', () => {
    const allTime = BOARDS.filter((b) => b.section === 'allTime').map((b) => b.id);
    expect(allTime).toEqual(['bestWeek', 'bestSeason', 'careerPoints', 'weeksStarted', 'championshipRosters', 'benchBlunder', 'careerPpg']);
    for (const b of BOARDS) expect(b.definition.length).toBeGreaterThan(10);
  });
});

describe('postseason boards', () => {
  // Finals: 2024 wk3 a: q1 31 (bench t1 3) vs b: r1 7 ; 2025 wk3 b: r1 22 (bench q1 50) vs a: w1 4. Toilet bowls never appear here.
  it('count only started lines in championship-bracket games', () => {
    expect(postPoints(ctx).slice(0, 2)).toEqual([
      expect.objectContaining({ playerId: 'q1', value: 31, valueLabel: '31.00', meta: '2024', detail: '1 start' }),
      expect.objectContaining({ playerId: 'r1', value: 29, meta: '2024, 2025', detail: '2 starts' }),
    ]);
    expect(postStarts(ctx)[0]).toMatchObject({ playerId: 'r1', value: 2, valueLabel: '2', detail: '29.00 pts' });
  });
  it('sum touchdowns, yards and receptions from the stats', () => {
    const rich = season(2023, [week(3, [game(2023, 3, 1,
      side('a', 40, [line('w1', 25, { rec: 8, rec_yd: 120, rec_td: 2 }), line('r1', 15, { rush_yd: 60, rush_td: 1, rec: 2, rec_yd: 10 })]),
      side('b', 5, [line('q1', 5, { pass_yd: 150, pass_td: 1 })]), 'SF')], true)]);
    const c = { ...ctx, lines: flattenLines([rich], players) };
    expect(postTouchdowns(c)[0]).toMatchObject({ playerId: 'w1', value: 2, valueLabel: '2', detail: '1 start' });
    expect(postYards(c)[0]).toMatchObject({ playerId: 'q1', value: 150, valueLabel: '150' });
    expect(postReceptions(c).map((r) => [r.playerId, r.value])).toEqual([['w1', 8], ['r1', 2]]);
  });
});

describe('extras', () => {
  it('boom starts count started lines of 30 or more', () => {
    expect(boomStarts(ctx)[0]).toMatchObject({ playerId: 'q1', value: 3, valueLabel: '3', detail: '5 starts' }); // 40, 35, 31
    expect(boomStarts(ctx)).toHaveLength(1);
  });
  it('dud starts count played starts under 5 and ignore unplayed weeks', () => {
    // w1 4 (2025 wk3) is a played start under 5. t1 0 (2025 wk1) is unplayed and excluded. t1 3 was benched.
    expect(dudStarts(ctx)).toEqual([expect.objectContaining({ playerId: 'w1', value: 1 })]);
  });
  it('journeyman counts distinct managers who started the player', () => {
    const rows = journeyman(ctx);
    expect(rows.find((r) => r.playerId === 'q1')).toMatchObject({ value: 2, valueLabel: '2', detail: '5 starts' }); // a in 2024, b in 2025
    expect(rows.find((r) => r.playerId === 'w1')).toMatchObject({ value: 2 }); // b in 2024, a in 2025
    expect(rows.find((r) => r.playerId === 't1')).toMatchObject({ value: 1 }); // only b
    // q1, r1 and w1 all tie at 2; r1 and w1 share the newest start (2025 wk 3) so playerId breaks it, then q1 (newest 2025 wk 2)
    expect(rows.slice(0, 3).map((r) => r.playerId)).toEqual(['r1', 'w1', 'q1']);
  });
});

describe('league leaders', () => {
  it('use the current season only, started or benched, with the latest manager', () => {
    // 2025: q1 35 + 18 (b) + 50 benched (b) = 103 ; r1 9 + 11 (a) + 22 (b) = 42 ; w1 4 (a) ; t1 0
    expect(leadPoints(ctx).slice(0, 2)).toEqual([
      expect.objectContaining({ playerId: 'q1', value: 103, valueLabel: '103.00', userId: 'b', meta: '2025' }),
      expect.objectContaining({ playerId: 'r1', value: 42, userId: 'b' }),
    ]);
    expect(leadYards(ctx)).toEqual([]); // fixture lines carry no yardage in 2025
    expect(leadTouchdowns(ctx)).toEqual([]);
  });
  it('return nothing when the current season has no lines', () => {
    expect(leadPoints({ ...ctx, currentYear: 2026 })).toEqual([]);
  });
});

describe('BOARDS registry sections', () => {
  it('lists postseason, extras and leaders in order', () => {
    const ids = (s: string) => BOARDS.filter((b) => b.section === s).map((b) => b.id);
    expect(ids('postseason')).toEqual(['postPoints', 'postStarts', 'postTouchdowns', 'postYards', 'postReceptions']);
    expect(ids('extras')).toEqual(['boomStarts', 'dudStarts', 'journeyman']);
    expect(ids('leaders')).toEqual(['leadPoints', 'leadYards', 'leadTouchdowns']);
  });
});
