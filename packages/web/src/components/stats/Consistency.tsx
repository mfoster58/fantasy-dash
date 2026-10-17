import type { ManagerRef } from '../../lib/stats/scope';
import type { ConsistencyRow } from '../../lib/stats/strength';
import { fmtPts } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

export default function Consistency({ rows, refs, pin }: { rows: ConsistencyRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const lo = Math.floor(Math.min(...rows.map((r) => r.min)) / 10) * 10, hi = Math.ceil(Math.max(...rows.map((r) => r.max)) / 10) * 10;
  const x = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  const ticks = [lo, Math.round((lo + hi) / 20) * 10, hi];
  return (
    <div>
      <ul className="space-y-1.5" aria-label="Consistency">
        {rows.map((r) => (
          <li key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="relative h-4">
              <span className="absolute top-1/2 h-px -translate-y-1/2 bg-muted opacity-60" style={{ left: x(r.min), width: `calc(${x(r.max)} - ${x(r.min)})` }} />
              <span data-box title={`${name(r.id)}: floor ${fmtPts(r.floor)}, median ${fmtPts(r.median)}, ceiling ${fmtPts(r.ceiling)}; worst ${fmtPts(r.min)}, best ${fmtPts(r.max)}`} className="absolute top-0.5 h-3 rounded-sm" style={{ left: x(r.floor), width: `calc(${x(r.ceiling)} - ${x(r.floor)})`, background: r.id === active ? 'var(--gold)' : 'var(--dim)', opacity: 0.8 }} />
              <span className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-ink" style={{ left: x(r.median) }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="relative ml-[7rem] mt-1 h-4 text-[10px] text-muted">
        {ticks.map((t) => <span key={t} className="num absolute -translate-x-1/2" style={{ left: x(t) }}>{t}</span>)}
      </div>
    </div>
  );
}
