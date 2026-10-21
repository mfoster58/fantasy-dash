import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { History } from '@fantasy-dash/core';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import RecordsView from './RecordsView';

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
const mount = (initial = '/records', currentYear = 2025) => render(
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route path="/records" element={<><RecordsView seasons={seasons} players={players} managers={managers} years={years} currentYear={currentYear} /><LocationProbe /></>} />
    </Routes>
  </MemoryRouter>,
);
const region = (name: string) => screen.getByRole('region', { name });
/** the section's own position bar, the first in its region; every board below has one of its own */
const sectionPos = (name: string) => within(within(region(name)).getAllByRole('group', { name: 'Position' })[0]);
const firstRow = (boardTitle: string) => within(region(boardTitle)).getAllByRole('listitem')[0];
const tabs = (label: string) => within(screen.getByRole('tablist', { name: label }));
const tab = (name: RegExp) => tabs('Tabs').getByRole('tab', { name });
const sub = (name: RegExp) => tabs('Sections').getByRole('tab', { name });
const loc = () => screen.getByTestId('loc').textContent ?? '';

describe('RecordsView', () => {
  it('opens on Players → All-time and lists both tab bars with board counts', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Records$/);
    expect(screen.queryByText(/through 2025/)).toBeNull();
    expect(screen.queryByText(/Leaderboards about/)).toBeNull();
    expect(tabs('Tabs').getAllByRole('tab').map((t) => t.textContent)).toEqual(['Players', 'Managers']);
    expect(tabs('Sections').getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, '').trim())).toEqual(['All-time', 'Moments', 'Streaks', 'Postseason']);
    expect(sub(/^All-time/)).toHaveAttribute('aria-selected', 'true');
    expect(sub(/^All-time/)).toHaveTextContent('16');
    expect(region('All-time')).toBeInTheDocument();
    expect(within(region('All-time')).getByText('Most career points started')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Moments' })).toBeNull();
  });

  it('switches sub-tabs and tabs from the bars and writes the URL', () => {
    mount();
    fireEvent.click(sub(/^Moments/));
    expect(loc()).toContain('sub=moments');
    expect(region('Moments')).toBeInTheDocument();
    expect(within(region('Moments')).getByText('Best week by a starter')).toBeInTheDocument();
    fireEvent.click(tab(/Managers/));
    expect(loc()).toContain('tab=managers');
    expect(loc()).not.toContain('sub=');
    expect(tabs('Sections').getAllByRole('tab').map((t) => t.textContent?.replace(/\d+$/, '').trim())).toEqual(['All-time', 'Seasons', 'Games', 'Streaks', 'Playoffs', 'Draft', 'Transactions']);
    expect(screen.getByRole('tabpanel', { name: 'All-time' })).toHaveAttribute('id', 'panel-malltime');
    expect(within(region('All-time')).queryByRole('button', { name: 'RB' })).toBeNull(); // no position filter on the managers side
    fireEvent.click(tab(/Players/));
    expect(loc()).toBe('');
  });

  it('reads tab and sub from the URL and ignores a sub from the other tab or junk', () => {
    mount('/records?tab=managers&sub=moments');
    expect(screen.getByRole('tabpanel', { name: 'All-time' })).toHaveAttribute('id', 'panel-malltime');
    fireEvent.click(tab(/Players/));
    fireEvent.click(sub(/^Postseason/));
    expect(within(region('Postseason')).getByText('Most postseason points started')).toBeInTheDocument();
  });

  it('keeps each sub-tab\'s position and season in their own URL params across switches', () => {
    mount('/records?sub=alltime');
    fireEvent.click(sectionPos('All-time').getByRole('button', { name: 'RB' }));
    expect(screen.queryByText('Every season')).toBeNull(); // no note under the section title
    expect(loc()).toContain('alltime=RB');
    expect(firstRow('Most career points started')).toHaveTextContent('Ricky One');
    fireEvent.change(within(region('All-time')).getByRole('combobox', { name: 'Season' }), { target: { value: '2024' } });
    expect(loc()).toContain('alltimeSeason=2024');
    fireEvent.click(sub(/^All-time/));
    expect(sectionPos('All-time').getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(region('All-time')).getByRole('combobox', { name: 'Season' })).toHaveValue('2024');
  });

  it('falls back for junk params', () => {
    mount('/records?sub=moments&moments=XYZ&momentsSeason=1999');
    expect(sectionPos('Moments').getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
  });

  it('sends the retired Leaders sub-tab to All-time', () => {
    mount('/records?sub=leaders');
    expect(sub(/^All-time/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /^Leaders/ })).toBeNull();
  });

  it('leaves the sub-tab alone when the already selected tab is clicked again', () => {
    mount('/records?sub=moments');
    fireEvent.click(tab(/Players/));
    expect(loc()).toContain('sub=moments');
    expect(region('Moments')).toBeInTheDocument();
  });

  it('keeps a board toggle across a tab switch because panels stay mounted', () => {
    mount('/records?sub=alltime');
    fireEvent.click(within(region('Most career points started')).getByRole('button', { name: 'PPG' }));
    fireEvent.click(tab(/Managers/));
    fireEvent.click(tab(/Players/));
    expect(within(region('Most career points started')).getByRole('button', { name: 'PPG' })).toHaveAttribute('aria-pressed', 'true');
  });
});
