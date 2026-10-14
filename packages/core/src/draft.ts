import type { Draft, DraftPick, PlayerDirectory, PlayerId, UserId } from './types';
import type { SleeperDraft, SleeperDraftPick } from './sleeper/types';
import { round2 } from './scoring';

/** Last startable rank per position in a 10-team league with 2 RB, 2 WR, 1 TE, 2 FLEX, 1 QB, 1 K, 1 DEF. */
export const BASELINE_RANKS: Record<string, number> = { QB: 10, RB: 24, WR: 24, TE: 12, K: 10, DEF: 10 };

export interface DraftValueInput { seasonPoints: Record<PlayerId, number>; players: PlayerDirectory }

/**
 * Fill posDraftRank, seasonPoints, posFinishRank, value and pointsOverBaseline. Pure.
 *
 * Finish rank: per position, the ranking pool is the players with season points > 0, sorted by
 * points desc then id asc, ranked 1..N. Any player at the position with zero or no points is tied
 * at N + 1 (just behind every scorer). Baseline points come from the pool at BASELINE_RANKS[pos]
 * (0 if the pool is shorter). Positions without a BASELINE_RANKS entry (DB, LB, ...) are treated
 * like unknown positions: all value fields are null, only seasonPoints is kept.
 */
export function computeDraftValues(picks: DraftPick[], input: DraftValueInput): DraftPick[] {
  const posOf = (id: PlayerId) => input.players[id]?.position ?? null;
  const pts = (id: PlayerId) => input.seasonPoints[id] ?? 0;

  // Finish rank: scorers (points > 0) ranked 1..N; everyone else at the position ties at N + 1.
  const finishRank = new Map<PlayerId, number>();
  const baselinePoints = new Map<string, number>();
  const byPos = new Map<string, PlayerId[]>();
  for (const id of Object.keys(input.players)) {
    const pos = posOf(id);
    if (!pos) continue;
    const list = byPos.get(pos) ?? [];
    list.push(id);
    byPos.set(pos, list);
  }
  for (const [pos, all] of byPos) {
    const ids = all.filter((id) => pts(id) > 0);
    ids.sort((a, b) => pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
    const scored = new Set(ids);
    ids.forEach((id, i) => finishRank.set(id, i + 1));
    for (const id of all) if (!scored.has(id)) finishRank.set(id, ids.length + 1);
    const baseRank = BASELINE_RANKS[pos];
    const baseId = baseRank ? ids[baseRank - 1] : undefined;
    baselinePoints.set(pos, baseId ? pts(baseId) : 0);
  }

  // Draft rank: order within position by pickNo.
  const seen = new Map<string, number>();
  return [...picks]
    .sort((a, b) => a.pickNo - b.pickNo)
    .map((p) => {
      const pos = posOf(p.playerId);
      const seasonPoints = round2(pts(p.playerId));
      if (!pos || BASELINE_RANKS[pos] === undefined) return { ...p, posDraftRank: null, seasonPoints, posFinishRank: null, value: null, pointsOverBaseline: null };
      const posDraftRank = (seen.get(pos) ?? 0) + 1;
      seen.set(pos, posDraftRank);
      const posFinishRank = finishRank.get(p.playerId) ?? null;
      return {
        ...p,
        posDraftRank,
        seasonPoints,
        posFinishRank,
        value: posFinishRank === null ? null : posDraftRank - posFinishRank,
        pointsOverBaseline: round2(seasonPoints - (baselinePoints.get(pos) ?? 0)),
      };
    });
}

/** Normalize a Sleeper draft. Pickers come from `picked_by`, else the roster owner. */
export function buildDraft(draft: SleeperDraft, rawPicks: SleeperDraftPick[], rosterToUser: Record<number, UserId>, value: DraftValueInput): Draft {
  const pickerOf = (p: SleeperDraftPick): UserId =>
    p.picked_by ?? (p.roster_id != null ? rosterToUser[p.roster_id] ?? `roster-${p.roster_id}` : 'unknown');

  const basePicks: DraftPick[] = [...rawPicks]
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((p) => ({ round: p.round, pickNo: p.pick_no, slot: p.draft_slot, userId: pickerOf(p), playerId: p.player_id, isKeeper: p.is_keeper === true, posDraftRank: null, seasonPoints: 0, posFinishRank: null, value: null, pointsOverBaseline: null }));
  const picks = computeDraftValues(basePicks, value);

  let slotOrder: UserId[];
  if (draft.draft_order && Object.keys(draft.draft_order).length > 0) {
    slotOrder = Object.entries(draft.draft_order).sort((a, b) => a[1] - b[1]).map(([userId]) => userId);
  } else {
    slotOrder = picks.filter((p) => p.round === 1).sort((a, b) => a.slot - b.slot).map((p) => p.userId);
  }

  return { draftId: draft.draft_id, type: draft.type, rounds: draft.settings.rounds, slotOrder, picks };
}
