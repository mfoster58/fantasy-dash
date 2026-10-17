import { useState } from 'react';
import type { UserId } from '@fantasy-dash/core';

export type Pin = UserId | null;

/** the manager a chart should light up: the one under the pointer, else the pinned one */
export function usePinHover(pin: Pin): { active: Pin; hoverProps: (id: UserId) => { onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void } } {
  const [hover, setHover] = useState<Pin>(null);
  return {
    active: hover ?? pin,
    hoverProps: (id) => ({ onMouseEnter: () => setHover(id), onMouseLeave: () => setHover(null), onFocus: () => setHover(id), onBlur: () => setHover(null) }),
  };
}

export const markAttrs = (id: UserId, active: Pin): { 'data-pinned'?: 'true'; 'data-dim'?: 'true' } =>
  active === null ? {} : id === active ? { 'data-pinned': 'true' } : { 'data-dim': 'true' };
export const rowClass = (id: UserId, active: Pin): string => (active === null ? '' : id === active ? 'text-gold font-semibold' : 'opacity-40');
export const lineStroke = (id: UserId, active: Pin): string => (id === active ? 'var(--gold)' : 'var(--dim)');
export const lineWidth = (id: UserId, active: Pin): number => (id === active ? 3 : 1.5);
/** colour-mix helper for tinted cells: `k` from 0 to 1 over the card's second surface */
export const tint = (token: 'win' | 'loss' | 'gold' | 'accent', k: number): string => `color-mix(in srgb, var(--${token}) ${Math.round(Math.max(0, Math.min(1, k)) * 85)}%, var(--surface-2))`;
