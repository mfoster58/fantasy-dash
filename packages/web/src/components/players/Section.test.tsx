import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import type { BoardContext, BoardDef, BoardRow } from '../../lib/playerBoards';
import { players } from '../../test/playerFixtures';
import Section from './Section';

const managers: History['managers'] = { a: { displayName: 'alice', avatar: null, seasons: [2025] } };
const rows = (n: number, prefix: string): BoardRow[] => Array.from({ length: n }, (_, i) => ({
  key: `${prefix}${i}`, playerId: i === 0 ? 'q1' : `${prefix}${i}`, value: n - i, valueLabel: String(n - i), meta: '2025', detail: null, userId: null, to: null,
}));
const big: BoardDef = { id: 'big', section: 'extras', title: 'Big board', definition: 'Eight rows.', valueHeader: 'N', compute: () => rows(8, 'b') };
const small: BoardDef = { id: 'small', section: 'extras', title: 'Small board', definition: 'Two rows.', valueHeader: 'N', compute: () => rows(2, 's') };
const sortable: BoardDef = { id: 'sortable', section: 'extras', title: 'Sortable board', definition: 'Direction aware.', valueHeader: 'N', sortable: true,
  compute: (_ctx, direction) => (direction === 'asc' ? rows(6, 'u') : rows(6, 'o')) };
const ctx: BoardContext = { lines: [], players, champions: {}, currentYear: 2025, pos: 'All', picks: [], xfp: null };
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Section', () => {
  it('expands every board together and leaves short boards alone', () => {
    wrap(<Section id="extras" title="Extras" note="Every season" boards={[big, small, sortable]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const bigBoard = screen.getByRole('region', { name: 'Big board' });
    const sortBoard = screen.getByRole('region', { name: 'Sortable board' });
    const smallBoard = screen.getByRole('region', { name: 'Small board' });
    expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(sortBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(smallBoard).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(within(bigBoard).getByRole('button', { name: /show all/i }));
    expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(8);
    expect(within(sortBoard).getAllByRole('listitem')).toHaveLength(6);
    expect(within(smallBoard).getAllByRole('listitem')).toHaveLength(2);
    expect(within(smallBoard).queryByRole('button')).toBeNull();
    expect(within(sortBoard).getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  it('passes the direction to a sortable board', () => {
    wrap(<Section id="extras" title="Extras" note="" boards={[sortable]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const board = screen.getByRole('region', { name: 'Sortable board' });
    // row 0 is always q1; row 1's id carries the direction prefix ('o1' vs 'u1')
    expect(within(board).getAllByRole('listitem')[1]).toHaveTextContent('o1');
    fireEvent.click(within(board).getByRole('button', { name: 'Under' }));
    expect(within(board).getAllByRole('listitem')[1]).toHaveTextContent('u1');
  });

  it('renders its own position filter and optional season picker, and an empty message instead of boards', () => {
    const onPos = vi.fn();
    const onChange = vi.fn();
    wrap(<Section id="leaders" title="League leaders" note="" boards={[big]} ctx={ctx} players={players} managers={managers} pos="RB" onPos={onPos} columns={3}
      seasonPicker={{ years: [2024, 2025], value: 2025, onChange }} emptyMessage="Season has not started." />);
    expect(screen.getByRole('heading', { name: 'League leaders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'TE' }));
    expect(onPos).toHaveBeenCalledWith('TE');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } });
    expect(onChange).toHaveBeenCalledWith(2024);
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Big board' })).toBeNull();
  });
});
