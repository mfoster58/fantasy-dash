import type { Draft, DraftPick, UserId } from './types';
import type { SleeperDraft, SleeperDraftPick } from './sleeper/types';

/** Normalize a Sleeper draft. Pickers come from `picked_by`, else the roster owner. */
export function buildDraft(draft: SleeperDraft, rawPicks: SleeperDraftPick[], rosterToUser: Record<number, UserId>): Draft {
  const pickerOf = (p: SleeperDraftPick): UserId =>
    p.picked_by ?? (p.roster_id != null ? rosterToUser[p.roster_id] ?? `roster-${p.roster_id}` : 'unknown');

  const picks: DraftPick[] = [...rawPicks]
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((p) => ({ round: p.round, pickNo: p.pick_no, slot: p.draft_slot, userId: pickerOf(p), playerId: p.player_id, isKeeper: p.is_keeper === true }));

  let slotOrder: UserId[];
  if (draft.draft_order && Object.keys(draft.draft_order).length > 0) {
    slotOrder = Object.entries(draft.draft_order).sort((a, b) => a[1] - b[1]).map(([userId]) => userId);
  } else {
    slotOrder = picks.filter((p) => p.round === 1).sort((a, b) => a.slot - b.slot).map((p) => p.userId);
  }

  return { draftId: draft.draft_id, type: draft.type, rounds: draft.settings.rounds, slotOrder, picks };
}
