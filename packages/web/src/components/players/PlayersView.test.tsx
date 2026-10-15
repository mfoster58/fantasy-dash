import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { History } from '@fantasy-dash/core';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import PlayersView from './PlayersView';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] },
};
const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40), line('r1', 20)]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
    week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
  ], 'a'),
  season(2025, [
    week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35, { pass_yd: 300, pass_td: 3 })]), side('a', 9, [line('r1', 9, { rush_yd: 40 })]))]),
  ], null, 1),
];

function LocationProbe() { const loc = useLocation(); return <output data-testid="loc">{loc.search}</output>; }
const mount = (initial = '/players') => render(
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route path="/players" element={<><PlayersView seasons={seasons} players={players} managers={managers} currentYear={2025} lastScoredWeek={1} /><LocationProbe /></>} />
    </Routes>
  </MemoryRouter>,
);

describe('PlayersView', () => {
  it('renders the four sections with every board and the through-week line', () => {
    mount();
    expect(screen.getByText(/through 2025 week 1/i)).toBeInTheDocument();
    for (const h of ['League leaders', 'All-time', 'Postseason', 'Extras']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
    expect(screen.getByText('Most postseason receptions')).toBeInTheDocument();
    expect(screen.getByText('Journeyman')).toBeInTheDocument();
    expect(screen.getByText('Most yards')).toBeInTheDocument();
  });

  it('filters every board by position and writes the choice to the URL', () => {
    mount();
    const best = screen.getByRole('region', { name: 'Best week by a starter' });
    expect(within(best).getAllByRole('listitem')[0]).toHaveTextContent('Quincy One');
    fireEvent.click(screen.getByRole('button', { name: 'RB' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('?pos=RB');
    expect(within(screen.getByRole('region', { name: 'Best week by a starter' })).getAllByRole('listitem')[0]).toHaveTextContent('Ricky One');
    expect(within(screen.getByRole('region', { name: 'Most yards' })).getAllByRole('listitem')[0]).toHaveTextContent('Ricky One');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('');
  });

  it('reads the position from the URL and falls back to All for junk', () => {
    mount('/players?pos=QB');
    expect(screen.getByRole('button', { name: 'QB' })).toHaveAttribute('aria-pressed', 'true');
    mount('/players?pos=XYZ');
    expect(screen.getAllByRole('button', { name: 'All' }).at(-1)).toHaveAttribute('aria-pressed', 'true');
  });

  it('says the season has not started when the current year has no lines', () => {
    render(
      <MemoryRouter>
        <PlayersView seasons={seasons} players={players} managers={managers} currentYear={2026} lastScoredWeek={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByText('Most yards')).toBeNull();
  });
});
