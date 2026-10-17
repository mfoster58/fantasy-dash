import { render, screen, within } from '@testing-library/react';
import type { GameSide, PlayerDirectory } from '@fantasy-dash/core';
import LineupTable from './LineupTable';

const players: PlayerDirectory = {
  a1: { id: 'a1', name: 'Alpha One', firstName: 'Alpha', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 1, birthDate: null },
  a2: { id: 'a2', name: 'Alpha Two', firstName: 'Alpha', lastName: 'Two', position: 'RB', team: 'SF', yearsExp: 1, birthDate: null },
  a3: { id: 'a3', name: 'Alpha Three', firstName: 'Alpha', lastName: 'Three', position: 'WR', team: 'DAL', yearsExp: 1, birthDate: null },
  b1: { id: 'b1', name: 'Bravo One', firstName: 'Bravo', lastName: 'One', position: 'QB', team: 'BUF', yearsExp: 1, birthDate: null },
  b2: { id: 'b2', name: 'Bravo Two', firstName: 'Bravo', lastName: 'Two', position: 'TE', team: 'DET', yearsExp: 1, birthDate: null },
};
const line = (playerId: string, points: number) => ({ playerId, points, projected: null, stats: {} });
const side = (userId: string, starter: string, bench: string[]): GameSide => ({
  userId, points: 10, projected: 10, ceiling: 10, efficiency: 1, recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 0, optimalSwaps: [],
  starters: [{ slot: 'QB', player: line(starter, 10) }], bench: bench.map((id) => line(id, 1)),
});

describe('LineupTable', () => {
  it('pairs bench players row by row with a BN pill between them, padding the shorter bench', () => {
    render(<LineupTable sides={[side('a', 'a1', ['a2', 'a3']), side('b', 'b1', ['b2'])]} slots={['QB']} players={players} seasonTeams={{ a2: 'NYG' }} />);
    const rows = screen.getAllByTestId('bench-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('BN')).toHaveClass('pos-pill');
    expect(rows[0]).toHaveTextContent('Alpha Two');
    expect(rows[0]).toHaveTextContent('NYG');        // the season's team, not the directory's
    expect(rows[0]).toHaveTextContent('Bravo Two');
    expect(rows[1]).toHaveTextContent('Alpha Three');
    expect(rows[1]).not.toHaveTextContent('Bravo');
    expect(screen.queryByText('Total')).toBeNull();
  });
});
