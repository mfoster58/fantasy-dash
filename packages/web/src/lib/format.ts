import type { WLT } from '@fantasy-dash/core';

export const fmtPts = (n: number): string => n.toFixed(2);
export const fmtPpg = (n: number): string => n.toFixed(1);
export const fmtPct = (ratio: number, digits = 1): string => `${(ratio * 100).toFixed(digits)}%`;
export const fmtWinPct = (p: number): string => p.toFixed(3).replace(/^0\./, '.');
export const fmtRecord = (r: WLT): string => (r.t ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`);
export const fmtSigned = (n: number, digits = 1): string => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
