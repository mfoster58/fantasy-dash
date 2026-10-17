import type { ManagerRef } from '../../lib/stats/scope';
import type { OriginRow } from '../../lib/stats/roster';
import { fmtPts } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

const PARTS: { key: 'draft' | 'pickup' | 'trade' | 'other'; label: string; colour: string }[] = [
  { key: 'draft', label: 'Draft', colour: 'var(--win)' }, { key: 'pickup', label: 'Waivers and free agents', colour: 'var(--gold)' },
  { key: 'trade', label: 'Trade', colour: 'var(--pos-K)' }, { key: 'other', label: 'Unknown', colour: 'var(--dim)' },
];

export default function PointOrigins({ rows, refs, pin }: { rows: OriginRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const used = PARTS.filter((p) => rows.some((r) => r[p.key] > 0));
  return (
    <div>
      <ul className="space-y-1.5" aria-label="Where the points came from">
        {rows.map((r) => (
          <li key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="flex h-4 overflow-hidden rounded bg-surface-2 text-[10px] font-semibold text-bg">
              {used.map((p) => { const share = r.total ? r[p.key] / r.total : 0; return (
                <span key={p.key} data-part={p.key} title={`${p.label}: ${fmtPts(r[p.key])} points, ${Math.round(share * 100)}%`} className="flex items-center justify-center" style={{ width: `${share * 100}%`, background: p.colour, opacity: r.id === active ? 1 : 0.85 }}>{share >= 0.08 ? `${Math.round(share * 100)}%` : ''}</span>
              ); })}
            </span>
          </li>
        ))}
      </ul>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
        {used.map((p) => <li key={p.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.colour }} />{p.label}</li>)}
      </ul>
    </div>
  );
}
