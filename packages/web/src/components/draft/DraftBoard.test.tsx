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
  p4: { id: 'p4', name: 'Player Four', firstName: 'Player', lastName: 'Four', position: 'DEF', team: 'DET', yearsExp: 1 },
};
const pick = (round: number, pickNo: number, slot: number, userId: string, playerId: string, value: number | null, extra: Partial<DraftPick> = {}): DraftPick => ({
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: 1, seasonPoints: 120.5, gamesPlayed: 5, ppg: 24.1, healthy: true,
  pointsOverBaseline: 15.25, redraftPos: 2, contribution: value === null ? null : 20, earnedPick: value === null ? null : 1.5, value, tradedTo: null, ...extra,
});
const draft: Draft = {
  draftId: 'D', type: 'snake', rounds: 2, slotOrder: ['a', 'b'], expectedCurve: { a: 40, k: 36, c: 0 }, baselines: {},
  picks: [
    pick(1, 1, 1, 'a', 'p1', 6.5, { tradedTo: { userId: 'b', week: 3 } }),
    pick(1, 2, 2, 'b', 'p2', -30, { isKeeper: true }),
    pick(2, 3, 2, 'b', 'p3', 0),
    pick(2, 4, 1, 'a', 'p4', null, { posDraftRank: null, pointsOverBaseline: null, redraftPos: null }),
  ],
};

describe('DraftBoard', () => {
  it('lays picks out by round and slot with position labels and a detailed tooltip', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} seasonTeams={{}} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('Player One');
    expect(cells[0]).toHaveTextContent('RB1');
    expect(cells[2]).toHaveTextContent('DEF');
    const title = cells[0].getAttribute('title') ?? '';
    expect(title).toContain('Season points: 120.50');
    expect(title).toContain('Redraft position: 2 (drafted RB1)');
    expect(title).toContain('Earned pick: 1.5 (drafted 1)');
    expect(title).toContain('Points over baseline: +15.25');
    expect(title).toContain('PPG: 24.1 over 5 games');
    expect(title).toContain('Traded to bob in week 3');
    expect(cells[1].getAttribute('title')).toContain('Keeper');
  });

  it("shows the team the player was on that season rather than today's team", () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} seasonTeams={{ p2: 'NYG' }} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[1]).toHaveTextContent('NYG');
    expect(cells[1]).not.toHaveTextContent('DAL');
    expect(cells[1]).toHaveAttribute('title', expect.stringContaining('· NYG'));
  });

  it('marks keepers with a lock and traded players with a yellow ring and the new owner\'s name', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} seasonTeams={{}} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[1].querySelector('[aria-label="Keeper"]')).not.toBeNull();
    expect(cells[1]).not.toHaveTextContent(/keeper/i);
    expect(cells[0].className).toContain('ring-warn');
    expect(cells[0].querySelector('[aria-label="Traded"]')).not.toBeNull();
    expect(cells[1].querySelector('[aria-label="Traded"]')).toBeNull();
    expect(cells[1].className).not.toContain('ring-warn');
    expect(cells[0]).toHaveTextContent('bob');
    expect(cells[0]).not.toHaveTextContent('SF');
    expect(cells[1]).toHaveTextContent('DAL');
    expect(cells[2].querySelector('[aria-label]')).toBeNull();
  });

  it('colors value mode on a red-yellow-green scale and shows the total value', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} seasonTeams={{}} mode="value" highlight={null} onHighlight={() => {}} inSeason={true} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[0].style.background).toMatch(/(#2f9e5f|rgb\(47, 158, 95\)) 11%/);
    expect(cells[0].style.background).toContain('transparent');
    expect(cells[1].style.background).toMatch(/(#d64545|rgb\(214, 69, 69\))(, | 50%)/);
    expect(cells[3].style.background).toMatch(/(#e6c229|rgb\(230, 194, 41\)) 45%, transparent/);
    expect(cells[2].style.background).toBe('transparent');
    expect(cells[0].style.color).toBe('');
    expect(cells[0]).toHaveTextContent('+7');
    expect(cells[1]).toHaveTextContent('-30');
    expect(cells[0].getAttribute('title')).toContain('Season points to date');
    expect(cells[0].getAttribute('title')).toContain('Redraft position today');
  });

  it('shows a letter grade, total and rank under each column', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} seasonTeams={{}} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const row = screen.getByTestId('grade-row');
    const cells = row.querySelectorAll('button');
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveTextContent('A+');     // alice: 6.5 + null -> +7, rank 1
    expect(cells[0]).toHaveTextContent('+7');
    expect(cells[0]).toHaveTextContent('1 of 2');
    expect(cells[1]).toHaveTextContent('B-');     // bob: rank 2 of 2 -> letter index floor(11/2) = 5
  });

  it('highlights one manager\'s picks when the column header is clicked', () => {
    const onHighlight = vi.fn();
    render(<DraftBoard draft={draft} managers={managers} players={players} seasonTeams={{}} mode="value" highlight="a" onHighlight={onHighlight} inSeason={false} />);
    fireEvent.click(screen.getByRole('button', { name: /alice/ }));
    expect(onHighlight).toHaveBeenCalledWith(null);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[0]).toHaveAttribute('data-highlight', 'true');
    expect(cells[1]).toHaveAttribute('data-highlight', 'false');
    fireEvent.click(cells[1]);                       // any cell selects its column's manager
    expect(onHighlight).toHaveBeenLastCalledWith('b');
    fireEvent.click(cells[0]);                       // clicking the active column clears it
    expect(onHighlight).toHaveBeenLastCalledWith(null);
  });
});
