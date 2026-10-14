import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { fmtPpg } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import { posLabel, topHealthyPpg } from '../../lib/draft';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

export default function TopPpg({ draft, managers, players, inSeason }: Props) {
  const rows = topHealthyPpg(draft, 10);
  return (
    <div className="card px-4 py-3">
      <div className="section-label">Top PPG (healthy){inSeason ? ' (to date)' : ''}</div>
      {rows.length === 0
        ? <p className="py-2 text-xs text-muted">No games played yet.</p>
        : (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.pickNo} className="flex items-center gap-3 py-1.5 text-sm">
                <Headshot players={players} id={p.playerId} size={24} />
                <span className="min-w-0 flex-1 truncate">
                  {playerName(players, p.playerId)}{' '}
                  <span className="text-xs text-muted">{posLabel(playerPos(players, p.playerId), p.posDraftRank)} · {playerTeam(players, p.playerId)} · pick {p.pickNo} · {managers[p.userId]?.displayName}</span>
                </span>
                <span className="num text-xs text-muted">{p.gamesPlayed} G</span>
                <span className="num w-12 text-right font-semibold">{p.ppg === null ? '—' : fmtPpg(p.ppg)}</span>
              </li>
            ))}
          </ul>
        )}
      <p className="pt-2 text-xs text-muted">Healthy means the player has played every game their team has played. Kickers and defenses are excluded.</p>
    </div>
  );
}
