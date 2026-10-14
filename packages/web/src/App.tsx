import { createBrowserRouter, Outlet, redirect, type LoaderFunctionArgs } from 'react-router';
import Nav from './components/Nav';
import ErrorPage from './pages/ErrorPage';
import BoxScorePage from './pages/BoxScorePage';
import ScoresPage from './pages/ScoresPage';
import StandingsPage from './pages/StandingsPage';
import AllTimePage from './pages/AllTimePage';
import H2HPage from './pages/H2HPage';
import HistoryPage from './pages/HistoryPage';
import { currentSeason, loadAllSeasons, loadSeason } from './data/load';

export async function seasonLoader({ params }: LoaderFunctionArgs) {
  const year = Number(params.season);
  if (!Number.isInteger(year)) throw new Response('Bad season', { status: 400 });
  return loadSeason(year);
}

function Layout() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Nav />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
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
        { path: 'all-time', element: <AllTimePage /> },
        { path: 'h2h', loader: () => loadAllSeasons(), element: <H2HPage /> },
        { path: 'history', element: <HistoryPage /> },
      ],
    },
  ],
  { basename },
);
