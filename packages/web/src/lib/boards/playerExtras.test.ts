import { describe, it, expect } from 'vitest';
import { flattenLines } from '../playerLines';
import { emptyManagerCtx, game, line, players, season, side, week } from '../../test/playerFixtures';
import { BOARDS, boardsFor, championsOf, lastPlacesOf, type BoardContext } from '../playerBoards';
import { bestStartInLoss, worstStartInWin, topScorerWeeks } from './playerMoments';
import { drought, posTopRun, run15, run20 } from './playerStreaks';

// a beats b in weeks 1-2 and loses week 3; q1 (a) tops the league in weeks 1 and 2, t1 (b) in week 3. r1 duds in week 2 (played) and sits out week 3 (no stats).
const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 50, [line('q1', 30), line('r1', 20)]), side('b', 25, [line('w1', 15), line('t1', 10)]))]),
    week(2, [game(2024, 2, 1, side('a', 24, [line('q1', 22), line('r1', 2)]), side('b', 21, [line('w1', 16), line('t1', 5)]))]),
    week(3, [game(2024, 3, 1, side('a', 20, [line('q1', 20), line('r1', 0, {})]), side('b', 45, [line('w1', 14), line('t1', 31)]))]),
  ]),
];
const ctx: BoardContext = { lines: flattenLines(seasons, players), players, champions: championsOf(seasons), lastPlaces: lastPlacesOf(seasons), year: null, currentYear: 2024, pos: 'All', picks: [], xfp: null, transactions: [], playerSeasons: {}, drafts: {}, ...emptyManagerCtx };

describe('player moments', () => {
  it('bestStartInLoss ranks starters on the losing side', () => {
    expect(bestStartInLoss(ctx).slice(0, 2).map((r) => [r.playerId, r.value, r.meta])).toEqual([['q1', 20, '2024 · Wk 3'], ['w1', 16, '2024 · Wk 2']]);
  });
  it('worstStartInWin ranks played skill starters on the winning side, lowest first', () => {
    expect(worstStartInWin(ctx)[0]).toMatchObject({ playerId: 'r1', value: 2, meta: '2024 · Wk 2' });
    expect(worstStartInWin(ctx).some((r) => r.value === 0)).toBe(false); // the unplayed week-3 line is out
  });
  it('topScorerWeeks counts weeks as the league\'s top starter, ties shared', () => {
    const rows = topScorerWeeks(ctx);
    expect(rows.map((r) => [r.playerId, r.value, r.detail])).toEqual([['q1', 2, 'best 30.00 · 2024 · Wk 1'], ['t1', 1, 'best 31.00 · 2024 · Wk 3']]);
    expect(topScorerWeeks({ ...ctx, lines: ctx.lines.filter((l) => l.position === 'WR') })[0]).toMatchObject({ playerId: 'w1', value: 3 }); // within a position filter, top at that position
  });
});

describe('player streaks', () => {
  it('run15 and run20 count consecutive qualifying starts with their span', () => {
    expect(run15(ctx)[0]).toMatchObject({ playerId: 'q1', value: 3, meta: '2024 Wk 1 – 2024 Wk 3', userId: 'a' });
    expect(run20(ctx).find((r) => r.playerId === 'w1')).toBeUndefined();
    expect(run20(ctx)[0]).toMatchObject({ playerId: 'q1', value: 3 });
  });
  it('drought counts consecutive played starts under 5 and skips unplayed weeks', () => {
    expect(drought(ctx)[0]).toMatchObject({ playerId: 'r1', value: 1, meta: '2024 Wk 2 – 2024 Wk 2' });
  });
  it('posTopRun counts consecutive league weeks as the top started scorer at the position', () => {
    const rows = posTopRun(ctx);
    expect(rows.find((r) => r.playerId === 'w1')).toMatchObject({ value: 3, meta: '2024 Wk 1 – 2024 Wk 3', detail: 'active', userId: 'b', managers: [{ userId: 'b', weeks: 3 }] });
    expect(rows.find((r) => r.playerId === 'r1')).toMatchObject({ value: 2 }); // the only started RB each week; week 3 has no stat from any SF player, so it is an inferred bye and skipped
  });
  it('posTopRun widens to the top 3, 5 or 10 at the position in its modes, ties sharing a rank', () => {
    const rb = (id: string) => ({ id, name: id, firstName: id, lastName: id, position: 'RB', team: 'SF', yearsExp: 1 });
    const four = { ...players, r2: rb('r2'), r3: rb('r3'), r4: rb('r4') };
    const rbs = season(2024, [
      week(1, [game(2024, 1, 1, side('a', 35, [line('r1', 20), line('r2', 15)]), side('b', 20, [line('r3', 10), line('r4', 10)]))]),
      week(2, [game(2024, 2, 1, side('a', 17, [line('r1', 2), line('r2', 15)]), side('b', 30, [line('r3', 10), line('r4', 20)]))]),
      week(3, [game(2024, 3, 1, side('a', 29, [line('r1', 14), line('r2', 15)]), side('b', 11, [line('r3', 10), line('r4', 1)]))]),
    ]);
    const c = { ...ctx, players: four, lines: flattenLines([rbs], four) };
    const by = (rows: ReturnType<typeof posTopRun>) => Object.fromEntries(rows.map((r) => [r.playerId, r.value]));
    expect(by(posTopRun(c))).toEqual({ r1: 1, r2: 1, r4: 1 });
    expect(by(posTopRun(c, 'desc', '1'))).toEqual({ r1: 1, r2: 1, r4: 1 });
    expect(by(posTopRun(c, 'desc', '3'))).toEqual({ r1: 1, r2: 3, r3: 3, r4: 2 }); // r3 and r4 tie for third in week 1
    expect(by(posTopRun(c, 'desc', '5'))).toEqual({ r1: 3, r2: 3, r3: 3, r4: 3 });
    const def = BOARDS.find((b) => b.id === 'posTopRun')!;
    expect(def.modes!.map((m) => [m.id, m.label])).toEqual([['1', 'Top scorer'], ['3', 'Top 3'], ['5', 'Top 5'], ['10', 'Top 10']]);
    expect(def.modeSelect).toBe(true);
  });

  it('run15 and posTopRun skip a player\'s bye week instead of breaking on it', () => {
    // q1 (KC) is started on his bye in week 2 with no stats; t1 (KC) is benched on it. Nobody else is a QB or TE.
    const byeSeason = season(2024, [
      week(1, [game(2024, 1, 1, side('a', 50, [line('q1', 30), line('t1', 10)]), side('b', 25, [line('w1', 15)]))]),
      week(2, [game(2024, 2, 1, side('a', 0, [line('q1', 0, {})], [line('t1', 0, {})]), side('b', 21, [line('w1', 16)]))]),
      week(3, [game(2024, 3, 1, side('a', 32, [line('q1', 22), line('t1', 10)]), side('b', 45, [line('w1', 14)]))]),
    ]);
    const c = { ...ctx, lines: flattenLines([byeSeason], players) };
    expect(run15(c).find((r) => r.playerId === 'q1')).toMatchObject({ value: 2, meta: '2024 Wk 1 – 2024 Wk 3' });
    expect(posTopRun(c).find((r) => r.playerId === 'q1')).toMatchObject({ value: 2, meta: '2024 Wk 1 – 2024 Wk 3' });
    expect(posTopRun(c).find((r) => r.playerId === 't1')).toMatchObject({ value: 2, meta: '2024 Wk 1 – 2024 Wk 3' }); // benched on the bye: skipped, not broken
  });

  it('is registered under the right sub-tabs', () => {
    expect(boardsFor('players', 'moments').map((b) => b.id)).toEqual(['bestWeek', 'benchBlunder', 'breakout', 'fallOff', 'bestStartInLoss', 'worstStartInWin']);
    expect(boardsFor('players', 'streaks').map((b) => b.id)).toEqual(['ironman', 'run15', 'run20', 'drought', 'posTopRun']);
    expect(boardsFor('players', 'alltime').at(-1)!.id).toBe('topScorerWeeks');
    expect(BOARDS.find((b) => b.id === 'worstStartInWin')!.definition).toMatch(/won/);
  });
});
