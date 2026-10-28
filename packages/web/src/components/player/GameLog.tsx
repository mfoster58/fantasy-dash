import { useMemo } from 'react';
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import SeasonPicker from '../SeasonPicker';
import { gameLog, weekTints } from '../../lib/player/gameLog';
import { COLUMNS, columnValue, groupsFor, type Tab } from '../../lib/playerdb/columns';
import type { PlayerLine } from '../../lib/playerLines';
import { ColumnHeaderCells, GroupHeaderCells, HeaderCell, StatCells, th } from '../players/db/GridParts';
import { useCollapsedGroups } from '../players/db/PlayerDbTable';
import TintCell from '../players/db/TintCell';

/** fantasy points and points against projection lead each week; games, PPG and rank mean nothing for one week */
const LEAD = ['pts', 'projPlus'].map((k) => COLUMNS[k]);
const FIXED = ['Wk', 'Opp', 'Status'];
/** Wk and Opp stay put while the rest scrolls sideways */
const STICK_LEFT = ['0', '2.75rem'];
const STICK_W = ['2.75rem', '3.5rem'];
const td = 'border-b border-line px-2 py-1.5';

/** The Players table for one player, one row per week, with the league week he spent on a roster to the left. */
export default function GameLog({ id, db, lines, season, tab, pos, years, onYear }: { id: PlayerId; db: PlayerDb; lines: PlayerLine[]; season: Season | undefined; tab: Tab; pos: string; years: number[]; onYear: (y: number) => void }) {
  const [collapsed, toggle] = useCollapsedGroups(tab);
  const body = useMemo(() => groupsFor(tab).slice(1), [tab]);
  const lead = LEAD;
  const rows = useMemo(() => gameLog(db, id, lines, season), [db, id, lines, season]);
  const tints = useMemo(() => weekTints(db, rows, [...lead, ...body.flatMap((g) => g.cols)], pos), [db, rows, body, pos]);
  const statSpan = lead.length + body.reduce((n, g) => n + (collapsed.has(g.group) ? 1 : g.cols.length), 0);
  return (
    <section aria-labelledby="pp-log" className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-log" className="text-sm font-semibold uppercase tracking-wide">Game log</h2>
        <SeasonPicker years={years} value={db.year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
      </div>
      <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr><th colSpan={2} className="sticky left-0 z-[2] bg-surface border-b border-line" /><th colSpan={FIXED.length - 2 + lead.length} className="border-b border-line" /><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={toggle} /></tr>
          <tr>
            {FIXED.map((h, n) => <th key={h} scope="col" className={`${th} border-b border-line text-left ${n < 2 ? 'sticky z-[2] bg-surface' : ''}`} style={n < 2 ? { left: STICK_LEFT[n], width: STICK_W[n], minWidth: STICK_W[n], maxWidth: STICK_W[n] } : undefined}>{h === 'Status' ? '' : h}</th>)}
            {lead.map((c) => <HeaderCell key={c.key} col={c} title={c.def} />)}
            <ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const l = r.line;
            const fixed = (
              <>
                <td className={`num sticky z-[1] bg-surface ${td}`} style={{ left: STICK_LEFT[0], width: STICK_W[0], minWidth: STICK_W[0], maxWidth: STICK_W[0] }}>{r.week}</td>
                <td className={`sticky z-[1] whitespace-nowrap bg-surface text-muted shadow-[inset_-1px_0_0_var(--line)] ${td}`} style={{ left: STICK_LEFT[1], width: STICK_W[1], minWidth: STICK_W[1], maxWidth: STICK_W[1] }}>{r.opp}</td>
                <td className={`text-xs ${l?.started ? '' : 'text-muted'} ${td}`}>{l ? (l.started ? 'Started' : 'Bench') : 'FA'}</td>
              </>
            );
            if (!r.agg) return <tr key={r.week} data-testid="log-gap">{fixed}<td colSpan={statSpan} className={`text-xs text-muted ${td}`}>{r.bye ? 'Bye' : 'Did not play'}</td></tr>;
            const agg = r.agg;
            return (
              <tr key={r.week} data-testid="log-week">
                {fixed}
                {lead.map((c) => <TintCell key={c.key} value={columnValue(c, agg, 'total')} col={c} mode="total" tint={tints.get(c.key)?.[i] ?? 'transparent'} dim={false} est={Boolean(c.est) && agg.routesEst} />)}
                <StatCells groups={body} collapsed={collapsed} agg={agg} mode="total" tint={(k) => tints.get(k)?.[i] ?? 'transparent'} />
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}
