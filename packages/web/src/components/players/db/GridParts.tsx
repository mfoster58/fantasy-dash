import type { Agg } from '../../../lib/playerdb/aggregate';
import { belowMin, columnValue, type ColumnDef, type Mode } from '../../../lib/playerdb/columns';
import TintCell from './TintCell';

/** Header and body pieces of a column-grouped stat table, shared by the Players table and the player page. */
export type Group = { group: string; cols: ColumnDef[] };
export const th = 'section-label whitespace-nowrap px-2 py-2 text-center';

/** A column header; a sort button when `onSort` is given, a plain label otherwise. */
export function HeaderCell({ col, title, arrow = '', onSort, first = false }: { col: ColumnDef; title: string; arrow?: string; onSort?: (key: string) => void; first?: boolean }) {
  return (
    <th scope="col" title={title} className={`${th} border-b border-line ${first ? 'border-l' : ''}`}>
      {onSort ? <button type="button" onClick={() => onSort(col.key)} className="hover:text-ink">{col.label}{arrow}</button> : <>{col.label}{arrow}</>}
    </th>
  );
}

/** The group-title row's cells, each a collapse toggle. */
export function GroupHeaderCells({ groups, collapsed, onToggleGroup }: { groups: Group[]; collapsed: ReadonlySet<string>; onToggleGroup: (group: string) => void }) {
  return <>{groups.map((g) => {
    const off = collapsed.has(g.group);
    return (
      <th key={g.group} colSpan={off ? 1 : g.cols.length} className="section-label border-b border-l border-line px-2 py-1 text-left">
        <button type="button" aria-label={`${off ? 'Expand' : 'Collapse'} ${g.group}`} onClick={() => onToggleGroup(g.group)} className="hover:text-ink">{off ? '▸ ' : '▾ '}{g.group}</button>
      </th>
    );
  })}</>;
}

/** Column headers for the groups; a collapsed group is one '…' cell. */
export function ColumnHeaderCells({ groups, collapsed, title, arrow, onSort }: { groups: Group[]; collapsed: ReadonlySet<string>; title: (c: ColumnDef) => string; arrow?: (key: string) => string; onSort?: (key: string) => void }) {
  return <>{groups.map((g) => (collapsed.has(g.group)
    ? <th key={g.group} className={`${th} border-b border-l border-line text-muted`}>…</th>
    : g.cols.map((c, i) => <HeaderCell key={c.key} col={c} title={title(c)} arrow={arrow?.(c.key)} onSort={onSort} first={i === 0} />)))}</>;
}

/** One row's cells for the groups; a collapsed group is one blank cell. */
export function StatCells({ groups, collapsed, agg, mode, tint }: { groups: Group[]; collapsed: ReadonlySet<string>; agg: Agg; mode: Mode; tint: (key: string) => string }) {
  return <>{groups.map((g) => (collapsed.has(g.group)
    ? <td key={g.group} className="border-b border-l border-line" />
    : g.cols.map((c) => <TintCell key={c.key} value={columnValue(c, agg, mode)} col={c} mode={mode} tint={tint(c.key)} dim={belowMin(c, agg)} est={Boolean(c.est) && agg.routesEst} />)))}</>;
}
