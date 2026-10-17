import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { GameSide, Manager } from '@fantasy-dash/core';
import EfficiencyBlock from './EfficiencyBlock';
import { players } from '../../test/playerFixtures';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
};
const side = (userId: string, points: number, ceiling: number): GameSide => ({
  userId, points, projected: 100, ceiling, efficiency: points / ceiling, starters: [], bench: [], optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 100,
});

describe('EfficiencyBlock', () => {
  it('names each side as a link to the manager\'s career page', () => {
    render(<MemoryRouter><EfficiencyBlock sides={[side('a', 90, 100), side('b', 80, 100)]} managers={managers} players={players} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByRole('link', { name: 'bob' })).toHaveAttribute('href', '/managers/b');
    expect(screen.getAllByText('Optimal lineup.')).toHaveLength(2);
  });
});
