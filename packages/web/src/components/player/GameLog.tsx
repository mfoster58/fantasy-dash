import { useMemo } from 'react';
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { ManagerLink } from '../NameLink';
import SeasonPicker from '../SeasonPicker';
import { history } from '../../data/load';
import { gameLog, weekTints } from '../../lib/player/gameLog';
import { COLUMNS, columnValue, groupsFor, type Tab } from '../../lib/playerdb/columns';
import type { PlayerLine } from '../../lib/playerLines';
import { ColumnHeaderCells, GroupHeaderCells, HeaderCell, StatCells, th } from '../players/db/GridParts';
import { useCollapsedGroups } from '../players/db/PlayerDbTable';
import TintCell from '../players/db/TintCell';

/** fantasy points and points against projection lead each week; games, PPG and rank mean nothing for one week */
const LEAD = ['pts', 'projPlus'].map((k) => COLUMNS[k]);
const FIXED = ['Wk', 'Opp', 'Manager', 'Status', 'Result'];
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
    <section aria-labelledby="pp-log" className="card overflow-auto">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-log" className="text-sm font-semibold uppercase tracking-wide">Game log</h2>
        <SeasonPicker years={years} value={db.year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
      </div>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr><th colSpan={FIXED.length + lead.length} className="border-b border-line" /><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={toggle} /></tr>
          <tr>
            {FIXED.map((h) => <th key={h} scope="col" className={`${th} border-b border-line text-left`}>{h === 'Status' ? '' : h}</th>)}
            {lead.map((c) => <HeaderCell key={c.key} col={c} title={c.def} />)}
            <ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const l = r.line;
            const name = l ? history.managers[l.userId]?.displayName ?? l.userId : '';
            const fixed = (
              <>
                <td className={`num ${td}`}>{r.week}</td>
                <td className={`whitespace-nowrap text-muted ${td}`}>{r.opp}</td>
                <td className={`whitespace-nowrap ${td}`}>
                  {l ? <span className="flex items-center gap-1.5"><Avatar avatar={history.managers[l.userId]?.avatar ?? null} name={name} size={18} /><ManagerLink userId={l.userId}>{name}</ManagerLink></span> : <span className="text-xs text-muted">FA</span>}
                </td>
                <td className={`text-xs ${l?.started ? '' : 'text-muted'} ${td}`}>{l ? (l.started ? 'Started' : 'Bench') : ''}</td>
                <td className={`num whitespace-nowrap text-xs ${td}`}>
                  {l && r.score && <span className={l.result === 'W' ? 'text-win' : l.result === 'L' ? 'text-loss' : ''}>{l.result} {r.score.mine.toFixed(1)}–{r.score.theirs.toFixed(1)}</span>}
                  {r.swing !== null && <span className="ml-1.5 text-muted">+{r.swing.toFixed(1)} left</span>}
                </td>
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
    </section>
  );
}
