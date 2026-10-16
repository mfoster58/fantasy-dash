import { describe, it, expect } from 'vitest';
import { buildDraft, computeDraftValues, tradesFromTransactions, capital, earnedCapital, pickValue, surplusMultiplier, SURPLUS_PREMIUM, fitExpectedCurve, expectedAt, earnedPickFor, BASELINE_RANKS, POSITION_WEIGHTS, TOP_BONUS, TOP_BONUS_DECAY, type DraftValueInput } from '../src/draft';
import type { DraftPick, PlayerDirectory } from '../src/types';
import type { SleeperDraft, SleeperDraftPick, SleeperTransaction } from '../src/sleeper/types';

const noValue: DraftValueInput = { seasonPoints: {}, players: {}, gamesPlayed: {}, teamGames: {}, playerTeams: {}, lastScoredWeek: 0, byeAdjust: false, trades: [] };
const rosterToUser = { 1: 'ua', 2: 'ub', 3: 'uc' };
const draft: SleeperDraft = {
  draft_id: 'D1', type: 'snake', status: 'complete',
  settings: { rounds: 2, teams: 3 },
  draft_order: { ub: 1, uc: 2, ua: 3 },
  slot_to_roster_id: null,
};
const pick = (round: number, pick_no: number, draft_slot: number, roster_id: number, player_id: string, extra: Partial<SleeperDraftPick> = {}): SleeperDraftPick =>
  ({ round, pick_no, draft_slot, roster_id, picked_by: rosterToUser[roster_id as 1 | 2 | 3], player_id, is_keeper: null, ...extra });
const picks: SleeperDraftPick[] = [
  pick(1, 1, 1, 2, 'p1'), pick(1, 2, 2, 3, 'p2'), pick(1, 3, 3, 1, 'p3', { is_keeper: true }),
  pick(2, 4, 3, 1, 'p4'), pick(2, 5, 2, 3, 'p5'), pick(2, 6, 1, 2, 'p6', { picked_by: null }),
];

describe('buildDraft', () => {
  it('normalizes picks in pick order with keeper flags', () => {
    const d = buildDraft(draft, picks, rosterToUser, noValue);
    expect(d).toMatchObject({ draftId: 'D1', type: 'snake', rounds: 2 });
    expect(d.picks.map((p) => p.pickNo)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(d.picks[2]).toEqual({ round: 1, pickNo: 3, slot: 3, userId: 'ua', playerId: 'p3', isKeeper: true, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null, tradedTo: null });
    expect(d.picks[0].isKeeper).toBe(false);
    expect(d.expectedCurve).toBeNull();
    expect(d.baselines).toEqual({});
  });

  it('uses draft_order for the slot order', () => {
    expect(buildDraft(draft, picks, rosterToUser, noValue).slotOrder).toEqual(['ub', 'uc', 'ua']);
  });

  it('falls back to round-1 picks for the slot order and to the roster owner for the picker', () => {
    const d = buildDraft({ ...draft, draft_order: null }, picks, rosterToUser, noValue);
    expect(d.slotOrder).toEqual(['ub', 'uc', 'ua']);
    expect(d.picks[5].userId).toBe('ub');
  });
});

const info = (id: string, position: string | null): PlayerDirectory[string] => ({ id, name: id, firstName: id, lastName: '', position, team: null, yearsExp: null });

describe('computeDraftValues', () => {
  // Four scoring RBs + one zero RB, three QBs, a DEF, and an unknown-position player.
  const players: PlayerDirectory = {
    rbA: info('rbA', 'RB'), rbB: info('rbB', 'RB'), rbC: info('rbC', 'RB'), rbX: info('rbX', 'RB'), rbY: { ...info('rbY', 'RB'), team: 'SF' },
    qbA: info('qbA', 'QB'), qbB: info('qbB', 'QB'), qbX: info('qbX', 'QB'),
    def1: info('def1', 'DEF'), mys: info('mys', null),
  };
  players.rbA.team = 'DET'; players.qbA.team = 'KC';
  const seasonPoints = { rbA: 100, rbB: 250, rbC: 50, rbX: 300, qbA: 400, qbB: 380, qbX: 390, def1: 90, mys: 999 };
  const pick = (pickNo: number, playerId: string): DraftPick => ({ round: 1, pickNo, slot: pickNo, userId: `u${pickNo}`, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null, tradedTo: null });
  const input: DraftValueInput = {
    seasonPoints, players,
    gamesPlayed: { rbA: 5, qbA: 4, rbB: 5, def1: 5 },
    teamGames: { DET: 5, KC: 5, SF: 4 },
    playerTeams: {},
    lastScoredWeek: 5, byeAdjust: true,
    trades: [
      { playerId: 'rbB', toUserId: 'u9', week: 2, created: 200 },
      { playerId: 'rbB', toUserId: 'u8', week: 4, created: 400 },
    ],
  };
  const drafted = [pick(1, 'rbA'), pick(2, 'qbA'), pick(3, 'rbB'), pick(4, 'mys'), pick(5, 'qbB'), pick(6, 'rbC'), pick(7, 'def1'), pick(8, 'rbY')];
  const { picks, expectedCurve, baselines } = computeDraftValues(drafted, input);
  const by = Object.fromEntries(picks.map((p) => [p.playerId, p]));

  it('leaves value fields null for kickers and defenses but keeps points, games and ppg', () => {
    const { picks: [k] } = computeDraftValues([pick(1, 'k1')], { ...input, seasonPoints: { k1: 120 }, players: { k1: info('k1', 'K') }, gamesPlayed: { k1: 5 } });
    expect(k).toMatchObject({ seasonPoints: 120, gamesPlayed: 5, ppg: 24, posDraftRank: null, pointsOverBaseline: null, redraftPos: null, value: null });
    expect(by.def1).toMatchObject({ seasonPoints: 90, gamesPlayed: 5, ppg: 18, healthy: false, posDraftRank: null, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null });
  });

  it('leaves value fields null for players with an unknown position', () => {
    expect(by.mys).toMatchObject({ posDraftRank: null, pointsOverBaseline: null, redraftPos: null, value: null, seasonPoints: 999 });
  });

  it('ranks picks within their position by pick order', () => {
    expect([by.rbA.posDraftRank, by.rbB.posDraftRank, by.rbC.posDraftRank, by.rbY.posDraftRank]).toEqual([1, 2, 3, 4]);
    expect([by.qbA.posDraftRank, by.qbB.posDraftRank]).toEqual([1, 2]);
  });

  it('computes points over the positional baseline (baseline 0 when the pool is shallow)', () => {
    expect(by.rbA.pointsOverBaseline).toBe(100);
    expect(by.qbB.pointsOverBaseline).toBe(380);
    expect(by.rbY.pointsOverBaseline).toBe(0);
  });

  it('uses the baseline player\'s points when the pool is deep enough', () => {
    const deepPlayers: PlayerDirectory = {};
    const deepPoints: Record<string, number> = {};
    for (let i = 1; i <= 14; i++) { deepPlayers[`te${i}`] = info(`te${i}`, 'TE'); deepPoints[`te${i}`] = 200 - i * 10; } // te1 190 ... te14 60
    const { picks: [p] } = computeDraftValues([pick(1, 'te3')], { ...input, seasonPoints: deepPoints, players: deepPlayers });
    expect(BASELINE_RANKS.TE).toBe(12);
    expect(p.pointsOverBaseline).toBe(170 - 80); // te3 170 minus te12 80
  });

  it('weights each position\'s points over baseline toward where this league drafts it', () => {
    // fitted by scripts/fit-position-weights.ts on the 2023-2025 drafts; receivers are the reference at 1
    expect(POSITION_WEIGHTS).toEqual({ QB: 0.65, RB: 0.65, TE: 0.5 });
    const tePlayers: PlayerDirectory = { te1: info('te1', 'TE'), te2: info('te2', 'TE') };
    const { picks: [te] } = computeDraftValues([pick(1, 'te1'), pick(2, 'te2')], { ...input, seasonPoints: { te1: 200, te2: 100 }, players: tePlayers });
    expect(te.pointsOverBaseline).toBe(200);
    expect(te.contribution).toBe(100);
  });

  it('ranks the redraft order across positions by weighted points over baseline, zero scorers tied last', () => {
    // RB and QB PoB both weigh 0.65: qbA 260, qbX 253.5, qbB 247, rbX 195, rbB 162.5, rbA 65, rbC 32.5 -> 7 scorers; rbY ties at 8
    expect(by.qbA.redraftPos).toBe(1);
    expect(by.qbB.redraftPos).toBe(3);
    expect(by.rbB.redraftPos).toBe(5);
    expect(by.rbA.redraftPos).toBe(6);
    expect(by.rbC.redraftPos).toBe(7);
    expect(by.rbY.redraftPos).toBe(8);
    expect(by.qbA.pointsOverBaseline).toBe(400);   // displayed PoB stays unweighted
  });

  it('reports the baseline and bench players per position', () => {
    // RB pool: rbX 300, rbB 250, rbA 100, rbC 50 (4 scorers): ranks 24/40 are beyond the pool, so both are 0
    expect(baselines.RB).toEqual({ baselineRank: 24, baselinePoints: 0, benchRank: 40, benchPoints: 0 });
    expect(baselines.QB).toEqual({ baselineRank: 10, baselinePoints: 0, benchRank: 14, benchPoints: 0 });
    expect(Object.keys(baselines).sort()).toEqual(['QB', 'RB']);
  });

  it('fits the expected curve to contribution and values each pick as capital earned minus capital spent', () => {
    expect(expectedCurve).not.toBeNull();
    const weighted = (p: DraftPick) => (POSITION_WEIGHTS[players[p.playerId].position!] ?? 1) * p.pointsOverBaseline!;
    const valued = picks.filter((p) => p.pointsOverBaseline !== null);
    expect(valued.map((p) => p.playerId).sort()).toEqual(['qbA', 'qbB', 'rbA', 'rbB', 'rbC', 'rbY']);
    for (const p of valued) expect(p.contribution).toBe(weighted(p));          // bench gap is 0 here, so the floor is 0
    expect(expectedCurve).toEqual(fitExpectedCurve(valued.map((p) => ({ pick: p.pickNo, contribution: p.contribution! }))));
    for (const p of valued) {
      const earned = earnedPickFor(expectedCurve!, p.contribution!);
      if (earned === null) {
        expect(p.earnedPick).toBeNull();
        expect(p.value).toBeCloseTo(-capital(p.pickNo), 1);
      } else {
        expect(p.earnedPick).toBeCloseTo(earned, 1);
        expect(p.value).toBeCloseTo(pickValue(earned, p.pickNo), 0);
      }
    }
    // contribution 0 sits above the fitted floor here, so even the zero scorer earns a (late) pick
    expect(by.rbY.earnedPick).toBeGreaterThan(by.rbB.earnedPick!);
  });

  it('gives a dominant top pick a positive value by earning a pick before 1', () => {
    // Straight line of contributions 100..10 except pick 1 at 400: earned pick well before 1, value > 0
    const dir: PlayerDirectory = {}; const pts: Record<string, number> = {}; const dp: DraftPick[] = [];
    for (let i = 1; i <= 10; i++) { dir[`rb${i}`] = info(`rb${i}`, 'RB'); pts[`rb${i}`] = i === 1 ? 400 : 110 - i * 10; dp.push(pick(i, `rb${i}`)); }
    const res = computeDraftValues(dp, { ...input, seasonPoints: pts, players: dir });
    const top = res.picks[0];
    expect(top.redraftPos).toBe(1);
    expect(top.earnedPick).toBeLessThan(1);
    expect(top.value).toBeGreaterThan(0);
    expect(top.value).toBeCloseTo(earnedCapital(top.earnedPick!) - 100, 0);   // no premium at pick 1
    expect(top.value).toBeLessThanOrEqual(TOP_BONUS);
  });

  it('fills games played, ppg and healthy from the inputs', () => {
    expect(by.rbA).toMatchObject({ gamesPlayed: 5, ppg: 20, healthy: true });      // DET played 5, rbA 5
    expect(by.qbA).toMatchObject({ gamesPlayed: 4, ppg: 100, healthy: false });    // KC played 5, qbA 4
    expect(by.rbY).toMatchObject({ gamesPlayed: 0, ppg: null, healthy: false });   // no games
    expect(by.rbB.healthy).toBe(false);                                            // no team
  });

  it("uses the season's team for healthy and bye checks before the directory's current team", () => {
    const { picks: moved } = computeDraftValues(drafted, { ...input, playerTeams: { rbB: 'SF', rbA: 'SF' } });
    const byMoved = Object.fromEntries(moved.map((p) => [p.playerId, p]));
    expect(byMoved.rbB.healthy).toBe(true);    // SF played 4, rbB 5: the season team gives a team where the directory had none
    expect(byMoved.rbA.healthy).toBe(true);    // directory says DET (5 games); season says SF (4) — still healthy at 5
    expect(byMoved.rbA.pointsOverBaseline).toBeGreaterThan(by.rbA.pointsOverBaseline!); // SF is a bye team, so rbA's points get scaled up
  });

  it('scales points for teams that have had their bye before ranking', () => {
    // rbY is on SF (4 games of 5): 40 raw points -> 50 adjusted, ahead of rbC (50 raw, no team, unadjusted) on points tiebreak... use 44 -> 55 to be clear
    const res = computeDraftValues(drafted, { ...input, seasonPoints: { ...seasonPoints, rbY: 44 } });
    const byY = Object.fromEntries(res.picks.map((p) => [p.playerId, p]));
    expect(byY.rbY.seasonPoints).toBe(44);                    // displayed points stay raw
    expect(byY.rbY.pointsOverBaseline).toBe(55);              // 44 * 5/4, baseline 0
    expect(byY.rbY.redraftPos).toBeLessThan(byY.rbC.redraftPos!);
    expect(byY.rbA.pointsOverBaseline).toBe(100);             // DET has played all 5
    const done = computeDraftValues(drafted, { ...input, seasonPoints: { ...seasonPoints, rbY: 44 }, byeAdjust: false });
    expect(done.picks.find((p) => p.playerId === 'rbY')!.pointsOverBaseline).toBe(44);   // completed season: no scaling
  });

  it('floors contribution at the bench gap instead of zero', () => {
    const deep: PlayerDirectory = {};
    const pts: Record<string, number> = {};
    for (let i = 1; i <= 45; i++) { deep[`wr${i}`] = info(`wr${i}`, 'WR'); pts[`wr${i}`] = 300 - i * 5; }   // wr24 180 is the baseline
    deep.bust = info('bust', 'WR'); pts.bust = 5;                                                      // PoB -175, floored at the gap
    deep.bench = info('bench', 'WR'); pts.bench = 150;                                                 // PoB -30, above the floor; shifts rank 40 to wr39 (105) -> gap 75
    const res = computeDraftValues([pick(1, 'wr1'), pick(2, 'bench'), pick(3, 'bust')], { ...input, seasonPoints: pts, players: deep });
    const b = Object.fromEntries(res.picks.map((p) => [p.playerId, p]));
    expect(b.bust.pointsOverBaseline).toBe(-175);
    expect(b.bust.contribution).toBe(-75);
    expect(b.bench.contribution).toBe(-30);
    expect(res.baselines.WR).toEqual({ baselineRank: 24, baselinePoints: 180, benchRank: 40, benchPoints: 105 });
  });

  it('falls back to the redraft position when the curve cannot be fitted', () => {
    // one valued pick: fewer than 2 points to fit
    const res = computeDraftValues([pick(3, 'rbA')], input);
    expect(res.expectedCurve).toBeNull();
    const [p] = res.picks;
    expect(p.earnedPick).toBe(p.redraftPos);
    expect(p.value).toBeCloseTo(capital(p.redraftPos!) - capital(3), 1);
  });

  it('marks the latest completed trade per player', () => {
    expect(by.rbB.tradedTo).toEqual({ userId: 'u8', week: 4 });
    expect(by.rbA.tradedTo).toBeNull();
  });

  it('nulls every value field before the first scored week', () => {
    const res = computeDraftValues(drafted, { ...input, lastScoredWeek: 0 });
    expect(res.expectedCurve).toBeNull();
    for (const p of res.picks) expect(p).toMatchObject({ pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null });
    expect(res.baselines).toEqual({});
    expect(res.picks[0].posDraftRank).toBe(1);
  });
});

describe('tradesFromTransactions', () => {
  const tx = (over: Partial<SleeperTransaction>): SleeperTransaction => ({ transaction_id: 't', type: 'trade', status: 'complete', leg: 3, created: 100, adds: null, drops: null, roster_ids: [], settings: null, ...over });
  it('keeps completed trades only and maps rosters to users', () => {
    const out = tradesFromTransactions([
      tx({ adds: { p1: 2, p2: 1 }, drops: { p1: 1, p2: 2 }, roster_ids: [1, 2] }),
      tx({ type: 'waiver', adds: { p3: 1 } }),
      tx({ status: 'failed', adds: { p4: 1 } }),
      tx({ adds: { p5: 9 }, leg: 6, created: 600 }),
    ], { 1: 'ua', 2: 'ub' });
    expect(out).toEqual([
      { playerId: 'p1', toUserId: 'ub', week: 3, created: 100 },
      { playerId: 'p2', toUserId: 'ua', week: 3, created: 100 },
      { playerId: 'p5', toUserId: 'roster-9', week: 6, created: 600 },
    ]);
  });
});

describe('capital', () => {
  it('is 100 at pick 1 and decays with e-folding of 35 picks', () => {
    expect(capital(1)).toBe(100);
    expect(capital(36)).toBeCloseTo(100 / Math.E, 6);
    expect(capital(160)).toBeCloseTo(1.06, 2);
  });
});

describe('pickValue', () => {
  it('scales a hit by the surplus premium in proportion to capital saved, and never scales a miss', () => {
    expect(surplusMultiplier(1)).toBe(1);
    expect(surplusMultiplier(1000)).toBeCloseTo(1 + SURPLUS_PREMIUM, 6);
    expect(pickValue(1, 1)).toBe(0);
    expect(pickValue(5, 1)).toBeCloseTo(capital(5) - 100, 9);                                   // miss from pick 1: raw gap
    expect(pickValue(null, 120)).toBeCloseTo(-capital(120), 9);                                 // off the board costs what was spent
    expect(pickValue(5, 120)).toBeCloseTo((capital(5) - capital(120)) * surplusMultiplier(120), 9);
    expect(pickValue(5, 120)).toBeGreaterThan(pickValue(5, 20));                                // same production, cheaper pick, more value
  });
});

describe('earnedCapital', () => {
  it('matches the slot capital on the board and is 0 off the board', () => {
    expect(earnedCapital(null)).toBe(0);
    expect(earnedCapital(1)).toBe(100);
    expect(earnedCapital(30)).toBeCloseTo(capital(30), 9);
  });
  it('is continuous at pick 1 and rises toward 100 + TOP_BONUS before it', () => {
    expect(earnedCapital(0.999)).toBeCloseTo(100, 1);
    expect(earnedCapital(1 - TOP_BONUS_DECAY)).toBeCloseTo(100 + TOP_BONUS * (1 - 1 / Math.E), 6);
    expect(earnedCapital(-45)).toBeLessThan(100 + TOP_BONUS);
    expect(earnedCapital(-45)).toBeGreaterThan(earnedCapital(-10));
    expect(earnedCapital(-1000)).toBeCloseTo(100 + TOP_BONUS, 6);
  });
});

describe('earnedPickFor', () => {
  const curve = { a: 50, k: 35, c: -7.5 };
  it('inverts the expected curve', () => {
    expect(earnedPickFor(curve, expectedAt(curve, 1))).toBeCloseTo(1, 6);
    expect(earnedPickFor(curve, expectedAt(curve, 60))).toBeCloseTo(60, 6);
  });
  it('goes before pick 1 for contribution above what pick 1 returns', () => {
    expect(earnedPickFor(curve, 100)!).toBeLessThan(1);
  });
  it('is null at or below the floor and for a degenerate fit', () => {
    expect(earnedPickFor(curve, -7.5)).toBeNull();
    expect(earnedPickFor(curve, -20)).toBeNull();
    expect(earnedPickFor({ a: -5, k: 35, c: 0 }, 10)).toBeNull();
  });
});

describe('fitExpectedCurve', () => {
  it('recovers a and k from clean exponential data', () => {
    const pts = [];
    for (let pick = 1; pick <= 160; pick += 3) pts.push({ pick, contribution: 50 * Math.exp(-(pick - 1) / 40) });
    const c = fitExpectedCurve(pts);
    expect(c).not.toBeNull();
    expect(c!.k).toBe(40);
    expect(c!.a).toBeCloseTo(50, 3);
    expect(c!.c).toBeCloseTo(0, 3);
    expect(expectedAt(c!, 1)).toBeCloseTo(50, 3);
    expect(expectedAt(c!, 41)).toBeCloseTo(50 / Math.E, 3);
  });
  it('recovers a negative offset so late picks can be expected below replacement', () => {
    const pts = [];
    for (let pick = 1; pick <= 160; pick += 3) pts.push({ pick, contribution: 60 * Math.exp(-(pick - 1) / 30) - 12 });
    const c = fitExpectedCurve(pts)!;
    expect(c.k).toBe(30);
    expect(c.a).toBeCloseTo(60, 3);
    expect(c.c).toBeCloseTo(-12, 3);
    expect(expectedAt(c, 160)).toBeLessThan(0);
  });
  it('returns null when there is nothing to fit', () => {
    expect(fitExpectedCurve([])).toBeNull();
    expect(fitExpectedCurve([{ pick: 1, contribution: 0 }, { pick: 2, contribution: 0 }])).toBeNull();
  });
});
