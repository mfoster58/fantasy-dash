import type { ManagerRef } from '../../lib/stats/scope';
import type { CalendarData } from '../../lib/stats/season';
import { fmtPts, fmtSigned } from '../../lib/format';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

/** a swing this big fills the cell's colour */
const FULL = 45;

export default function ScoringCalendar({ data, refs, pin }: { data: CalendarData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.indexOf(Number(key));
    const c = data.rows.find((r) => r.id === rowId)?.cells[i];
    if (!c) return null;
    return { fill: tint(c.delta >= 0 ? 'win' : 'loss', Math.abs(c.delta) / FULL), text: String(Math.round(c.points)), title: `Week ${c.week}: ${fmtPts(c.points)}, league average ${fmtPts(c.avg)} (${fmtSigned(c.delta, 2)})` };
  };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w) => ({ key: String(w), label: String(w) }))} cell={cell} refs={refs} pin={pin} ariaLabel="Scoring calendar" />;
}
