import { render, screen, within } from '@testing-library/react';
import StandingsRace from './StandingsRace';
import FormGuide from './FormGuide';
import ScoringCalendar from './ScoringCalendar';
import WeeklyFinishes from './WeeklyFinishes';
import { managerRefs } from '../../lib/stats/scope';
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from '../../lib/stats/season';
import { league, season2025 } from '../../test/statsFixtures';

const refs = managerRefs(league());
const s25 = season2025();

describe('StandingsRace', () => {
  it('draws a line per manager over the regular-season weeks with the playoff line, the pinned one marked', () => {
    render(<StandingsRace data={standingsRace(s25)} refs={refs} pin="b" />);
    const svg = screen.getByRole('img', { name: 'Standings race' });
    expect(svg.querySelectorAll('path[data-series]')).toHaveLength(4);
    expect(svg.querySelector('path[data-series="b"]')).toHaveAttribute('data-pinned', 'true');
    expect(screen.getByText('playoff line')).toBeInTheDocument();
    expect(screen.getByText('wk 4')).toBeInTheDocument();
    // every manager keeps his own colour; the pinned one is gold
    const strokes = [...svg.querySelectorAll('path[data-series]')].map((p) => p.getAttribute('stroke'));
    expect(strokes).toContain('var(--gold)');
    expect(new Set(strokes).size).toBe(4);
    expect(strokes.filter((s) => s === 'var(--dim)')).toHaveLength(0);
  });
  it('says so before anything is played', () => {
    render(<StandingsRace data={{ weeks: [], playoffTeams: 2, series: [] }} refs={refs} pin={null} />);
    expect(screen.getByText('Nothing played yet.')).toBeInTheDocument();
  });
});

describe('FormGuide', () => {
  it('shows a W or L square per game, the top score dotted, with a dashed line before the playoffs', () => {
    render(<FormGuide data={formGuide(s25)} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Form guide' });
    const a = within(table).getAllByRole('row')[1];
    expect(within(a).getAllByRole('cell').map((c) => c.textContent)).toEqual(['W', 'W', 'W', 'W', 'W']);
    expect(within(a).getAllByRole('cell')[0].querySelector('[data-dot]')).not.toBeNull();
    expect(within(a).getAllByRole('cell')[4].previousElementSibling).toHaveAttribute('data-divider-gap');
    // muted: tinted squares, not the full win and loss colours
    expect(within(a).getAllByRole('cell')[0].getAttribute('style')).toMatch(/color-mix/);
    expect(screen.getByTitle('Week 1: 120.00 vs bob 100.00')).toBeInTheDocument();
    const d = within(table).getAllByRole('row')[4];
    expect(within(d).getAllByRole('cell').map((c) => c.textContent)).toEqual(['W', 'L', 'L', 'L', 'L']);
  });
});

describe('ScoringCalendar', () => {
  it('prints the score in every regular-season cell and titles it against the week\'s average', () => {
    render(<ScoringCalendar data={scoringCalendar(s25)} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Scoring calendar' });
    const a = within(table).getAllByRole('row')[1];
    expect(within(a).getAllByRole('cell').map((c) => c.textContent)).toEqual(['120', '130', '80', '100', '150']);
    expect(within(a).getAllByRole('cell')[4].previousElementSibling).toHaveAttribute('data-divider-gap');
    expect(screen.getByTitle('Week 3: 80.00, league average 98.75 (-18.75)')).toBeInTheDocument();
  });
});

describe('WeeklyFinishes', () => {
  it('draws a three-part bar per manager with the top and bottom counts printed', () => {
    render(<WeeklyFinishes rows={weeklyFinishes([s25])} refs={refs} pin="c" />);
    const list = screen.getByRole('list', { name: 'Weekly finishes' });
    const items = list.querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(items[2]).toHaveAttribute('data-pinned', 'true');
    expect(items[2].querySelector('[data-part="top"]')).toHaveTextContent('2');
    expect(items[2].querySelector('[data-part="bottom"]')).toHaveTextContent('2');
    expect(items[0].querySelector('[data-part="bottom"]')).toHaveTextContent('');
  });
});
