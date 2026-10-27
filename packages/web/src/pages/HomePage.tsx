import { useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import HomeStandings from '../components/home/HomeStandings';
import LeadersBand from '../components/home/LeadersBand';
import ResultsCard from '../components/home/ResultsCard';
import TopPerformers from '../components/home/TopPerformers';
import TopRow from '../components/home/TopRow';
import { currentSeason, history } from '../data/load';
import { homeWeek, pickGames } from '../lib/home/pick';
import { scoredSoFar } from '../lib/home/results';
import { useLive, useLiveStats } from '../lib/live/LiveProvider';
import { weekStatus } from '../lib/live/weekStatus';

export default function HomePage() {
  const seasons = useLoaderData() as Season[];
  const live = useLive();
  const season = seasons.find((s) => s.year === currentSeason.year) ?? seasons[seasons.length - 1];
  const champion = history.seasons.find((s) => s.year === season.year - 1)?.honors.champion ?? null;
  const liveNo = live.season?.year === season.year ? live.week : null;
  const thisWeek = homeWeek(season, liveNo);
  const picks = thisWeek ? pickGames(season, thisWeek, champion) : null;
  // from the live week's first kickoff, results and top performers follow it; until then, the last week played
  const st = thisWeek ? weekStatus(season, thisWeek, live) : null;
  useLiveStats(!!st?.started);
  const results = st?.started ? scoredSoFar(st.week) : season.lastScoredWeek > 0 ? season.weeks[season.lastScoredWeek - 1] : null;
  return (
    <div className="space-y-5">
      {thisWeek && picks?.hero && <TopRow season={season} week={thisWeek} picks={picks} champion={champion} />}
      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <HomeStandings season={season} />
        {results && results.games.length > 0 && (
          <div className="space-y-4">
            <ResultsCard season={season} week={results} live={!!st?.started} />
            <TopPerformers season={season} week={results} />
          </div>
        )}
      </div>
      <LeadersBand seasons={seasons} season={season} />
    </div>
  );
}
