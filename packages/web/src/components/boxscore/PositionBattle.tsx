import type { GameSide, Manager, UserId } from '@fantasy-dash/core';
import { ManagerLink } from '../NameLink';
import PosPill from '../PosPill';
import { fmtPts } from '../../lib/format';

interface Props { sides: [GameSide, GameSide]; slots: string[]; managers: Record<UserId, Manager> }

export interface PositionGroup { slot: string; left: number; right: number }

/** Points per starting slot group (QB, RB, WR, …, in roster order) for each side. */
export function positionGroups(sides: [GameSide, GameSide], slots: string[]): PositionGroup[] {
  const order = [...new Set(slots)];
  return order.map((slot) => {
    const sum = (side: GameSide) => side.starters.filter((e) => e.slot === slot).reduce((t, e) => t + (e.player?.points ?? 0), 0);
    return { slot, left: Math.round(sum(sides[0]) * 100) / 100, right: Math.round(sum(sides[1]) * 100) / 100 };
  });
}

/** Paired bars per slot group, growing outward from the middle, so the side that won each position is obvious. */
export default function PositionBattle({ sides, slots, managers }: Props) {
  const groups = positionGroups(sides, slots);
  const max = Math.max(1, ...groups.flatMap((g) => [g.left, g.right]));
  const won = (k: 'left' | 'right') => groups.filter((g) => (k === 'left' ? g.left > g.right : g.right > g.left)).length;
  const name = (i: 0 | 1) => <ManagerLink userId={sides[i].userId} className="truncate">{managers[sides[i].userId]?.displayName ?? sides[i].userId}</ManagerLink>;
  return (
    <section className="card p-5" aria-labelledby="position-battle-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="position-battle-title" className="section-label">Position battle</h2>
        <span className="num text-xs text-muted" data-testid="position-tally">{won('left')} – {won('right')} <span className="font-sans">positions</span></span>
      </div>
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] text-xs text-muted">
        <span className="flex min-w-0">{name(0)}</span><span /><span className="flex min-w-0 justify-end text-right">{name(1)}</span>
      </div>
      <ul className="space-y-2">
        {groups.map((g) => {
          const lw = g.left > g.right, rw = g.right > g.left;
          return (
            <li key={g.slot} className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-x-2" data-testid="position-row">
              <div className="flex items-center justify-end gap-2">
                <span className={`num text-sm ${lw ? 'font-semibold text-ink' : 'text-muted'}`}>{fmtPts(g.left)}</span>
                <span className="h-2.5 w-full max-w-[11rem] overflow-hidden rounded-l bg-surface-2" aria-hidden="true">
                  <span className="float-right block h-full rounded-l" style={{ width: `${(g.left / max) * 100}%`, background: `color-mix(in srgb, ${lw ? 'var(--accent)' : 'var(--muted)'} ${lw ? 75 : 35}%, transparent)` }} />
                </span>
              </div>
              <span className="flex justify-center"><PosPill pos={g.slot} /></span>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-full max-w-[11rem] overflow-hidden rounded-r bg-surface-2" aria-hidden="true">
                  <span className="block h-full rounded-r" style={{ width: `${(g.right / max) * 100}%`, background: `color-mix(in srgb, ${rw ? 'var(--accent)' : 'var(--muted)'} ${rw ? 75 : 35}%, transparent)` }} />
                </span>
                <span className={`num text-sm ${rw ? 'font-semibold text-ink' : 'text-muted'}`}>{fmtPts(g.right)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
