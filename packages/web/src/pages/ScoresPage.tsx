import { useLoaderData, useNavigate, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import ScoreCard from '../components/ScoreCard';
import SeasonPicker from '../components/SeasonPicker';
import WeekStrip from '../components/WeekStrip';
import { history, players } from '../data/load';

export default function ScoresPage() {
  const season = useLoaderData() as Season;
  const { week: weekParam } = useParams();
  const navigate = useNavigate();
  const selected: number | 'season' = weekParam === 'season' ? 'season' : Number(weekParam);
  const weeks = selected === 'season' ? season.weeks : season.weeks.filter((w) => w.week === selected);
  const years = history.seasons.map((s) => s.year);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Scoreboard <span className="num font-normal text-muted">{season.year}</span>
        </h1>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/scores/${y}`)} />
      </header>
      <WeekStrip weeks={season.weeks} selected={selected} onSelect={(w) => navigate(`/scores/${season.year}/${w}`)} />
      {weeks.length === 0 && <p className="text-sm text-muted">No week {weekParam} in {season.year}.</p>}
      {weeks.map((wk) => (
        <div key={wk.week} className="space-y-3">
          {selected === 'season' && (
            <h2 className="section-label">
              Week {wk.week}{wk.isPlayoff ? ' · Playoffs' : ''}{wk.played ? '' : ' · Upcoming'}
            </h2>
          )}
          {wk.games.length === 0 ? (
            <p className="text-sm text-muted">
              {wk.isPlayoff && !wk.played
                ? 'Playoff matchups are set after the regular season.'
                : 'No games scheduled.'}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {wk.games.map((g) => (
                <ScoreCard
                  key={g.id}
                  game={g}
                  played={wk.played}
                  managers={season.managers}
                  players={players}
                  to={`/scores/${season.year}/${wk.week}/${g.matchupId}`}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
