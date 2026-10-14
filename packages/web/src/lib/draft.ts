import type { Draft, DraftPick, UserId } from '@fantasy-dash/core';

export interface ManagerDraftSummary { userId: UserId; picks: number; totalValue: number; totalPoB: number; best: DraftPick | null; worst: DraftPick | null }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function managerDraftSummaries(draft: Draft): ManagerDraftSummary[] {
  const map = new Map<UserId, ManagerDraftSummary>();
  for (const p of draft.picks) {
    const s = map.get(p.userId) ?? { userId: p.userId, picks: 0, totalValue: 0, totalPoB: 0, best: null, worst: null };
    s.picks += 1;
    if (p.value !== null) {
      s.totalValue += p.value;
      if (!s.best || p.value > (s.best.value ?? -Infinity)) s.best = p;
      if (!s.worst || p.value < (s.worst.value ?? Infinity)) s.worst = p;
    }
    if (p.pointsOverBaseline !== null) s.totalPoB += p.pointsOverBaseline;
    map.set(p.userId, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, totalPoB: r2(s.totalPoB) }))
    .sort((a, b) => b.totalValue - a.totalValue || b.totalPoB - a.totalPoB);
}

export function leagueExtremes(draft: Draft, n = 5): { steals: DraftPick[]; busts: DraftPick[] } {
  const valued = draft.picks.filter((p) => p.value !== null);
  const byValueDesc = [...valued].sort((a, b) => (b.value! - a.value!) || ((b.pointsOverBaseline ?? 0) - (a.pointsOverBaseline ?? 0)));
  const byValueAsc = [...valued].sort((a, b) => (a.value! - b.value!) || ((a.pointsOverBaseline ?? 0) - (b.pointsOverBaseline ?? 0)));
  return { steals: byValueDesc.slice(0, n), busts: byValueAsc.slice(0, n) };
}

/** Diverging fill for a value cell: 0 is transparent, |12| and beyond is the strongest tint. */
export function valueColor(value: number | null): string {
  if (value === null || value === 0) return 'transparent';
  const magnitude = Math.min(Math.abs(value), 12) / 12;        // 0..1
  const pct = Math.round(10 + magnitude * 60);                  // 10%..70%
  return `color-mix(in srgb, var(--${value > 0 ? 'win' : 'loss'}) ${pct}%, transparent)`;
}

export function posLabel(pos: string, rank: number | null): string {
  return rank === null ? pos : `${pos}${rank}`;
}
