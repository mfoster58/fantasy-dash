import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
import type { GameSide, Manager } from '@fantasy-dash/core';
import PositionBattle, { positionGroups } from './PositionBattle';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: null, avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
};
const slots = ['QB', 'RB', 'RB', 'WR', 'FLEX'];
const side = (userId: string, pts: (number | null)[]): GameSide => ({
  userId, points: 0, projected: 0, ceiling: 0, efficiency: 1, bench: [], optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 0,
  starters: slots.map((slot, i) => ({ slot, player: pts[i] === null ? null : { playerId: `${userId}${i}`, points: pts[i]!, projected: null, stats: {} } })),
});
const sides: [GameSide, GameSide] = [side('a', [20, 10, 5.5, 12, null]), side('b', [18, 8, 8, 12, 9])];

describe('positionGroups', () => {
  it('sums starters per distinct slot in roster order, treating empty slots as zero', () => {
    expect(positionGroups(sides, slots)).toEqual([
      { slot: 'QB', left: 20, right: 18 }, { slot: 'RB', left: 15.5, right: 16 }, { slot: 'WR', left: 12, right: 12 }, { slot: 'FLEX', left: 0, right: 9 },
    ]);
  });
});

describe('PositionBattle', () => {
  it('renders one row per slot group and tallies the positions each side won', () => {
    render(<PositionBattle sides={sides} slots={slots} managers={managers} />);
    expect(screen.getAllByTestId('position-row')).toHaveLength(4);
    expect(screen.getByTestId('position-tally')).toHaveTextContent('1 – 2');
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByRole('link', { name: 'bob' })).toHaveAttribute('href', '/managers/b');
    expect(screen.getByText('15.50')).toBeInTheDocument();
  });
});
