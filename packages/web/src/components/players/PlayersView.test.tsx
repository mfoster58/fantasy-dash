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
    week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40, { pass_yd: 250 }), line('r1', 20, { rush_yd: 80 })]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
    week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
  ], 'a'),
  season(2025, [
    week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35, { pass_yd: 300, pass_td: 3 })]), side('a', 9, [line('r1', 9, { rush_yd: 40 })]))]),
  ], null, 1),
];
const years = [2024, 2025];

function LocationProbe() { const loc = useLocation(); return <output data-testid="loc">{loc.search}</output>; }
const mount = (initial = '/players', currentYear = 2025, lastScoredWeek = 1) => render(
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route path="/players" element={<><PlayersView seasons={seasons} players={players} managers={managers} years={years} currentYear={currentYear} lastScoredWeek={lastScoredWeek} /><LocationProbe /></>} />
    </Routes>
  </MemoryRouter>,
);
const region = (name: string) => screen.getByRole('region', { name });
const firstRow = (boardTitle: string) => within(region(boardTitle)).getAllByRole('listitem')[0];

describe('PlayersView', () => {
  it('renders the four sections, every board, and the through-week line', () => {
    mount();
    expect(screen.getByText(/through 2025 week 1/i)).toBeInTheDocument();
    for (const h of ['League leaders', 'Career', 'Postseason', 'Extras']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    // board titles are h3 headings; plain getByText would collide with value headers like "PPG"
    for (const t of ['Rushing yards', 'Passing TDs', 'Most touches', 'FPOE', 'xFP', 'Most toilet bowl starts', 'Most last place rosters', 'Best playoff starts', 'Worst toilet bowl starts', 'Average draft value', 'Bench warmers', 'Loyalty', 'Ironman']) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'PPG' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Career PPG' })).toBeNull();
    expect(within(region('Postseason')).getByText('Most championship rosters')).toBeInTheDocument();
    expect(within(region('Career')).queryByText('Most championship rosters')).toBeNull();
    expect(within(region('Extras')).getByText('Biggest bench blunder')).toBeInTheDocument();
  });

  it('switches the leaders points board to PPG from its toggle', () => {
    mount();
    expect(firstRow('Most points')).toHaveTextContent('35.00');
    fireEvent.click(within(region('Most points')).getByRole('button', { name: 'PPG' }));
    expect(within(region('Most points')).getByText('No players with 3 games yet.')).toBeInTheDocument(); // nobody has 3 played games in 2025
    fireEvent.click(within(region('Most points')).getByRole('button', { name: 'Total' }));
    expect(firstRow('Most points')).toHaveTextContent('35.00');
  });

  it('filters one section at a time and writes each to its own URL parameter', () => {
    mount();
    expect(firstRow('Best week by a starter')).toHaveTextContent('Quincy One');
    fireEvent.click(within(region('Career')).getByRole('button', { name: 'RB' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('?career=RB');
    expect(firstRow('Best week by a starter')).toHaveTextContent('Ricky One');
    expect(firstRow('Most points')).toHaveTextContent('Quincy One'); // leaders untouched
    fireEvent.click(within(region('League leaders')).getByRole('button', { name: 'RB' }));
    expect(screen.getByTestId('loc').textContent).toContain('lead=RB');
    expect(screen.getByTestId('loc').textContent).toContain('career=RB');
    expect(firstRow('Most points')).toHaveTextContent('Ricky One');
    fireEvent.click(within(region('Career')).getByRole('button', { name: 'All' }));
    expect(screen.getByTestId('loc').textContent).not.toContain('career=');
  });

  it('switches the leaders season from the picker and the URL', () => {
    mount();
    expect(firstRow('Most points')).toHaveTextContent('35.00');
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '2024' } });
    expect(screen.getByTestId('loc')).toHaveTextContent('season=2024');
    expect(firstRow('Most points')).toHaveTextContent('71.00'); // q1 40 + 31 in 2024
    expect(firstRow('Best week by a starter')).toHaveTextContent('40.00'); // all-time unaffected by the season picker
  });

  it('falls back for junk parameters', () => {
    mount('/players?career=XYZ&season=1999&lead=rb');
    expect(within(region('Career')).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(region('League leaders')).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('2025');
  });

  it('shows the not-started message for a season with no lines and keeps the other sections', () => {
    mount('/players', 2026, 0);
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByText('Most yards')).toBeNull();
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
  });

  it('writes and reads All-time per section', () => {
    mount('/players?season=all&extrasSeason=2024');
    const pickers = screen.getAllByRole('combobox');
    expect(pickers).toHaveLength(3); // leaders, career, extras
    expect(pickers[0]).toHaveValue('all');
    expect(pickers[1]).toHaveValue('all'); // career default
    expect(pickers[2]).toHaveValue('2024');
    expect(firstRow('Most points')).toHaveTextContent('2 seasons'); // q1 across both seasons
    fireEvent.change(pickers[1], { target: { value: '2024' } });
    expect(screen.getByTestId('loc').textContent).toContain('careerSeason=2024');
    expect(firstRow('Best week by a starter')).toHaveTextContent('2024 · Wk 1');
    fireEvent.change(pickers[0], { target: { value: '2025' } });
    expect(screen.getByTestId('loc').textContent).not.toContain('season=all');
    fireEvent.change(pickers[2], { target: { value: 'all' } });
    expect(screen.getByTestId('loc').textContent).not.toContain('extrasSeason');
  });

  it('shows the season note per section', () => {
    mount('/players?careerSeason=2025');
    expect(within(region('Career')).getByText('2025 season')).toBeInTheDocument();
    expect(within(region('Extras')).getByText('Every season')).toBeInTheDocument();
  });
});
