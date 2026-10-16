import { useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import { FinishIcon, TrophyIcon } from '../components/Icons';
import IndexRow, { Spark, type RowStat } from '../components/teams/IndexRow';
import TeamsTabs from '../components/teams/TeamsTabs';
import { currentSeason, history } from '../data/load';
import { fmtPpg, fmtRecord, fmtWinPct } from '../lib/format';
import { managerRows } from '../lib/indexRows';

/** Everyone who has managed a team, by all-time rank, one row each with every season's finish and the career numbers. */
export default function ManagersPage() {
  const seasons = useLoaderData() as Season[];
  const rows = managerRows(seasons, history);
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-[22px] font-semibold tracking-tight">Managers</h1>
        <p className="text-sm text-muted">Ranked all-time. Open a manager for the career profile.</p>
      </header>
      <TeamsTabs teamsTo={`/teams/${currentSeason.year}`} />
      <ul className="space-y-3">
        {rows.map((m) => {
          const stats: RowStat[] = [
            { label: 'Record', value: fmtRecord(m) },
            { label: 'Win %', value: fmtWinPct(m.winPct) },
            { label: 'PPG', value: fmtPpg(m.ppg) },
            { label: 'Playoffs', value: `${m.playoffApps} of ${m.completeSeasons}` },
            { label: 'Titles', value: String(m.titles), tone: m.titles > 0 ? 'gold' : null },
            { label: 'Week highs', value: String(m.weeklyHighs) },
          ];
          return (
            <IndexRow key={m.userId} to={`/managers/${m.userId}`} rank={m.rank} avatar={m.avatar} name={m.name}
              title={<>{m.name}{m.titles > 0 && <span className="ml-2 inline-flex items-center gap-0.5 text-gold" title={`${m.titles} title${m.titles === 1 ? '' : 's'}`}>{Array.from({ length: m.titles }, (_, i) => <TrophyIcon key={i} />)}</span>}</>}
              subtitle={m.teamName}
              badge={m.seasons.map((s) => (
                <span key={s.year} className={`num inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 ${s.status === 'complete' ? '' : 'text-muted'}`} data-testid={`chip-${m.userId}-${s.year}`}>
                  {s.year} {s.status === 'complete' ? <>{s.icon && <FinishIcon kind={s.icon} size="1.1em" />}<span className={s.finish === '1st' ? 'font-semibold text-gold' : ''}>{s.finish}</span></> : <>#{s.rank}</>}
                </span>
              ))}
              stats={stats}
              visual={<Spark points={m.spark} label={`${m.name}: points per game by season against the league average`} />}
              cta="View manager" />
          );
        })}
      </ul>
    </section>
  );
}
