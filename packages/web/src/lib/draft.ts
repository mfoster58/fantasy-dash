import type { Draft, DraftPick, UserId } from '@fantasy-dash/core';

export interface ManagerDraftSummary {
  userId: UserId; picks: number; totalValue: number; totalSlot: number; totalProduction: number; totalPoB: number; best: DraftPick | null; worst: DraftPick | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function managerDraftSummaries(draft: Draft): ManagerDraftSummary[] {
  const map = new Map<UserId, ManagerDraftSummary>();
  for (const p of draft.picks) {
    const s = map.get(p.userId) ?? { userId: p.userId, picks: 0, totalValue: 0, totalSlot: 0, totalProduction: 0, totalPoB: 0, best: null, worst: null };
    s.picks += 1;
    if (p.value !== null) {
      s.totalValue += p.value;
      s.totalSlot += p.slotValue ?? 0;
      s.totalProduction += p.productionValue ?? 0;
      if (!s.best || p.value > (s.best.value ?? -Infinity)) s.best = p;
      if (!s.worst || p.value < (s.worst.value ?? Infinity)) s.worst = p;
    }
    if (p.pointsOverBaseline !== null) s.totalPoB += p.pointsOverBaseline;
    map.set(p.userId, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, totalValue: r1(s.totalValue), totalSlot: r1(s.totalSlot), totalProduction: r1(s.totalProduction), totalPoB: r1(s.totalPoB) }))
    .sort((a, b) => b.totalValue - a.totalValue || b.totalPoB - a.totalPoB);
}

export function leagueExtremes(draft: Draft, n = 10): { steals: DraftPick[]; busts: DraftPick[] } {
  const valued = draft.picks.filter((p) => p.value !== null);
  const tie = (a: DraftPick, b: DraftPick) => (b.pointsOverBaseline ?? 0) - (a.pointsOverBaseline ?? 0);
  const byValueDesc = [...valued].sort((a, b) => (b.value! - a.value!) || tie(a, b));
  const byValueAsc = [...valued].sort((a, b) => (a.value! - b.value!) || tie(a, b));
  return { steals: byValueDesc.slice(0, n), busts: byValueAsc.slice(0, n) };
}

/** Highest PPG among valued picks who have played every game their team has played. */
export function topHealthyPpg(draft: Draft, n = 10): DraftPick[] {
  return draft.picks
    .filter((p) => p.healthy && p.value !== null && p.ppg !== null)
    .sort((a, b) => b.ppg! - a.ppg! || b.seasonPoints - a.seasonPoints)
    .slice(0, n);
}

export const VALUE_SATURATION = 60;
const RED = '#d64545';
const YELLOW = '#e6c229';
const GREEN = '#2f9e5f';

/** Red → yellow → green fill for a value cell. Yellow at 0, fully red/green at ±VALUE_SATURATION. */
export function valueColor(value: number | null): string {
  if (value === null) return 'transparent';
  const pct = Math.round(Math.min(Math.abs(value), VALUE_SATURATION) / VALUE_SATURATION * 100);
  if (pct === 0) return YELLOW;
  return `color-mix(in oklch, ${value > 0 ? GREEN : RED} ${pct}%, ${YELLOW})`;
}

export function posLabel(pos: string, rank: number | null): string {
  return rank === null ? pos : `${pos}${rank}`;
}
