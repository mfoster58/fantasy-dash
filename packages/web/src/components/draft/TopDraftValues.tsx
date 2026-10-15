import type { History, PlayerDirectory } from '@fantasy-dash/core';
import { Link } from 'react-router';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtSigned } from '../../lib/format';
import { playerName, playerPos } from '../../lib/players';
import { pickLabel } from '../../lib/draft';
import { CardHeader, signClass } from './DraftAnalysis';

interface Props { history: History; players: PlayerDirectory }

/** The best draft picks by value across completed seasons. */
export default function TopDraftValues({ history, players }: Props) {
  const rows = history.topDraftValues;
  return (
    <div className="card" data-testid="top-draft-values">
      <CardHeader label="All time" title="Best draft values" aside="Completed seasons" />
      {rows.length === 0
        ? <p className="px-4 py-2 text-xs text-muted">No completed seasons yet.</p>
        : (
          <ul className="divide-y divide-line px-4">
            {rows.map((p) => (
              <li key={`${p.year}-${p.pickNo}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="num w-9 text-xs text-muted">{pickLabel(p, p.teams)}</span>
                <Headshot players={players} id={p.playerId} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="truncate font-medium">{playerName(players, p.playerId)}</span><PosPill pos={playerPos(players, p.playerId)} /></span>
                  <span className="block truncate text-xs text-muted">
                    <Link to={`/draft/${p.year}`} className="hover:text-ink hover:underline">{p.year}</Link> · {history.managers[p.userId]?.displayName ?? p.userId}{p.redraftPos !== null ? ` · redraft ${p.redraftPos}` : ''}
                  </span>
                </span>
                <span className={`num text-base font-semibold ${signClass(p.value)}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
