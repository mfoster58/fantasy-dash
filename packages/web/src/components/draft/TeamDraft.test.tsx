import { fireEvent, render, screen } from '@testing-library/react';
import type { Draft, DraftPick, Manager, PlayerDirectory } from '@fantasy-dash/core';
import TeamDraft from './TeamDraft';

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
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: 1, seasonPoints: 120.5, gamesPlayed: 5, ppg: 24.1, healthy: true,
  pointsOverBaseline: 15.25, redraftPos: 2, contribution: value === null ? null : 20, earnedPick: value === null ? null : 1.5, value, tradedTo: null, ...extra,
});
const draft: Draft = {
  draftId: 'D', type: 'snake', rounds: 2, slotOrder: ['a', 'b'], expectedCurve: { a: 40, k: 36, c: 0 }, baselines: {},
  picks: [pick(1, 1, 1, 'a', 'p1', 6.5, { tradedTo: { userId: 'b', week: 3 } }), pick(1, 2, 2, 'b', 'p2', -30, { isKeeper: true }), pick(2, 3, 2, 'b', 'p3', 0), pick(2, 4, 1, 'a', 'p4', 12)],
};

describe('TeamDraft', () => {
  it('lists the selected manager\'s picks round by round with totals', () => {
    render(<TeamDraft draft={draft} managers={managers} players={players} userId="a" onSelect={() => {}} inSeason={false} />);
    const panel = screen.getByTestId('team-draft');
    expect(panel).toHaveTextContent('alice');
    expect(panel).toHaveTextContent('1 of 2');
    expect(panel).toHaveTextContent('A+');
    const rows = panel.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Player One');
    expect(rows[0]).toHaveTextContent('1.01');
    expect(rows[0]).toHaveTextContent('redraft 2 · traded to bob');
    expect(rows[0]).toHaveTextContent('+7');
    expect(rows[1]).toHaveTextContent('Player Four');
    expect(panel).toHaveTextContent('+19');   // total value 6.5 + 12 = 18.5 -> +19
    expect(panel).toHaveTextContent('2 hits');
    expect(panel).not.toHaveTextContent('Player Two');
  });

  it('cycles managers with the arrows', () => {
    const onSelect = vi.fn();
    render(<TeamDraft draft={draft} managers={managers} players={players} userId="a" onSelect={onSelect} inSeason={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next manager' }));
    expect(onSelect).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Previous manager' }));
    expect(onSelect).toHaveBeenLastCalledWith('b');   // wraps around with two managers
    expect(screen.getByTestId('team-draft')).toHaveTextContent('to date');
  });
});
