import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import { Link } from 'react-router';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { playerName, playerPos, playerTeam } from '../../lib/players';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; year: number }

export default function DraftRoundOne({ draft, managers, players, year }: Props) {
  const picks = draft.picks.filter((p) => p.round === 1).sort((a, b) => a.pickNo - b.pickNo);
  return (
    <div className="card">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <div className="section-label">Round 1</div>
        <div className="text-xs text-muted">{draft.rounds} rounds · {draft.type}</div>
      </div>
      <ol className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
        {picks.map((p) => {
          const pos = playerPos(players, p.playerId);
          return (
            <li key={p.pickNo} className="grid grid-cols-[1.5rem_28px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-2 text-sm first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
              <span className="num text-muted">{p.pickNo}</span>
              <Headshot players={players} id={p.playerId} size={28} />
              <span className="min-w-0">
                <span className="truncate font-medium">{playerName(players, p.playerId)}</span>
                <span className="ml-1.5 text-xs text-muted">{managers[p.userId]?.displayName ?? p.userId}</span>
              </span>
              <span className="flex items-center gap-2">
                {p.isKeeper && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">Keeper</span>}
                <PosPill pos={pos} />
                <span className="w-8 text-xs text-muted">{playerTeam(players, p.playerId)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line px-4 py-2 text-xs"><Link to={`/draft/${year}`} className="text-accent hover:underline">Full draft board and analysis →</Link></div>
    </div>
  );
}
