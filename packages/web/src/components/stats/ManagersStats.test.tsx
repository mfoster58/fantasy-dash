import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import ManagersStats from './ManagersStats';
import { league, season2025, statsPlayers } from '../../test/statsFixtures';
import { season } from '../../test/playerFixtures';

function Where() { const { search } = useLocation(); return <output data-testid="where">{search}</output>; }
const mount = (url = '/stats', seasons = league()) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/stats" element={<><ManagersStats seasons={seasons} players={statsPlayers} years={[2024, 2025]} currentYear={2025} /><Where /></>} /></Routes>
  </MemoryRouter>,
);
const card = (name: string) => screen.getByRole('region', { name });

describe('ManagersStats', () => {
  it('opens on the current season with the cards in the agreed order, one title each, no group headings and no head-to-head grid', () => {
    mount();
    const names = screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby')).map((id) => document.getElementById(id!)?.textContent);
    expect(names).toEqual(['Standings race', 'Form', 'The numbers', 'Scoring calendar', 'Consistency', 'Power rating', 'Schedule luck', 'Strength of schedule', 'Postseason form', 'Roster age', 'Draft returns by round', 'Wire activity', 'Weekly finishes', 'Where the points came from']);
    // the last row: weekly finishes beside the points' origins, each only as tall as it needs
    const finishes = card('Weekly finishes'), origins = card('Where the points came from');
    expect(finishes.parentElement).toBe(origins.parentElement);
    expect(finishes.parentElement!.className).toMatch(/\bitems-start\b/);
    expect(screen.queryByRole('region', { name: 'Notable matchups' })).toBeNull();
    for (const s of ['The season', 'Strength', 'Roster', 'Moments', 'By the numbers']) expect(screen.queryByRole('heading', { name: s })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Head to head' })).toBeNull();
    expect(card('Standings race').querySelector('.section-label')).toBeNull();
    expect(screen.getByRole('combobox')).toHaveValue('2025');
    expect(screen.getByTestId('where')).toBeEmptyDOMElement();
  });
  it('pins through the URL and lights the manager in every chart', () => {
    mount('/stats?pin=c');
    expect(screen.getByRole('button', { name: 'cara' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card('Form')).getAllByRole('row')[3]).toHaveAttribute('data-pinned', 'true');
    expect(within(card('The numbers')).getAllByRole('row').find((r) => r.textContent?.includes('cara'))).toHaveAttribute('data-pinned', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'alice' }));
    expect(screen.getByTestId('where')).toHaveTextContent('?pin=a');
    fireEvent.click(screen.getByRole('button', { name: 'alice' }));
    expect(screen.getByTestId('where')).toBeEmptyDOMElement();
  });
  it('switches to all-time: the week-by-week cards give way to a note, the rest aggregate, the table gains a seasons column', () => {
    mount();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(screen.getByTestId('where')).toHaveTextContent('?season=all');
    expect(screen.queryByRole('region', { name: 'Form' })).toBeNull();
    expect(screen.getByText('Pick a season for the week-by-week charts.')).toBeInTheDocument();
    // the calendar stays, one column per season
    expect(within(card('Scoring calendar')).getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['2024', '2025']);
    expect(card('Power rating')).toBeInTheDocument();
    expect(within(card('The numbers')).getByRole('columnheader', { name: /Yrs/ })).toBeInTheDocument();
  });
  it('ignores a season that was never played and says so for a season with nothing played yet', () => {
    mount('/stats?season=1999');
    expect(screen.getByRole('combobox')).toHaveValue('2025');
    const blank = season(2026, []);
    blank.status = 'in_season';
    blank.managers = season2025().managers;
    blank.standings = [];
    render(
      <MemoryRouter initialEntries={['/stats?season=2026']}>
        <Routes><Route path="/stats" element={<ManagersStats seasons={[...league(), blank]} players={statsPlayers} years={[2024, 2025, 2026]} currentYear={2026} />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
  });
});
