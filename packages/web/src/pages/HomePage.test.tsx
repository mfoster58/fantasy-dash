import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import { game, line, season, side, standing, week } from '../test/playerFixtures';
import HomePage from './HomePage';

vi.mock('../data/load', async (orig) => {
  const real = await orig<typeof import('../data/load')>();
  return { ...real, players: (await import('../test/playerFixtures')).players, currentSeason: { ...real.currentSeason, year: 2026 }, history: { ...real.history, seasons: [], managers: {} } };
});

function league(withUpcoming: boolean): Season {
  const t = (u: string, w: number, l: number) => { const s = side(u, 0, []); s.recordBefore = { w, l, t: 0 }; s.seasonPpg = 120; s.projected = 120; return s; };
  const w1 = week(1, [game(2026, 1, 1, side('a', 130, [line('q1', 30)]), side('b', 100, [line('r1', 20)]))]);
  const w2 = week(2, withUpcoming ? [game(2026, 2, 1, t('a', 1, 0), t('b', 0, 1))] : []);
  w2.played = false;
  const s = season(2026, [w1, w2], null, 1);
  s.status = 'in_season';
  s.standings = [standing('a', 1, 1, 0, 0, 130, 100), standing('b', 2, 0, 1, 0, 100, 130)];
  s.managers = { a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 }, b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 } };
  return s;
}
let loaded: Season[] = [];
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => loaded }));

async function show(s: Season) {
  loaded = [s];
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  await screen.findByRole('region', { name: 'Standings' });
}

describe('HomePage', () => {
  it('shows the top row, standings, the results and top performers for the week played, and the leaders', async () => {
    await show(league(true));
    expect(screen.getByRole('region', { name: 'Game of the week' })).toHaveTextContent('Projected');
    expect(screen.getByRole('region', { name: 'Week 1' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Week 1 top performers' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'League leaders' })).toBeInTheDocument();
  });
  it('before week 1 has games: no top row and no results, standings still shown', async () => {
    const pre = league(false);
    pre.weeks = [week(1, [])]; pre.weeks[0].played = false;
    pre.lastScoredWeek = 0;
    await show(pre);
    expect(screen.queryByRole('region', { name: 'Game of the week' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Week 1' })).toBeNull();
  });
});
