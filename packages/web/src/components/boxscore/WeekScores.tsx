import type { Game, Manager, UserId, Week } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { CoverLink, ManagerLink } from '../NameLink';
import { fmtPct, fmtPts } from '../../lib/format';

interface Props {
  week: Week; managers: Record<UserId, Manager>; year: number;
  /** when viewing one game, its two teams are highlighted and summarised */
  game?: Game;
  /** the live week: rank live points */
  live?: boolean;
}

export interface WeekScoreRow {
  userId: UserId; points: number; efficiency: number;
  /** best possible points from the full roster (equals points when unplayed) */
  ceiling: number;
  matchupId: number;
  /** one of the two teams in the game being viewed */
  inGame: boolean;
  /** 1 + number of teams with strictly more points */
  rank: number;
}

/** Every team's score this week (projection when unplayed, live points in a live week), best first, with the viewed game's two teams flagged. */
export function weekScoreRows(week: Week, game?: Game, live = false): WeekScoreRow[] {
  const scored = week.played || live;
  const rows = week.games.flatMap((g) => g.sides.map((s) => ({
    userId: s.userId, points: scored ? s.points : s.projected, efficiency: s.efficiency,
    // a live week's track is the pre-game projection
    ceiling: week.played ? s.ceiling : live ? Math.max(s.points, s.projected) : s.projected,
    matchupId: g.matchupId, inGame: g.id === game?.id, rank: 0,
  })));
  rows.sort((a, b) => b.points - a.points || (a.userId < b.userId ? -1 : 1));
  for (const r of rows) r.rank = 1 + rows.filter((o) => o.points > r.points).length;
  return rows;
}

export default function WeekScores({ week, managers, year, game, live = false }: Props) {
  const rows = weekScoreRows(week, game, live);
  // Each bar's track is the team's ceiling, scaled to the week's biggest ceiling; the fill is what it actually scored.
  const max = Math.max(1, ...rows.map((r) => Math.max(r.points, r.ceiling)));
  const n = rows.length;
  const name = (id: UserId) => managers[id]?.displayName ?? id;
  const mine = rows.filter((r) => r.inGame);
  return (
    <section className="card p-5" aria-labelledby="ranked-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="ranked-title" className="section-label">Ranked</h2>
        <span className="text-xs text-muted">Week {week.week} · {week.played ? 'score out of lineup max' : live ? 'live, out of projection' : 'projected'}</span>
      </div>
      <ol className="-mx-2 space-y-0.5">
        {rows.map((r) => (
          <li key={r.userId} className="relative rounded-md hover:bg-surface-2">
            <CoverLink to={`/scores/${year}/${week.week}/${r.matchupId}`} label={`${name(r.userId)}: week ${week.week} box score`} aria-current={r.inGame ? 'true' : undefined} className="rounded-md" />
            <div className={`grid grid-cols-[1.5rem_20px_minmax(0,1fr)_auto] items-center gap-x-2.5 px-2 py-1 text-sm ${r.inGame ? 'text-ink' : 'text-muted'}`}>
              <span className="num text-xs">{r.rank}</span>
              <Avatar avatar={managers[r.userId]?.avatar ?? null} name={name(r.userId)} size={20} />
              <span className="flex min-w-0 items-center gap-2">
                <ManagerLink userId={r.userId} className={`relative z-10 w-24 shrink-0 truncate sm:w-28 ${r.inGame ? 'font-semibold' : ''}`}>{name(r.userId)}</ManagerLink>
                <span className="min-w-0 flex-1" aria-hidden="true">
                  <span className="block h-2 overflow-hidden rounded bg-surface-2" style={{ width: `${(Math.max(r.points, r.ceiling) / max) * 100}%` }} data-testid="track">
                    <span
                      className="block h-full rounded"
                      style={{ width: `${Math.min(100, (r.points / Math.max(1, r.ceiling)) * 100)}%`, background: r.inGame ? 'color-mix(in srgb, var(--accent) 75%, transparent)' : 'color-mix(in srgb, var(--muted) 40%, transparent)' }}
                    />
                  </span>
                </span>
              </span>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className={`num ${r.inGame ? 'font-semibold' : ''}`}>{fmtPts(r.points)}</span>
                {week.played && (
                  <span className="hidden text-xs sm:inline" title="Best possible score from the full roster">out of <span className="num" data-testid="ceiling">{fmtPts(r.ceiling)}</span> max</span>
                )}
                {week.played && <span className="num w-9 text-right text-xs" data-testid="efficiency">{fmtPct(r.efficiency, 0)}</span>}
              </span>
            </div>
          </li>
        ))}
      </ol>
      {mine.length > 0 && (
        <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          {mine.map((r) => {
            const beats = rows.filter((o) => !o.inGame && o.points < r.points).length;
            const others = n - 2;
            return (
              <div key={r.userId} className="min-w-0">
                <div className="truncate text-xs text-muted">{name(r.userId)}</div>
                <div className="num text-lg font-semibold leading-tight">#{r.rank} <span className="text-sm font-normal text-muted">of {n}</span></div>
                <div className="text-xs text-muted">
                  {r.rank === 1 ? `Highest ${week.played || live ? 'score' : 'projection'} of the week` : `Beats ${beats} of the other ${others} teams`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
