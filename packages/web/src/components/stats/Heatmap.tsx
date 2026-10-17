import type { UserId } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import ManagerName from './ManagerName';
import { markAttrs, usePinHover, type Pin } from './pin';

export interface HeatCell { fill: string; text?: string; title: string; outline?: boolean; dot?: boolean }
export interface HeatCol { key: string; label: string; /** a dashed gold line down the left of this column */ divider?: boolean }
interface Props { rows: { id: UserId }[]; cols: HeatCol[]; cell: (rowId: UserId, colKey: string) => HeatCell | null; refs: ManagerRef[]; pin: Pin; right?: (rowId: UserId) => string | null; ariaLabel: string }

/** Managers down the side, periods across, a tinted square per cell. The first column is sticky so phones can scroll the rest. */
export default function Heatmap({ rows, cols, cell, refs, pin, right, ariaLabel }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  // the dashed line gets a narrow column of its own, so it never runs over a box
  const gap = (c: HeatCol, header = false) => c.divider && (header
    ? <th key={`gap-${c.key}`} aria-hidden="true" data-divider-gap className="w-2 px-0"><span className="mx-auto block h-full w-0 border-l-2 border-dashed border-gold/70" /></th>
    : <td key={`gap-${c.key}`} role="presentation" data-divider-gap className="w-2 px-0"><span className="mx-auto block h-7 w-0 border-l-2 border-dashed border-gold/70" /></td>);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] w-px whitespace-nowrap bg-surface" />
            {cols.flatMap((c) => [gap(c, true), <th key={c.key} scope="col" className="num px-0.5 pb-1 text-center font-normal text-muted">{c.label}</th>])}
            {right && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={active !== null && active !== r.id ? 'opacity-40' : ''}>
              <th scope="row" className="sticky left-0 z-[1] w-px whitespace-nowrap bg-surface pr-2 text-left font-normal"><ManagerName id={r.id} refs={refs} active={active} /></th>
              {cols.flatMap((c) => {
                const v = cell(r.id, c.key);
                return [gap(c),
                  <td key={c.key} title={v?.title} data-divider={c.divider ? 'true' : undefined} data-outline={v?.outline ? 'true' : undefined}
                    className={`relative h-7 min-w-7 rounded text-center ${v?.outline ? 'ring-2 ring-inset ring-loss' : ''}`}
                    style={{ background: v?.fill ?? 'transparent' }}>
                    {v?.text && <span className="num text-[11px] text-ink">{v.text}</span>}
                    {v?.dot && <span data-dot className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-gold" />}
                  </td>];
              })}
              {right && <td className="num whitespace-nowrap pl-2 text-right text-muted">{right(r.id)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
