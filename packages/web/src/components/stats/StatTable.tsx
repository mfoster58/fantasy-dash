import { useState } from 'react';
import type { ManagerRef } from '../../lib/stats/scope';
import { COLUMNS, type ColumnDef, type StatRow } from '../../lib/stats/table';
import ManagerName from './ManagerName';
import { markAttrs, tint, usePinHover, type Pin } from './pin';

interface Props { rows: StatRow[]; refs: ManagerRef[]; pin: Pin; allTime: boolean }
const PINNED_ROW = 'bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]';
/** columns that describe rather than rank, left untinted */
const UNTINTED = new Set(['seasons']);

/**
 * Where a row sits in a column, from -1 (worst) to 1 (best), by rank so one outlier does not wash the rest out;
 * null when the column cannot be ranked (all equal, or a postseason column the row has no games for).
 */
function standing(col: ColumnDef, rows: StatRow[], r: StatRow): number | null {
  if (UNTINTED.has(col.key)) return null;
  const counts = (x: StatRow) => !(col.group === 'Games' && col.key.startsWith('post') && x.postGames === 0);
  if (!counts(r)) return null;
  const vals = rows.filter(counts).map((x) => col.value(x));
  if (vals.length < 2 || vals.every((v) => v === vals[0])) return null;
  const v = col.value(r);
  const better = vals.filter((x) => (col.higherBetter ? x < v : x > v)).length;
  const worse = vals.filter((x) => (col.higherBetter ? x > v : x < v)).length;
  return (better - worse) / (vals.length - 1);
}

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
            <th className="sticky left-0 z-[1] bg-surface" />
            {groups.map((g, i) => <th key={g.group + i} colSpan={g.span} className="section-label border-b border-line px-2 pb-1 text-left text-[10px]">{g.group}</th>)}
          </tr>
          <tr>
            <th scope="col" className="sticky left-0 z-[1] bg-surface px-2 py-1.5 text-left font-normal text-muted">Manager</th>
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
            const rowTint = r.id === active ? PINNED_ROW : '';
            return (
              <tr key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`border-t border-line ${rowTint} ${active !== null && active !== r.id ? 'opacity-60' : ''}`}>
                <th scope="row" className={`sticky left-0 z-[1] bg-surface px-2 py-1.5 text-left font-normal ${rowTint}`}><ManagerName id={r.id} refs={refs} active={active} /></th>
                {columns.map((c) => {
                  const s = standing(c, rows, r);
                  const tone = s === null || s === 0 ? undefined : s > 0 ? 'good' : 'bad';
                  return (
                    <td key={c.key} data-tone={tone} className="num whitespace-nowrap px-2 py-1.5 text-right"
                      style={tone ? { background: tint(tone === 'good' ? 'win' : 'loss', Math.abs(s!) * 0.5) } : undefined}>{c.text(r)}</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
