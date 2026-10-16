import { Link } from 'react-router';
import { CardHeader } from '../draft/DraftAnalysis';
import { TrophyIcon } from '../Icons';
import { fmtPts, fmtRecord } from '../../lib/format';
import type { CareerSeasonLine } from '../../lib/teamProfile';

interface Props { seasons: CareerSeasonLine[]; userId: string }

const honor = (s: CareerSeasonLine) => s.champion ? <><TrophyIcon /> Champion</> : s.runnerUp ? 'Runner-up' : s.third ? 'Third' : s.lastPlace ? 'Last place' : s.playoffBerth ? 'Playoffs' : null;

/** One row per season, newest first, each opening that season's team page. */
export default function SeasonsTable({ seasons, userId }: Props) {
  return (
    <section className="card overflow-hidden">
      <CardHeader label={`${seasons.length} season${seasons.length === 1 ? '' : 's'}`} title="Seasons" />
      <table className="w-full text-sm">
        <thead className="section-label text-[10px]">
          <tr className="border-b border-line">
            <th className="px-4 py-1.5 text-left font-medium">Year</th><th className="py-1.5 text-left font-medium">Team</th>
            <th className="py-1.5 text-right font-medium">Record</th><th className="hidden py-1.5 text-right font-medium sm:table-cell">PF</th>
            <th className="hidden py-1.5 text-right font-medium sm:table-cell">PA</th><th className="py-1.5 pr-4 text-right font-medium">Finish</th><th className="hidden py-1.5 pr-4 text-right font-medium md:table-cell">Draft</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {seasons.map((s) => (
            <tr key={s.year} className="hover:bg-surface-2">
              <td className="num px-4 py-2 font-semibold"><Link to={`/teams/${s.year}/${userId}`} className="hover:text-accent">{s.year}</Link></td>
              <td className="max-w-[12rem] truncate py-2"><Link to={`/teams/${s.year}/${userId}`} className="hover:text-accent">{s.teamName}</Link>{honor(s) && <span className={`ml-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${s.champion ? 'text-gold' : s.lastPlace ? 'text-loss' : 'text-muted'}`}>{honor(s)}</span>}</td>
              <td className="num py-2 text-right">{s.row ? fmtRecord(s.row) : '—'}</td>
              <td className="num hidden py-2 text-right sm:table-cell">{s.row ? fmtPts(s.row.pf) : '—'}</td>
              <td className="num hidden py-2 text-right text-muted sm:table-cell">{s.row ? fmtPts(s.row.pa) : '—'}</td>
              <td className={`num py-2 pr-4 text-right font-semibold ${s.champion ? 'text-gold' : ''}`}>{s.finish}</td>
              <td className="num hidden py-2 pr-4 text-right md:table-cell">{s.grade ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
