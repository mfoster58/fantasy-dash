import type { GameSide, PlayerDirectory, PlayerLine } from '@fantasy-dash/core';
import { fmtPts } from '../../lib/format';
import { playerName, playerPos, playerTeam, statLine } from '../../lib/players';
import Headshot from '../Headshot';
import PosPill from '../PosPill';

interface Props { sides: [GameSide, GameSide]; slots: string[]; players: PlayerDirectory }

function PlayerCell({ line, players, align, showPos = false }: {
  line: PlayerLine | null; players: PlayerDirectory; align: 'left' | 'right'; showPos?: boolean;
}) {
  if (!line) return <div className={`text-sm text-muted ${align === 'right' ? 'sm:text-right' : ''}`}>Empty</div>;
  const pos = playerPos(players, line.playerId);
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === 'right' ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      <Headshot players={players} id={line.playerId} size={32} />
      {showPos && <PosPill pos={pos} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {playerName(players, line.playerId)} <span className="text-xs font-normal text-muted">{playerTeam(players, line.playerId)}</span>
        </div>
        <div className="truncate text-xs text-muted">{statLine(pos, line.stats) || '-'}</div>
      </div>
      <div className="num shrink-0 text-right text-sm">{fmtPts(line.points)}</div>
    </div>
  );
}

export default function LineupTable({ sides, slots, players }: Props) {
  const [a, b] = sides;
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-line">
        {slots.map((slot, i) => (
          <div key={`${slot}-${i}`} className="grid grid-cols-[3rem_1fr] sm:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 px-5 py-2.5">
            <div className="min-w-0 col-start-2 sm:col-auto">
              <PlayerCell line={a.starters[i]?.player ?? null} players={players} align="left" />
            </div>
            <span className="order-first row-span-2 flex self-center sm:order-none sm:row-span-1 sm:w-14 sm:justify-center"><PosPill pos={slot} /></span>
            <div className="min-w-0 col-start-2 sm:col-auto border-t border-line pt-2 sm:border-0 sm:pt-0">
              <PlayerCell line={b.starters[i]?.player ?? null} players={players} align="right" />
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-surface-2 px-5 py-2.5 text-sm font-semibold">
          <span className="num">{fmtPts(a.points)}</span>
          <span className="section-label w-14 text-center">Total</span>
          <span className="num text-right">{fmtPts(b.points)}</span>
        </div>
      </div>
      <details className="border-t border-line px-5 py-2.5">
        <summary className="section-label cursor-pointer hover:text-ink">Bench</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">{a.bench.map((l) => <PlayerCell key={l.playerId} line={l} players={players} align="left" showPos />)}</div>
          <div className="space-y-2">{b.bench.map((l) => <PlayerCell key={l.playerId} line={l} players={players} align="right" showPos />)}</div>
        </div>
      </details>
    </div>
  );
}
