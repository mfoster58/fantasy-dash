import type { ManagerRef } from '../../lib/stats/scope';
import type { WireActivity as WireData } from '../../lib/stats/roster';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

export default function WireActivity({ data, refs, pin }: { data: WireData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.indexOf(Number(key));
    const n = data.rows.find((r) => r.id === rowId)?.perWeek[i];
    if (n === undefined) return null;
    return { fill: n ? tint('accent', n / 4) : 'var(--surface-2)', text: n ? String(n) : undefined, title: `${name(rowId)} week ${key}: ${n} pickup${n === 1 ? '' : 's'}` };
  };
  const right = (rowId: string) => { const r = data.rows.find((x) => x.id === rowId); return r ? `${r.total} · $${r.faab}` : null; };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w) => ({ key: String(w), label: String(w) }))} cell={cell} refs={refs} pin={pin} right={right} ariaLabel="Wire activity" />;
}
