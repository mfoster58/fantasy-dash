import { render, screen, within } from '@testing-library/react';
import type { GameSide, PlayerDirectory } from '@fantasy-dash/core';
import { MemoryRouter } from 'react-router';
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
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', ['a2', 'a3']), side('b', 'b1', ['b2'])]} slots={['QB']} players={players} seasonTeams={{ a2: 'NYG' }} /></MemoryRouter>);
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
  it('links each player name to the player page', () => {
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', ['a2']), side('b', 'b1', [])]} slots={['QB']} players={players} seasonTeams={{}} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Alpha One' })).toHaveAttribute('href', '/player/a1');
  });
  it('shows each starter\'s NFL game state when live', () => {
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', []), side('b', 'b1', [])]} slots={['QB']} players={players} seasonTeams={{}}
      gameOf={(id) => (id === 'a1' ? { kind: 'live', period: 3, clock: '4:12', halftime: false } : { kind: 'final' })} /></MemoryRouter>);
    expect(screen.getAllByTestId('game-state').map((e) => e.textContent)).toEqual(['Q3 4:12', 'Final']);
  });
  it('highlights players whose game is on, with the ball\'s spot on a field bar and the logo of the team that has it', () => {
    const field = { home: 'KC', away: 'BUF', possession: 'BUF', yardLine: 11, down: '1st & 10 at KC 11', redZone: true };
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', []), side('b', 'b1', [])]} slots={['QB']} players={players} seasonTeams={{}}
      gameOf={(id) => (id === 'a1' ? { kind: 'live', period: 4, clock: '11:21', halftime: false, field } : { kind: 'final' })} /></MemoryRouter>);
    const bars = screen.getAllByTestId('field-bar');
    expect(bars).toHaveLength(1);
    expect(screen.getByText('Alpha One').closest('[data-live]')).toHaveAttribute('data-live', 'true');
    expect(screen.getByText('Bravo One').closest('[data-live]')).toBeNull();
    // the away end zone on the left, the home one on the right: KC 11 is 89% of the way across
    expect(within(bars[0]).getByTestId('ball')).toHaveStyle({ left: '89%' });
    expect(within(bars[0]).getByRole('img', { name: 'BUF ball' })).toHaveAttribute('src', expect.stringContaining('/buf.png'));
    expect(bars[0]).toHaveTextContent('1st & 10 at KC 11');
    // yard lines every 10 yards between the goal lines
    expect(within(bars[0]).getAllByTestId('yard-line')).toHaveLength(9);
    // right under the name, above the stat line
    const name = screen.getByText('Alpha One');
    const state = screen.getAllByTestId('game-state')[0];
    expect(name.compareDocumentPosition(bars[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bars[0].compareDocumentPosition(state) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('puts a finished player\'s NFL result under his name, above the stats, in place of "Final"', () => {
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', []), side('b', 'b1', [])]} slots={['QB']} players={players} seasonTeams={{}}
      gameOf={(id) => (id === 'a1' ? { kind: 'final', result: 'L 24-27 vs CLE' } : { kind: 'final' })} /></MemoryRouter>);
    const result = screen.getByTestId('nfl-result');
    expect(result).toHaveTextContent('L 24-27 vs CLE');
    expect(screen.getByText('Alpha One').compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId('game-state').map((e) => e.textContent)).toEqual(['Final']); // only the player without a result
  });
  it('shows no game state outside the live week', () => {
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', []), side('b', 'b1', [])]} slots={['QB']} players={players} seasonTeams={{}} /></MemoryRouter>);
    expect(screen.queryByTestId('game-state')).not.toBeInTheDocument();
  });
});
