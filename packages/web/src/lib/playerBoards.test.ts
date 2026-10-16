import { describe, it, expect } from 'vitest';
import { flattenLines } from './playerLines';
import { emptyManagerCtx, game, line, players, season, side, week } from '../test/playerFixtures';
import {
  BOARDS, bestSeason, bestWeek, benchBlunder, careerPoints, championshipRosters, championsOf, weeksStarted,
  boomStarts, dudStarts, journeyman, leadPoints, leadTouchdowns, leadYards, postPoints, postReceptions, postStarts, postTouchdowns, postYards,
  draftValue, leadFpoe, leadPassTd, leadPassYards, leadRecTd, leadRecYards, leadRushTd, leadRushYards, leadXfp, postToiletBowl,
  lastPlaceRosters, lastPlacesOf, leadTouches, minGames, bestPlayoffStarts, worstToiletStarts, draftValuesOf, boardsFor,
  type BoardContext,
} from './playerBoards';
import { subTabsOf } from './boards/tabs';
import type { XfpModel } from './xfp';

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
const ctx: BoardContext = { lines: flattenLines(seasons, players), players, champions: championsOf(seasons), lastPlaces: lastPlacesOf(seasons), year: null, currentYear: 2025, pos: 'All', picks: [], xfp: null, transactions: [], playerSeasons: {}, drafts: {}, ...emptyManagerCtx };

describe('championsOf and lastPlacesOf', () => {
  it('map year to champion and to last place', () => {
    expect(championsOf(seasons)).toEqual({ 2024: 'a', 2025: 'b' });
    expect(lastPlacesOf(seasons)).toEqual({ 2024: null, 2025: null });
    expect(lastPlacesOf([{ ...s2024, honors: { ...s2024.honors, lastPlace: 'b' } }])).toEqual({ 2024: 'b' });
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
  it('aggregates across seasons and managers with a seasons count instead of a years list', () => {
    const pts = careerPoints(ctx);
    expect(pts[0]).toMatchObject({ playerId: 'q1', value: 149, valueLabel: '149.00', meta: '2 seasons', detail: '5 starts', userId: null, to: null });
    expect(pts[1]).toMatchObject({ playerId: 'r1', value: 81 });
    const wk = weeksStarted(ctx);
    expect(wk[0]).toMatchObject({ playerId: 'r1', value: 6, valueLabel: '6', meta: '2 seasons' });
    expect(wk[1]).toMatchObject({ playerId: 'q1', value: 5 });
    expect(wk.find((r) => r.playerId === 'w1')).toMatchObject({ meta: '2 seasons' });
    expect(weeksStarted({ ...ctx, lines: ctx.lines.filter((l) => l.year === 2025) })[0]).toMatchObject({ meta: '1 season' });
  });
  it('switches to points per start with a minimum of starts in ppg mode', () => {
    expect(careerPoints(ctx, 'desc', 'ppg')).toEqual([]); // nobody has 12 starts in the fixture
    const many = Array.from({ length: 12 }, (_, i) => week(i + 1, [game(2023, i + 1, 1, side('a', 10, [line('r1', 10)]), side('b', 1, [line('t1', 0, {})]))]));
    const big = { ...ctx, lines: flattenLines([season(2023, many), ...seasons], players) };
    const rows = careerPoints(big, 'desc', 'ppg');
    // r1: 12 × 10 in 2023 + 20, 12, 7, 9, 11, 22 = 201 over 18 played starts
    expect(rows.find((r) => r.playerId === 'r1')).toMatchObject({ value: 11.17, valueLabel: '11.2', detail: '18 games', meta: '3 seasons' });
    // t1: 12 unplayed starts in 2023 and an unplayed 2025 start do not count; only 1 played start → below the minimum
    expect(rows.find((r) => r.playerId === 't1')).toBeUndefined();
  });
});

describe('championshipRosters', () => {
  it('counts seasons on the champion roster in the final, bench included, breaking ties by postseason points on that roster', () => {
    const rows = championshipRosters(ctx);
    // 2024 final: a (champion) started q1 31, benched t1 3. 2025 final: b (champion) started r1 22, benched q1 50.
    expect(rows.map((r) => [r.playerId, r.value, r.meta, r.detail])).toEqual([['q1', 2, '2024, 2025', '81.00 pts'], ['r1', 1, '2025', '22.00 pts'], ['t1', 1, '2024', '3.00 pts']]);
  });
  it('ties on seasons fall to points even when the lower scorer is newer', () => {
    // make t1 the newer one-season player with fewer points: swap the 2025 champion to a, whose final roster is w1 (4)
    const c = { ...ctx, champions: { 2024: 'a', 2025: 'a' } };
    // 2024 a: q1 31, t1 3 ; 2025 a: w1 4 → q1 (31) first, then t1 (3, 2024) before w1 (4, 2025)? No: points decide: w1 4 > t1 3
    expect(championshipRosters(c).map((r) => [r.playerId, r.value, r.detail])).toEqual([['q1', 1, '31.00 pts'], ['w1', 1, '4.00 pts'], ['t1', 1, '3.00 pts']]);
  });
});

describe('benchBlunder', () => {
  it('ranks benched lines by points with the manager and game', () => {
    const rows = benchBlunder(ctx);
    expect(rows[0]).toMatchObject({ playerId: 'q1', value: 50, meta: '2025 · Wk 3 · Championship', userId: 'b', to: '/scores/2025/3/1' });
    expect(rows[1]).toMatchObject({ playerId: 'w1', value: 44, userId: 'a' });
  });
});

describe('postseason boards', () => {
  // Finals: 2024 wk3 a: q1 31 (bench t1 3) vs b: r1 7 ; 2025 wk3 b: r1 22 (bench q1 50) vs a: w1 4. Toilet bowls never appear here.
  it('count only started lines in championship-bracket games and keep the years list', () => {
    expect(postPoints(ctx).slice(0, 2)).toEqual([
      expect.objectContaining({ playerId: 'q1', value: 31, valueLabel: '31.00', meta: '2024', detail: '1 start' }),
      expect.objectContaining({ playerId: 'r1', value: 29, meta: '2024, 2025', detail: '2 starts' }),
    ]);
    expect(postStarts(ctx)[0]).toMatchObject({ playerId: 'r1', value: 2, valueLabel: '2', detail: '29.00 pts' });
  });
  it('postseason points average per start in ppg mode with a minimum of starts', () => {
    expect(postPoints(ctx, 'desc', 'ppg')).toEqual([]); // nobody has 3 postseason starts
    const extra = season(2023, [week(3, [game(2023, 3, 1, side('a', 10, [line('r1', 10)]), side('b', 1, [line('t1', 1)]), 'SF')], true)]);
    const c = { ...ctx, lines: flattenLines([extra, ...seasons], players) };
    expect(postPoints(c, 'desc', 'ppg')).toEqual([expect.objectContaining({ playerId: 'r1', value: 13, valueLabel: '13.0', detail: '3 games', meta: '2023, 2024, 2025' })]);
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

const c25: BoardContext = { ...ctx, year: 2025, lines: ctx.lines.filter((l) => l.year === 2025) };

describe('league leaders', () => {
  it('use the lines they are given, started or benched, with the latest manager', () => {
    // 2025: q1 35 + 18 (b) + 50 benched (b) = 103 ; r1 9 + 11 (a) + 22 (b) = 42 ; w1 4 (a) ; t1 0
    expect(leadPoints(c25).slice(0, 2)).toEqual([
      expect.objectContaining({ playerId: 'q1', value: 103, valueLabel: '103.00', userId: 'b', meta: '2025' }),
      expect.objectContaining({ playerId: 'r1', value: 42, userId: 'b' }),
    ]);
    expect(leadYards(c25)).toEqual([]); // fixture lines carry no yardage in 2025
    expect(leadTouchdowns(c25)).toEqual([]);
  });
  it('points switch to per played game in ppg mode, three games minimum', () => {
    const rows = leadPoints(c25, 'desc', 'ppg');
    expect(rows.map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 34.33, '34.3', '3 games'], ['r1', 14, '14.0', '3 games']]);
  });
  it('return nothing when the chosen season has no lines', () => {
    expect(leadPoints({ ...ctx, year: 2026, lines: [] })).toEqual([]);
  });
});

describe('leaders splits', () => {
  const split = season(2025, [
    week(1, [game(2025, 1, 1,
      side('a', 50, [line('q1', 30, { pass_yd: 300, pass_td: 3, rush_yd: 12, rush_td: 1 }), line('r1', 20, { rush_yd: 90, rush_td: 1, rec_yd: 15, rec: 2, rec_td: 0 })]),
      side('b', 15, [line('w1', 15, { rec_yd: 110, rec_td: 1, rec: 7 }), line('k1', 9, { fgm: 3 })]))]),
  ]);
  const c = { ...ctx, year: 2025, lines: flattenLines([split], players) };
  it('rank rushing, receiving and passing yards and touchdowns separately', () => {
    expect(leadRushYards(c).map((r) => [r.playerId, r.value])).toEqual([['r1', 90], ['q1', 12]]);
    expect(leadRecYards(c).map((r) => [r.playerId, r.value])).toEqual([['w1', 110], ['r1', 15]]);
    expect(leadPassYards(c).map((r) => [r.playerId, r.value])).toEqual([['q1', 300]]);
    expect(leadRushTd(c).map((r) => [r.playerId, r.value])).toEqual([['q1', 1], ['r1', 1]]); // tie in the same week → playerId asc
    expect(leadRecTd(c).map((r) => [r.playerId, r.value])).toEqual([['w1', 1]]);
    expect(leadPassTd(c).map((r) => [r.playerId, r.value])).toEqual([['q1', 3]]);
  });
  it('yards boards show the stat totals underneath', () => {
    expect(leadYards(c).map((r) => [r.playerId, r.value, r.detail])).toEqual([['q1', 312, '300 pass · 12 rush'], ['w1', 110, '110 rec'], ['r1', 105, '90 rush · 15 rec']]);
    // volume stats missing from the fixture lines: zero parts drop rather than print "0 car"
    expect(leadRushYards(c)[0]).toMatchObject({ playerId: 'r1', detail: null });
    expect(leadRecYards(c)[0]).toMatchObject({ playerId: 'w1', detail: '7 rec' });
    expect(leadPassYards(c)[0]).toMatchObject({ playerId: 'q1', detail: null });
  });
  it('touches add receptions and carries, with a mode for each, and show targets underneath', () => {
    const vol = season(2025, [
      week(1, [game(2025, 1, 1,
        side('a', 50, [line('r1', 20, { rush_att: 18, rec: 3, rec_tgt: 4 }), line('w1', 15, { rec: 7, rec_tgt: 11 })]),
        side('b', 15, [line('q1', 30, { pass_att: 30 }), line('t1', 5, { rec: 2, rec_tgt: 2, rush_att: 1 })]))]),
      week(2, [game(2025, 2, 1, side('a', 10, [line('r1', 10, { rush_att: 12, rec_tgt: 1 })]), side('b', 1, [line('w1', 1, { rec_tgt: 3 })]))]),
    ]);
    const v = { ...ctx, year: 2025, lines: flattenLines([vol], players) };
    expect(leadTouches(v).map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([
      ['r1', 33, '33', '3 rec · 30 car · 5 tgt'], ['w1', 7, '7', '7 rec · 14 tgt'], ['t1', 3, '3', '2 rec · 1 car · 2 tgt'],
    ]);
    expect(leadTouches(v, 'desc', 'rec').map((r) => [r.playerId, r.value])).toEqual([['w1', 7], ['r1', 3], ['t1', 2]]);
    expect(leadTouches(v, 'desc', 'car').map((r) => [r.playerId, r.value])).toEqual([['r1', 30], ['t1', 1]]);
  });
});

describe('leaders FPOE and xFP', () => {
  // 2025 lines: q1 35 (wk1), 18 (wk2), 50 bench (wk3) all played; t1 wk1 unplayed; r1 9, 11, 22; w1 4.
  const flat: XfpModel = { coef: {}, predict: (l) => (l.position === 'QB' ? 30 : l.position === 'RB' ? 10 : null) };
  const c = { ...c25, xfp: flat };
  it('FPOE is actual minus predicted over modelled lines, sortable both ways', () => {
    // q1: (35-30)+(18-30)+(50-30) = 13 ; r1: (9-10)+(11-10)+(22-10) = 12 ; w1 has 1 line (<3) → out ; t1 TE → no model
    expect(leadFpoe(c).map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 13, '+13.0', 'xFP 90.0'], ['r1', 12, '+12.0', 'xFP 30.0']]);
    expect(leadFpoe(c, 'asc').map((r) => r.playerId)).toEqual(['r1', 'q1']);
  });
  it('xFP sums predictions', () => {
    expect(leadXfp(c).map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 90, '90.0', 'actual 103.0'], ['r1', 30, '30.0', 'actual 42.0']]);
  });
  it('FPOE and xFP are empty without a model, or when the filter leaves only unmodelled players', () => {
    expect(leadFpoe(c25)).toEqual([]);
    expect(leadXfp(c25)).toEqual([]);
    const kOnly = { ...c, lines: c.lines.filter((l) => l.position === 'K') };
    expect(leadFpoe(kOnly, 'asc')).toEqual([]);
  });
});

describe('toilet bowl and exclusions', () => {
  const cons = season(2023, [
    week(3, [game(2023, 3, 1, side('a', 20, [line('q1', 20)]), side('b', 10, [line('KC', 10)]), 'Cons-R1')], true),
    week(4, [game(2023, 4, 1, side('a', 5, [line('q1', 5)]), side('b', 1, [line('k1', 1)]), 'Toilet Bowl')], true),
    week(4, [game(2023, 4, 2, side('c', 7, [line('r1', 7)]), side('d', 2, [line('w1', 2)]), 'Cons-7th')], true),
  ]);
  const c = { ...ctx, lines: flattenLines([cons, ...seasons], players) };
  it('toilet bowl starts count round 1 and the Toilet Bowl, not the seventh-place game', () => {
    // ties at 1 break by newest week (wk 4 before wk 3), then playerId asc; r1 and w1 only played the 7th-place game
    expect(postToiletBowl(c).map((r) => [r.playerId, r.value, r.detail])).toEqual([['q1', 2, '25.00 pts'], ['k1', 1, '1.00 pts'], ['KC', 1, '10.00 pts']]);
    expect(postPoints(c).some((r) => r.playerId === 'KC')).toBe(false);
  });
  it('last place rosters count seasons on the last-place roster in the toilet bowl, bench included', () => {
    const bowl2 = season(2024, [week(4, [game(2024, 4, 1, side('b', 3, [line('k1', 3)], [line('q1', 0, {})]), side('a', 9, [line('r1', 9)]), 'Toilet Bowl')], true)]);
    const lp = { ...c, lines: flattenLines([cons, bowl2, ...seasons], players), lastPlaces: { 2023: 'b', 2024: 'b', 2025: null } };
    expect(lastPlaceRosters(lp).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail])).toEqual([['k1', 2, '2', '2023, 2024', '4.00 pts'], ['q1', 1, '1', '2024', '0.00 pts']]);
    expect(lastPlaceRosters({ ...lp, lastPlaces: {} })).toEqual([]);
  });
  it('dud starts and journeyman drop kickers and defenses', () => {
    expect(dudStarts(c).some((r) => r.playerId === 'KC' || r.playerId === 'k1')).toBe(false);
    expect(journeyman(c).some((r) => r.playerId === 'KC' || r.playerId === 'k1')).toBe(false);
    expect(dudStarts(c).find((r) => r.playerId === 'w1')).toMatchObject({ value: 2 }); // 2 (2023 wk4) and 4 (2025 wk3)
  });
});

describe('BOARDS registry by tab and sub-tab', () => {
  const ids = (tab: 'players' | 'managers', sub: string) => boardsFor(tab, sub).map((b) => b.id);
  it('lays every player board under its sub-tab in display order', () => {
    expect(ids('players', 'leaders')).toEqual(['leadPoints', 'leadYards', 'leadTouchdowns', 'leadRushYards', 'leadRecYards', 'leadPassYards', 'leadRushTd', 'leadRecTd', 'leadPassTd', 'leadTouches', 'leadFpoe', 'leadXfp']);
    expect(ids('players', 'alltime')).toEqual(['careerPoints', 'weeksStarted', 'bestSeason', 'championshipRosters', 'lastPlaceRosters', 'loyalty', 'journeyman', 'benchWarmers', 'fodder', 'boomStarts', 'dudStarts', 'waiverHeroes', 'waiverVillains', 'draftValue', 'mrIrrelevant', 'topScorerWeeks']);
    expect(ids('players', 'moments')).toEqual(['bestWeek', 'benchBlunder', 'breakout', 'fallOff', 'bestStartInLoss', 'worstStartInWin']);
    expect(ids('players', 'streaks')).toEqual(['ironman', 'run15', 'run20', 'drought', 'posTopRun']);
    expect(ids('players', 'postseason')).toEqual(['postPoints', 'postStarts', 'postTouchdowns', 'postYards', 'postReceptions', 'bestPlayoffStarts', 'postChampionshipRosters', 'postToiletBowl', 'worstToiletStarts', 'postLastPlaceRosters']);
    expect(BOARDS.filter((b) => b.sortable).map((b) => b.id)).toEqual(['leadFpoe', 'draftValue']);
    for (const b of BOARDS) expect(b.definition.length).toBeGreaterThan(10);
    expect(ids('managers', 'malltime')).toEqual(['mCareerWins', 'mWinPct', 'mWorstWinPct', 'mCareerPoints', 'mCareerPpg', 'mPointsAgainst', 'mTitles', 'mFinals', 'mBerths', 'mPlayoffWins', 'mBerthsNoTitle', 'mLastPlaces', 'mSeasons', 'mEfficiency', 'mWorstEfficiency', 'mWeeklyHighs']);
    expect(ids('managers', 'mseasons')).toEqual(['msPoints', 'msFewest', 'msPpg', 'msAgainst', 'msRecord', 'msWorstRecord', 'msDiff', 'msAllPlay', 'msWorstAllPlay', 'msLucky', 'msUnlucky', 'msNoTitle', 'msEfficiency', 'msWorstEfficiency', 'msBench']);
    expect(ids('managers', 'mgames')).toEqual(['mgHigh', 'mgLow', 'mgLossHigh', 'mgWinLow', 'mgBlowout', 'mgClosest', 'mgCombinedHigh', 'mgCombinedLow', 'mgPerfect', 'mgBench']);
    expect(ids('managers', 'mstreaks')).toEqual(['mWinStreak', 'mLoseStreak', 'mPlayoffStreak', 'mDrought', 'mRun100', 'mHighRun']);
    expect(ids('managers', 'mplayoffs')).toEqual(['mpHigh', 'mpLow', 'mpBlowout', 'mpClosest', 'mpLowSeed', 'mpFinalsLost', 'mpToiletApps', 'mpToiletWins']);
    expect(ids('managers', 'mdraft')).toEqual(['mdBestClass', 'mdWorstClass', 'mdSteal', 'mdBust', 'mdLate', 'mdFirstRound']);
    expect(ids('managers', 'mtransactions')).toEqual(['mtAdds', 'mtDrops', 'mtTrades', 'mtBusiest', 'mtFaabSeason', 'mtFaabCareer', 'mtBiggestBid', 'mtCheap', 'mtCostly', 'mtBestPickup', 'mtQuickCut']);
  });
  it('points boards offer a Total/PPG mode and touches a Both/Rec/Car mode', () => {
    const modes = (id: string) => BOARDS.find((b) => b.id === id)!.modes?.map((m) => [m.id, m.label, m.valueHeader]);
    for (const id of ['leadPoints', 'careerPoints', 'postPoints']) expect(modes(id)).toEqual([['total', 'Total', 'Pts'], ['ppg', 'PPG', 'PPG']]);
    expect(modes('leadTouches')).toEqual([['both', 'Both', 'Touches'], ['rec', 'Rec', 'Rec'], ['car', 'Car', 'Car']]);
    expect(BOARDS.filter((b) => b.modes).map((b) => b.id)).toEqual(['leadPoints', 'leadYards', 'leadTouches', 'leadXfp', 'careerPoints', 'bestSeason', 'posTopRun', 'postPoints', 'bestPlayoffStarts', 'worstToiletStarts']);
  });
  it('names the sub-tabs of each tab in order', () => {
    expect(subTabsOf('players').map((s) => [s.id, s.title, s.picker, s.positions])).toEqual([
      ['alltime', 'All-time', 'all', true], ['moments', 'Moments', 'all', true], ['streaks', 'Streaks', null, true], ['postseason', 'Postseason', null, true], ['leaders', 'Leaders', 'current', true],
    ]);
    expect(subTabsOf('managers').map((s) => [s.id, s.title, s.picker, s.positions])).toEqual([
      ['malltime', 'All-time', null, false], ['mseasons', 'Seasons', 'all', false], ['mgames', 'Games', 'all', false], ['mstreaks', 'Streaks', null, false], ['mplayoffs', 'Playoffs', null, false], ['mdraft', 'Draft', 'all', false], ['mtransactions', 'Transactions', 'all', false],
    ]);
  });
});

describe('season-aware context', () => {
  it('leaders rank whatever lines they are given and label rows by the chosen year or by seasons', () => {
    const all = { ...ctx, year: null };
    // q1: 40+25+31 (2024, a) + 35+18+50 (2025, b) = 199 ; latest manager b
    expect(leadPoints(all)[0]).toMatchObject({ playerId: 'q1', value: 199, meta: '2 seasons', userId: 'b' });
    const one = { ...ctx, year: 2024, lines: ctx.lines.filter((l) => l.year === 2024) };
    expect(leadPoints(one)[0]).toMatchObject({ playerId: 'q1', value: 96, meta: '2024', userId: 'a' });
  });
  it('per-game minimum is 3 for a season and 12 for all-time', () => {
    expect(minGames({ ...ctx, year: 2025 })).toBe(3);
    expect(minGames({ ...ctx, year: null })).toBe(12);
    expect(leadPoints({ ...ctx, year: 2025, lines: ctx.lines.filter((l) => l.year === 2025) }, 'desc', 'ppg').map((r) => r.playerId)).toEqual(['q1', 'r1']);
    expect(leadPoints({ ...ctx, year: null }, 'desc', 'ppg')).toEqual([]);
    expect(careerPoints({ ...ctx, year: 2024, lines: ctx.lines.filter((l) => l.year === 2024) }, 'desc', 'ppg').map((r) => [r.playerId, r.value])).toEqual([['q1', 32], ['r1', 13]]);
  });
  it('draft values carry the slot', () => {
    const d = { ...season(2024, []), draft: { draftId: 'd', type: 'snake', rounds: 1, slotOrder: [], expectedCurve: null, baselines: {}, picks: [{
      round: 2, pickNo: 15, slot: 3, userId: 'a', playerId: 'q1', isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null,
      healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: 4.5, tradedTo: null }] } };
    expect(draftValuesOf([d])).toEqual([{ year: 2024, playerId: 'q1', value: 4.5, round: 2, pickNo: 15 }]);
  });
});

describe('per-game modes and tone', () => {
  const split = season(2025, [
    week(1, [game(2025, 1, 1, side('a', 50, [line('q1', 30, { pass_yd: 300 }), line('r1', 20, { rush_yd: 90, rush_att: 20, rec: 2 })]), side('b', 15, [line('w1', 15, { rec_yd: 110, rec: 7 })]))]),
    week(2, [game(2025, 2, 1, side('a', 20, [line('q1', 20, { pass_yd: 200 }), line('r1', 0, {})]), side('b', 5, [line('w1', 5, { rec_yd: 40, rec: 3 })]))]),
    week(3, [game(2025, 3, 1, side('a', 10, [line('q1', 10, { pass_yd: 100 })]), side('b', 5, [line('w1', 5, { rec_yd: 50, rec: 1 })]))]),
  ]);
  const c = { ...ctx, year: 2025, lines: flattenLines([split], players) };
  it('yards, touches and xFP read per played game with the minimum', () => {
    expect(leadYards(c, 'desc', 'pg').map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 200, '200.0', '600 pass'], ['w1', 66.7, '66.7', '200 rec']]); // r1: 1 played game < 3
    expect(leadTouches(c, 'desc', 'both', 'pg').map((r) => [r.playerId, r.value])).toEqual([['w1', 3.7]]); // 11 touches over 3 games; r1 only 1 played game
    expect(leadTouches(c, 'desc', 'rec', 'total').map((r) => [r.playerId, r.value])).toEqual([['w1', 11], ['r1', 2]]);
    const flat: XfpModel = { coef: {}, predict: (l) => (l.position === 'QB' ? 30 : null) };
    expect(leadXfp({ ...c, xfp: flat }, 'desc', 'pg').map((r) => [r.playerId, r.value, r.detail])).toEqual([['q1', 30, 'actual 20.0 per game']]);
  });
  it('best season reads PPG over played starts', () => {
    expect(bestSeason(c, 'desc', 'ppg').map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 20, '20.0', '3 games'], ['w1', 8.33, '8.3', '3 games']]);
  });
  it('FPOE and draft value carry a tone by sign', () => {
    const flat: XfpModel = { coef: {}, predict: (l) => (l.position === 'QB' ? 15 : l.position === 'WR' ? 10 : null) };
    const rows = leadFpoe({ ...c, xfp: flat });
    expect(rows.map((r) => [r.playerId, r.value, r.tone])).toEqual([['q1', 15, 'win'], ['w1', -5, 'loss']]);
    const picks = [{ year: 2025, playerId: 'q1', value: 3, round: 1, pickNo: 1 }, { year: 2025, playerId: 'r1', value: -2, round: 2, pickNo: 20 }, { year: 2025, playerId: 'w1', value: 0, round: 3, pickNo: 30 }];
    expect(draftValue({ ...c, picks }).map((r) => [r.playerId, r.tone ?? null])).toEqual([['q1', 'win'], ['w1', null], ['r1', 'loss']]);
    expect(draftValue({ ...c, picks }, 'asc').map((r) => r.playerId)).toEqual(['r1', 'w1', 'q1']);
  });
  it('registry: toggles and empty copy', () => {
    const def = (id: string) => BOARDS.find((b) => b.id === id)!;
    expect(def('leadYards').modes!.map((m) => [m.id, m.valueHeader])).toEqual([['total', 'Yds'], ['pg', 'Yds/G']]);
    expect(def('leadTouches').modes2!.map((m) => [m.id, m.valueHeader])).toEqual([['total', ''], ['pg', '/G']]);
    expect(def('leadXfp').modes!.map((m) => m.valueHeader)).toEqual(['xFP', 'xFP/G']);
    expect(def('bestSeason').modes!.map((m) => m.label)).toEqual(['Total', 'PPG']);
    expect(def('draftValue').sortable).toBe(true);
    expect(def('draftValue').directionLabels).toEqual(['+', '\u2212']);
    expect(def('leadPoints').empty!({ ...ctx, year: 2025 }, 'ppg')).toBe('No players with 3 games yet.');
    expect(def('leadPoints').empty!({ ...ctx, year: null }, 'ppg')).toBe('No players with 12 games yet.');
    expect(def('leadPoints').empty!(ctx, 'total')).toBeUndefined();
    expect(def('leadTouches').empty!({ ...ctx, year: 2025 }, 'both', 'pg')).toBe('No players with 3 games yet.');
    expect(def('careerPoints').empty!({ ...ctx, year: null }, 'ppg')).toBe('No players with 12 games yet.');
    expect(def('postPoints').empty!(ctx, 'ppg')).toBe('No players with 3 games yet.');
  });
});

describe('managers on aggregate rows', () => {
  it('list every manager by weeks rostered, newest first on ties, and name a lone manager as the row manager', () => {
    // q1 all-time: a 3 weeks (2024), b 3 weeks (2025, one benched) → tie, b newer
    expect(leadPoints({ ...ctx, year: null }).find((r) => r.playerId === 'q1')!.managers).toEqual([{ userId: 'b', weeks: 3 }, { userId: 'a', weeks: 3 }]);
    // r1 in 2025: a wk1, wk2; b wk3
    expect(leadPoints(c25).find((r) => r.playerId === 'r1')!.managers).toEqual([{ userId: 'a', weeks: 2 }, { userId: 'b', weeks: 1 }]);
    const pts = careerPoints(ctx);
    expect(pts.find((r) => r.playerId === 'q1')).toMatchObject({ userId: null, managers: [{ userId: 'a', weeks: 3 }, { userId: 'b', weeks: 2 }] });
    // t1 was only ever started by b, so the row names b
    expect(pts.find((r) => r.playerId === 't1')).toMatchObject({ userId: 'b', managers: [{ userId: 'b', weeks: 2 }] });
  });
});

describe('postseason moments', () => {
  const bracket = season(2023, [
    week(3, [game(2023, 3, 1, side('a', 20, [line('q1', 20)]), side('b', 10, [line('r1', 10)]), 'SF'),
             game(2023, 3, 2, side('c', 9, [line('w1', 9)]), side('d', 1, [line('t1', 1)]), 'Cons-R1')], true),
    week(4, [game(2023, 4, 1, side('a', 33, [line('q1', 33)]), side('b', 12, [line('r1', 12)]), 'Final'),
             game(2023, 4, 2, side('c', 2, [line('w1', 2)]), side('d', 0, [line('t1', 0, {}), line('k1', 0.5)]), 'Toilet Bowl')], true),
  ]);
  const c = { ...ctx, lines: flattenLines([bracket], players) };
  it('best playoff starts rank bracket starts, Final only on request', () => {
    expect(bestPlayoffStarts(c).map((r) => [r.playerId, r.value, r.meta, r.to])).toEqual([
      ['q1', 33, '2023 · Wk 4 · Championship', '/scores/2023/4/1'], ['q1', 20, '2023 · Wk 3 · Semifinal', '/scores/2023/3/1'], ['r1', 12, '2023 · Wk 4 · Championship', '/scores/2023/4/1'], ['r1', 10, '2023 · Wk 3 · Semifinal', '/scores/2023/3/1'],
    ]);
    expect(bestPlayoffStarts(c, 'desc', 'final').map((r) => [r.playerId, r.value])).toEqual([['q1', 33], ['r1', 12]]);
  });
  it('worst toilet bowl starts rank played consolation starts lowest first, Toilet Bowl only on request', () => {
    expect(worstToiletStarts(c).map((r) => [r.playerId, r.value, r.meta])).toEqual([
      ['k1', 0.5, '2023 · Wk 4 · Toilet Bowl'], ['t1', 1, '2023 · Wk 3 · Consolation'], ['w1', 2, '2023 · Wk 4 · Toilet Bowl'], ['w1', 9, '2023 · Wk 3 · Consolation'],
    ]); // t1's 0 in the toilet bowl is unplayed and excluded
    expect(worstToiletStarts(c, 'desc', 'toilet').map((r) => r.playerId)).toEqual(['k1', 'w1']);
  });
});
