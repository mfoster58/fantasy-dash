import { Link } from 'react-router';
import type { Game, Manager, UserId, Week } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { fmtPts } from '../../lib/format';

interface Props { week: Week; game: Game; managers: Record<UserId, Manager>; year: number }

export interface WeekScoreRow {
  userId: UserId; points: number; matchupId: number;
  /** one of the two teams in the game being viewed */
  inGame: boolean;
  /** 1 + number of teams with strictly more points */
  rank: number;
}

/** Every team's score this week (projection when unplayed), best first, with the viewed game's two teams flagged. */
export function weekScoreRows(week: Week, game: Game): WeekScoreRow[] {
  const rows = week.games.flatMap((g) => g.sides.map((s) => ({
    userId: s.userId, points: week.played ? s.points : s.projected, matchupId: g.matchupId, inGame: g.id === game.id, rank: 0,
  })));
  rows.sort((a, b) => b.points - a.points || (a.userId < b.userId ? -1 : 1));
  for (const r of rows) r.rank = 1 + rows.filter((o) => o.points > r.points).length;
  return rows;
}

export default function WeekScores({ week, game, managers, year }: Props) {
  const rows = weekScoreRows(week, game);
  const max = Math.max(1, ...rows.map((r) => r.points));
  const n = rows.length;
  const name = (id: UserId) => managers[id]?.displayName ?? id;
  const mine = rows.filter((r) => r.inGame);
  return (
    <section className="card p-5" aria-labelledby="week-scores-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="week-scores-title" className="section-label">Around the league</h2>
        <span className="text-xs text-muted">Week {week.week} · {week.played ? 'scores' : 'projected'}</span>
      </div>
      <ol className="-mx-2 space-y-0.5">
        {rows.map((r) => (
          <li key={r.userId}>
            <Link
              to={`/scores/${year}/${week.week}/${r.matchupId}`}
              aria-current={r.inGame ? 'true' : undefined}
              className={`grid grid-cols-[1.5rem_20px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-md px-2 py-1 text-sm hover:bg-surface-2 ${r.inGame ? 'text-ink' : 'text-muted'}`}
            >
              <span className="num text-xs">{r.rank}</span>
              <Avatar avatar={managers[r.userId]?.avatar ?? null} name={name(r.userId)} size={20} />
              <span className="flex min-w-0 items-center gap-2">
                <span className={`w-24 shrink-0 truncate sm:w-28 ${r.inGame ? 'font-semibold' : ''}`}>{name(r.userId)}</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded bg-surface-2" aria-hidden="true">
                  <span
                    className="block h-full rounded"
                    style={{ width: `${(r.points / max) * 100}%`, background: r.inGame ? 'color-mix(in srgb, var(--accent) 75%, transparent)' : 'color-mix(in srgb, var(--muted) 35%, transparent)' }}
                  />
                </span>
              </span>
              <span className={`num ${r.inGame ? 'font-semibold' : ''}`}>{fmtPts(r.points)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
        {mine.map((r) => {
          const beats = rows.filter((o) => !o.inGame && o.points < r.points).length;
          const others = n - 2;
          return (
            <div key={r.userId} className="min-w-0">
              <div className="truncate text-xs text-muted">{name(r.userId)}</div>
              <div className="num text-lg font-semibold leading-tight">#{r.rank} <span className="text-sm font-normal text-muted">of {n}</span></div>
              <div className="text-xs text-muted">
                {r.rank === 1 ? `Highest ${week.played ? 'score' : 'projection'} of the week` : `Beats ${beats} of the other ${others} teams`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
