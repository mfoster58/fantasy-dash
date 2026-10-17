import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Draft, DraftPick, Manager } from '@fantasy-dash/core';
import TopPpg from './TopPpg';
import { players } from '../../test/playerFixtures';

const managers: Record<string, Manager> = { a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 } };
const pick: DraftPick = {
  round: 1, pickNo: 1, slot: 1, userId: 'a', playerId: 'q1', isKeeper: false, posDraftRank: 1, seasonPoints: 300, gamesPlayed: 15, ppg: 20, healthy: true,
  pointsOverBaseline: 50, redraftPos: 1, contribution: 50, earnedPick: 1, value: 10, tradedTo: null,
};
const draft: Draft = { draftId: 'D', type: 'snake', rounds: 1, slotOrder: ['a'], expectedCurve: null, baselines: {}, picks: [pick] };

describe('TopPpg', () => {
  it('links the drafting manager to the career page', () => {
    render(<MemoryRouter><TopPpg draft={draft} managers={managers} players={players} seasonTeams={{}} inSeason={false} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByText('20.0')).toBeInTheDocument();
  });
});
