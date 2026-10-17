import { useState } from 'react';
import type { PlayerDirectory } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import type { DraftReturns as DraftData } from '../../lib/stats/roster';
import { fmtPts, fmtSigned } from '../../lib/format';
import { playerName } from '../../lib/players';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

/** cells at or above this print their points */
const PRINT_FROM = 60;
type Mode = 'points' | 'value';

export default function DraftReturns({ data, players, refs, pin }: { data: DraftData | null; players: PlayerDirectory; refs: ManagerRef[]; pin: Pin }) {
  const [mode, setMode] = useState<Mode>('points');
  if (!data) return <Empty text="No draft recorded." />;
  const maxPts = Math.max(1, ...data.rows.flatMap((r) => r.cells.map((c) => c.points)));
  const maxVal = Math.max(1, ...data.rows.flatMap((r) => r.cells.map((c) => Math.abs(c.value ?? 0))));
  const rows = mode === 'points' ? data.rows : [...data.rows].sort((x, y) => y.totalValue - x.totalValue || (x.id < y.id ? -1 : 1));
  const cell = (rowId: string, key: string): HeatCell | null => {
    const c = data.rows.find((r) => r.id === rowId)?.cells[Number(key) - 1];
    if (!c) return null;
    const who = c.playerId ? playerName(players, c.playerId) : 'No pick';
    if (mode === 'points') {
      return { fill: tint('win', c.points / maxPts), text: c.points >= PRINT_FROM ? String(Math.round(c.points)) : undefined, title: c.playerId ? `${who} · ${fmtPts(c.points)} started points` : who };
    }
    if (c.value === null) return { fill: 'var(--surface-2)', title: c.playerId ? `${who} · not graded` : who };
    return { fill: tint(c.value >= 0 ? 'win' : 'loss', Math.abs(c.value) / maxVal), text: fmtSigned(c.value, 0), title: `${who} · value ${fmtSigned(c.value, 1)}` };
  };
  const cols = Array.from({ length: data.rounds }, (_, i) => ({ key: String(i + 1), label: `R${i + 1}` }));
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Show" className="flex gap-1 text-xs">
        {(['points', 'value'] as Mode[]).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={`rounded-full px-2.5 py-0.5 ${mode === m ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>{m === 'points' ? 'Points' : 'Value'}</button>
        ))}
      </div>
      <Heatmap rows={rows} cols={cols} cell={cell} refs={refs} pin={pin} ariaLabel="Draft returns by round" />
    </div>
  );
}
