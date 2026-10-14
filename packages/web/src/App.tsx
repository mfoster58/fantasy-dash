import { createBrowserRouter, Outlet, redirect, type LoaderFunctionArgs } from 'react-router';
import Nav from './components/Nav';
import ErrorPage from './pages/ErrorPage';
import HomePage from './pages/HomePage';
import StandingsPage from './pages/StandingsPage';
import { currentSeason, loadSeason } from './data/load';

export async function seasonLoader({ params }: LoaderFunctionArgs) {
  const year = Number(params.season);
  if (!Number.isInteger(year)) throw new Response('Bad season', { status: 400 });
  return loadSeason(year);
}

function Layout() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
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
        { index: true, element: <HomePage /> },
        { path: 'standings', loader: () => redirect(`/standings/${currentSeason.year}`) },
        { path: 'standings/:season', loader: seasonLoader, element: <StandingsPage /> },
      ],
    },
  ],
  { basename },
);
