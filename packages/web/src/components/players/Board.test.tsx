import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const wrapB = (props: Partial<React.ComponentProps<typeof Board>> = {}) => {
  const onToggle = vi.fn();
  const utils = render(<MemoryRouter><Board def={def} rows={[]} players={players} managers={managers} expanded={false} onToggle={onToggle} {...props} /></MemoryRouter>);
  return { ...utils, onToggle };
};

describe('Board', () => {
  const eight = Array.from({ length: 8 }, (_, i) => row(i));

  it('shows five rows when collapsed and asks the section to expand', () => {
    const { onToggle } = wrapB({ rows: eight });
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /show all/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(5); // controlled: nothing changes until the parent flips expanded
  });

  it('shows every row when expanded and offers Show less', () => {
    const { onToggle } = wrapB({ rows: eight, expanded: true });
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('puts the position pill before the name and shows the definition', () => {
    wrapB({ rows: [row(0, { userId: 'a', to: '/scores/2025/1/3', detail: '3 starts' }), row(1)] });
    expect(screen.getByText('Most points in a week.')).toBeInTheDocument();
    const first = screen.getAllByRole('listitem')[0];
    expect(first.textContent).toMatch(/^1QBQuincy One/);
    expect(within(first).getByText('100.00')).toBeInTheDocument();
    expect(within(first).getByText('3 starts')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/h2h?a=a');
    expect(within(first).getByRole('link', { name: /2025 · Wk 1/ })).toHaveAttribute('href', '/scores/2025/1/3');
    const second = screen.getAllByRole('listitem')[1];
    expect(second.textContent).toMatch(/^2\?p1/); // unknown player: '?' pill then id
    expect(within(second).queryByRole('link')).toBeNull();
  });

  it('shows an empty state and no buttons with no rows', () => {
    wrapB();
    expect(screen.getByText('No players at this position.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the toggle with five or fewer rows, even when expanded', () => {
    wrapB({ rows: [row(0)], expanded: true });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('offers a mode toggle for moded boards and shows the mode value header', () => {
    const onMode = vi.fn();
    const modes = [{ id: 'both', label: 'Both', valueHeader: 'Touches' }, { id: 'rec', label: 'Rec', valueHeader: 'Rec' }, { id: 'car', label: 'Car', valueHeader: 'Car' }];
    wrapB({ def: { ...def, modes }, rows: [row(0)], mode: 'rec', onMode });
    const group = screen.getByRole('group', { name: 'View' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Both', 'Rec', 'Car']);
    expect(within(group).getByRole('button', { name: 'Rec' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Rec', { selector: '.section-label' })).toBeInTheDocument();
    expect(screen.queryByText('Pts')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Car' }));
    expect(onMode).toHaveBeenCalledWith('car');
    cleanup();
    wrapB({ def: { ...def, modes }, rows: [row(0)] }); // no mode given: first mode is the default
    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Touches')).toBeInTheDocument();
  });

  it('offers an Over/Under toggle only for sortable boards', () => {
    const onDirection = vi.fn();
    wrapB({ def: { ...def, sortable: true }, rows: [row(0)], direction: 'desc', onDirection });
    expect(screen.getByRole('button', { name: 'Over' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Under' }));
    expect(onDirection).toHaveBeenCalledWith('asc');
    cleanup();
    wrapB({ rows: [row(0)], direction: 'desc', onDirection });
    expect(screen.queryByRole('button', { name: 'Over' })).toBeNull();
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
