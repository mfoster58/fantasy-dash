import { Link } from 'react-router';
import type { Game, GameSide, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { fmtPct, fmtPts, fmtRecord } from '../lib/format';
import { topPerformers } from '../lib/metrics';

interface Props {
  game: Game;
  played: boolean;
  managers: Record<UserId, Manager>;
  players: PlayerDirectory;
  to: string;
}

export default function ScoreCard({ game, played, managers, players, to }: Props) {
  const top = played ? topPerformers(game) : [];
  const status = !played ? 'Upcoming' : game.winner === null ? 'Tie' : null;
  return (
    <Link to={to} className="block rounded-lg border border-line bg-surface transition-colors hover:border-accent/60">
      <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted">
        <span className={game.tag ? 'font-medium text-accent' : ''}>{game.tag ?? `Week ${game.week}`}</span>
        {status && <span>{status}</span>}
      </div>
      <div className="space-y-2 px-4 py-2">
        {game.sides.map((side) => (
          <SideRow key={side.userId} side={side} manager={managers[side.userId]} isWinner={game.winner === side.userId} played={played} />
        ))}
      </div>
      {top.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs">
          {top.map((t) => (
            <span key={t.playerId} className="flex items-center gap-1.5">
              <span className="num text-ink">{fmtPts(t.points)}</span>
              <span className="truncate text-muted">{players[t.playerId]?.name ?? t.playerId}</span>
              <span className="text-muted/70">{managers[t.userId]?.displayName}</span>
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function SideRow({ side, manager, isWinner, played }: { side: GameSide; manager?: Manager; isWinner: boolean; played: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${isWinner || !played ? 'text-ink' : 'text-muted'}`}>
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{manager?.teamName ?? manager?.displayName ?? side.userId}</div>
        <div className="text-xs text-muted">{manager?.displayName} · <span>{fmtRecord(side.recordBefore)}</span></div>
      </div>
      {played && (
        <span className="num rounded bg-surface-2 px-1.5 py-0.5 text-[11px]" title="Efficiency: points divided by the best possible lineup">
          {fmtPct(side.efficiency, 0)}
        </span>
      )}
      <span className={`num text-lg ${isWinner ? 'font-semibold' : ''}`}>
        {played ? fmtPts(side.points) : <span className="text-sm text-muted">{fmtPts(side.projected)} proj</span>}
      </span>
    </div>
  );
}
