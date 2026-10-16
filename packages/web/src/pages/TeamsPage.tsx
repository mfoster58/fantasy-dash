import { useLoaderData, useNavigate } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import Headshot from '../components/Headshot';
import { FinishIcon } from '../components/Icons';
import SeasonPicker from '../components/SeasonPicker';
import IndexRow, { Spark, type RowStat } from '../components/teams/IndexRow';
import TeamsTabs from '../components/teams/TeamsTabs';
import { history, players } from '../data/load';
import { fmtPct, fmtPts, fmtRecord, fmtWinPct } from '../lib/format';
import { teamRows } from '../lib/indexRows';
import { playerName } from '../lib/players';
import { ordinal } from '../lib/teamProfile';

/** Every team in one season, in standings order, one row each with the season's shape and headline numbers. */
export default function TeamsPage() {
  const { season } = useLoaderData() as { seasons: Season[]; season: Season };
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const rows = teamRows(season);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Teams <span className="num font-normal text-muted">{season.year}</span></h1>
          <p className="text-sm text-muted">{season.status === 'complete' ? 'Final standings.' : `Through week ${season.lastScoredWeek}.`} Open a team for its full profile.</p>
        </div>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/teams/${y}`)} />
      </header>
      <TeamsTabs teamsTo={`/teams/${season.year}`} />
      <ul className="space-y-3">
        {rows.map((t) => {
          const r = t.row;
          const stats: RowStat[] = [
            { label: 'Record', value: fmtRecord(r), sub: r.streak !== '-' ? `streak ${r.streak}` : null },
            { label: 'Pts for', value: fmtPts(r.pf), sub: ordinal(t.pfRank), tone: t.pfRank === 1 ? 'win' : null },
            { label: 'Pts against', value: fmtPts(r.pa), sub: `${ordinal(t.paRank)} fewest` },
            { label: 'All-play', value: `${r.allPlay.w}–${r.allPlay.l}`, sub: fmtWinPct(r.allPlay.pct) },
            { label: 'Efficiency', value: fmtPct(r.efficiency) },
            { label: 'Week highs', value: String(r.weeklyHighs) },
          ];
          return (
            <IndexRow key={t.userId} to={`/teams/${season.year}/${t.userId}`} rank={r.rank} avatar={t.avatar} name={t.managerName}
              title={t.teamName} subtitle={t.managerName}
              badge={t.finish.place !== null
                ? <span className={`inline-flex items-center gap-1 font-medium ${t.finish.place === 1 ? 'text-gold' : t.finish.place === season.standings.length ? 'text-loss' : ''}`}>{t.finish.icon && <FinishIcon kind={t.finish.icon} />}{t.finish.label}{t.finish.note && <span className="font-normal text-muted">· {t.finish.note}</span>}</span>
                : <span className="text-muted">Seed #{r.rank} · {r.rank <= season.playoffTeams ? <span className="text-win">in the top {season.playoffTeams}</span> : <span className="text-loss">outside the top {season.playoffTeams}</span>}</span>}
              stats={stats}
              visual={
                <span className="flex items-center gap-4">
                  {t.topScorer && (
                    <span className="hidden items-center gap-2 xl:flex" title="Most points while started">
                      <Headshot players={players} id={t.topScorer.playerId} size={32} />
                      <span className="min-w-0"><span className="block max-w-[8rem] truncate text-xs font-medium">{playerName(players, t.topScorer.playerId)}</span><span className="num block text-[10px] text-muted">{fmtPts(t.topScorer.points)} started</span></span>
                    </span>
                  )}
                  <Spark points={t.spark} label={`${t.teamName}: points by week against the league average`} />
                </span>
              }
              cta="View team" />
          );
        })}
      </ul>
    </section>
  );
}
