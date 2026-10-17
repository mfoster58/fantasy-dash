import { Link, useLoaderData, useNavigate, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import SeasonPicker from '../components/SeasonPicker';
import { FinishIcon } from '../components/Icons';
import ProfileHeader from '../components/teams/ProfileHeader';
import RosterBreakdown from '../components/teams/RosterBreakdown';
import Schedule from '../components/teams/Schedule';
import SeasonShape, { type ShapePoint } from '../components/teams/SeasonShape';
import TeamMoves from '../components/teams/TeamMoves';
import TeamPicks from '../components/teams/TeamPicks';
import TopStarts from '../components/teams/TopStarts';
import { history, players } from '../data/load';
import { fmtPct, fmtPpg, fmtPts, fmtRecord, fmtWinPct } from '../lib/format';
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
        <p className="text-sm text-muted">{history.managers[userId]?.displayName ?? 'That manager'} did not play in {season.year}.{years.length > 0 && <> Try <Link to={`/teams/${years[years.length - 1]}/${userId}`} className="text-accent hover:underline">{years[years.length - 1]}</Link>.</>}</p>
      </section>
    );
  }
  const p = seasonProfile(season, userId, players);
  const inSeason = season.status === 'in_season';
  const ap = p.row?.allPlay;
  const complete = season.status === 'complete';
  return (
    <section className="space-y-4">
      <ProfileHeader
        avatar={p.avatar} name={p.displayName}
        pennants={complete && p.finish.place === 1 ? [season.year] : []}
        eyebrow={<SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/teams/${y}/${userId}`)} />}
        title={p.teamName}
        subtitle={<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <select aria-label="Manager" value={userId} onChange={(e) => navigate(`/teams/${season.year}/${e.target.value}`)} className="rounded border border-line bg-surface px-2 py-0.5 text-sm text-ink">
            {season.standings.map((r) => <option key={r.userId} value={r.userId}>{season.managers[r.userId]?.displayName ?? r.userId}</option>)}
          </select>
          <Link to={`/managers/${userId}`} className="hover:text-accent">manager page →</Link>
        </span>}
        badges={[
          <span title="Points for, ranked in the league">PF <b className="text-ink">{ordinal(p.scoringRank)}</b></span>,
          <span title="Points against, ranked from fewest allowed">PA <b className="text-ink">{ordinal(p.pointsAllowedRank)}</b></span>,
          <span title="Lineup efficiency: points scored as a share of the best possible lineup, ranked in the league">EFF <b className="num text-ink">{fmtPct(p.efficiency, 0)}</b> · {ordinal(p.efficiencyRank)}</span>,
          inSeason ? <span>Through week {season.lastScoredWeek}</span> : null,
        ].filter(Boolean)}
        tiles={[
          { label: 'Record', value: p.row ? fmtRecord(p.row) : '—' },
          { label: 'Pts for', value: p.row ? fmtPpg(p.row.pf) : '—' },
          { label: 'Pts against', value: p.row ? fmtPpg(p.row.pa) : '—' },
          { label: 'Finish', value: p.finish.icon ? <span className="inline-flex items-center gap-1.5"><FinishIcon kind={p.finish.icon} />{p.finish.label}</span> : p.finish.label, sub: p.finish.note ?? (inSeason ? 'season in progress' : null), tone: p.finish.place === 1 ? 'gold' : p.finish.place === p.teams ? 'loss' : null },
          { label: 'Playoff seed', value: p.seed === null ? '—' : `#${p.seed}`, sub: p.seed === null ? null : complete ? (p.madePlayoffs ? 'made the playoffs' : `missed · top ${p.playoffSpots} play`) : (p.madePlayoffs ? `in the top ${p.playoffSpots}` : `outside the top ${p.playoffSpots}`), tone: p.seed === null ? null : p.madePlayoffs ? 'win' : 'loss' },
          { label: 'All-play', value: ap ? `${ap.w}–${ap.l}${ap.t ? `–${ap.t}` : ''}` : '—', sub: ap ? `${fmtWinPct(ap.pct)} vs everyone` : null },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-4">
          <SeasonShape label="Week by week" points={p.schedule.flatMap((e): ShapePoint[] => e.kind === 'played' ? [{ label: `Week ${e.week}`, mine: e.points, league: e.leagueAvg, result: e.result, playoff: e.isPlayoff }] : e.kind === 'bye' ? [{ label: `Week ${e.week}`, mine: null, league: e.leagueAvg, playoff: true }] : [])} mineCaption={`${fmtPpg(p.ppw)} a week`} leagueCaption={`${fmtPpg(p.leagueAvgPpw)} league average`} />
          <Schedule entries={p.schedule} managers={season.managers} year={season.year} />
          {season.draft && p.picks.length > 0 && <TeamPicks picks={p.picks} teams={season.draft.slotOrder.length} grade={p.grade} value={p.draftValue} year={season.year} players={players} seasonTeams={season.playerTeams} />}
          <TopStarts label="Single-week highs" title="Best starts" rows={p.bestStarts} empty="Nothing started yet." players={players} seasonTeams={season.playerTeams} managers={season.managers} year={season.year} />
          <TopStarts label="Waivers and free agents" title="Best waiver starts" rows={p.bestWaiverStarts} empty="No pickup has started yet." players={players} seasonTeams={season.playerTeams} managers={season.managers} year={season.year} />
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
