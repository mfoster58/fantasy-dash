import { useLoaderData, useNavigate } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import StandingsTable from '../components/StandingsTable';
import SeasonPicker from '../components/SeasonPicker';
import { history } from '../data/load';

export default function StandingsPage() {
  const season = useLoaderData() as Season;
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const note = season.status === 'in_season' ? `through week ${season.lastScoredWeek}` : 'final';
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Standings <span className="num font-normal text-muted">{season.year}</span>{' '}
          <span className="ml-1 text-sm font-normal text-muted">{note}</span>
        </h1>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/standings/${y}`)} />
      </header>
      <StandingsTable rows={season.standings} managers={season.managers} playoffTeams={season.playoffTeams} year={season.year} />
      <p className="text-xs text-muted">
        Regular season only. Hover a column header for its definition. Top {season.playoffTeams} make the playoffs.
      </p>
    </section>
  );
}
