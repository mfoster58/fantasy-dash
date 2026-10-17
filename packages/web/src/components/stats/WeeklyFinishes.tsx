import type { ManagerRef } from '../../lib/stats/scope';
import type { FinishRow } from '../../lib/stats/season';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

export default function WeeklyFinishes({ rows, refs, pin }: { rows: FinishRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const pct = (n: number, of: number) => `${of ? (n / of) * 100 : 0}%`;
  return (
    <ul className="space-y-1.5" aria-label="Weekly finishes">
      {rows.map((r) => (
        <li key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
          <ManagerName id={r.id} refs={refs} active={active} />
          <span className="flex h-4 overflow-hidden rounded bg-surface-2 text-[10px] font-semibold text-bg">
            <span data-part="top" title={`${r.top} weeks in the top three`} className="flex items-center justify-start bg-win pl-1" style={{ width: pct(r.top, r.weeks) }}>{r.top || ''}</span>
            <span data-part="middle" className="flex-1" />
            <span data-part="bottom" title={`${r.bottom} weeks in the bottom three`} className="flex items-center justify-end bg-loss pr-1" style={{ width: pct(r.bottom, r.weeks) }}>{r.bottom || ''}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
