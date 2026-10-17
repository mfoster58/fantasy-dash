import type { Manager, PlayoffTag, UserId } from '@fantasy-dash/core';
import { CardHeader } from '../draft/DraftAnalysis';
import { CoverLink, TeamLink } from '../NameLink';
import { fmtPts, fmtTag } from '../../lib/format';
import type { ScheduleEntry } from '../../lib/teamProfile';

interface Props { entries: ScheduleEntry[]; managers: Record<UserId, Manager>; year: number }

const pill = (r: 'W' | 'L' | 'T') => r === 'W' ? 'bg-win/15 text-win' : r === 'L' ? 'bg-loss/15 text-loss' : 'bg-surface-2 text-muted';
const ROW = 'grid grid-cols-[1.75rem_minmax(0,1fr)_auto_2.25rem] items-center gap-x-3 px-4 py-2 text-sm';

/** One row per week: played games with the score and result, upcoming games with projections, playoff byes. Each game opens its box score; the opponent's name opens their team page. */
export default function Schedule({ entries, managers, year }: Props) {
  const name = (id: UserId) => managers[id]?.teamName ?? managers[id]?.displayName ?? id;
  const opponent = (id: UserId, tag: PlayoffTag | null) => (
    <span className="min-w-0">
      <TeamLink userId={id} year={year} className="relative z-10 block truncate">{name(id)}</TeamLink>
      {tag && <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent">{fmtTag(tag)}</span>}
    </span>
  );
  return (
    <section className="card">
      <CardHeader label={String(year)} title="Schedule" />
      {entries.length === 0 ? <p className="px-4 py-3 text-xs text-muted">No games scheduled yet.</p> : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.week} className={e.kind === 'bye' ? undefined : 'relative hover:bg-surface-2'}>
              {e.kind === 'bye' ? (
                <div className={`${ROW} text-muted`}>
                  <span className="num text-xs">{e.week}</span>
                  <span className="italic">Bye</span>
                  <span />
                  <span />
                </div>
              ) : e.kind === 'upcoming' ? (
                <>
                  <CoverLink to={`/scores/${year}/${e.week}/${e.matchupId}`} label={`Week ${e.week} box score`} />
                  <div className={ROW}>
                    <span className="num text-xs text-muted">{e.week}</span>
                    {opponent(e.opponentId, e.tag)}
                    <span className="num whitespace-nowrap text-right text-muted">{fmtPts(e.projected)}–{fmtPts(e.oppProjected)}</span>
                    <span className="section-label text-center text-[9px]">proj</span>
                  </div>
                </>
              ) : (
                <>
                  <CoverLink to={`/scores/${year}/${e.week}/${e.matchupId}`} label={`Week ${e.week} box score`} />
                  <div className={ROW}>
                    <span className="num text-xs text-muted">{e.week}</span>
                    {opponent(e.opponentId, e.tag)}
                    <span className="num whitespace-nowrap text-right"><span className="font-semibold">{fmtPts(e.points)}</span><span className="text-muted">–{fmtPts(e.oppPoints)}</span></span>
                    <span className={`num rounded px-1.5 py-0.5 text-center text-xs font-semibold ${pill(e.result)}`}>{e.result}</span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
