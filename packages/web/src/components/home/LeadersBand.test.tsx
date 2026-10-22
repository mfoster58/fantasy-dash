import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { game, line, season, side, week } from '../../test/playerFixtures';
import LeadersBand from './LeadersBand';

vi.mock('../../data/load', async (orig) => ({
  ...(await orig<typeof import('../../data/load')>()),
  players: (await import('../../test/playerFixtures')).players,
  history: { ...(await orig<typeof import('../../data/load')>()).history, managers: { a: { displayName: 'alice', avatar: null, seasons: [2026] }, b: { displayName: 'bob', avatar: null, seasons: [2026] } } },
}));

const s = season(2026, [week(1, [game(2026, 1, 1,
  side('a', 60, [line('q1', 35, { pass_yd: 300, pass_td: 3 }), line('w1', 25, { rec: 8, rec_yd: 120, rec_td: 1 })]),
  side('b', 20, [line('r1', 20, { rush_yd: 110, rush_td: 1 })]))])], null, 1);
s.status = 'in_season';
s.managers = { a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 }, b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 } };
const mount = () => render(<MemoryRouter><LeadersBand seasons={[s]} season={s} /></MemoryRouter>);
const col = (name: string) => screen.getByRole('region', { name });

describe('LeadersBand', () => {
  it('spotlights each category leader with a link and lists the rest', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'League leaders' })).toBeInTheDocument();
    expect(screen.getByText('2026 · through week 1')).toBeInTheDocument();
    expect(within(col('Most points')).getAllByRole('link')[0]).toHaveAttribute('href', '/player/q1');
    expect(col('Most points')).toHaveTextContent('Team A');
    expect(within(col('Most yards')).getAllByRole('link')[0]).toHaveAttribute('href', '/player/q1');
  });
  it('switches yards by split and narrows every column by position', () => {
    mount();
    fireEvent.click(within(col('Most yards')).getByRole('button', { name: 'Rush' }));
    expect(within(col('Most yards')).getAllByRole('link')[0]).toHaveAttribute('href', '/player/r1');
    fireEvent.click(within(screen.getByRole('group', { name: 'Position' })).getByRole('button', { name: 'WR' }));
    expect(within(col('Most points')).getAllByRole('link')[0]).toHaveAttribute('href', '/player/w1');
  });
  it('says so when a position has no leaders', () => {
    mount();
    fireEvent.click(within(screen.getByRole('group', { name: 'Position' })).getByRole('button', { name: 'TE' }));
    expect(within(col('Most points')).getByText('No leaders yet.')).toBeInTheDocument();
  });
  it('offers FPOE and xFP in the model panel', () => {
    mount();
    const panel = col('Points over expected');
    expect(within(panel).getByRole('button', { name: 'FPOE' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(panel).getByRole('button', { name: 'xFP' }));
    expect(within(panel).getByRole('button', { name: 'xFP' })).toHaveAttribute('aria-pressed', 'true');
  });
});
