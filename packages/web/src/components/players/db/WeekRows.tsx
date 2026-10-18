import type { PlayerDb } from '@fantasy-dash/core';
import { aggregateWeeks, type Agg } from '../../../lib/playerdb/aggregate';
import { columnValue, type ColumnDef, type Mode } from '../../../lib/playerdb/columns';
import TintCell from './TintCell';

interface Props { db: PlayerDb; agg: Agg; cols: ColumnDef[]; mode: Mode; span: number; weekLabel?: (week: number) => string }

/** The expanded row: his weeks in the range, one line each, and the range total. */
export default function WeekRows({ db, agg, cols, mode, span, weekLabel }: Props) {
  const weeks = agg.rows.map((r) => ({ row: r, a: aggregateWeeks(db, [r], 1) }));
  const cells = (a: Agg, est: boolean) => cols.map((c) => <TintCell key={c.key} value={columnValue(c, a, 'total')} col={c} mode="total" tint="transparent" dim={false} est={est && Boolean(c.est)} />);
  return (
    <tr data-testid="db-weeks">
      <td colSpan={span} className="bg-surface-2/50 px-3 py-2">
        <table className="w-full text-xs">
          <thead><tr className="section-label"><th className="px-2 py-1 text-left">Wk</th><th className="px-2 py-1 text-left">Opp</th>{cols.map((c) => <th key={c.key} className="px-2 py-1 text-center">{c.label}</th>)}</tr></thead>
          <tbody>
            {weeks.map(({ row, a }) => (
              <tr key={row.week} data-testid="db-week" className="border-t border-line/60">
                <td className="num whitespace-nowrap px-2 py-1">{weekLabel ? weekLabel(row.week) : row.week}</td><td className="px-2 py-1 text-muted">{row.team}{row.opp ? ` v ${row.opp}` : ''}</td>{cells(a, agg.routesEst)}
              </tr>
            ))}
            <tr data-testid="db-week-total" className="border-t border-line font-medium"><td className="px-2 py-1" colSpan={2}>{mode === 'pg' ? 'Per game' : 'Total'}</td>{cols.map((c) => <TintCell key={c.key} value={columnValue(c, agg, mode)} col={c} mode={mode} tint="transparent" dim={false} est={agg.routesEst && Boolean(c.est)} />)}</tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}
