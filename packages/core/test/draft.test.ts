import { describe, it, expect } from 'vitest';
import { buildDraft, computeDraftValues, tradesFromTransactions, capital, fitExpectedCurve, expectedAt, BASELINE_RANKS, type DraftValueInput } from '../src/draft';
import type { DraftPick, PlayerDirectory } from '../src/types';
import type { SleeperDraft, SleeperDraftPick, SleeperTransaction } from '../src/sleeper/types';

const noValue: DraftValueInput = { seasonPoints: {}, players: {}, gamesPlayed: {}, teamGames: {}, lastScoredWeek: 0, trades: [] };
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
    expect(d.picks[2]).toEqual({ round: 1, pickNo: 3, slot: 3, userId: 'ua', playerId: 'p3', isKeeper: true, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null });
    expect(d.picks[0].isKeeper).toBe(false);
    expect(d.expectedCurve).toBeNull();
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
  const pick = (pickNo: number, playerId: string): DraftPick => ({ round: 1, pickNo, slot: pickNo, userId: `u${pickNo}`, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null });
  const input: DraftValueInput = {
    seasonPoints, players,
    gamesPlayed: { rbA: 5, qbA: 4, rbB: 5, def1: 5 },
    teamGames: { DET: 5, KC: 5, SF: 4 },
    lastScoredWeek: 5,
    trades: [
      { playerId: 'rbB', toUserId: 'u9', week: 2, created: 200 },
      { playerId: 'rbB', toUserId: 'u8', week: 4, created: 400 },
    ],
  };
  const drafted = [pick(1, 'rbA'), pick(2, 'qbA'), pick(3, 'rbB'), pick(4, 'mys'), pick(5, 'qbB'), pick(6, 'rbC'), pick(7, 'def1'), pick(8, 'rbY')];
  const { picks, expectedCurve } = computeDraftValues(drafted, input);
  const by = Object.fromEntries(picks.map((p) => [p.playerId, p]));

  it('leaves value fields null for defenses but keeps points, games and ppg', () => {
    expect(by.def1).toMatchObject({ seasonPoints: 90, gamesPlayed: 5, ppg: 18, healthy: false, posDraftRank: null, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null });
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
    for (let i = 1; i <= 12; i++) { deepPlayers[`k${i}`] = info(`k${i}`, 'K'); deepPoints[`k${i}`] = 200 - i * 10; } // k1 190 ... k12 80
    const { picks: [p] } = computeDraftValues([pick(1, 'k3')], { ...input, seasonPoints: deepPoints, players: deepPlayers });
    expect(BASELINE_RANKS.K).toBe(10);
    expect(p.pointsOverBaseline).toBe(170 - 100); // k3 170 minus k10 100
  });

  it('ranks the redraft order across positions by weighted points over baseline, zero scorers tied last', () => {
    // QB PoB weighs 0.5: rbX 300, rbB 250, qbA 200, qbX 195, qbB 190, rbA 100, rbC 50 -> 7 scorers; rbY ties at 8
    expect(by.rbB.redraftPos).toBe(2);
    expect(by.qbA.redraftPos).toBe(3);
    expect(by.qbB.redraftPos).toBe(5);
    expect(by.rbA.redraftPos).toBe(6);
    expect(by.rbC.redraftPos).toBe(7);
    expect(by.rbY.redraftPos).toBe(8);
    expect(by.qbA.pointsOverBaseline).toBe(400);   // displayed PoB stays unweighted
  });

  it('computes slot value as capital gained between the pick and the redraft position', () => {
    expect(by.rbA.slotValue).toBeCloseTo(capital(6) - capital(1), 1);   // -10.5
    expect(by.qbA.slotValue).toBeCloseTo(capital(3) - capital(2), 1);   // -2.2
    expect(by.rbB.slotValue).toBeCloseTo(capital(2) - capital(3), 1);   // +2.2
    expect(by.qbB.slotValue).toBe(0);
    expect(by.rbY.slotValue).toBe(0);
  });

  it('fits the expected curve on weighted valued picks and reports production in points to date', () => {
    expect(expectedCurve).not.toBeNull();
    const weighted = (p: DraftPick) => (players[p.playerId].position === 'QB' ? 0.5 : 1) * p.pointsOverBaseline!;
    const valued = picks.filter((p) => p.pointsOverBaseline !== null);
    expect(expectedCurve).toEqual(fitExpectedCurve(valued.map((p) => ({ pick: p.pickNo, contribution: Math.max(weighted(p), 0) }))));
    for (const p of valued) {
      const expected = Math.round((Math.max(weighted(p), 0) - expectedAt(expectedCurve!, p.pickNo)) * 10) / 10;
      expect(p.productionValue).toBeCloseTo(expected, 1);
      expect(p.value).toBeCloseTo(p.slotValue! + p.productionValue!, 1);
    }
    expect(valued.map((p) => p.playerId).sort()).toEqual(['qbA', 'qbB', 'rbA', 'rbB', 'rbC', 'rbY']);
  });

  it('fills games played, ppg and healthy from the inputs', () => {
    expect(by.rbA).toMatchObject({ gamesPlayed: 5, ppg: 20, healthy: true });      // DET played 5, rbA 5
    expect(by.qbA).toMatchObject({ gamesPlayed: 4, ppg: 100, healthy: false });    // KC played 5, qbA 4
    expect(by.rbY).toMatchObject({ gamesPlayed: 0, ppg: null, healthy: false });   // no games
    expect(by.rbB.healthy).toBe(false);                                            // no team
  });

  it('marks the latest completed trade per player', () => {
    expect(by.rbB.tradedTo).toEqual({ userId: 'u8', week: 4 });
    expect(by.rbA.tradedTo).toBeNull();
  });

  it('nulls every value field before the first scored week', () => {
    const res = computeDraftValues(drafted, { ...input, lastScoredWeek: 0 });
    expect(res.expectedCurve).toBeNull();
    for (const p of res.picks) expect(p).toMatchObject({ pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null });
    expect(res.picks[0].posDraftRank).toBe(1);
  });
});

describe('tradesFromTransactions', () => {
  const tx = (over: Partial<SleeperTransaction>): SleeperTransaction => ({ transaction_id: 't', type: 'trade', status: 'complete', leg: 3, created: 100, adds: null, drops: null, roster_ids: [], ...over });
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
  it('is 100 at pick 1 and decays with e-folding of 45 picks', () => {
    expect(capital(1)).toBe(100);
    expect(capital(46)).toBeCloseTo(100 / Math.E, 6);
    expect(capital(160)).toBeCloseTo(2.92, 2);
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
    expect(expectedAt(c!, 1)).toBeCloseTo(50, 3);
    expect(expectedAt(c!, 41)).toBeCloseTo(50 / Math.E, 3);
  });
  it('returns null when there is nothing to fit', () => {
    expect(fitExpectedCurve([])).toBeNull();
    expect(fitExpectedCurve([{ pick: 1, contribution: 0 }, { pick: 2, contribution: 0 }])).toBeNull();
  });
});
