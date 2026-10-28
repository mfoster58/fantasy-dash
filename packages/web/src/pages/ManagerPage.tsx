import { useMemo } from 'react';
import { Link, useLoaderData, useNavigate, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import AllTimeTeam from '../components/teams/AllTimeTeam';
import DraftDeskCard from '../components/teams/DraftDeskCard';
import FranchisePlayers from '../components/teams/FranchisePlayers';
import LeagueRecords from '../components/teams/LeagueRecords';
import EfficiencyCard from '../components/teams/EfficiencyCard';
import ProfileHeader from '../components/teams/ProfileHeader';
import CareerTimeline from '../components/teams/CareerTimeline';
import { careerTimeline } from '../lib/careerTimeline';
import Rivals from '../components/teams/Rivals';
import SeasonsTable from '../components/teams/SeasonsTable';
import { history, players } from '../data/load';
import { fmtPpg, fmtRecord, fmtWinPct } from '../lib/format';
import { allTimeContext, managerRecords } from '../lib/managerRecords';
import { careerProfile, ordinal } from '../lib/teamProfile';

/** One manager across every season. */
export default function ManagerPage() {
  const seasons = useLoaderData() as Season[];
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const c = useMemo(() => careerProfile(seasons, history, userId, players), [seasons, userId]);
  const timeline = useMemo(() => careerTimeline(c.seasons, seasons, userId, players, history.managers[userId]?.displayName ?? userId), [c.seasons, seasons, userId]);
  const records = useMemo(() => managerRecords(allTimeContext(seasons, players, history.managers), userId), [seasons, userId]);
  if (!history.managers[userId]) return <section className="space-y-4"><p className="text-sm text-muted">No such manager.</p></section>;
  return (
    <section className="space-y-4">
      <ProfileHeader
        avatar={c.avatar} name={c.name}
        pennants={[...c.honors.champion].sort((a, b) => b - a)}
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
          <CareerTimeline stops={timeline} players={players} />
          <EfficiencyCard desk={c.lineup} />
          {c.draft && <DraftDeskCard desk={c.draft} players={players} />}
          <FranchisePlayers players={players} franchise={c.franchise} />
          <AllTimeTeam team={c.allTimeTeam} players={players} userId={userId} />
        </div>
        <div className="space-y-4">
          <LeagueRecords records={records} />
          <Rivals rivalries={c.rivalries} managers={history.managers} userId={userId} />
        </div>
      </div>
    </section>
  );
}
