import { useState } from 'react';
import type { ManagerRef } from '../../lib/stats/scope';
import { COLUMNS, type ColumnDef, type StatRow } from '../../lib/stats/table';
import ManagerName from './ManagerName';
import { markAttrs, usePinHover, type Pin } from './pin';

interface Props { rows: StatRow[]; refs: ManagerRef[]; pin: Pin; allTime: boolean }
const PINNED_ROW = 'bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]';

/** Every manager, every advanced number, any column sortable. The manager column stays put while the rest scroll on a phone. */
export default function StatTable({ rows, refs, pin, allTime }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'ppg', dir: 'desc' });
  const columns = COLUMNS.filter((c) => allTime || c.group !== 'Season');
  const groups = columns.reduce<{ group: ColumnDef['group']; span: number }[]>((acc, c) => { const last = acc[acc.length - 1]; if (last && last.group === c.group) last.span += 1; else acc.push({ group: c.group, span: 1 }); return acc; }, []);
  const by = columns.find((c) => c.key === sort.key) ?? columns[0];
  const sorted = [...rows].sort((x, y) => (by.value(x) - by.value(y)) * (sort.dir === 'asc' ? 1 : -1) || (x.id < y.id ? -1 : 1));
  const click = (c: ColumnDef) => setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.higherBetter ? 'desc' : 'asc' }));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface" />
            {groups.map((g, i) => <th key={g.group + i} colSpan={g.span} className="section-label border-b border-line px-2 pb-1 text-left text-[10px]">{g.group}</th>)}
          </tr>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-normal text-muted">Manager</th>
            {columns.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="whitespace-nowrap px-2 py-1.5 text-right">
                <button type="button" title={c.title} onClick={() => click(c)} className={`font-medium hover:text-ink ${sort.key === c.key ? 'text-ink underline decoration-dotted underline-offset-4' : 'text-muted'}`}>
                  {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▴' : ' ▾') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const tint = r.id === active ? PINNED_ROW : '';
            return (
              <tr key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`border-t border-line ${tint} ${active !== null && active !== r.id ? 'opacity-60' : ''}`}>
                <th scope="row" className={`sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-normal ${tint}`}><ManagerName id={r.id} refs={refs} active={active} /></th>
                {columns.map((c) => <td key={c.key} className="num whitespace-nowrap px-2 py-1.5 text-right">{c.text(r)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
