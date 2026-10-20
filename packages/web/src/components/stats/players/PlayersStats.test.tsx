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
  it('a tooltip opened by a tap closes when the view changes', () => {
    mount();
    const logo = screen.getByRole('region', { name: /Expected vs actual/ }).querySelector('[data-player]')!;
    fireEvent.pointerDown(logo, { pointerType: 'touch' });
    fireEvent.click(logo);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Success % vs explosive %/ }));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('the trends window ends at the league\'s last scored week', () => {
    render(<MemoryRouter initialEntries={['/stats/players']}><Routes><Route path="/stats/players" element={<PlayersStats dbs={[statsDb()]} charts={[statsCharts()]} currentYear={2026} lastWeeks={{ 2026: 4 }} />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('region', { name: /RB volume trends/ })).toHaveTextContent('weeks 1–4');
  });
  it('has the week picker, and a range of three or more weeks becomes the trends window', () => {
    mount('/stats/players?from=2&to=5');
    expect(screen.getByRole('group', { name: /Week/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /RB volume trends/ })).toHaveTextContent('weeks 2–5');
  });
  it('a range under three weeks shows a note instead of trends', () => {
    mount('/stats/players?from=4&to=5');
    expect(screen.queryByRole('region', { name: /RB volume trends/ })).toBeNull();
    expect(screen.getByText(/Pick at least three weeks/)).toBeInTheDocument();
  });
  it('coverage and pressure views say full season only when a range is picked', () => {
    mount('/stats/players?pos=QB&view=press&from=2&to=4', [{ ...statsCharts(), participation: true }]);
    expect(screen.getByText(/full season only/i)).toBeInTheDocument();
  });
  it('Custom: two dropdowns pick the stats, the chart follows, and the picks go in the URL', () => {
    mount('/stats/players?pos=RB');
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const x = screen.getByRole('combobox', { name: 'X axis stat' }), y = screen.getByRole('combobox', { name: 'Y axis stat' });
    fireEvent.change(x, { target: { value: 'car' } });
    fireEvent.change(y, { target: { value: 'ppg' } });
    expect(screen.getByRole('region', { name: 'PPG vs Carries' })).toBeInTheDocument();
  });
  it('a custom link opens those stats', () => {
    mount('/stats/players?pos=WR&view=custom&x=adot&y=yprr');
    expect(screen.getByRole('region', { name: 'YPRR vs aDOT' })).toBeInTheDocument();
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
