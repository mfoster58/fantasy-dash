import type { GameSide, PlayerDirectory, PlayerLine } from '@fantasy-dash/core';
import { fmtPts } from '../../lib/format';
import { playerName, playerPos, playerTeam, posColor, statLine } from '../../lib/players';

interface Props { sides: [GameSide, GameSide]; slots: string[]; players: PlayerDirectory }

function PlayerCell({ line, players, align }: { line: PlayerLine | null; players: PlayerDirectory; align: 'left' | 'right' }) {
  if (!line) return <div className={`text-sm text-muted ${align === 'right' ? 'text-right' : ''}`}>Empty</div>;
  const pos = playerPos(players, line.playerId);
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold text-white" style={{ background: posColor(pos) }}>
        {pos}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {playerName(players, line.playerId)} <span className="text-xs text-muted">{playerTeam(players, line.playerId)}</span>
        </div>
        <div className="truncate text-xs text-muted">{statLine(pos, line.stats) || '-'}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="num text-sm">{fmtPts(line.points)}</div>
        <div className="num text-[11px] text-muted">{line.projected === null ? 'no proj' : fmtPts(line.projected)}</div>
      </div>
    </div>
  );
}

export default function LineupTable({ sides, slots, players }: Props) {
  const [a, b] = sides;
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="divide-y divide-line">
        {slots.map((slot, i) => (
          <div key={`${slot}-${i}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2">
            <PlayerCell line={a.starters[i]?.player ?? null} players={players} align="left" />
            <span className="w-12 text-center text-[11px] uppercase tracking-wide text-muted">{slot}</span>
            <PlayerCell line={b.starters[i]?.player ?? null} players={players} align="right" />
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-surface-2 px-4 py-2 text-sm font-semibold">
          <span className="num">{fmtPts(a.points)}</span>
          <span className="w-12 text-center text-[11px] uppercase text-muted">Total</span>
          <span className="num text-right">{fmtPts(b.points)}</span>
        </div>
      </div>
      <details className="border-t border-line px-4 py-2">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted">Bench</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">{a.bench.map((l) => <PlayerCell key={l.playerId} line={l} players={players} align="left" />)}</div>
          <div className="space-y-2">{b.bench.map((l) => <PlayerCell key={l.playerId} line={l} players={players} align="right" />)}</div>
        </div>
      </details>
    </div>
  );
}
