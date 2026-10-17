import type { ManagerRef } from '../../lib/stats/scope';
import type { FormData } from '../../lib/stats/season';
import { fmtPts } from '../../lib/format';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import type { Pin } from './pin';

/** muted squares: the result colour mixed into the card, so a column of them reads calmly */
const FILL = { W: 'color-mix(in srgb, var(--win) 45%, var(--surface-2))', L: 'color-mix(in srgb, var(--loss) 45%, var(--surface-2))', T: 'var(--surface-2)' } as const;

export default function FormGuide({ data, refs, pin }: { data: FormData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.findIndex((w) => String(w.week) === key);
    const c = data.rows.find((r) => r.id === rowId)?.cells[i];
    if (!c) return null;
    return { fill: FILL[c.result], text: c.result, dot: c.top, title: `Week ${c.week}: ${fmtPts(c.points)} vs ${name(c.oppId)} ${fmtPts(c.oppPoints)}` };
  };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w, i) => ({ key: String(w.week), label: String(w.week), divider: i === data.playoffAt }))} cell={cell} refs={refs} pin={pin} ariaLabel="Form guide" />;
}
