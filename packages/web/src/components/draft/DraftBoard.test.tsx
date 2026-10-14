import { fireEvent, render, screen } from '@testing-library/react';
import type { Draft, DraftPick, Manager, PlayerDirectory } from '@fantasy-dash/core';
import DraftBoard from './DraftBoard';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
};
const players: PlayerDirectory = {
  p1: { id: 'p1', name: 'Player One', firstName: 'Player', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 1 },
  p2: { id: 'p2', name: 'Player Two', firstName: 'Player', lastName: 'Two', position: 'WR', team: 'DAL', yearsExp: 1 },
  p3: { id: 'p3', name: 'Player Three', firstName: 'Player', lastName: 'Three', position: 'QB', team: 'KC', yearsExp: 1 },
  p4: { id: 'p4', name: 'Player Four', firstName: 'Player', lastName: 'Four', position: 'RB', team: 'DET', yearsExp: 1 },
};
const pick = (round: number, pickNo: number, slot: number, userId: string, playerId: string, value: number | null, extra: Partial<DraftPick> = {}): DraftPick => ({
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: 1, seasonPoints: 120.5, posFinishRank: 2, value, pointsOverBaseline: 15.25, ...extra,
});
const draft: Draft = {
  draftId: 'D', type: 'snake', rounds: 2, slotOrder: ['a', 'b'],
  picks: [pick(1, 1, 1, 'a', 'p1', 4), pick(1, 2, 2, 'b', 'p2', -6, { isKeeper: true }), pick(2, 3, 2, 'b', 'p3', 0), pick(2, 4, 1, 'a', 'p4', null)],
};

describe('DraftBoard', () => {
  it('lays picks out by round and slot with position labels and keeper tags', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('Player One');
    expect(cells[0]).toHaveTextContent('RB1');
    expect(cells[1]).toHaveTextContent('Keeper');
    expect(cells[0]).toHaveAttribute('title', expect.stringContaining('120.50'));
    expect(cells[0]).toHaveAttribute('title', expect.stringContaining('+15.25'));
  });

  it('highlights one manager\'s picks when the column header is clicked', () => {
    const onHighlight = vi.fn();
    render(<DraftBoard draft={draft} managers={managers} players={players} mode="value" highlight="a" onHighlight={onHighlight} inSeason={false} />);
    fireEvent.click(screen.getByRole('button', { name: /alice/ }));
    expect(onHighlight).toHaveBeenCalledWith(null);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[0]).toHaveAttribute('data-highlight', 'true');
    expect(cells[1]).toHaveAttribute('data-highlight', 'false');
  });
});
