import type { PlayerDirectory } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import type { DraftReturns as DraftData } from '../../lib/stats/roster';
import { fmtPts } from '../../lib/format';
import { playerName } from '../../lib/players';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

/** cells at or above this print their points */
const PRINT_FROM = 60;

export default function DraftReturns({ data, players, refs, pin }: { data: DraftData | null; players: PlayerDirectory; refs: ManagerRef[]; pin: Pin }) {
  if (!data) return <Empty text="No draft recorded." />;
  const max = Math.max(1, ...data.rows.flatMap((r) => r.cells.map((c) => c.points)));
  const cell = (rowId: string, key: string): HeatCell | null => {
    const c = data.rows.find((r) => r.id === rowId)?.cells[Number(key) - 1];
    if (!c) return null;
    return { fill: tint('win', c.points / max), text: c.points >= PRINT_FROM ? String(Math.round(c.points)) : undefined, title: c.playerId ? `${playerName(players, c.playerId)} · ${fmtPts(c.points)} started points` : 'No pick' };
  };
  const cols = Array.from({ length: data.rounds }, (_, i) => ({ key: String(i + 1), label: `R${i + 1}` }));
  return <Heatmap rows={data.rows} cols={cols} cell={cell} refs={refs} pin={pin} ariaLabel="Draft returns by round" />;
}
