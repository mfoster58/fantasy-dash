import { useLoaderData, useNavigate, useParams } from 'react-router';
import { computeStandings, type Season } from '@fantasy-dash/core';
import ScoreCard from '../components/ScoreCard';
import SeasonPicker from '../components/SeasonPicker';
import WeekStrip from '../components/WeekStrip';
import LiveDot from '../components/LiveDot';
import { weekStatus } from '../lib/live/weekStatus';
import { useLive } from '../lib/live/LiveProvider';
import { history, players } from '../data/load';

export default function ScoresPage() {
  const season = useLoaderData() as Season;
  const { week: weekParam } = useParams();
  const navigate = useNavigate();
  const live = useLive();
  const selected = Number(weekParam);
  const weeks = Number.isInteger(selected) ? season.weeks.filter((w) => w.week === selected) : [];
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
      {weeks.map((raw) => {
        const { week: wk, isLive, outlookOf } = weekStatus(season, raw, live);
        // rank and streak as they stood entering the week; none before week 1
        const entering = wk.week > 1 ? computeStandings(season.weeks.slice(0, wk.week - 1), Object.keys(season.managers), season.playoffWeekStart) : [];
        return (
          <div key={wk.week} className="space-y-3">
            {isLive && <LiveDot on={live.polling} />}
            {wk.games.length === 0 ? (
              <p className="text-sm text-muted">
                {wk.isPlayoff && !wk.played
                  ? 'Playoff matchups are set after the regular season.'
                  : 'No games scheduled.'}
              </p>
            ) : (
              <div className="grid gap-4">
                {wk.games.map((g) => (
                  <ScoreCard
                    key={g.id}
                    game={g}
                    played={wk.played}
                    managers={season.managers}
                    players={players}
                    seasonTeams={season.playerTeams}
                    to={`/scores/${season.year}/${wk.week}/${g.matchupId}`}
                    year={season.year}
                    live={outlookOf(g) ?? undefined}
                    standing={(u) => entering.find((r) => r.userId === u)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
