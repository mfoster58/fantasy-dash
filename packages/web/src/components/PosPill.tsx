import type { CSSProperties } from 'react';
import { posColor } from '../lib/players';

/** Translucent position chip. Unknown positions (FLEX, etc.) fall back to muted. */
export default function PosPill({ pos, className = '' }: { pos: string; className?: string }) {
  return (
    <span className={`pos-pill ${className}`} style={{ '--pos-color': posColor(pos) } as CSSProperties}>
      {pos}
    </span>
  );
}
