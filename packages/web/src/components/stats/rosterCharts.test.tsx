import { fireEvent, render, screen, within } from '@testing-library/react';
import DraftReturns from './DraftReturns';
import PointOrigins from './PointOrigins';
import RosterAge, { labelLanes } from './RosterAge';
import WireActivity from './WireActivity';
import { managerRefs } from '../../lib/stats/scope';
import { draftReturns, pointOrigins, rosterAge, wireActivity } from '../../lib/stats/roster';
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
  it('switches to draft value: green for picks that beat their slot, red for picks that fell short, sorted by total value', () => {
    render(<DraftReturns data={draftReturns(s25)} players={statsPlayers} refs={refs} pin={null} />);
    const toggle = screen.getByRole('group', { name: 'Show' });
    expect(within(toggle).getByRole('button', { name: 'Points' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(toggle).getByRole('button', { name: 'Value' }));
    const rows = within(screen.getByRole('table', { name: 'Draft returns by round' })).getAllByRole('row');
    expect(within(rows[1]).getAllByRole('rowheader')[0]).toHaveTextContent('bob');   // 15 + 3
    const alice = rows.find((r) => r.textContent?.includes('alice'))!;
    expect(within(alice).getAllByRole('cell').map((c) => c.textContent)).toEqual(['+20', '-8']);
    expect(screen.getByTitle('Quincy One · value +20.0')).toBeInTheDocument();
    expect(within(alice).getAllByRole('cell')[0].getAttribute('style')).toMatch(/--win/);
    expect(within(alice).getAllByRole('cell')[1].getAttribute('style')).toMatch(/--loss/);
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
  it('puts each name in the nearest lane where it does not overlap the one before, alternating above and below the line', () => {
    expect(labelLanes([0, 10, 20, 200], [50, 50, 50, 50])).toEqual([0, 1, 2, 0]);
    expect(labelLanes([0, 100], [50, 50])).toEqual([0, 0]);
  });
  it('says so with nothing to place', () => {
    render(<RosterAge data={{ rows: [], estimated: false }} refs={refs} pin={null} />);
    expect(screen.getByText('Nothing played yet.')).toBeInTheDocument();
  });
});

describe('WireActivity', () => {
  it('counts pickups per week with the totals and FAAB at the right', () => {
    render(<WireActivity data={wireActivity(s25)} players={statsPlayers} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Wire activity' });
    const a = within(table).getAllByRole('row')[1];
    expect(within(a).getAllByRole('cell').map((c) => c.textContent)).toEqual(['', '1', '', '1', '', '2 · $13']);
    expect(screen.getByTitle('alice week 2: + Xavier One (waiver, $10), − Tony Two')).toBeInTheDocument();
    expect(screen.getByTitle('bob week 3: + Xavier Two (free agent)')).toBeInTheDocument();
  });
});

