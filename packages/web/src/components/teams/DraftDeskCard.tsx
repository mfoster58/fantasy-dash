import { Link } from 'react-router';
import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { CardHeader, signClass } from '../draft/DraftAnalysis';
import { fmtSigned } from '../../lib/format';
import { pickLabel } from '../../lib/draft';
import { playerName } from '../../lib/players';
import type { DeskPick, DraftDesk } from '../../lib/teamProfile';

function Pick({ pick, players }: { pick: DeskPick | null; players: PlayerDirectory }) {
  if (!pick) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Headshot players={players} id={pick.playerId} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">{playerName(players, pick.playerId)}</span>
        <span className="num block text-[10px] leading-tight text-muted">pick {pickLabel(pick, pick.teams)}</span>
      </span>
      <span className={`num text-sm font-semibold ${signClass(pick.value)}`}>{pick.value === null ? '—' : fmtSigned(pick.value, 0)}</span>
    </span>
  );
}

/** Career draft grade and value per draft, then one row per year: grade, value, biggest steal and biggest bust. */
export default function DraftDeskCard({ desk, players }: { desk: DraftDesk; players: PlayerDirectory }) {
  return (
    <section className="card overflow-hidden">
      <CardHeader title="Draft success" aside={`${desk.drafts} draft${desk.drafts === 1 ? '' : 's'}`} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <span className="flex items-baseline gap-2"><span className="rounded bg-ink px-2.5 py-1 text-xl font-bold text-bg">{desk.avgGrade}</span><span className="text-xs text-muted">average grade</span></span>
        <span className="flex items-baseline gap-2"><span className={`num text-2xl font-bold ${signClass(desk.valuePerDraft)}`}>{fmtSigned(desk.valuePerDraft, 0)}</span><span className="text-xs text-muted">value per draft</span></span>
      </div>
      <table className="w-full border-t border-line text-sm">
        <thead className="section-label text-[10px]">
          <tr className="border-b border-line">
            <th className="px-4 py-1.5 text-left font-medium">Year</th><th className="py-1.5 text-left font-medium">Grade</th><th className="py-1.5 text-right font-medium">Value</th>
            <th className="py-1.5 pl-4 text-left font-medium">Biggest steal</th><th className="py-1.5 pl-4 pr-4 text-left font-medium">Biggest bust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {desk.seasons.map((s) => (
            <tr key={s.year} className="hover:bg-surface-2" data-testid={`draft-${s.year}`}>
              <td className="num px-4 py-2 font-semibold"><Link to={`/draft/${s.year}`} className="hover:text-accent">{s.year}</Link></td>
              <td className="py-2"><span className="rounded bg-ink px-1.5 py-0.5 text-xs font-bold text-bg">{s.grade}</span></td>
              <td className={`num py-2 text-right font-semibold ${signClass(s.value)}`}>{fmtSigned(s.value, 0)}</td>
              <td className="py-2 pl-4"><Pick pick={s.steal} players={players} /></td>
              <td className="py-2 pl-4 pr-4"><Pick pick={s.bust} players={players} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
