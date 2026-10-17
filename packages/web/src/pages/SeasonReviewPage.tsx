import { Link, useLoaderData } from 'react-router';
import type { ReactNode } from 'react';
import type { Season } from '@fantasy-dash/core';
import StandingsTable from '../components/StandingsTable';
import Bracket from '../components/history/Bracket';
import DraftRoundOne from '../components/history/DraftRoundOne';
import HonorsStrip from '../components/history/HonorsStrip';
import RecordsBlock from '../components/history/RecordsBlock';
import { players } from '../data/load';
import { seasonRecords } from '../lib/records';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (<section className="space-y-3"><h2 className="text-[15px] font-semibold text-ink">{title}</h2>{children}</section>);
}

export default function SeasonReviewPage() {
  const season = useLoaderData() as Season;
  const hasBracket = season.brackets.winners.some((g) => g.home !== null);
  return (
    <article className="space-y-8">
      <nav className="text-xs text-muted"><Link to="/history" className="hover:text-ink">← League history</Link></nav>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">{season.year} <span className="font-normal text-muted">season review</span></h1>
        <Link to={`/scores/${season.year}/${Math.max(1, season.lastScoredWeek)}`} className="text-sm text-accent hover:underline">Scoreboard →</Link>
      </header>
      <HonorsStrip honors={season.honors} managers={season.managers} status={season.status} lastScoredWeek={season.lastScoredWeek} year={season.year} />
      <Section title={season.status === 'complete' ? 'Final standings' : `Standings · through week ${season.lastScoredWeek}`}>
        <StandingsTable rows={season.standings} managers={season.managers} playoffTeams={season.playoffTeams} year={season.year} />
      </Section>
      <Section title="Playoffs">
        {hasBracket ? <Bracket games={season.brackets.winners} kind="winners" managers={season.managers} year={season.year} /> : <p className="text-sm text-muted">Playoff matchups are set after the regular season.</p>}
      </Section>
      {hasBracket && season.brackets.consolation.length > 0 && (
        <Section title="Consolation">
          <Bracket games={season.brackets.consolation} kind="consolation" managers={season.managers} year={season.year} />
        </Section>
      )}
      {season.draft && (
        <Section title="Draft">
          <DraftRoundOne draft={season.draft} managers={season.managers} players={players} seasonTeams={season.playerTeams} year={season.year} />
        </Section>
      )}
      {season.standings.length > 0 && (
        <Section title="Season records">
          <RecordsBlock records={seasonRecords(season.standings)} managers={season.managers} />
        </Section>
      )}
    </article>
  );
}
