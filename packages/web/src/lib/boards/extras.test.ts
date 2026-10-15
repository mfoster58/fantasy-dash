import { describe, it, expect } from 'vitest';
import { flattenLines } from '../playerLines';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import type { Draft, Season, Transaction } from '@fantasy-dash/core';
import { BOARDS, benchWarmers, championsOf, lastPlacesOf, loyalty, ironman, tradeBait, fodder, waiverHeroes, waiverVillains, draftValue, draftValuesOf, mrIrrelevant, breakout, fallOff, type BoardContext } from '../playerBoards';

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
    expect(BOARDS.filter((b) => b.section === 'extras').map((b) => b.id)).toEqual(['boomStarts', 'dudStarts', 'benchBlunder', 'benchWarmers', 'journeyman', 'loyalty', 'ironman', 'fodder', 'tradeBait', 'waiverHeroes', 'waiverVillains', 'draftValue', 'mrIrrelevant', 'breakout', 'fallOff']);
    expect(BOARDS.filter((b) => b.section === 'career').map((b) => b.id)).toEqual(['bestWeek', 'bestSeason', 'careerPoints', 'weeksStarted']);
  });
});

const t = (over: Partial<Transaction>): Transaction => ({ id: 'x', type: 'trade', week: 1, created: 1, adds: [], drops: [], bid: null, ...over });
const txCtx: BoardContext = { ...ctx, transactions: [
  { year: 2024, transactions: [
    t({ id: 'a', adds: [{ playerId: 'q1', userId: 'b' }, { playerId: 'r1', userId: 'a' }], drops: [{ playerId: 'q1', userId: 'a' }, { playerId: 'r1', userId: 'b' }] }),
    t({ id: 'b', created: 2, type: 'free_agent', drops: [{ playerId: 'w1', userId: 'a' }] }),
    t({ id: 'c', created: 3, type: 'waiver', week: 2, adds: [{ playerId: 'w1', userId: 'b' }], bid: 30 }),
  ] },
  { year: 2025, transactions: [
    t({ id: 'd', adds: [{ playerId: 'q1', userId: 'a' }], drops: [{ playerId: 'q1', userId: 'b' }] }),
    t({ id: 'e', created: 2, type: 'waiver', week: 1, adds: [{ playerId: 'q1', userId: 'b' }], drops: [{ playerId: 'w1', userId: 'b' }], bid: 9 }),
    t({ id: 'f', created: 3, type: 'commissioner', drops: [{ playerId: 'w1', userId: 'a' }] }),
  ] },
] };

describe('trade bait and fodder', () => {
  it('count trades moving the player and drops of the player', () => {
    expect(tradeBait(txCtx).map((r) => [r.playerId, r.value, r.meta, r.detail])).toEqual([['q1', 2, '2 seasons', '2 managers'], ['r1', 1, '1 season', '1 manager']]);
    // drops: w1 by a (2024 free agent), by b and by a (2025) = 3 ; q1 in both trades = 2 ; r1 in the 2024 trade = 1
    expect(fodder(txCtx).map((r) => [r.playerId, r.value, r.detail])).toEqual([['w1', 3, 'picked up 1 time'], ['q1', 2, 'picked up 1 time'], ['r1', 1, 'picked up 0 times']]);
    expect(tradeBait({ ...txCtx, year: 2025 }).map((r) => [r.playerId, r.value, r.meta])).toEqual([['q1', 1, '2025']]);
  });
});

describe('waiver heroes and villains', () => {
  // w1 claimed by b for $30 in 2024 wk2: b started w1 in 2024 wk1 only (before the claim) → 0 starts.
  // q1 claimed by b for $9 in 2025 wk1: b started q1 wk1 35, wk2 18; benched wk3 → 53 pts, 2 starts.
  it('heroes rank started points per claim; villains rank dollars per point for claims of $10 or more', () => {
    expect(waiverHeroes(txCtx).map((r) => [r.playerId, r.value, r.meta, r.detail, r.userId])).toEqual([['q1', 53, '2025 · Wk 1', '$9 · 2 starts', 'b'], ['w1', 0, '2024 · Wk 2', '$30 · 0 starts', 'b']]);
    expect(waiverVillains(txCtx).map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['w1', 30, '$30.0/pt', '$30 · 0.00 pts · 0 starts']]);
  });
});

const pick = (over: Partial<Draft['picks'][number]>): Draft['picks'][number] => ({
  round: 1, pickNo: 1, slot: 1, userId: 'a', playerId: 'q1', isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null,
  healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null, tradedTo: null, ...over,
});
const withDraft = (year: number, picks: Draft['picks']): Season => ({ ...season(year, []), draft: { draftId: 'd', type: 'snake', rounds: 2, slotOrder: [], expectedCurve: null, baselines: {}, picks } });
const drafts = [
  withDraft(2024, [pick({ playerId: 'q1', value: 38.2 }), pick({ pickNo: 2, playerId: 'r1', value: -5, round: 1 }), pick({ pickNo: 3, playerId: 'k1', value: null, round: 2 }), pick({ pickNo: 4, playerId: 'KC', value: null, round: 2, userId: 'b' })]),
  withDraft(2025, [pick({ playerId: 'q1', value: -12 }), pick({ pickNo: 2, playerId: 'r1', value: 20.5 }), pick({ pickNo: 5, round: 2, playerId: 'w1', value: 1, userId: 'b' })]),
];
const dCtx: BoardContext = { ...ctx, picks: draftValuesOf(drafts), drafts: { 2024: drafts[0].draft, 2025: drafts[1].draft },
  playerSeasons: {
    2024: { q1: { points: 300, games: 17, posRank: 2 }, r1: { points: 100, games: 12, posRank: 20 }, w1: { points: 50, games: 10, posRank: 60 }, t1: { points: 90, games: 9, posRank: 8 } },
    2025: { q1: { points: 200, games: 10, posRank: 9 }, r1: { points: 250, games: 15, posRank: 3 }, w1: { points: 40, games: 4, posRank: 70 }, t1: { points: 150, games: 16, posRank: 2 } },
  } };

describe('draft value by season', () => {
  it('shows the chosen season, or each player\'s best season under All-time, with the slot and a tone', () => {
    expect(draftValue({ ...dCtx, year: 2025 }).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail, r.tone ?? null])).toEqual([
      ['r1', 20.5, '+20.5', '2025', 'Rd 1, pick 2', 'win'], ['w1', 1, '+1.0', '2025', 'Rd 2, pick 5', 'win'], ['q1', -12, '-12.0', '2025', 'Rd 1, pick 1', 'loss'],
    ]);
    expect(draftValue(dCtx).map((r) => [r.playerId, r.value, r.meta])).toEqual([['q1', 38.2, '2024'], ['r1', 20.5, '2025'], ['w1', 1, '2025']]);
    expect(draftValue(dCtx, 'asc').map((r) => r.playerId)).toEqual(['w1', 'r1', 'q1']);
    expect(draftValue({ ...dCtx, pos: 'K' })).toEqual([]);
  });
});

describe('Mr. Irrelevant', () => {
  it('takes the last positional pick of each draft with that season\'s finish', () => {
    // 2024: last pick overall is KC (DEF) → last positional pick is r1 (pick 2). 2025: w1 (pick 5).
    expect(mrIrrelevant(dCtx).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail, r.userId])).toEqual([
      ['r1', 100, '100.00', '2024', 'RB20 · 8.3 ppg · Rd 1, pick 2', 'a'],
      ['w1', 40, '40.00', '2025', 'WR70 · 10.0 ppg · Rd 2, pick 5', 'b'],
    ]);
    expect(mrIrrelevant({ ...dCtx, year: 2025 }).map((r) => r.playerId)).toEqual(['w1']);
  });
  it('last pick with no games shows zero and a dash', () => {
    const c = { ...dCtx, playerSeasons: { 2024: {}, 2025: {} } };
    expect(mrIrrelevant({ ...c, year: 2024 })[0]).toMatchObject({ playerId: 'r1', value: 0, valueLabel: '0.00', detail: '— · Rd 1, pick 2' });
  });
});

describe('breakout and fall-off', () => {
  it('compare consecutive seasons with ten games in both, ranked by PPG change', () => {
    // q1 17.65 → 20.0 (+2.4) ; r1 8.33 → 16.67 (+8.3) ; w1 only 4 games in 2025 ; t1 only 9 games in 2024
    expect(breakout(dCtx).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail])).toEqual([
      ['r1', 8.3, '+8.3', '2024 → 2025', 'RB20 · 8.3 ppg → RB3 · 16.7 ppg · 250.00 pts'],
      ['q1', 2.4, '+2.4', '2024 → 2025', 'QB2 · 17.6 ppg → QB9 · 20.0 ppg · 200.00 pts'],
    ]);
    expect(fallOff(dCtx)).toEqual([]);
    const fall = { ...dCtx, playerSeasons: { ...dCtx.playerSeasons, 2025: { ...dCtx.playerSeasons[2025], q1: { points: 100, games: 10, posRank: 9 } } } };
    expect(fallOff(fall).map((r) => [r.playerId, r.value, r.tone])).toEqual([['q1', -7.6, 'loss']]);
    expect(breakout({ ...dCtx, year: 2024 })).toEqual([]); // first season has no pair
  });
});
