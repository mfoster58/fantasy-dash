import type { PlayerId, Swap } from './types';
import { round2 } from './scoring';

export interface LineupPlayer {
  playerId: PlayerId;
  position: string | null;
  points: number;
}

export interface LineupSlot {
  slot: string;
  playerId: PlayerId | null;
}

export interface Lineup {
  slots: LineupSlot[];
  total: number;
}

/** Sleeper flex slot names and the positions they accept. */
export const FLEX_ELIGIBILITY: Record<string, string[]> = {
  FLEX: ['RB', 'WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  IDP_FLEX: ['DL', 'LB', 'DB'],
};

export function slotEligible(slot: string): string[] {
  return FLEX_ELIGIBILITY[slot] ?? [slot];
}

/**
 * Best possible lineup from a roster. Fixed-position slots are filled first with
 * the top scorers at that position; flex slots then take the best remaining
 * eligible player. Greedy is optimal because every flex slot accepts a superset
 * of the fixed slots it competes with.
 */
export function optimalLineup(slots: string[], players: LineupPlayer[]): Lineup {
  const remaining = players
    .filter((p) => p.position !== null)
    .sort((a, b) => b.points - a.points);
  const result: LineupSlot[] = slots.map((slot) => ({ slot, playerId: null }));

  const fill = (index: number) => {
    const eligible = slotEligible(result[index].slot);
    const i = remaining.findIndex((p) => eligible.includes(p.position as string));
    if (i >= 0) {
      result[index].playerId = remaining[i].playerId;
      remaining.splice(i, 1);
    }
  };

  slots.forEach((slot, i) => { if (!(slot in FLEX_ELIGIBILITY)) fill(i); });
  slots.forEach((slot, i) => { if (slot in FLEX_ELIGIBILITY) fill(i); });

  const points = new Map(players.map((p) => [p.playerId, p.points]));
  const total = round2(result.reduce((sum, r) => sum + (r.playerId ? points.get(r.playerId) ?? 0 : 0), 0));
  return { slots: result, total };
}

/**
 * The bench-for-starter replacements that turn the actual lineup into the
 * optimal one. Each optimal addition is paired with a removed starter of the
 * same position when one exists, otherwise with the lowest-scoring removed
 * starter, otherwise with null (an empty slot).
 */
export function optimalSwaps(
  actualStarters: (PlayerId | null)[],
  optimal: Lineup,
  info: (id: PlayerId) => LineupPlayer,
): Swap[] {
  const actual = new Set(actualStarters.filter((id): id is PlayerId => id !== null));
  const chosen = new Set(optimal.slots.map((s) => s.playerId).filter((id): id is PlayerId => id !== null));

  const outs = [...actual].filter((id) => !chosen.has(id)).sort((a, b) => info(a).points - info(b).points);
  const ins = [...chosen].filter((id) => !actual.has(id)).sort((a, b) => info(b).points - info(a).points);

  return ins.map((inId) => {
    const inPos = info(inId).position;
    let idx = outs.findIndex((id) => info(id).position === inPos);
    if (idx < 0) idx = outs.length ? 0 : -1;
    const outId = idx >= 0 ? outs.splice(idx, 1)[0] : null;
    const gain = round2(info(inId).points - (outId ? info(outId).points : 0));
    return { out: outId, in: inId, gain };
  });
}
