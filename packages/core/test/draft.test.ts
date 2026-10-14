import { describe, it, expect } from 'vitest';
import { buildDraft, computeDraftValues, BASELINE_RANKS } from '../src/draft';
import type { DraftPick, PlayerDirectory } from '../src/types';
import type { SleeperDraft, SleeperDraftPick } from '../src/sleeper/types';

const noValue = { seasonPoints: {}, players: {} };
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
    expect(d.picks[2]).toEqual({ round: 1, pickNo: 3, slot: 3, userId: 'ua', playerId: 'p3', isKeeper: true, posDraftRank: null, seasonPoints: 0, posFinishRank: null, value: null, pointsOverBaseline: null });
    expect(d.picks[0].isKeeper).toBe(false);
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
  // Three RBs and two QBs drafted; league-wide RB pool has 5 players, QB pool has 3.
  const players: PlayerDirectory = {
    rbA: info('rbA', 'RB'), rbB: info('rbB', 'RB'), rbC: info('rbC', 'RB'), rbX: info('rbX', 'RB'), rbY: info('rbY', 'RB'),
    qbA: info('qbA', 'QB'), qbB: info('qbB', 'QB'), qbX: info('qbX', 'QB'),
    mys: info('mys', null),
  };
  const seasonPoints = { rbA: 100, rbB: 250, rbC: 50, rbX: 300, rbY: 10, qbA: 400, qbB: 380, qbX: 390, mys: 999 };
  const pick = (pickNo: number, playerId: string): DraftPick => ({ round: 1, pickNo, slot: pickNo, userId: `u${pickNo}`, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, posFinishRank: null, value: null, pointsOverBaseline: null });
  const picks = computeDraftValues([pick(1, 'rbA'), pick(2, 'qbA'), pick(3, 'rbB'), pick(4, 'mys'), pick(5, 'qbB'), pick(6, 'rbC')], { seasonPoints, players });
  const by = Object.fromEntries(picks.map((p) => [p.playerId, p]));

  it('ranks picks within their position by pick order', () => {
    expect([by.rbA.posDraftRank, by.rbB.posDraftRank, by.rbC.posDraftRank]).toEqual([1, 2, 3]);
    expect([by.qbA.posDraftRank, by.qbB.posDraftRank]).toEqual([1, 2]);
  });

  it('ranks finish among all players at the position, league-wide', () => {
    // RB finish order: rbX 300, rbB 250, rbA 100, rbC 50, rbY 10
    expect([by.rbA.posFinishRank, by.rbB.posFinishRank, by.rbC.posFinishRank]).toEqual([3, 2, 4]);
    // QB finish: qbA 400, qbX 390, qbB 380
    expect([by.qbA.posFinishRank, by.qbB.posFinishRank]).toEqual([1, 3]);
  });

  it('computes value as draft rank minus finish rank', () => {
    expect(by.rbA.value).toBe(-2);
    expect(by.rbB.value).toBe(0);
    expect(by.rbC.value).toBe(-1);
    expect(by.qbA.value).toBe(0);
    expect(by.qbB.value).toBe(-1);
  });

  it('computes points over the positional baseline', () => {
    // RB baseline rank 24 > pool size 5 -> baseline 0; QB baseline rank 10 > 3 -> 0
    expect(by.rbA.pointsOverBaseline).toBe(100);
    expect(by.qbB.pointsOverBaseline).toBe(380);
    const small = computeDraftValues([pick(1, 'rbA')], { seasonPoints, players: { ...players } });
    expect(small[0].seasonPoints).toBe(100);
  });

  it('uses the baseline player\'s points when the pool is deep enough', () => {
    const deepPlayers: PlayerDirectory = {};
    const deepPoints: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) { deepPlayers[`k${i}`] = info(`k${i}`, 'K'); deepPoints[`k${i}`] = 200 - i * 10; } // k1 190 ... k12 80
    const [p] = computeDraftValues([pick(1, 'k3')], { seasonPoints: deepPoints, players: deepPlayers });
    expect(BASELINE_RANKS.K).toBe(10);
    expect(p.pointsOverBaseline).toBe(170 - 100); // k3 170 minus k10 100
  });

  it('leaves value fields null for players with an unknown position', () => {
    expect(by.mys).toMatchObject({ posDraftRank: null, posFinishRank: null, value: null, pointsOverBaseline: null, seasonPoints: 999 });
  });

  it('places players without stats after everyone with points', () => {
    const [p] = computeDraftValues([pick(1, 'rbY')], { seasonPoints: { rbA: 100, rbB: 250, rbC: 50, rbX: 300 }, players });
    expect(p.seasonPoints).toBe(0);
    expect(p.posFinishRank).toBe(5);
  });
});
