import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { DraftPick, PlayerDirectory } from '@fantasy-dash/core';
import PickList, { type PickRow } from './PickList';

const players: PlayerDirectory = {
  p1: { id: 'p1', name: 'Player One', firstName: 'Player', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 1, birthDate: null },
};
const pick = (pickNo: number, value: number): DraftPick => ({
  round: Math.ceil(pickNo / 10), pickNo, slot: 1, userId: 'a', playerId: 'p1', isKeeper: false, posDraftRank: 1, seasonPoints: 200, gamesPlayed: 17, ppg: 11.8, healthy: true,
  pointsOverBaseline: 80, redraftPos: 5, contribution: 80, earnedPick: 1, value, tradedTo: null,
});
const rows: PickRow[] = Array.from({ length: 30 }, (_, i) => ({ pick: pick(i + 1, 150 - i), teams: 10, manager: 'alice', year: 2024 }));

describe('PickList', () => {
  it('shows the first 10 rows with year, manager and value, then expands to 25', () => {
    render(<MemoryRouter><PickList label="All time" title="Best draft values" rows={rows} players={players} testId="list" /></MemoryRouter>);
    const list = screen.getByTestId('list');
    expect(list.querySelectorAll('li')).toHaveLength(10);
    const first = list.querySelector('li')!;
    expect(first).toHaveTextContent('1.01');
    expect(first).toHaveTextContent('Player One');
    expect(first).toHaveTextContent('2024 · alice · redraft 5');
    expect(first).toHaveTextContent('+150');
    expect(screen.getAllByRole('link', { name: '2024' })[0]).toHaveAttribute('href', '/draft/2024');
    fireEvent.click(screen.getByRole('button', { name: 'Show all 25' }));
    expect(list.querySelectorAll('li')).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: 'Show top 10' }));
    expect(list.querySelectorAll('li')).toHaveLength(10);
  });

  it('hides the toggle when there is nothing more to show and explains an empty list', () => {
    const { rerender } = render(<MemoryRouter><PickList label="L" title="T" rows={rows.slice(0, 3)} players={players} testId="short" /></MemoryRouter>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('short').querySelectorAll('li')).toHaveLength(3);
    rerender(<MemoryRouter><PickList label="L" title="T" rows={[]} players={players} empty="No TE picks yet." /></MemoryRouter>);
    expect(screen.getByText('No TE picks yet.')).toBeInTheDocument();
  });
});
