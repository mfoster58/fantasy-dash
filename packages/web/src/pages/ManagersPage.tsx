import { Link, useLoaderData } from 'react-router';
import { TrophyIcon } from '../components/Icons';
import type { Season } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import TeamsTabs from '../components/teams/TeamsTabs';
import { currentSeason, history } from '../data/load';
import { fmtRecord, fmtWinPct } from '../lib/format';

/** Everyone who has managed a team, by all-time rank. */
export default function ManagersPage() {
  useLoaderData() as Season[];
  return (
    <section className="space-y-4">
      <header><h1 className="text-[22px] font-semibold tracking-tight">Managers</h1></header>
      <TeamsTabs teamsTo={`/teams/${currentSeason.year}`} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {history.allTime.map((r) => {
          const m = history.managers[r.userId];
          return (
            <li key={r.userId}>
              <Link to={`/managers/${r.userId}`} className="card flex h-full items-center gap-3 p-4 transition-colors hover:border-accent">
                <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m?.displayName ?? r.userId}{r.titles > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-gold"><TrophyIcon title="Titles" />{r.titles > 1 ? <span className="num">{r.titles}</span> : null}</span>}</span>
                  <span className="num block text-xs text-muted">{r.seasons} season{r.seasons === 1 ? '' : 's'} · {fmtRecord(r)} · {fmtWinPct(r.winPct)}</span>
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
