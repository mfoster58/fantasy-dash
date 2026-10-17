import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Draft, DraftPick, Manager } from '@fantasy-dash/core';
import DraftRoundOne from './DraftRoundOne';
import { players } from '../../test/playerFixtures';

const managers: Record<string, Manager> = { a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 } };
const pick: DraftPick = {
  round: 1, pickNo: 1, slot: 1, userId: 'a', playerId: 'q1', isKeeper: false, posDraftRank: 1, seasonPoints: 300, gamesPlayed: 15, ppg: 20, healthy: true,
  pointsOverBaseline: 50, redraftPos: 1, contribution: 50, earnedPick: 1, value: 10, tradedTo: null,
};
const draft: Draft = { draftId: 'D', type: 'snake', rounds: 15, slotOrder: ['a'], expectedCurve: null, baselines: {}, picks: [pick, { ...pick, round: 2, pickNo: 2 }] };

describe('DraftRoundOne', () => {
  it('lists round one with the drafting manager linked to the career page', () => {
    render(<MemoryRouter><DraftRoundOne draft={draft} managers={managers} players={players} seasonTeams={{}} year={2025} /></MemoryRouter>);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByRole('link', { name: /Full draft board/ })).toHaveAttribute('href', '/draft/2025');
  });
});
