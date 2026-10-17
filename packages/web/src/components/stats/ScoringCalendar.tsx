import type { ManagerRef } from '../../lib/stats/scope';
import type { CalendarData } from '../../lib/stats/season';
import { fmtPts, fmtSigned } from '../../lib/format';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

/** a swing this big fills the cell's colour */
const FULL = 45;

export default function ScoringCalendar({ data, refs, pin, bySeason = false }: { data: CalendarData; refs: ManagerRef[]; pin: Pin; /** columns are seasons and cells points per game */ bySeason?: boolean }) {
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  if (data.weeks.length === 0) return <Empty />;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.findIndex((w) => String(w.week) === key);
    const c = data.rows.find((r) => r.id === rowId)?.cells[i];
    if (!c) return null;
    const full = bySeason ? 15 : FULL;
    const fill = tint(c.delta >= 0 ? 'win' : 'loss', Math.abs(c.delta) / full);
    if (bySeason) return { fill, text: String(Math.round(c.points)), title: `${name(rowId)} ${c.week}: ${c.points.toFixed(1)} a game, league ${c.avg.toFixed(1)} (${fmtSigned(c.delta, 1)})` };
    return { fill, text: String(Math.round(c.points)), title: `Week ${c.week}: ${fmtPts(c.points)}, league average ${fmtPts(c.avg)} (${fmtSigned(c.delta, 2)})` };
  };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w, i) => ({ key: String(w.week), label: String(w.week), divider: i === data.playoffAt }))} cell={cell} refs={refs} pin={pin} ariaLabel="Scoring calendar" />;
}
