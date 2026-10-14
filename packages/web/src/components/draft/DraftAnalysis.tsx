import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import { fmtSigned } from '../../lib/format';
import { playerName, playerPos } from '../../lib/players';
import { leagueExtremes, managerDraftSummaries, posLabel } from '../../lib/draft';

const signClass = (n: number, fallback = 'text-muted') => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : fallback);

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

function PickLine({ p, players, managers }: { p: DraftPick; players: PlayerDirectory; managers: Record<UserId, Manager> }) {
  const pos = playerPos(players, p.playerId);
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <Headshot players={players} id={p.playerId} size={24} />
      <span className="min-w-0 flex-1 truncate">
        {playerName(players, p.playerId)}{' '}
        <span className="text-xs text-muted">{posLabel(pos, p.posDraftRank)} · pick {p.pickNo} → redraft {p.redraftPos ?? '?'} · {managers[p.userId]?.displayName}</span>
      </span>
      <span className={`num ${signClass(p.value ?? 0)}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
      <span className="num w-16 text-right text-xs text-muted">{p.pointsOverBaseline === null ? '' : fmtSigned(p.pointsOverBaseline, 1)}</span>
    </li>
  );
}

const HEADERS = ['Manager', 'Value', 'Slot', 'Production', 'Pts over baseline', 'Best pick', 'Worst pick'];
const NUMERIC = new Set([1, 2, 3, 4]);

export default function DraftAnalysis({ draft, managers, players, inSeason }: Props) {
  const summaries = managerDraftSummaries(draft);
  const { steals, busts } = leagueExtremes(draft, 10);
  const note = inSeason ? ' (to date)' : '';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="card overflow-x-auto">
        <div className="section-label px-4 pt-3">Draft grades{note}</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left">
            {HEADERS.map((h, i) => <th key={h} className={`section-label px-4 py-2 ${NUMERIC.has(i) ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {summaries.map((s) => {
              const m = managers[s.userId];
              return (
                <tr key={s.userId} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={22} />{m?.displayName ?? s.userId}</span></td>
                  <td className={`num px-4 py-2 text-right font-semibold ${signClass(s.totalValue, '')}`}>{fmtSigned(s.totalValue, 0)}</td>
                  <td className="num px-4 py-2 text-right text-muted">{fmtSigned(s.totalSlot, 0)}</td>
                  <td className="num px-4 py-2 text-right text-muted">{fmtSigned(s.totalProduction, 0)}</td>
                  <td className="num px-4 py-2 text-right text-muted">{fmtSigned(s.totalPoB, 1)}</td>
                  <td className="px-4 py-2 text-xs">{s.best ? `${playerName(players, s.best.playerId)} (${fmtSigned(s.best.value ?? 0, 0)})` : '—'}</td>
                  <td className="px-4 py-2 text-xs">{s.worst ? `${playerName(players, s.worst.playerId)} (${fmtSigned(s.worst.value ?? 0, 0)})` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-muted">
          Value has two parts. Slot value converts the pick taken and the player's redraft position (where they would go if the league redrafted on this season's production) into draft capital on a trade-value curve, so a late dart that misses costs almost nothing and an early whiff costs most of what was spent. Production value is points over the positional baseline minus what a pick in that slot typically returns this season{inSeason ? ', to date' : ''}. Quarterback points count at half weight, matching how a one-QB league actually prices them. Defenses are excluded.
        </p>
      </div>
      <div className="space-y-4">
        <div className="card px-4 py-3"><div className="section-label">Top steals{note}</div><ul className="divide-y divide-line">{steals.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
        <div className="card px-4 py-3"><div className="section-label">Top busts{note}</div><ul className="divide-y divide-line">{busts.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
      </div>
    </div>
  );
}
