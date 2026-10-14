import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtPpg } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import { topHealthyPpg } from '../../lib/draft';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

export default function TopPpg({ draft, managers, players, inSeason }: Props) {
  const rows = topHealthyPpg(draft, 10);
  if (rows.length === 0) return null;
  return (
    <div className="card overflow-x-auto">
      <div className="section-label px-4 pt-3">Top PPG (healthy){inSeason ? ' (to date)' : ''}</div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left">
          {['Player', 'Pick', 'Manager', 'G', 'PPG'].map((h, i) => <th key={h} className={`section-label px-4 py-2 ${i >= 3 ? 'text-right' : ''}`}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.pickNo} className="border-t border-line hover:bg-surface-2">
              <td className="px-4 py-2">
                <span className="flex items-center gap-2">
                  <Headshot players={players} id={p.playerId} size={24} />
                  <span className="truncate font-medium">{playerName(players, p.playerId)}</span>
                  <PosPill pos={playerPos(players, p.playerId)} />
                  <span className="text-xs text-muted">{playerTeam(players, p.playerId)}</span>
                </span>
              </td>
              <td className="num px-4 py-2">{p.pickNo}</td>
              <td className="px-4 py-2 text-xs">{managers[p.userId]?.displayName ?? p.userId}</td>
              <td className="num px-4 py-2 text-right">{p.gamesPlayed}</td>
              <td className="num px-4 py-2 text-right font-semibold">{p.ppg === null ? '—' : fmtPpg(p.ppg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted">Healthy means the player has played every game their team has played. Kickers and defenses are excluded.</p>
    </div>
  );
}
