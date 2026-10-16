import type { PlayoffTag, WLT } from '@fantasy-dash/core';

export const fmtPts = (n: number): string => n.toFixed(2);
export const fmtPpg = (n: number): string => n.toFixed(1);
/** Standings streak 'W3' / 'L2' as '3W' / '2L'; null for none ('-'). */
export function fmtStreak(streak: string): { label: string; kind: 'W' | 'L' | 'T' } | null {
  const m = /^([WLT])(\d+)$/.exec(streak);
  return m ? { label: `${m[2]}${m[1]}`, kind: m[1] as 'W' | 'L' | 'T' } : null;
}

export const fmtPct = (ratio: number, digits = 1): string => `${(ratio * 100).toFixed(digits)}%`;
export const fmtWinPct = (p: number): string => p.toFixed(3).replace(/^0\./, '.');
export const fmtRecord = (r: WLT): string => (r.t ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`);
const TAG_LABELS: Partial<Record<PlayoffTag, string>> = {
  QF: 'Quarterfinal', SF: 'Semifinal', Final: 'Championship', '3rd': '3rd place', '5th': '5th place',
  'Cons-R1': 'Consolation', 'Cons-7th': '7th place',
};
/** Reader-facing name for a playoff tag. */
export const fmtTag = (tag: PlayoffTag): string => TAG_LABELS[tag] ?? tag;
export const fmtSigned = (n: number, digits = 1): string => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
