import { Outlet, redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import Nav from './components/Nav';
import ScoreTicker from './components/ScoreTicker';
import { LiveProvider } from './lib/live/LiveProvider';
import ErrorPage from './pages/ErrorPage';
import BoxScorePage from './pages/BoxScorePage';
import ScoresPage from './pages/ScoresPage';
import StandingsPage from './pages/StandingsPage';
import H2HPage from './pages/H2HPage';
import HistoryPage from './pages/HistoryPage';
import SeasonReviewPage from './pages/SeasonReviewPage';
import DraftPage from './pages/DraftPage';
import GradingPage from './pages/GradingPage';
import RecordsPage from './pages/RecordsPage';
import StatsPage from './pages/StatsPage';
import StatsPlayersPage, { type StatsPlayersData } from './pages/StatsPlayersPage';
import TeamPage from './pages/TeamPage';
import ManagerPage from './pages/ManagerPage';
import PlayersPage from './pages/PlayersPage';
import PlayerPage, { type PlayerPageData } from './pages/PlayerPage';
import { isRostered } from './lib/player/coverage';
import { mergeSeasons } from './lib/playerdb/merge';
import { currentSeason, hasPlayerDb, history, loadAllSeasons, loadPlayerDb, loadSeason, hasCharts, loadCharts } from './data/load';

export async function seasonLoader({ params }: LoaderFunctionArgs) {
  const year = Number(params.season);
  if (!Number.isInteger(year)) throw new Response('Bad season', { status: 400 });
  return loadSeason(year);
}

/** Every season plus the one in the URL; 404 for a season the league never played. */
export async function teamsLoader({ params }: LoaderFunctionArgs) {
  const year = Number(params.season);
  if (!history.seasons.some((s) => s.year === year)) throw new Response(`No season ${params.season}`, { status: 404 });
  const seasons = await loadAllSeasons();
  return { seasons, season: seasons.find((s) => s.year === year)! };
}

/** There is no teams index any more: a season on its own opens the team at the top of its standings. */
export async function topTeamLoader(args: LoaderFunctionArgs) {
  const { season } = await teamsLoader(args);
  return redirect(`/teams/${season.year}/${season.standings[0].userId}`);
}

/** The season plus its player database, or null for a year not yet synced; 404 for a year the league never played. */
export async function playersLoader({ params }: LoaderFunctionArgs) {
  if (params.season === 'all') {
    const years = history.seasons.map((s) => s.year).filter(hasPlayerDb);
    const [season, dbs] = await Promise.all([loadSeason(currentSeason.year), Promise.all(years.map(loadPlayerDb))]);
    if (!dbs.length) return { season, db: null };
    const { db, spans } = mergeSeasons(dbs);
    return { season, db, spans };
  }
  const year = Number(params.season);
  if (!history.seasons.some((s) => s.year === year)) throw new Response(`No season ${params.season}`, { status: 404 });
  const [season, db] = await Promise.all([loadSeason(year), hasPlayerDb(year) ? loadPlayerDb(year) : Promise.resolve(null)]);
  return { season, db };
}

export async function playerLoader({ params }: LoaderFunctionArgs): Promise<PlayerPageData> {
  const id = params.id ?? '';
  const years = history.seasons.map((s) => s.year);
  const [seasons, dbs, charts] = await Promise.all([
    loadAllSeasons(),
    Promise.all(years.filter(hasPlayerDb).map(loadPlayerDb)),
    Promise.all(years.filter(hasCharts).map(loadCharts)),
  ]);
  if (!dbs.some((d) => Object.hasOwn(d.players, id)) && !isRostered(seasons, id)) throw new Response(`No player ${id}`, { status: 404 });
  return { id, seasons, dbs, charts };
}

export async function statsPlayersLoader(): Promise<StatsPlayersData> {
  const years = history.seasons.map((s) => s.year);
  const [dbs, charts] = await Promise.all([Promise.all(years.filter(hasPlayerDb).map(loadPlayerDb)), Promise.all(years.filter(hasCharts).map(loadCharts))]);
  return { dbs, charts };
}

function Layout() {
  return (
    <LiveProvider>
      <div className="min-h-screen bg-bg text-ink">
        <ScoreTicker />
        <Nav />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </LiveProvider>
  );
}

/** URLs of pages that no longer exist, and where they go now. */
export const RETIRED_PATHS: Record<string, string> = { 'all-time': '/records' };

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, loader: () => redirect(`/scores/${currentSeason.year}/${Math.max(1, currentSeason.lastScoredWeek)}`) },
      { path: 'scores', loader: () => redirect(`/scores/${currentSeason.year}/${Math.max(1, currentSeason.lastScoredWeek)}`) },
      {
        path: 'scores/:season',
        loader: async (args: LoaderFunctionArgs) => {
          const season = await seasonLoader(args);
          return redirect(`/scores/${season.year}/${Math.max(1, season.lastScoredWeek)}`);
        },
      },
      { path: 'scores/:season/:week', loader: seasonLoader, element: <ScoresPage /> },
      { path: 'scores/:season/:week/:matchupId', loader: seasonLoader, element: <BoxScorePage /> },
      { path: 'standings', loader: () => redirect(`/standings/${currentSeason.year}`) },
      { path: 'standings/:season', loader: seasonLoader, element: <StandingsPage /> },
      { path: 'teams', loader: () => redirect(`/teams/${currentSeason.year}`) },
      { path: 'teams/:season', loader: topTeamLoader },
      { path: 'teams/:season/:userId', loader: teamsLoader, element: <TeamPage /> },
      { path: 'managers', loader: () => redirect(`/managers/${history.allTime[0].userId}`) },
      { path: 'managers/:userId', loader: () => loadAllSeasons(), element: <ManagerPage /> },
      { path: 'players', loader: () => redirect(`/players/${currentSeason.year}`) },
      { path: 'players/:season', loader: playersLoader, element: <PlayersPage /> },
      { path: 'player/:id', loader: playerLoader, element: <PlayerPage /> },
      ...Object.entries(RETIRED_PATHS).map(([path, to]) => ({ path, loader: () => redirect(to) })),
      { path: 'h2h', loader: () => loadAllSeasons(), element: <H2HPage /> },
      { path: 'records', loader: () => loadAllSeasons(), element: <RecordsPage /> },
      { path: 'stats', loader: () => loadAllSeasons(), element: <StatsPage /> },
      { path: 'stats/players', loader: statsPlayersLoader, element: <StatsPlayersPage /> },
      { path: 'stats/managers', loader: ({ request }: LoaderFunctionArgs) => redirect(`/stats${new URL(request.url).search}`) },
      { path: 'history', element: <HistoryPage /> },
      { path: 'history/:season', loader: seasonLoader, element: <SeasonReviewPage /> },
      { path: 'draft', loader: () => redirect(`/draft/${currentSeason.year}`) },
      { path: 'draft/grading', loader: () => loadAllSeasons().then((all) => all.filter((s) => s.status === 'complete' && s.draft).at(-1) ?? null), element: <GradingPage /> },
      { path: 'draft/:season', loader: seasonLoader, element: <DraftPage /> },
    ],
  },
];
