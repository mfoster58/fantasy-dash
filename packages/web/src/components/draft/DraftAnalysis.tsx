import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import { fmtSigned } from '../../lib/format';
import { playerName, playerPos } from '../../lib/players';
import { leagueExtremes, managerDraftSummaries, posLabel } from '../../lib/draft';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

function PickLine({ p, players, managers }: { p: DraftPick; players: PlayerDirectory; managers: Record<UserId, Manager> }) {
  const pos = playerPos(players, p.playerId);
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <Headshot players={players} id={p.playerId} size={24} />
      <span className="min-w-0 flex-1 truncate">{playerName(players, p.playerId)} <span className="text-xs text-muted">{posLabel(pos, p.posDraftRank)} → {pos}{p.posFinishRank ?? '?'} · pick {p.pickNo} · {managers[p.userId]?.displayName}</span></span>
      <span className={`num ${(p.value ?? 0) > 0 ? 'text-win' : (p.value ?? 0) < 0 ? 'text-loss' : 'text-muted'}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
      <span className="num w-16 text-right text-xs text-muted">{p.pointsOverBaseline === null ? '' : fmtSigned(p.pointsOverBaseline, 1)}</span>
    </li>
  );
}

export default function DraftAnalysis({ draft, managers, players, inSeason }: Props) {
  const summaries = managerDraftSummaries(draft);
  const { steals, busts } = leagueExtremes(draft, 5);
  const note = inSeason ? ' (to date)' : '';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="card overflow-x-auto">
        <div className="section-label px-4 pt-3">Draft grades{note}</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left">
            {['Manager', 'Value', 'Pts over baseline', 'Best pick', 'Worst pick'].map((h, i) => <th key={h} className={`section-label px-4 py-2 ${i === 1 || i === 2 ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {summaries.map((s) => {
              const m = managers[s.userId];
              return (
                <tr key={s.userId} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={22} />{m?.displayName ?? s.userId}</span></td>
                  <td className={`num px-4 py-2 text-right ${s.totalValue > 0 ? 'text-win' : s.totalValue < 0 ? 'text-loss' : ''}`}>{fmtSigned(s.totalValue, 0)}</td>
                  <td className="num px-4 py-2 text-right">{fmtSigned(s.totalPoB, 1)}</td>
                  <td className="px-4 py-2 text-xs">{s.best ? `${playerName(players, s.best.playerId)} (${fmtSigned(s.best.value ?? 0, 0)})` : '—'}</td>
                  <td className="px-4 py-2 text-xs">{s.worst ? `${playerName(players, s.worst.playerId)} (${fmtSigned(s.worst.value ?? 0, 0)})` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-muted">Value = positional draft rank minus positional finish rank (positive is a steal). Points over baseline compares season points to the last startable player at the position.</p>
      </div>
      <div className="space-y-4">
        <div className="card px-4 py-3"><div className="section-label">Top steals{note}</div><ul className="divide-y divide-line">{steals.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
        <div className="card px-4 py-3"><div className="section-label">Top busts{note}</div><ul className="divide-y divide-line">{busts.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
      </div>
    </div>
  );
}
