import { useMemo } from 'react';
import { Link, useLoaderData, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import { TrophyIcon } from '../components/Icons';
import DraftDeskCard from '../components/teams/DraftDeskCard';
import FranchisePlayers from '../components/teams/FranchisePlayers';
import LeagueRecords from '../components/teams/LeagueRecords';
import LineupDeskCard from '../components/teams/LineupDeskCard';
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
  const c = useMemo(() => careerProfile(seasons, history, userId, players), [seasons, userId]);
  const records = useMemo(() => managerRecords(allTimeContext(seasons, players, history.managers), userId), [seasons, userId]);
  if (!history.managers[userId]) return <section className="space-y-4"><TeamsTabs teamsTo={`/teams/${currentSeason.year}`} /><p className="text-sm text-muted">No such manager.</p></section>;
  const latest = c.seasons[0];
  return (
    <section className="space-y-4">
      <TeamsTabs teamsTo={`/teams/${currentSeason.year}`} />
      <ProfileHeader
        avatar={c.avatar} name={c.name}
        eyebrow={<><span>Manager</span>{c.allTime && <span className="num normal-case tracking-normal text-muted">all-time rank {ordinal(c.allTime.rank)} of {c.managers}</span>}</>}
        title={c.name}
        subtitle={latest && <Link to={`/teams/${latest.year}/${userId}`} className="hover:text-accent">{latest.teamName} · {latest.year} team page →</Link>}
        badges={[
          <span className="num">Seasons <b className="text-ink">{c.seasons.length}</b> · {c.seasons.length ? `${c.seasons[c.seasons.length - 1].year}–${c.seasons[0].year}` : ''}</span>,
          c.titles > 0 ? <span className="inline-flex items-center gap-1 text-gold"><TrophyIcon /> {c.titles} title{c.titles === 1 ? '' : 's'}</span> : null,
          <span>Longest win streak <b className="num text-ink">{c.longestWinStreak}</b></span>,
          <span>Week highs <b className="num text-ink">{c.weekHighs}</b></span>,
        ].filter(Boolean)}
        tiles={[
          { label: 'Record', value: fmtRecord(c.record) },
          { label: 'Win %', value: fmtWinPct(c.winPct) },
          { label: 'Points for', value: fmtPpg(c.pf) },
          { label: 'Playoffs', value: `${c.playoffApps}/${c.seasons.length}` },
          { label: 'Best finish', value: c.bestFinish },
          { label: 'Titles', value: String(c.titles) },
        ]}
        chips={<><span className="section-label text-[10px]">Fielded as</span>{c.fieldedAs.map((f) => <span key={`${f.teamName}-${f.from}`} className="rounded-full border border-line px-2.5 py-0.5"><span className="font-medium">{f.teamName}</span> <span className="num text-muted">{f.from === f.to ? f.from : `${f.from}–${f.to}`}</span></span>)}</>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-4">
          <SeasonsTable seasons={c.seasons} userId={userId} />
          <SeasonShape wide label="Season by season" points={[...c.seasons].reverse().map((s) => ({ label: String(s.year), mine: s.ppw, league: s.leagueAvgPpw }))} mineCaption={`${fmtPpg(c.seasons.length ? c.seasons.reduce((t, s) => t + s.ppw, 0) / c.seasons.length : 0)} a week`} leagueCaption="league average" />
          <LineupDeskCard desk={c.lineup} />
          {c.draft && <DraftDeskCard desk={c.draft} players={players} />}
          <FranchisePlayers players={players} franchise={c.franchise} />
        </div>
        <div className="space-y-4">
          <LeagueRecords records={records} />
          <Rivals rivalries={c.rivalries} managers={history.managers} userId={userId} />
        </div>
      </div>
    </section>
  );
}
