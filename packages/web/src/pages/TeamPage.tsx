import { Link, useLoaderData, useNavigate, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import SeasonPicker from '../components/SeasonPicker';
import ProfileHeader from '../components/teams/ProfileHeader';
import RosterBreakdown from '../components/teams/RosterBreakdown';
import Schedule from '../components/teams/Schedule';
import SeasonShape from '../components/teams/SeasonShape';
import TeamMoves from '../components/teams/TeamMoves';
import TeamPicks from '../components/teams/TeamPicks';
import TeamsTabs from '../components/teams/TeamsTabs';
import { history, players } from '../data/load';
import { fmtPct, fmtPpg, fmtPts, fmtRecord } from '../lib/format';
import { ordinal, seasonProfile } from '../lib/teamProfile';

/** One manager's season: header, shape, schedule, picks, roster breakdown and moves. */
export default function TeamPage() {
  const { season } = useLoaderData() as { seasons: Season[]; season: Season };
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const years = history.managers[userId]?.seasons ?? [];
  if (!season.managers[userId]) {
    return (
      <section className="space-y-4">
        <TeamsTabs teamsTo={`/teams/${season.year}`} />
        <p className="text-sm text-muted">{history.managers[userId]?.displayName ?? 'That manager'} did not play in {season.year}.{years.length > 0 && <> Try <Link to={`/teams/${years[years.length - 1]}/${userId}`} className="text-accent hover:underline">{years[years.length - 1]}</Link>.</>}</p>
      </section>
    );
  }
  const p = seasonProfile(season, userId, players);
  const inSeason = season.status === 'in_season';
  const ap = p.row?.allPlay;
  return (
    <section className="space-y-4">
      <TeamsTabs teamsTo={`/teams/${season.year}`} />
      <ProfileHeader
        avatar={p.avatar} name={p.displayName}
        eyebrow={<><SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/teams/${y}/${userId}`)} /><Link to={`/teams/${season.year}`} className="text-accent normal-case tracking-normal hover:underline">All teams</Link></>}
        title={p.teamName}
        subtitle={<Link to={`/managers/${userId}`} className="hover:text-accent">{p.displayName} · manager page →</Link>}
        badges={[
          <>Scoring <b className="text-ink">{ordinal(p.scoringRank)}</b> of {p.teams}</>,
          <>Points allowed <b className="text-ink">{ordinal(p.pointsAllowedRank)} most</b></>,
          ap ? <>Vs. everyone <b className="num text-ink">{ap.w}–{ap.l}{ap.t ? `–${ap.t}` : ''}</b></> : null,
        ].filter(Boolean)}
        tiles={[
          { label: 'Record', value: p.row ? fmtRecord(p.row) : '—' },
          { label: 'Pts for', value: p.row ? fmtPpg(p.row.pf) : '—' },
          { label: 'Pts against', value: p.row ? fmtPpg(p.row.pa) : '—' },
          { label: 'Finish', value: p.finish, sub: p.finishNote === 'Regular-season rank' ? 'regular season' : p.finishNote },
          { label: 'Draft slot', value: p.draftSlot === null ? '—' : String(p.draftSlot) },
          { label: 'FAAB spent', value: `$${p.faab}` },
        ]}
        strip={<>
          <span>Longest win streak <b className="num text-ink">{p.longestWinStreak}</b></span>
          <span>Left on the bench <b className="num text-ink">{fmtPpg(p.benchLeft)}</b> · <span className="num">{fmtPct(p.efficiency, 0)}</span> of the best lineup</span>
          {inSeason && <span>Through week {season.lastScoredWeek}</span>}
        </>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-4">
          <SeasonShape label="Week by week" points={p.weeks.map((w) => ({ label: `Week ${w.week}`, mine: w.points, league: w.leagueAvg }))} mineCaption={`${fmtPpg(p.ppw)} a week`} leagueCaption={`${fmtPpg(p.leagueAvgPpw)} league average`} />
          <Schedule weeks={p.weeks} managers={season.managers} year={season.year} />
          {season.draft && p.picks.length > 0 && <TeamPicks picks={p.picks} teams={season.draft.slotOrder.length} grade={p.grade} value={p.draftValue} year={season.year} players={players} seasonTeams={season.playerTeams} />}
        </div>
        <div className="space-y-4">
          <RosterBreakdown positions={p.positions} neverStarted={p.neverStarted} players={players} seasonTeams={season.playerTeams} weeksPlayed={p.weeksPlayed} />
          <TeamMoves moves={p.moves} bestPickup={p.bestPickup} players={players} seasonTeams={season.playerTeams} managers={history.managers} userId={userId} />
        </div>
      </div>
      <p className="text-xs text-muted">Points, ranks and shares cover every played week including playoffs; the record and points tiles are regular season. Totals: {fmtPts(p.row?.pf ?? 0)} for.</p>
    </section>
  );
}
