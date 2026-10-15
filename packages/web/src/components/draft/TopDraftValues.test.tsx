import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History, HistoryDraftPick, PlayerDirectory } from '@fantasy-dash/core';
import TopDraftValues from './TopDraftValues';

const players: PlayerDirectory = {
  p1: { id: 'p1', name: 'Player One', firstName: 'Player', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 1 },
  p2: { id: 'p2', name: 'Player Two', firstName: 'Player', lastName: 'Two', position: 'WR', team: 'DAL', yearsExp: 1 },
};
const pick = (year: number, pickNo: number, playerId: string, value: number): HistoryDraftPick => ({
  year, teams: 10, round: Math.ceil(pickNo / 10), pickNo, slot: 1, userId: 'a', playerId, isKeeper: false, posDraftRank: 1, seasonPoints: 200, gamesPlayed: 17, ppg: 11.8, healthy: true,
  pointsOverBaseline: 80, redraftPos: 5, slotValue: value / 2, productionValue: value / 2, value, tradedTo: null,
});
const history = { seasons: [], managers: { a: { displayName: 'alice', avatar: null, seasons: [2024] } }, h2h: {}, allTime: [], topDraftValues: [pick(2024, 93, 'p1', 150), pick(2025, 12, 'p2', 90)] } as unknown as History;

describe('TopDraftValues', () => {
  it('lists the all-time best picks with year, manager and value', () => {
    render(<MemoryRouter><TopDraftValues history={history} players={players} /></MemoryRouter>);
    const rows = screen.getByTestId('top-draft-values').querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('10.03');
    expect(rows[0]).toHaveTextContent('Player One');
    expect(rows[0]).toHaveTextContent('2024 · alice · redraft 5');
    expect(rows[0]).toHaveTextContent('+150');
    expect(screen.getByRole('link', { name: '2025' })).toHaveAttribute('href', '/draft/2025');
  });
});
