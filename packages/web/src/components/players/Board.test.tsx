import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow } from '../../lib/playerBoards';
import Board from './Board';
import PositionFilter from './PositionFilter';

const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3 },
};
const managers: History['managers'] = { a: { displayName: 'alice', avatar: 'av', seasons: [2025] } };
const def: BoardDef = { id: 'x', section: 'allTime', title: 'Best week by a starter', definition: 'Most points in a week.', valueHeader: 'Pts', compute: () => [] };
const row = (i: number, extra: Partial<BoardRow> = {}): BoardRow => ({
  key: `k${i}`, playerId: i === 0 ? 'q1' : `p${i}`, value: 100 - i, valueLabel: `${100 - i}.00`, meta: '2025 · Wk 1', detail: null, userId: null, to: null, ...extra,
});
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Board', () => {
  it('shows five rows, then all of them on Show all', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(i));
    wrap(<Board def={def} rows={rows} players={players} managers={managers} />);
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /show all/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('renders name, position, unknown players, manager link and game link', () => {
    const rows = [row(0, { userId: 'a', to: '/scores/2025/1/3', detail: '3 starts' }), row(1)];
    wrap(<Board def={def} rows={rows} players={players} managers={managers} />);
    const first = screen.getAllByRole('listitem')[0];
    expect(within(first).getByText('Quincy One')).toBeInTheDocument();
    expect(within(first).getByText('QB')).toBeInTheDocument();
    expect(within(first).getByText('100.00')).toBeInTheDocument();
    expect(within(first).getByText('3 starts')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/h2h?a=a');
    expect(within(first).getByRole('link', { name: /2025 · Wk 1/ })).toHaveAttribute('href', '/scores/2025/1/3');
    const second = screen.getAllByRole('listitem')[1];
    expect(within(second).getByText('p1')).toBeInTheDocument(); // unknown player falls back to id
    expect(within(second).getByText('?')).toBeInTheDocument();
    expect(within(second).queryByRole('link')).toBeNull();
  });

  it('shows an empty state and no toggle with no rows', () => {
    wrap(<Board def={def} rows={[]} players={players} managers={managers} />);
    expect(screen.getByText('No players at this position.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the toggle when five or fewer rows', () => {
    wrap(<Board def={def} rows={[row(0)]} players={players} managers={managers} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('PositionFilter', () => {
  it('renders every option with the current one pressed and reports clicks', () => {
    const onChange = vi.fn();
    render(<PositionFilter value="RB" onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF']);
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'TE' }));
    expect(onChange).toHaveBeenCalledWith('TE');
  });
});
