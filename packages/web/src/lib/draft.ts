import type { Draft, DraftPick, PlayerDirectory, UserId } from '@fantasy-dash/core';

export interface ManagerDraftSummary {
  userId: UserId; picks: number; totalValue: number; totalPoB: number; best: DraftPick | null; worst: DraftPick | null;
  /** picks with a value */
  valued: number;
  /** picks with value > 0 */
  beat: number;
  /** sum of positive pick values */
  hits: number;
  /** sum of negative pick values (≤ 0) */
  misses: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function managerDraftSummaries(draft: Draft): ManagerDraftSummary[] {
  const map = new Map<UserId, ManagerDraftSummary>();
  for (const p of draft.picks) {
    const s = map.get(p.userId) ?? { userId: p.userId, picks: 0, totalValue: 0, totalPoB: 0, best: null, worst: null, valued: 0, beat: 0, hits: 0, misses: 0 };
    s.picks += 1;
    if (p.value !== null) {
      s.totalValue += p.value;
      s.valued += 1;
      if (p.value > 0) { s.beat += 1; s.hits += p.value; } else s.misses += p.value;
      if (!s.best || p.value > (s.best.value ?? -Infinity)) s.best = p;
      if (!s.worst || p.value < (s.worst.value ?? Infinity)) s.worst = p;
    }
    if (p.pointsOverBaseline !== null) s.totalPoB += p.pointsOverBaseline;
    map.set(p.userId, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, totalValue: r1(s.totalValue), totalPoB: r1(s.totalPoB), hits: r1(s.hits), misses: r1(s.misses) }))
    .sort((a, b) => b.totalValue - a.totalValue || b.totalPoB - a.totalPoB);
}

const LETTERS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

/** Letter grade from rank within the league: the top manager is A+, the bottom is D (F needs 12+ managers). */
export function letterGrade(rank: number, managers: number): string {
  if (managers <= 1) return 'A+';
  const i = Math.min(LETTERS.length - 1, Math.max(0, Math.floor(((rank - 1) * LETTERS.length) / managers)));
  return LETTERS[i];
}

/** "3.07" style label: round and pick within the round. */
export function pickLabel(p: DraftPick, teams: number): string {
  const inRound = teams > 0 ? p.pickNo - (p.round - 1) * teams : p.pickNo;
  return `${p.round}.${String(inRound).padStart(2, '0')}`;
}

export function leagueExtremes(draft: Draft, n = 25): { steals: DraftPick[]; busts: DraftPick[] } {
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

/** Translucency of the value tint: stronger than the position board's 16% so hits and misses read at a glance. */
const VALUE_TINT = 45;

/** Muted red → yellow → green tint for a value cell. Yellow at 0, fully red/green at ±VALUE_SATURATION, always mixed over transparent so normal text stays readable. */
export function valueColor(value: number | null): string {
  if (value === null) return 'transparent';
  const pct = Math.round(Math.min(Math.abs(value), VALUE_SATURATION) / VALUE_SATURATION * 100);
  const hue = pct === 0 ? YELLOW : `color-mix(in oklch, ${value > 0 ? GREEN : RED} ${pct}%, ${YELLOW})`;
  return `color-mix(in srgb, ${hue} ${VALUE_TINT}%, transparent)`;
}

/** Positions the best/worst lists can be filtered to. */
export const POSITION_FILTERS = ['QB', 'RB', 'WR', 'TE'] as const;
export type PositionFilter = (typeof POSITION_FILTERS)[number] | null;

/** Keep the rows whose player is at `pos` (today's position in the directory); null keeps everything. */
export function byPosition<T extends { playerId: string }>(rows: T[], players: PlayerDirectory, pos: PositionFilter): T[] {
  return pos === null ? rows : rows.filter((r) => players[r.playerId]?.position === pos);
}

export function posLabel(pos: string, rank: number | null): string {
  return rank === null ? pos : `${pos}${rank}`;
}
