import type { UserId } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import ManagerName from './ManagerName';
import { markAttrs, usePinHover, type Pin } from './pin';

export interface DumbbellRow { id: UserId; from: number; to: number; label: string; tone: 'win' | 'loss' | 'even'; fromTitle: string; toTitle: string }
interface Props { rows: DumbbellRow[]; domain: [number, number]; ticks: number[]; refs: ManagerRef[]; pin: Pin; ariaLabel: string }

const BAR: Record<DumbbellRow['tone'], string> = { win: 'var(--win)', loss: 'var(--loss)', even: 'var(--muted)' };

/** One row per manager: a hollow dot at `from`, a filled dot at `to`, a bar between them coloured by the tone. */
export default function Dumbbell({ rows, domain, ticks, refs, pin, ariaLabel }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  const [lo, hi] = domain;
  const x = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  return (
    <div>
      <ul className="space-y-1.5" aria-label={ariaLabel}>
        {rows.map((r) => (
          <li key={r.id} data-tone={r.tone} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="relative h-4">
              <span className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: x(Math.min(r.from, r.to)), width: `calc(${x(Math.max(r.from, r.to))} - ${x(Math.min(r.from, r.to))})`, background: BAR[r.tone], opacity: 0.7 }} />
              <span title={r.fromTitle} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted bg-surface" style={{ left: x(r.from) }} />
              <span title={r.toTitle} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: x(r.to), background: r.id === active ? 'var(--gold)' : BAR[r.tone] }} />
            </span>
            <span className="num text-right text-xs text-muted">{r.label}</span>
          </li>
        ))}
      </ul>
      <div className="relative ml-[7rem] mr-[3rem] mt-1 h-4 text-[10px] text-muted">
        {ticks.map((t) => <span key={t} className="num absolute -translate-x-1/2" style={{ left: x(t) }}>{t}</span>)}
      </div>
    </div>
  );
}
