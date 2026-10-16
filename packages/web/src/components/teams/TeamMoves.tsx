import { useState } from 'react';
import type { History, PlayerDirectory, PlayerId, Transaction, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import type { SeasonProfile } from '../../lib/teamProfile';

interface Props { moves: Transaction[]; bestPickup: SeasonProfile['bestPickup']; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; managers: History['managers']; userId: UserId }

type Filter = 'all' | 'waiver' | 'free_agent' | 'trade';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'waiver', label: 'Waivers' }, { id: 'free_agent', label: 'Free agents' }, { id: 'trade', label: 'Trades' }];
const TYPE_LABEL: Record<Transaction['type'], string> = { waiver: 'Waiver', free_agent: 'Free agent', trade: 'Trade', commissioner: 'Commish' };
const dateOf = (ms: number) => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** The manager's season transaction log with type filters and the best pickup. */
export default function TeamMoves({ moves, bestPickup, players, seasonTeams, managers, userId }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const count = (f: Filter) => (f === 'all' ? moves.length : moves.filter((m) => m.type === f).length);
  const shown = moves.filter((m) => filter === 'all' || m.type === filter);
  const byDate = new Map<string, Transaction[]>();
  for (const m of shown) byDate.set(dateOf(m.created), [...(byDate.get(dateOf(m.created)) ?? []), m]);
  const player = (id: PlayerId, sign: '+' | '−') => (
    <span key={`${sign}${id}`} className="flex items-center gap-1.5 text-sm">
      <span className={`num w-3 text-center ${sign === '+' ? 'text-win' : 'text-loss'}`}>{sign}</span>
      <Headshot players={players} id={id} size={22} />
      <span className="truncate">{playerName(players, id)}</span>
      <PosPill pos={playerPos(players, id)} />
      <span className="text-xs text-muted">{playerTeam(players, id, seasonTeams)}</span>
    </span>
  );
  return (
    <section className="card">
      <CardHeader label="Transactions" title={`${moves.length} move${moves.length === 1 ? '' : 's'}`} aside={bestPickup && <span>Best pickup <span className="font-medium text-ink">{playerName(players, bestPickup.playerId)}</span> · <span className="num">{fmtPts(bestPickup.points)}</span> pts in {bestPickup.starts} start{bestPickup.starts === 1 ? '' : 's'} since W{bestPickup.week}</span>} />
      <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
        {FILTERS.filter((f) => count(f.id) > 0 || f.id === 'all').map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full px-2.5 py-0.5 text-xs ${filter === f.id ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}>
            {f.label} <span className="num">{count(f.id)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="px-4 pb-3 text-xs text-muted">No moves yet.</p>}
      {[...byDate.entries()].map(([date, list]) => (
        <div key={date}>
          <div className="section-label border-y border-line bg-surface-2 px-4 py-1 text-[10px]">{date}</div>
          <ul className="divide-y divide-line">
            {list.map((m) => {
              const partner = [...m.adds, ...m.drops].map((x) => x.userId).find((id) => id !== userId);
              return (
                <li key={m.id} className="grid gap-x-4 gap-y-1 px-4 py-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-start">
                  <span className="section-label text-[10px]">{TYPE_LABEL[m.type]}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    {m.adds.filter((x) => x.userId === userId).map((x) => player(x.playerId, '+'))}
                    {m.drops.filter((x) => x.userId === userId).map((x) => player(x.playerId, '−'))}
                  </span>
                  <span className="num text-right text-xs text-muted">
                    {m.type === 'waiver' && m.bid !== null && <span className="font-semibold text-ink">${m.bid}</span>}
                    {m.type === 'trade' && partner && <span>with {managers[partner]?.displayName ?? partner}</span>}
                    <span className="block">Week {m.week}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
