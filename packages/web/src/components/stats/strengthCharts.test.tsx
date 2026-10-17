import { render, screen, within } from '@testing-library/react';
import PowerRating, { ELO_ABOUT } from './PowerRating';
import Consistency from './Consistency';
import ScheduleLuck from './ScheduleLuck';
import StrengthOfSchedule from './StrengthOfSchedule';
import AllPlayGrid from './AllPlayGrid';
import PostseasonForm from './PostseasonForm';
import { managerRefs } from '../../lib/stats/scope';
import { eloFor, eloHistory } from '../../lib/stats/elo';
import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from '../../lib/stats/strength';
import { teamGamesOf } from '../../lib/managerGames';
import { league, season2024, season2025 } from '../../test/statsFixtures';

const refs = managerRefs(league());
const g25 = teamGamesOf([season2025()]);

describe('PowerRating', () => {
  it('draws every manager across all seasons with a 1500 guide, a divider between seasons, playoff weeks banded and the leader labelled with his rating', () => {
    render(<PowerRating history={eloHistory(league())} refs={refs} pin={null} />);
    const svg = screen.getByRole('img', { name: 'Power rating' });
    expect(svg.querySelectorAll('path[data-series]')).toHaveLength(4);
    expect(svg.querySelectorAll('[data-divider]')).toHaveLength(1);
    expect(svg.querySelectorAll('[data-band]')).toHaveLength(1);
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(svg.querySelector('text[data-series-label="a"]')!.textContent).toMatch(/^alice \d{4}$/);
    expect(ELO_ABOUT).toMatch(/1500/);
    expect(ELO_ABOUT).toMatch(/margin of 40 or more/);
    // a taller chart so ten lines and their labels have room
    expect(svg.getAttribute('viewBox')).toMatch(/ 420$/);
  });
  it('labels one season\'s weeks by week number', () => {
    render(<PowerRating history={eloFor(eloHistory(league()), 2025)} refs={refs} pin="a" />);
    expect(screen.getByText('wk 5')).toBeInTheDocument();
    const svg = screen.getByRole('img', { name: 'Power rating' });
    expect(svg.querySelector('path[data-series="a"]')).toHaveAttribute('data-pinned', 'true');
    // colour-coded like the standings race: every manager his own colour, the pinned one gold
    const strokes = [...svg.querySelectorAll('path[data-series]')].map((p) => p.getAttribute('stroke'));
    expect(strokes).toContain('var(--gold)');
    expect(new Set(strokes).size).toBe(4);
    expect(strokes.filter((s) => s === 'var(--dim)')).toHaveLength(0);
  });
});

describe('Consistency', () => {
  it('draws a strip per manager with the floor-to-ceiling box, the median tick and the extremes', () => {
    render(<Consistency rows={consistency(g25)} refs={refs} pin="a" />);
    const items = screen.getByRole('list', { name: 'Consistency' }).querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveAttribute('data-pinned', 'true');
    expect(items[0].querySelector('[data-box]')).toHaveAttribute('title', 'alice: floor 100.00, median 110.00, ceiling 120.00; worst 80.00, best 130.00');
    expect(screen.getAllByText(/^\d+$/).length).toBeGreaterThan(1);   // axis ticks
  });
});

describe('ScheduleLuck', () => {
  it('runs a dumbbell from the median record to the real one, green when the schedule helped and red when it hurt', () => {
    render(<ScheduleLuck rows={scheduleLuck(g25)} refs={refs} pin={null} />);
    const items = screen.getByRole('list', { name: 'Schedule luck' }).querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-tone', 'win');
    expect(items[3]).toHaveAttribute('data-tone', 'loss');
    expect(screen.getByTitle('alice: 3-1 against the weekly median')).toBeInTheDocument();
    expect(screen.getByTitle('alice: 4-0 for real')).toBeInTheDocument();
    expect(within(items[0]).getByText('+1')).toBeInTheDocument();
  });
});

describe('StrengthOfSchedule', () => {
  it('draws a bar per manager, red to the right for a hard schedule and green to the left for a soft one', () => {
    render(<StrengthOfSchedule rows={strengthOfSchedule(g25)} refs={refs} pin={null} />);
    const items = screen.getByRole('list', { name: 'Strength of schedule' }).querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-tone', 'loss');
    expect(items[3]).toHaveAttribute('data-tone', 'win');
    expect(screen.getByTitle("alice's opponents scored 92.25 a week against him, 11.44 under the league's 103.69")).toBeInTheDocument();
    expect(screen.getByText('league average 103.7')).toBeInTheDocument();
  });
});

describe('AllPlayGrid', () => {
  it('shows the weeks each manager outscored each other with the real record in the title', () => {
    render(<AllPlayGrid grid={allPlayGrid(g25, refs.map((r) => r.id))} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Head to head' });
    expect(within(within(table).getAllByRole('row')[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['', '3-1', '2-2', '4-0']);
    expect(screen.getByTitle('alice outscored bob in 3 of 4 weeks · played twice, 2-0')).toBeInTheDocument();
  });
});

describe('PostseasonForm', () => {
  it('runs a dumbbell from the regular-season average to the postseason one, or says the playoffs have not started', () => {
    render(<PostseasonForm rows={postseasonForm(g25)} refs={refs} pin={null} />);
    expect(screen.getByTitle('alice: 150.0 a game over 1 postseason game')).toBeInTheDocument();
    expect(screen.getByTitle('alice: 107.5 a game in the regular season')).toBeInTheDocument();
    render(<PostseasonForm rows={postseasonForm(teamGamesOf([season2024()]))} refs={refs} pin={null} />);
    expect(screen.getByText('The playoffs have not started.')).toBeInTheDocument();
  });
});
