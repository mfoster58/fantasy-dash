import type { Season } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { TeamLink } from '../NameLink';
import CardHead from './CardHead';
import { fmtPpg, fmtWinPct } from '../../lib/format';

const cell = 'num whitespace-nowrap px-2 py-2.5 text-right sm:px-3';
/** a phone keeps the record and points for; the full table has the rest */
const wide = 'max-sm:hidden';
const HEADS = ['#', 'Team', 'W', 'L', 'Win%', 'PF', 'PPG', 'PA', 'Strk'];
const PHONE = new Set(['#', 'Team', 'W', 'L', 'PF']);

export default function HomeStandings({ season }: { season: Season }) {
  return (
    <section aria-label="Standings" className="card flex flex-col overflow-hidden">
      <CardHead over="Regular season" title="Standings" to={`/standings/${season.year}`} link="Full table" />
      <div className="flex-1 overflow-x-auto">
        <table className="h-full w-full text-sm">
          <thead className="border-b border-line">
            <tr>{HEADS.map((h, i) => <th key={h} scope="col" className={`section-label px-2 py-2.5 sm:px-3 ${i < 2 ? 'text-left' : 'text-right'} ${PHONE.has(h) ? '' : wide}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {season.standings.map((r, i) => {
              const m = season.managers[r.userId];
              const cut = i === season.playoffTeams - 1 && i < season.standings.length - 1;
              const tone = r.streak.startsWith('W') ? 'text-win' : r.streak.startsWith('L') ? 'text-loss' : 'text-muted';
              return (
                <tr key={r.userId} data-testid="home-standings-row" data-playoff-cut={cut ? 'true' : undefined} className={`border-t border-line first:border-t-0 ${cut ? 'border-b-2 border-b-accent/60' : ''}`}>
                  <td className="py-2.5 pl-3 pr-1 sm:px-3"><span className={`num grid h-6 w-6 place-items-center rounded text-xs ${r.rank <= 2 ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted'}`}>{r.rank}</span></td>
                  <td className="px-2 py-2.5 sm:px-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={30} />
                      <div className="min-w-0 leading-tight">
                        <TeamLink userId={r.userId} year={season.year} className="line-clamp-2 font-semibold sm:block sm:truncate">{m?.teamName ?? m?.displayName ?? r.userId}</TeamLink>
                        {m?.teamName && <span className="block text-xs text-muted">{m.displayName}</span>}
                      </div>
                    </div>
                  </td>
                  <td className={cell}>{r.w}</td>
                  <td className={`${cell} text-muted`}>{r.l}</td>
                  <td className={`${cell} ${wide}`}>{fmtWinPct(r.winPct)}</td>
                  <td className={cell}>{r.pf.toFixed(1)}</td>
                  <td className={`${cell} ${wide}`}>{fmtPpg(r.ppg)}</td>
                  <td className={`${cell} ${wide} text-muted`}>{r.pa.toFixed(1)}</td>
                  <td className={`${cell} ${wide} ${tone}`}>{r.streak}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
