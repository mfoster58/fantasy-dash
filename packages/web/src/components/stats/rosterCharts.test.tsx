import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import DraftReturns from './DraftReturns';
import PointOrigins from './PointOrigins';
import RosterAge from './RosterAge';
import WireActivity from './WireActivity';
import Moments from './Moments';
import { managerRefs } from '../../lib/stats/scope';
import { draftReturns, pointOrigins, rosterAge, wireActivity } from '../../lib/stats/roster';
import { moments } from '../../lib/stats/moments';
import { teamGamesOf } from '../../lib/managerGames';
import { league, season2024, season2025, statsPlayers } from '../../test/statsFixtures';

const refs = managerRefs(league());
const s25 = season2025();

describe('DraftReturns', () => {
  it('tints each round by the points its pick returned and names the player on hover', () => {
    render(<DraftReturns data={draftReturns(s25)} players={statsPlayers} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Draft returns by round' });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getAllByRole('rowheader')[0]).toHaveTextContent('bob');   // sorted by total
    expect(within(rows[2]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['340', '']);
    expect(screen.getByTitle('Quincy One · 340.00 started points')).toBeInTheDocument();
    expect(screen.getByTitle('Wally Two · 0.00 started points')).toHaveTextContent('');
  });
  it('says so without a draft', () => {
    render(<DraftReturns data={draftReturns(season2024())} players={statsPlayers} refs={refs} pin={null} />);
    expect(screen.getByText('No draft recorded.')).toBeInTheDocument();
  });
});

describe('PointOrigins', () => {
  it('stacks draft, pickup, trade and unknown shares per manager with a legend', () => {
    render(<PointOrigins rows={pointOrigins([s25])} refs={refs} pin="a" />);
    const items = screen.getByRole('list', { name: 'Where the points came from' }).querySelectorAll('li');
    expect(items).toHaveLength(4);
    const a = items[2];
    expect(a).toHaveAttribute('data-pinned', 'true');
    expect(a.querySelector('[data-part="draft"]')).toHaveTextContent('59%');
    expect(a.querySelector('[data-part="pickup"]')).toHaveTextContent('21%');
    expect(a.querySelector('[data-part="draft"]')).toHaveAttribute('title', 'Draft: 340.00 points, 59%');
    expect(screen.getByText('Waivers and free agents')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

describe('RosterAge', () => {
  it('places a dot per manager on the rook-to-unc spectrum, the pinned one gold, with the shares in the title', () => {
    render(<RosterAge data={rosterAge([s25], statsPlayers)} refs={refs} pin="b" />);
    const svg = screen.getByRole('img', { name: 'Roster age' });
    expect(svg.querySelectorAll('circle[data-manager]')).toHaveLength(4);
    expect(svg.querySelector('circle[data-manager="b"]')).toHaveAttribute('data-pinned', 'true');
    expect(svg.querySelector('circle[data-manager="a"] title')!.textContent).toBe('alice: average age 25.1 · rookies 16%, 30 and over 5%');
    expect(screen.getByText('ROOK')).toBeInTheDocument();
    expect([...svg.querySelectorAll('text')].find((t) => t.textContent === 'alice')).toHaveAttribute('font-size', '13');
    expect(screen.getByText('UNC')).toBeInTheDocument();
  });
  it('says so with nothing to place', () => {
    render(<RosterAge data={{ rows: [], estimated: false }} refs={refs} pin={null} />);
    expect(screen.getByText('Nothing played yet.')).toBeInTheDocument();
  });
});

describe('WireActivity', () => {
  it('counts pickups per week with the totals and FAAB at the right', () => {
    render(<WireActivity data={wireActivity(s25)} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Wire activity' });
    const a = within(table).getAllByRole('row')[1];
    expect(within(a).getAllByRole('cell').map((c) => c.textContent)).toEqual(['', '1', '', '1', '', '2 · $13']);
    expect(screen.getByTitle('alice week 2: 1 pickup')).toBeInTheDocument();
  });
});

describe('Moments', () => {
  it('draws each notable game as two score bars, winner over loser, linking to its box score', () => {
    render(<MemoryRouter><Moments data={moments(teamGamesOf([s25]))} refs={refs} pin={null} /></MemoryRouter>);
    for (const h of ['High score in a loss', 'Low score in a win', 'Blowouts', 'Close calls']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    const first = screen.getByRole('list', { name: 'High score in a loss' }).querySelector('li')!;
    const link = within(first).getByRole('link');
    expect(link).toHaveAttribute('href', '/scores/2025/5/1');
    expect(link).toHaveTextContent('Week 5');
    const bars = first.querySelectorAll('[data-bar]');
    expect([...bars].map((b) => b.getAttribute('data-bar'))).toEqual(['win', 'loss']);
    expect(bars[0]).toHaveTextContent('alice');
    expect(bars[0]).toHaveTextContent('150.00');
    expect(bars[1]).toHaveTextContent('dan');
    expect(bars[1]).toHaveTextContent('120.00');
    // the bars are scaled to the biggest score in the list, so the gap between them is the margin
    expect(parseFloat((bars[1].querySelector('[data-fill]') as HTMLElement).style.width)).toBeLessThan(parseFloat((bars[0].querySelector('[data-fill]') as HTMLElement).style.width));
    // the manager each list is about is marked: the loser for a high score in a loss
    expect(bars[1]).toHaveAttribute('data-featured', 'true');
    expect(screen.getByRole('list', { name: 'Blowouts' }).querySelector('li')).toHaveTextContent('+70.00');
    expect(screen.getByTestId('moment-lists').className).toMatch(/sm:grid-cols-2/);
  });
  it('can stack its four lists in one column', () => {
    render(<MemoryRouter><Moments data={moments(teamGamesOf([s25]))} refs={refs} pin={null} columns={1} /></MemoryRouter>);
    expect(screen.getByTestId('moment-lists').className).not.toMatch(/sm:grid-cols-2/);
  });
});
