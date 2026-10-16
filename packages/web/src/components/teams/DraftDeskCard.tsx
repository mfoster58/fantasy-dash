import { Link } from 'react-router';
import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { CardHeader, signClass } from '../draft/DraftAnalysis';
import { fmtSigned } from '../../lib/format';
import { pickLabel } from '../../lib/draft';
import { playerName } from '../../lib/players';
import type { DraftDesk } from '../../lib/teamProfile';

function Pick({ label, pick, players }: { label: string; pick: DraftDesk['steal']; players: PlayerDirectory }) {
  if (!pick) return null;
  return (
    <Link to={`/draft/${pick.year}`} className="flex items-center gap-3 rounded-md border border-line px-3 py-2 hover:bg-surface-2">
      <Headshot players={players} id={pick.playerId} size={32} />
      <span className="min-w-0 flex-1">
        <span className="section-label block text-[10px]">{label} <span className="num normal-case tracking-normal text-muted">{pick.year} · {pickLabel(pick, pick.teams)}</span></span>
        <span className="block truncate font-medium">{playerName(players, pick.playerId)}</span>
      </span>
      <span className={`num text-lg font-semibold ${signClass(pick.value)}`}>{pick.value === null ? '—' : fmtSigned(pick.value, 0)}</span>
    </Link>
  );
}

/** Career draft grades and values, the steal and the one that hurt. */
export default function DraftDeskCard({ desk, players }: { desk: DraftDesk; players: PlayerDirectory }) {
  return (
    <section className="card p-4">
      <CardHeader label="Draft desk" title="Draft success" aside={`${desk.drafts} draft${desk.drafts === 1 ? '' : 's'}`} />
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="rounded bg-ink px-2.5 py-1 text-xl font-bold text-bg">{desk.avgGrade}</span>
        <span className="text-xs text-muted">average grade · value per draft <span className={`num font-semibold ${signClass(desk.valuePerDraft)}`}>{fmtSigned(desk.valuePerDraft, 0)}</span> · career <span className={`num font-semibold ${signClass(desk.career)}`}>{fmtSigned(desk.career, 0)}</span></span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {desk.seasons.map((s) => (
          <Link key={s.year} to={`/draft/${s.year}`} className={`num rounded border px-2 py-0.5 text-xs hover:bg-surface-2 ${desk.best?.year === s.year ? 'border-accent' : 'border-line'}`} title={`${s.year}: ${s.grade}, ${fmtSigned(s.value, 0)}`}>
            {s.year} <span className="font-semibold">{s.grade}</span> <span className={signClass(s.value)}>{fmtSigned(s.value, 0)}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Pick label="The steal" pick={desk.steal} players={players} />
        <Pick label="The one that hurt" pick={desk.hurt} players={players} />
      </div>
    </section>
  );
}
