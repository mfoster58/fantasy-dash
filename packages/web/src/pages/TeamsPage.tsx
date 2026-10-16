import { Link, useLoaderData, useNavigate } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import SeasonPicker from '../components/SeasonPicker';
import TeamsTabs from '../components/teams/TeamsTabs';
import { history } from '../data/load';
import { fmtPts, fmtRecord } from '../lib/format';
import { finalPlacement, finishOf } from '../lib/teamProfile';

/** Every team in one season, in standings order. */
export default function TeamsPage() {
  const { season } = useLoaderData() as { seasons: Season[]; season: Season };
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const placement = finalPlacement(season);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Teams <span className="num font-normal text-muted">{season.year}</span></h1>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/teams/${y}`)} />
      </header>
      <TeamsTabs teamsTo={`/teams/${season.year}`} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {season.standings.map((r) => {
          const m = season.managers[r.userId];
          const finish = finishOf(season, r.userId, placement);
          return (
            <li key={r.userId}>
              <Link to={`/teams/${season.year}/${r.userId}`} className="card flex h-full items-center gap-3 p-4 transition-colors hover:border-accent">
                <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m?.teamName ?? m?.displayName ?? r.userId}</span>
                  <span className="block truncate text-xs text-muted">{m?.displayName}</span>
                  <span className="num mt-1 block text-xs text-muted">{fmtRecord(r)} · {fmtPts(r.pf)} pts{finish.place !== null ? ` · ${finish.icon ? `${finish.icon} ` : ''}${finish.label}` : ''}</span>
                </span>
                <span className="num text-lg font-semibold text-muted">#{r.rank}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
