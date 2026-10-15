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
const tab = (name: string) => screen.getByRole('tab', { name });
const loc = () => screen.getByTestId('loc').textContent ?? '';

describe('PlayersView', () => {
  it('shows one section at a time, League leaders by default, switching from the tab bar and the URL', () => {
    mount();
    expect(screen.getByText(/through 2025 week 1/i)).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['League leaders', 'Career', 'Postseason', 'Extras']);
    expect(tab('League leaders')).toHaveAttribute('aria-selected', 'true');
    expect(region('League leaders')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Career' })).toBeNull();
    fireEvent.click(tab('Career'));
    expect(loc()).toContain('tab=career');
    expect(tab('Career')).toHaveAttribute('aria-selected', 'true');
    expect(region('Career')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'League leaders' })).toBeNull();
    fireEvent.click(tab('League leaders'));
    expect(loc()).not.toContain('tab=');
  });

  it('reads the tab from the URL and falls back to League leaders for junk', () => {
    mount('/players?tab=extras');
    expect(region('Extras')).toBeInTheDocument();
    expect(within(region('Extras')).getByText('Biggest bench blunder')).toBeInTheDocument();
    for (const t of ['Draft value', 'Mr. Irrelevant', 'Biggest breakout', 'Biggest fall-off', 'Bench warmers', 'Loyalty', 'Ironman', 'Fodder', 'Waiver heroes', 'Waiver villains']) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Trade bait' })).toBeNull();
    fireEvent.click(tab('Postseason'));
    for (const t of ['Most toilet bowl starts', 'Most last place rosters', 'Best playoff starts', 'Worst toilet bowl starts']) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    expect(within(region('Postseason')).getByText('Most championship rosters')).toBeInTheDocument();
  });

  it('ignores a junk tab', () => {
    mount('/players?tab=nope');
    expect(region('League leaders')).toBeInTheDocument();
    for (const t of ['Rushing yards', 'Passing TDs', 'Most touches', 'FPOE', 'xFP']) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'PPG' })).toBeNull();
  });

  it('switches the leaders points board to PPG from its toggle, and keeps it across a tab switch', () => {
    mount();
    expect(firstRow('Most points')).toHaveTextContent('35.00');
    fireEvent.click(within(region('Most points')).getByRole('button', { name: 'PPG' }));
    expect(within(region('Most points')).getByText('No players with 3 games yet.')).toBeInTheDocument(); // nobody has 3 played games in 2025
    fireEvent.click(tab('Career'));
    fireEvent.click(tab('League leaders'));
    expect(within(region('Most points')).getByRole('button', { name: 'PPG' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(region('Most points')).getByRole('button', { name: 'Total' }));
    expect(firstRow('Most points')).toHaveTextContent('35.00');
  });

  it('marks each section as the tab panel of its tab', () => {
    mount();
    expect(screen.getByRole('tabpanel', { name: 'League leaders' })).toBeInTheDocument();
    // a hidden panel has no accessible name, so find it through its tab's aria-controls
    const career = document.getElementById(tab('Career').getAttribute('aria-controls')!)!;
    expect(career).toHaveAttribute('role', 'tabpanel');
    expect(career).toHaveAttribute('hidden');
    expect(screen.queryByRole('tabpanel', { name: 'Career' })).toBeNull();
    fireEvent.click(tab('Career'));
    expect(career).not.toHaveAttribute('hidden');
    expect(screen.getByRole('tabpanel', { name: 'Career' })).toBe(career);
  });

  it('keeps each section\'s filter in its own URL parameter across tab switches', () => {
    mount('/players?tab=career');
    expect(firstRow('Best week by a starter')).toHaveTextContent('Quincy One');
    fireEvent.click(within(region('Career')).getByRole('button', { name: 'RB' }));
    expect(loc()).toContain('career=RB');
    expect(firstRow('Best week by a starter')).toHaveTextContent('Ricky One');
    fireEvent.click(tab('League leaders'));
    expect(firstRow('Most points')).toHaveTextContent('Quincy One'); // leaders untouched
    fireEvent.click(within(region('League leaders')).getByRole('button', { name: 'RB' }));
    expect(loc()).toContain('lead=RB');
    expect(loc()).toContain('career=RB');
    expect(firstRow('Most points')).toHaveTextContent('Ricky One');
    fireEvent.click(tab('Career'));
    expect(within(region('Career')).getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(region('Career')).getByRole('button', { name: 'All' }));
    expect(loc()).not.toContain('career=');
    expect(loc()).toContain('tab=career');
  });

  it('switches the leaders season from the picker and the URL', () => {
    mount();
    expect(firstRow('Most points')).toHaveTextContent('35.00');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } });
    expect(loc()).toContain('season=2024');
    expect(firstRow('Most points')).toHaveTextContent('71.00'); // q1 40 + 31 in 2024
    fireEvent.click(tab('Career'));
    expect(firstRow('Best week by a starter')).toHaveTextContent('40.00'); // all-time unaffected by the leaders picker
  });

  it('falls back for junk parameters', () => {
    mount('/players?career=XYZ&season=1999&lead=rb');
    expect(within(region('League leaders')).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox')).toHaveValue('2025');
    fireEvent.click(tab('Career'));
    expect(within(region('Career')).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the not-started message for a season with no lines and keeps the other tabs', () => {
    mount('/players', 2026, 0);
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByText('Most yards')).toBeNull();
    fireEvent.click(tab('Career'));
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
  });

  it('writes and reads All-time per section', () => {
    mount('/players?season=all&extrasSeason=2024');
    expect(screen.getByRole('combobox')).toHaveValue('all');
    expect(firstRow('Most points')).toHaveTextContent('2 seasons'); // q1 across both seasons
    fireEvent.click(tab('Career'));
    expect(screen.getByRole('combobox')).toHaveValue('all'); // career default
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } });
    expect(loc()).toContain('careerSeason=2024');
    expect(firstRow('Best week by a starter')).toHaveTextContent('2024 · Wk 1');
    fireEvent.click(tab('Extras'));
    expect(screen.getByRole('combobox')).toHaveValue('2024');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(loc()).not.toContain('extrasSeason');
    fireEvent.click(tab('Postseason'));
    expect(screen.queryByRole('combobox')).toBeNull(); // postseason has no picker
    fireEvent.click(tab('League leaders'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2025' } });
    expect(loc()).not.toContain('season=all');
  });

  it('shows the season note per section', () => {
    mount('/players?careerSeason=2025&tab=career');
    expect(within(region('Career')).getByText('2025 season')).toBeInTheDocument();
    fireEvent.click(tab('Extras'));
    expect(within(region('Extras')).getByText('Every season')).toBeInTheDocument();
  });
});
