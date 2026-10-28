import { useMemo } from 'react';
import type { PlayerDb, PlayerId } from '@fantasy-dash/core';
import { aggregate, type Agg } from '../../lib/playerdb/aggregate';
import { columnValue, groupsFor, type Tab } from '../../lib/playerdb/columns';
import { aggregateAllTime, mergeSeasons } from '../../lib/playerdb/merge';
import { columnTints } from '../../lib/playerdb/percentile';
import { ColumnHeaderCells, GroupHeaderCells, HeaderCell, StatCells, th } from '../players/db/GridParts';
import { useCollapsedGroups } from '../players/db/PlayerDbTable';
import TintCell from '../players/db/TintCell';
import { useIsPhone } from '../../lib/useIsPhone';

interface Row { year: number; agg: Agg; tint: (key: string) => string }

/** Season, G, PTS, PPG and RK stay put while the rest scrolls sideways; on a phone just the season */
const FIXED_KEYS = ['g', 'pts', 'ppg', 'posRank'];
const SEASON_W = '4.5rem';
const LEFT: Record<string, string> = { g: '4.5rem', pts: '7.25rem', ppg: '11.25rem', posRank: '14.75rem' };
const WIDTH: Record<string, string> = { g: '2.75rem', pts: '4rem', ppg: '3.5rem', posRank: '3rem' };

/** The Players table's columns for his position, one row per season tinted against that season's position peers, then the career row. */
export default function AdvancedBySeason({ id, dbs, tab }: { id: PlayerId; dbs: PlayerDb[]; tab: Tab }) {
  const [collapsed, toggle] = useCollapsedGroups(tab);
  const phone = useIsPhone();
  const fixed = phone ? [] : FIXED_KEYS;
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
  const stickOf = (key: string, under?: string) => (!phone && LEFT[key] ? { left: LEFT[key], width: WIDTH[key], under, edge: key === 'posRank' } : undefined);
  return (
    <section aria-labelledby="pp-adv" className="card">
      <div className="border-b border-line px-4 pb-2 pt-3"><h2 id="pp-adv" className="text-sm font-semibold uppercase tracking-wide">Advanced by season</h2></div>
      <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr><th colSpan={1 + fixed.length} className="sticky left-0 z-[2] bg-surface border-b border-line" /><th colSpan={lead.length - fixed.length} className="border-b border-line" /><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={toggle} /></tr>
          <tr><th scope="col" className={`${th} sticky left-0 z-[2] bg-surface border-b border-line text-left`} style={{ width: SEASON_W, minWidth: SEASON_W, maxWidth: SEASON_W }}>Season</th>{lead.map((c) => <HeaderCell key={c.key} col={c} title={c.def} left={phone ? undefined : LEFT[c.key]} width={phone ? undefined : WIDTH[c.key]} />)}<ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} /></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <td className="num sticky left-0 z-[1] border-b border-line bg-surface px-3 py-1.5" style={{ width: SEASON_W, minWidth: SEASON_W, maxWidth: SEASON_W }}>{r.year}</td>
              {lead.map((c) => <TintCell key={c.key} value={columnValue(c, r.agg, 'total')} col={c} mode="total" tint={r.tint(c.key)} dim={false} est={Boolean(c.est) && r.agg.routesEst} stick={stickOf(c.key)} />)}
              <StatCells groups={body} collapsed={collapsed} agg={r.agg} mode="total" tint={r.tint} />
            </tr>
          ))}
          {career && (
            <tr className="bg-surface-2 font-semibold">
              <td className="sticky left-0 z-[1] border-b border-line bg-surface-2 px-3 py-1.5" style={{ width: SEASON_W, minWidth: SEASON_W, maxWidth: SEASON_W }}>Career</td>
              {/* a position rank across seasons means nothing */}
              {lead.map((c) => <TintCell key={c.key} value={c.key === 'posRank' ? null : columnValue(c, career, 'total')} col={c} mode="total" tint="transparent" dim={false} est={Boolean(c.est) && career.routesEst} stick={stickOf(c.key, 'var(--surface-2)')} />)}
              <StatCells groups={body} collapsed={collapsed} agg={career} mode="total" tint={plain} />
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </section>
  );
}
