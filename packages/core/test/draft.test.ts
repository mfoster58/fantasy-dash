import { describe, it, expect } from 'vitest';
import { buildDraft } from '../src/draft';
import type { SleeperDraft, SleeperDraftPick } from '../src/sleeper/types';

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
    const d = buildDraft(draft, picks, rosterToUser);
    expect(d).toMatchObject({ draftId: 'D1', type: 'snake', rounds: 2 });
    expect(d.picks.map((p) => p.pickNo)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(d.picks[2]).toEqual({ round: 1, pickNo: 3, slot: 3, userId: 'ua', playerId: 'p3', isKeeper: true });
    expect(d.picks[0].isKeeper).toBe(false);
  });

  it('uses draft_order for the slot order', () => {
    expect(buildDraft(draft, picks, rosterToUser).slotOrder).toEqual(['ub', 'uc', 'ua']);
  });

  it('falls back to round-1 picks for the slot order and to the roster owner for the picker', () => {
    const d = buildDraft({ ...draft, draft_order: null }, picks, rosterToUser);
    expect(d.slotOrder).toEqual(['ub', 'uc', 'ua']);
    expect(d.picks[5].userId).toBe('ub');
  });
});
