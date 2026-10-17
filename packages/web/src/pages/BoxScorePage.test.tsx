import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { GameSide, Manager } from '@fantasy-dash/core';
import { TeamHeader } from './BoxScorePage';

const alice: Manager = { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 };
const side: GameSide = { userId: 'a', points: 120, projected: 100, ceiling: 130, efficiency: 0.92, starters: [], bench: [], optimalSwaps: [], recordBefore: { w: 3, l: 1, t: 0 }, seasonPpg: 110 };

describe('TeamHeader', () => {
  it('links the team name to the team page and the manager to the career page', () => {
    render(<MemoryRouter><TeamHeader side={side} manager={alice} outcome="won" played align="left" year={2025} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Team A' })).toHaveAttribute('href', '/teams/2025/a');
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByTestId('team-details')).toHaveTextContent('3-1');
  });
});
