import { useState } from 'react';
import { Link } from 'react-router';
import type { DraftPick, PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtSigned } from '../../lib/format';
import { playerName, playerPos } from '../../lib/players';
import { pickLabel } from '../../lib/draft';
import { CardHeader, signClass } from './DraftAnalysis';

export interface PickRow {
  pick: DraftPick;
  /** teams in that draft, for the round.pick label */
  teams: number;
  manager: string;
  /** shown (as a link to that draft) for all-time rows */
  year?: number;
}

interface Props {
  label: string; title: string; aside?: string; rows: PickRow[]; players: PlayerDirectory; testId?: string;
  /** rows shown before "Show all" */
  limit?: number;
  /** rows shown after "Show all" */
  max?: number;
  empty?: string;
}

/** A ranked card of picks with their value: the first `limit` rows, expandable to `max`. */
export default function PickList({ label, title, aside, rows, players, testId, limit = 10, max = 25, empty = 'No picks match.' }: Props) {
  const [all, setAll] = useState(false);
  const shown = rows.slice(0, all ? max : limit);
  const total = Math.min(max, rows.length);
  return (
    <div className="card" data-testid={testId}>
      <CardHeader label={label} title={title} aside={aside} />
      {rows.length === 0
        ? <p className="px-4 py-2 text-xs text-muted">{empty}</p>
        : (
          <ul className="divide-y divide-line px-4">
            {shown.map(({ pick: p, teams, manager, year }) => (
              <li key={`${year ?? ''}-${p.pickNo}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="num w-9 text-xs text-muted">{pickLabel(p, teams)}</span>
                <Headshot players={players} id={p.playerId} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="truncate font-medium">{playerName(players, p.playerId)}</span><PosPill pos={playerPos(players, p.playerId)} /></span>
                  <span className="block truncate text-xs text-muted">
                    {year !== undefined && <><Link to={`/draft/${year}`} className="hover:text-ink hover:underline">{year}</Link> · </>}
                    {manager}{p.redraftPos !== null ? ` · redraft ${p.redraftPos}` : ''}
                  </span>
                </span>
                <span className={`num text-base font-semibold ${signClass(p.value)}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
              </li>
            ))}
          </ul>
        )}
      {rows.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-4 py-2 text-xs text-accent hover:bg-surface-2">
          {all ? `Show top ${limit}` : `Show all ${total}`}
        </button>
      )}
    </div>
  );
}
