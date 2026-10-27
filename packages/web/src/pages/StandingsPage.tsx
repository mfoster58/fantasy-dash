import { useLoaderData, useNavigate } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import Bracket from '../components/history/Bracket';
import StandingsTable from '../components/StandingsTable';
import SeasonPicker from '../components/SeasonPicker';
import { history } from '../data/load';
import { standingsBrackets } from '../lib/standings/brackets';

/** the season, and the last finished one before it, whose bracket shows where each seed goes */
export interface StandingsData { season: Season; template: Season | null }

function BracketSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function StandingsPage() {
  const { season, template } = useLoaderData() as StandingsData;
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const note = season.status === 'in_season' ? `through week ${season.lastScoredWeek}` : 'final';
  const brackets = standingsBrackets(season, template);
  const caption = brackets.kind === 'projected' ? 'If the season ended today: seeded from the table above.' : null;
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
        Regular season only. Click a column to sort by it; hover for its definition. Top {season.playoffTeams} make the playoffs.
      </p>
      {brackets.kind !== 'none' && (
        <div className="space-y-8 pt-4">
          <BracketSection title="Playoffs">
            {caption && <p className="text-sm text-muted">{caption}</p>}
            <Bracket games={brackets.winners} kind="winners" managers={season.managers} year={season.year} seeds={brackets.seeds} />
          </BracketSection>
          {brackets.consolation.length > 0 && (
            <BracketSection title="Toilet bowl">
              {caption && <p className="text-sm text-muted">{caption}</p>}
              <Bracket games={brackets.consolation} kind="consolation" managers={season.managers} year={season.year} seeds={brackets.seeds} />
            </BracketSection>
          )}
        </div>
      )}
    </section>
  );
}
