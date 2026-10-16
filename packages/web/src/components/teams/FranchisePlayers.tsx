import { useState } from 'react';
import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPpg, fmtPts } from '../../lib/format';
import { playerName } from '../../lib/players';
import type { FranchisePlayer } from '../../lib/teamProfile';

const TOP = 10;
const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
type Pos = (typeof POSITIONS)[number];

/** The ten players who scored most while started for this manager, filtered by position. */
export default function FranchisePlayers({ players, franchise }: { players: PlayerDirectory; franchise: FranchisePlayer[] }) {
  const [pos, setPos] = useState<Pos>('All');
  const shown = (pos === 'All' ? franchise : franchise.filter((f) => f.position === pos)).slice(0, TOP);
  return (
    <section className="card">
      <CardHeader title="Franchise players" aside={
        <span className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Position">
          {POSITIONS.map((p) => (
            <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)} className={`rounded-full px-2 py-0.5 text-xs ${pos === p ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>{p}</button>
          ))}
        </span>
      } />
      {shown.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nobody rostered yet.</p> : (
        <ol className="grid gap-px bg-line sm:grid-cols-2">
          {shown.map((f, i) => (
            <li key={f.playerId} className="flex items-center gap-3 bg-surface px-4 py-3">
              <span className="num w-4 text-xs text-muted">{i + 1}</span>
              <Headshot players={players} id={f.playerId} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5"><PosPill pos={f.position} /><span className="truncate text-sm font-medium">{playerName(players, f.playerId)}</span></span>
                <span className="num block text-xs leading-snug text-muted">{f.from === f.to ? f.from : `${f.from}–${f.to}`} · {f.seasons} season{f.seasons === 1 ? '' : 's'} · {f.starts}/{f.weeks} started</span>
              </span>
              <span className="text-right"><span className="num block font-semibold">{fmtPts(f.started)}</span><span className="num block text-[10px] text-muted">hi {fmtPpg(f.high)}</span></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
