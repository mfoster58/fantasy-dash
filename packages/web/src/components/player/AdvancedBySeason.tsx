import { useMemo } from 'react';
import type { PlayerDb, PlayerId } from '@fantasy-dash/core';
import { aggregate, type Agg } from '../../lib/playerdb/aggregate';
import { columnValue, groupsFor, type Tab } from '../../lib/playerdb/columns';
import { aggregateAllTime, mergeSeasons } from '../../lib/playerdb/merge';
import { columnTints } from '../../lib/playerdb/percentile';
import { ColumnHeaderCells, GroupHeaderCells, HeaderCell, StatCells, th } from '../players/db/GridParts';
import { useCollapsedGroups } from '../players/db/PlayerDbTable';
import TintCell from '../players/db/TintCell';

interface Row { year: number; agg: Agg; tint: (key: string) => string }

/** The Players table's columns for his position, one row per season tinted against that season's position peers, then the career row. */
export default function AdvancedBySeason({ id, dbs, tab }: { id: PlayerId; dbs: PlayerDb[]; tab: Tab }) {
  const [collapsed, toggle] = useCollapsedGroups(tab);
  const groups = useMemo(() => groupsFor(tab), [tab]);
  const lead = groups[0].cols, body = groups.slice(1);
  const rows = useMemo(() => dbs.flatMap((db): Row[] => {
    const pos = db.players[id]?.pos;
    const peers = aggregate(db, 1, Math.max(1, db.throughWeek)).filter((a) => db.players[a.id]?.pos === pos);
    const idx = peers.findIndex((a) => a.id === id);
    if (idx < 0) return [];
    const byKey = new Map(groups.flatMap((g) => g.cols).map((c) => [c.key, columnTints(c, peers, 'total')[idx]] as const));
    return [{ year: db.year, agg: peers[idx], tint: (k) => byKey.get(k) ?? 'transparent' }];
  }), [dbs, id, groups]);
  const career = useMemo(() => (dbs.length > 1 ? aggregateAllTime(mergeSeasons(dbs)).find((a) => a.id === id) ?? null : null), [dbs, id]);
  const plain = () => 'transparent';
  return (
    <section aria-labelledby="pp-adv" className="card overflow-auto">
      <div className="border-b border-line px-4 pb-2 pt-3"><h2 id="pp-adv" className="text-sm font-semibold uppercase tracking-wide">Advanced by season</h2></div>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr><th colSpan={1 + lead.length} className="border-b border-line" /><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={toggle} /></tr>
          <tr><th scope="col" className={`${th} border-b border-line text-left`}>Season</th>{lead.map((c) => <HeaderCell key={c.key} col={c} title={c.def} />)}<ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} /></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <td className="num border-b border-line px-3 py-1.5">{r.year}</td>
              {lead.map((c) => <TintCell key={c.key} value={columnValue(c, r.agg, 'total')} col={c} mode="total" tint={r.tint(c.key)} dim={false} est={Boolean(c.est) && r.agg.routesEst} />)}
              <StatCells groups={body} collapsed={collapsed} agg={r.agg} mode="total" tint={r.tint} />
            </tr>
          ))}
          {career && (
            <tr className="bg-surface-2 font-semibold">
              <td className="border-b border-line px-3 py-1.5">Career</td>
              {/* a position rank across seasons means nothing */}
              {lead.map((c) => <TintCell key={c.key} value={c.key === 'posRank' ? null : columnValue(c, career, 'total')} col={c} mode="total" tint="transparent" dim={false} est={Boolean(c.est) && career.routesEst} />)}
              <StatCells groups={body} collapsed={collapsed} agg={career} mode="total" tint={plain} />
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
