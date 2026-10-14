import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtPpg } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import { pickLabel, topHealthyPpg } from '../../lib/draft';
import { CardHeader } from './DraftAnalysis';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

export default function TopPpg({ draft, managers, players, inSeason }: Props) {
  const rows = topHealthyPpg(draft, 10);
  return (
    <div className="card">
      <CardHeader label={`Healthy players${inSeason ? ' (to date)' : ''}`} title="Top points per game" />
      {rows.length === 0
        ? <p className="px-4 py-2 text-xs text-muted">No games played yet.</p>
        : (
          <ul className="divide-y divide-line px-4">
            {rows.map((p) => (
              <li key={p.pickNo} className="flex items-center gap-3 py-2 text-sm">
                <span className="num w-9 text-xs text-muted">{pickLabel(p, draft.slotOrder.length)}</span>
                <Headshot players={players} id={p.playerId} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="truncate font-medium">{playerName(players, p.playerId)}</span><PosPill pos={playerPos(players, p.playerId)} /></span>
                  <span className="block truncate text-xs text-muted">{managers[p.userId]?.displayName} · {playerTeam(players, p.playerId)} · {p.gamesPlayed} games</span>
                </span>
                <span className="num text-base font-semibold">{p.ppg === null ? '—' : fmtPpg(p.ppg)}</span>
              </li>
            ))}
          </ul>
        )}
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Healthy means the player has played every game their team has played. Kickers and defenses are excluded.</p>
    </div>
  );
}
