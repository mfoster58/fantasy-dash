import { Link } from 'react-router';
import type { Manager, UserId } from '@fantasy-dash/core';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts, fmtTag } from '../../lib/format';
import type { WeekLine } from '../../lib/teamProfile';

interface Props { weeks: WeekLine[]; managers: Record<UserId, Manager>; year: number }

const pill = (r: 'W' | 'L' | 'T') => r === 'W' ? 'bg-win/15 text-win' : r === 'L' ? 'bg-loss/15 text-loss' : 'bg-surface-2 text-muted';

/** One row per played game, newest at the bottom, each opening the box score. */
export default function Schedule({ weeks, managers, year }: Props) {
  return (
    <section className="card">
      <CardHeader label={String(year)} title="Schedule" />
      {weeks.length === 0 ? <p className="px-4 py-3 text-xs text-muted">No games played yet.</p> : (
        <ul className="divide-y divide-line">
          {weeks.map((w) => {
            const opp = managers[w.opponentId];
            return (
              <li key={w.week}>
                <Link to={`/scores/${year}/${w.week}/${w.matchupId}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto_1.75rem] items-center gap-x-3 px-4 py-2 text-sm hover:bg-surface-2">
                  <span className="num text-xs text-muted">{w.week}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{opp?.teamName ?? opp?.displayName ?? w.opponentId}</span>
                    {w.tag && <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent">{fmtTag(w.tag)}</span>}
                  </span>
                  <span className="num whitespace-nowrap text-right">
                    {w.high && <span className="mr-1 text-[10px] text-win" aria-label="Season high">▲</span>}
                    {w.low && <span className="mr-1 text-[10px] text-loss" aria-label="Season low">▼</span>}
                    <span className="font-semibold">{fmtPts(w.points)}</span><span className="text-muted">–{fmtPts(w.oppPoints)}</span>
                  </span>
                  <span className={`num rounded px-1.5 py-0.5 text-center text-xs font-semibold ${pill(w.result)}`}>{w.result}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
