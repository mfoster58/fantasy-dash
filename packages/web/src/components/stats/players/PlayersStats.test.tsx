import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import PlayersStats from './PlayersStats';
import StatsTabs from './StatsTabs';

const mount = (url = '/stats/players', charts = [statsCharts()]) => render(
  <MemoryRouter initialEntries={[url]}><Routes><Route path="/stats/players" element={<PlayersStats dbs={[statsDb()]} charts={charts} currentYear={2026} />} /></Routes></MemoryRouter>,
);

describe('PlayersStats', () => {
  it('opens on RB with its first view, the trends table and no YPRR chart', () => {
    mount();
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: /Expected vs actual/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /RB volume trends/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Yards per route run/ })).toBeNull();
  });
  it('chips switch views, and the view is kept in the URL', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Success % vs explosive %/ }));
    expect(screen.getByRole('region', { name: /Success % vs explosive %/ })).toBeInTheDocument();
  });
  it('a link with pos and view opens that chart', () => {
    mount('/stats/players?pos=WR&view=role');
    expect(screen.getByRole('region', { name: /Role map/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Yards per route run/ })).toBeInTheDocument();
  });
  it('a participation view in a season without participation shows the note', () => {
    mount('/stats/players?pos=QB&view=press');
    const chip = screen.getByRole('button', { name: /Clean vs pressured/ });
    expect(chip).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/arrives after the season ends/)).toBeInTheDocument();
  });
  it('renders a season with no chart file', () => {
    mount('/stats/players?pos=RB&view=boom', []);
    expect(screen.getByRole('region', { name: /Success % vs explosive %/ })).toHaveTextContent(/No data yet/);
  });
});

describe('StatsTabs', () => {
  it('links Managers and Players, marking the current one', () => {
    render(<MemoryRouter initialEntries={['/stats/players']}><StatsTabs /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Managers' })).toHaveAttribute('href', '/stats');
  });
});
