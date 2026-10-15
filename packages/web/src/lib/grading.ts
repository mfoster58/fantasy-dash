import type { Draft, DraftPick } from '@fantasy-dash/core';

export interface GradingExample { key: string; label: string; pick: DraftPick }

/**
 * Picks that illustrate the grading method on a completed draft: the most productive player (earns a pick before 1),
 * the biggest steal taken after pick 50, the biggest bust, the best late dart and a late dart that missed entirely.
 * Each pick appears once; a slot is skipped when no pick qualifies.
 */
export function gradingExamples(draft: Draft): GradingExample[] {
  const valued = draft.picks.filter((p) => p.value !== null && p.contribution !== null);
  const teams = draft.slotOrder.length || 10;
  const used = new Set<number>();
  const take = (key: string, label: string, pool: DraftPick[], score: (p: DraftPick) => number): GradingExample | null => {
    const candidates = pool.filter((p) => !used.has(p.pickNo));
    if (!candidates.length) return null;
    const pick = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
    used.add(pick.pickNo);
    return { key, label, pick };
  };
  const out = [
    take('dominant', 'Most productive player', valued, (p) => p.contribution!),
    take('steal', 'Biggest steal after pick 50', valued.filter((p) => p.pickNo > 50), (p) => p.value!),
    take('bust', 'Biggest bust', valued, (p) => -p.value!),
    take('lateHit', 'Late dart that hit', valued.filter((p) => p.pickNo > teams * 9), (p) => p.value!),
    take('lateMiss', 'Late dart that missed', valued.filter((p) => p.pickNo > teams * 11 && p.earnedPick === null), (p) => -p.pickNo),
  ];
  return out.filter((e): e is GradingExample => e !== null);
}

/** Manager totals for a draft, best first, as [userId, total]. */
export function gradeTotals(draft: Draft): [string, number][] {
  const totals = new Map<string, number>();
  for (const p of draft.picks) if (p.value !== null) totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.value);
  return [...totals.entries()].map(([u, v]): [string, number] => [u, Math.round(v * 10) / 10]).sort((a, b) => b[1] - a[1]);
}
