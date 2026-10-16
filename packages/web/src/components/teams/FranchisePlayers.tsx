import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPpg, fmtPts } from '../../lib/format';
import { playerName } from '../../lib/players';
import type { FranchisePlayer } from '../../lib/teamProfile';

/** Longest tenures, biggest production: the players this manager kept around and started most. */
export default function FranchisePlayers({ players, franchise }: { players: PlayerDirectory; franchise: FranchisePlayer[] }) {
  return (
    <section className="card">
      <CardHeader label="Longest tenures, biggest production" title="Franchise players" />
      {franchise.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nobody rostered yet.</p> : (
        <ol className="grid gap-px bg-line sm:grid-cols-2">
          {franchise.map((f, i) => (
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
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Ranked on weeks rostered and points scored while started.</p>
    </section>
  );
}
