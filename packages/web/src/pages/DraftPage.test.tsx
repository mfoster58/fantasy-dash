import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Draft, DraftPick, Manager, Season } from '@fantasy-dash/core';
import { game, line, season, side, week } from '../test/playerFixtures';
import DraftPage from './DraftPage';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
};
const pick = (round: number, pickNo: number, slot: number, userId: string, playerId: string): DraftPick => ({
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: 1, seasonPoints: 50, gamesPlayed: 5, ppg: 10, healthy: true,
  pointsOverBaseline: 5, redraftPos: 2, contribution: 5, earnedPick: 1, value: 4, tradedTo: null,
});
const draft: Draft = { draftId: 'D', type: 'snake', rounds: 1, slotOrder: ['a', 'b'], expectedCurve: null, baselines: {}, picks: [pick(1, 1, 1, 'a', 'q1'), pick(1, 2, 2, 'b', 'r1')] };
const s: Season = { ...season(2024, [week(1, [game(2024, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('r1', 5)]))])]), managers, draft };

// a data router cannot initialise under jsdom (AbortSignal), so the loader hook is stubbed and the page rendered in a memory router
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => s }));

const mount = (url: string) => render(
  <MemoryRouter initialEntries={[url]}><Routes><Route path="/draft/:season" element={<DraftPage />} /></Routes></MemoryRouter>,
);
const lit = () => [...document.querySelectorAll('[data-highlight="true"]')];

describe('DraftPage', () => {
  it('opens on the first slot with nothing highlighted', () => {
    mount('/draft/2024');
    expect(screen.getByTestId('team-draft')).toHaveTextContent('alice');
    expect(lit()).toHaveLength(0);
  });

  it('opens on the manager named by the team param, column highlighted and team shown', () => {
    mount('/draft/2024?team=b');
    expect(screen.getByTestId('team-draft')).toHaveTextContent('bob');
    expect(lit().length).toBeGreaterThan(0);
    const cells = [...document.querySelectorAll('[data-testid="draft-cell"]')];
    expect(cells.map((c) => c.getAttribute('data-highlight'))).toEqual(['false', 'true']); // only b's pick
  });

  it('ignores a team that is not in the draft', () => {
    mount('/draft/2024?team=zzz');
    expect(screen.getByTestId('team-draft')).toHaveTextContent('alice');
    expect(lit()).toHaveLength(0);
  });
});
