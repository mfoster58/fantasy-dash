import type { PlayerDirectory } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import { playerName } from '../../lib/players';
import type { WireActivity as WireData } from '../../lib/stats/roster';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

export default function WireActivity({ data, players, refs, pin }: { data: WireData; players: PlayerDirectory; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.indexOf(Number(key));
    const r = data.rows.find((x) => x.id === rowId);
    const n = r?.perWeek[i];
    if (!r || n === undefined) return null;
    // what the moves were: each add with how it came in, then whoever went out
    const moves = r.moves[i].map((m) => [`+ ${playerName(players, m.playerId)} (${m.type === 'waiver' ? `waiver${m.bid ? `, $${m.bid}` : ''}` : 'free agent'})`, ...m.dropped.map((d) => `− ${playerName(players, d)}`)].join(', '));
    return { fill: n ? tint('accent', n / 4) : 'var(--surface-2)', text: n ? String(n) : undefined, title: n ? `${name(rowId)} week ${key}: ${moves.join('; ')}` : `${name(rowId)} week ${key}: no pickups` };
  };
  const right = (rowId: string) => { const r = data.rows.find((x) => x.id === rowId); return r ? `${r.total} · $${r.faab}` : null; };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w) => ({ key: String(w), label: String(w) }))} cell={cell} refs={refs} pin={pin} right={right} ariaLabel="Wire activity" />;
}
