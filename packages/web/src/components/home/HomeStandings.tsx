import { Fragment } from 'react';
import type { Season } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { TeamLink } from '../NameLink';
import CardHead from './CardHead';

const cell = 'num whitespace-nowrap px-3 py-2.5 text-right';

export default function HomeStandings({ season }: { season: Season }) {
  return (
    <section aria-label="Standings" className="card overflow-hidden">
      <CardHead over="Regular season" title="Standings" to={`/standings/${season.year}`} link="Full table" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>{['#', 'Team', 'W', 'L', 'PF', 'PA', 'Strk'].map((h, i) => <th key={h} scope="col" className={`section-label px-3 py-2.5 ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {season.standings.map((r, i) => {
              const m = season.managers[r.userId];
              const tone = r.streak.startsWith('W') ? 'text-win' : r.streak.startsWith('L') ? 'text-loss' : 'text-muted';
              return (
                <Fragment key={r.userId}>
                  <tr data-testid="home-standings-row" className="border-t border-line first:border-t-0">
                    <td className="px-3 py-2.5"><span className={`num grid h-6 w-6 place-items-center rounded text-xs ${r.rank <= 2 ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted'}`}>{r.rank}</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={30} />
                        <div className="min-w-0 leading-tight">
                          <TeamLink userId={r.userId} year={season.year} className="block truncate font-semibold">{m?.teamName ?? m?.displayName ?? r.userId}</TeamLink>
                          {m?.teamName && <span className="block text-xs text-muted">{m.displayName}</span>}
                        </div>
                      </div>
                    </td>
                    <td className={cell}>{r.w}</td>
                    <td className={`${cell} text-muted`}>{r.l}</td>
                    <td className={cell}>{r.pf.toFixed(1)}</td>
                    <td className={`${cell} text-muted`}>{r.pa.toFixed(1)}</td>
                    <td className={`${cell} ${tone}`}>{r.streak}</td>
                  </tr>
                  {i === season.playoffTeams - 1 && i < season.standings.length - 1 && (
                    <tr aria-hidden="true"><td colSpan={7} className="px-3 py-1"><div className="flex items-center gap-3 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-accent"><span className="h-px flex-1 bg-accent/40" />Playoff cut<span className="h-px flex-1 bg-accent/40" /></div></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
