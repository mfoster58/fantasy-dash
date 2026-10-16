import { useMemo } from 'react';
import { Link, useLoaderData, useNavigate, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import AllTimeTeam from '../components/teams/AllTimeTeam';
import DraftDeskCard from '../components/teams/DraftDeskCard';
import FranchisePlayers from '../components/teams/FranchisePlayers';
import LeagueRecords from '../components/teams/LeagueRecords';
import EfficiencyCard from '../components/teams/EfficiencyCard';
import ProfileHeader from '../components/teams/ProfileHeader';
import Rivals from '../components/teams/Rivals';
import SeasonShape from '../components/teams/SeasonShape';
import SeasonsTable from '../components/teams/SeasonsTable';
import TeamsTabs from '../components/teams/TeamsTabs';
import { currentSeason, history, players } from '../data/load';
import { fmtPpg, fmtRecord, fmtWinPct } from '../lib/format';
import { allTimeContext, managerRecords } from '../lib/managerRecords';
import { careerProfile, ordinal } from '../lib/teamProfile';

/** One manager across every season. */
export default function ManagerPage() {
  const seasons = useLoaderData() as Season[];
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const c = useMemo(() => careerProfile(seasons, history, userId, players), [seasons, userId]);
  const records = useMemo(() => managerRecords(allTimeContext(seasons, players, history.managers), userId), [seasons, userId]);
  if (!history.managers[userId]) return <section className="space-y-4"><TeamsTabs teamsTo={`/teams/${currentSeason.year}`} /><p className="text-sm text-muted">No such manager.</p></section>;
  return (
    <section className="space-y-4">
      <TeamsTabs teamsTo={`/teams/${currentSeason.year}`} />
      <ProfileHeader
        avatar={c.avatar} name={c.name}
        eyebrow={<><span>Manager</span>{c.allTime && <span className="num normal-case tracking-normal text-muted">all-time rank {ordinal(c.allTime.rank)} of {c.managers}</span>}</>}
        title={c.name}
        subtitle={<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <select aria-label="Manager" value={userId} onChange={(e) => navigate(`/managers/${e.target.value}`)} className="rounded border border-line bg-surface px-2 py-0.5 text-sm text-ink">
            {history.allTime.map((r) => <option key={r.userId} value={r.userId}>{history.managers[r.userId]?.displayName ?? r.userId}</option>)}
          </select>
        </span>}
        tiles={[
          { label: 'Record', value: fmtRecord(c.record) },
          { label: 'Win %', value: fmtWinPct(c.winPct) },
          { label: 'Points for', value: fmtPpg(c.pf) },
          { label: 'Playoffs', value: <span className="whitespace-nowrap">{c.playoffApps} <span className="text-sm font-normal text-muted">out of</span> {c.completeSeasons}</span> },
          { label: 'Weekly highs', value: String(c.weekHighs) },
          { label: 'Titles', value: String(c.titles) },
        ]}
        chips={<><span className="section-label text-[10px]">Team history</span>{c.fieldedAs.map((f) => <Link key={`${f.teamName}-${f.from}`} to={`/teams/${f.to}/${userId}`} className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent hover:text-accent"><span className="font-semibold">{f.teamName}</span> <span className="num text-muted">{f.from === f.to ? f.from : `${f.from}–${f.to}`}</span></Link>)}</>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-4">
          <SeasonsTable seasons={c.seasons} userId={userId} />
          <SeasonShape wide title="PPG history" label="Season by season" points={[...c.seasons].reverse().map((s) => ({ label: String(s.year), mine: s.ppw, league: s.leagueAvgPpw, finish: s.finish === '—' ? undefined : { label: s.finish, icon: s.finishIcon } }))} mineCaption={`${fmtPpg(c.seasons.length ? c.seasons.reduce((t, s) => t + s.ppw, 0) / c.seasons.length : 0)} a week`} leagueCaption="league average" />
          <EfficiencyCard desk={c.lineup} />
          {c.draft && <DraftDeskCard desk={c.draft} players={players} />}
          <FranchisePlayers players={players} franchise={c.franchise} />
          <AllTimeTeam team={c.allTimeTeam} players={players} userId={userId} />
          <Rivals rivalries={c.rivalries} managers={history.managers} userId={userId} />
        </div>
        <div className="space-y-4">
          <LeagueRecords records={records} />
        </div>
      </div>
    </section>
  );
}
