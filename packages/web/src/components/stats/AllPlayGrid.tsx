import type { ManagerRef } from '../../lib/stats/scope';
import type { AllPlayGrid as AllPlayData } from '../../lib/stats/strength';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

export default function AllPlayGrid({ grid, refs, pin }: { grid: AllPlayData; refs: ManagerRef[]; pin: Pin }) {
  if (grid.ids.length < 2) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const cell = (a: string, b: string): HeatCell | null => {
    const c = grid.cells[a]?.[b];
    if (!c) return null;
    const total = c.w + c.l + c.t;
    const p = total ? c.w / total : 0.5;
    const real = c.realW + c.realL + c.realT;
    return {
      fill: p === 0.5 ? 'var(--surface-2)' : tint(p > 0.5 ? 'win' : 'loss', Math.abs(p - 0.5) * 2),
      text: `${c.w}-${c.l}`,
      title: `${name(a)} outscored ${name(b)} in ${c.w} of ${total} weeks${real ? ` · played ${times(real)}, ${c.realW}-${c.realL}${c.realT ? `-${c.realT}` : ''}` : ' · never played'}`,
    };
  };
  return <Heatmap rows={grid.ids.map((id) => ({ id }))} cols={grid.ids.map((id) => ({ key: id, label: name(id).slice(0, 6) }))} cell={cell} refs={refs} pin={pin} ariaLabel="Head to head" />;
}
