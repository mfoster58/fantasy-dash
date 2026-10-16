import { Link } from 'react-router';
import type { Manager, UserId } from '@fantasy-dash/core';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts, fmtTag } from '../../lib/format';
import type { ScheduleEntry } from '../../lib/teamProfile';

interface Props { entries: ScheduleEntry[]; managers: Record<UserId, Manager>; year: number }

const pill = (r: 'W' | 'L' | 'T') => r === 'W' ? 'bg-win/15 text-win' : r === 'L' ? 'bg-loss/15 text-loss' : 'bg-surface-2 text-muted';
const ROW = 'grid grid-cols-[1.75rem_minmax(0,1fr)_auto_2.25rem] items-center gap-x-3 px-4 py-2 text-sm';
const chip = (tone: string, text: string) => <span className={`rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${tone}`}>{text}</span>;

/** One row per week: played games with the score, upcoming games with projections, playoff byes. Each game opens its box score. */
export default function Schedule({ entries, managers, year }: Props) {
  const name = (id: UserId) => managers[id]?.teamName ?? managers[id]?.displayName ?? id;
  return (
    <section className="card">
      <CardHeader label={String(year)} title="Schedule" />
      {entries.length === 0 ? <p className="px-4 py-3 text-xs text-muted">No games scheduled yet.</p> : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <li key={e.week}>
              {e.kind === 'bye' ? (
                <div className={`${ROW} text-muted`}>
                  <span className="num text-xs">{e.week}</span>
                  <span className="italic">Bye</span>
                  <span />
                  <span />
                </div>
              ) : e.kind === 'upcoming' ? (
                <Link to={`/scores/${year}/${e.week}/${e.matchupId}`} className={`${ROW} hover:bg-surface-2`}>
                  <span className="num text-xs text-muted">{e.week}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{name(e.opponentId)}</span>
                    {e.tag && <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent">{fmtTag(e.tag)}</span>}
                  </span>
                  <span className="num whitespace-nowrap text-right text-muted">{fmtPts(e.projected)}–{fmtPts(e.oppProjected)}</span>
                  <span className="section-label text-center text-[9px]">proj</span>
                </Link>
              ) : (
                <Link to={`/scores/${year}/${e.week}/${e.matchupId}`} className={`${ROW} hover:bg-surface-2`}>
                  <span className="num text-xs text-muted">{e.week}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{name(e.opponentId)}</span>
                    {(e.tag || e.high || e.low) && (
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {e.tag && <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">{fmtTag(e.tag)}</span>}
                        {e.high && chip('bg-win/15 text-win', 'Season high')}
                        {e.low && chip('bg-loss/15 text-loss', 'Season low')}
                      </span>
                    )}
                  </span>
                  <span className="num whitespace-nowrap text-right"><span className="font-semibold">{fmtPts(e.points)}</span><span className="text-muted">–{fmtPts(e.oppPoints)}</span></span>
                  <span className={`num rounded px-1.5 py-0.5 text-center text-xs font-semibold ${pill(e.result)}`}>{e.result}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
