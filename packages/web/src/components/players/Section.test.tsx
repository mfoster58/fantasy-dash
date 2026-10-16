import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import type { BoardContext, BoardDef, BoardRow } from '../../lib/playerBoards';
import { emptyManagerCtx, game, line, players, season, side, week } from '../../test/playerFixtures';
import { flattenLines } from '../../lib/playerLines';
import Section from './Section';

const managers: History['managers'] = { a: { displayName: 'alice', avatar: null, seasons: [2025] } };
const rows = (n: number, prefix: string): BoardRow[] => Array.from({ length: n }, (_, i) => ({
  key: `${prefix}${i}`, playerId: i === 0 ? 'q1' : `${prefix}${i}`, value: n - i, valueLabel: String(n - i), meta: '2025', detail: null, userId: null, to: null,
}));
const big: BoardDef = { id: 'big', tab: 'players', sub: 'alltime', title: 'Big board', definition: 'Eight rows.', valueHeader: 'N', compute: () => rows(8, 'b') };
const small: BoardDef = { id: 'small', tab: 'players', sub: 'alltime', title: 'Small board', definition: 'Two rows.', valueHeader: 'N', compute: () => rows(2, 's') };
const sortable: BoardDef = { id: 'sortable', tab: 'players', sub: 'alltime', title: 'Sortable board', definition: 'Direction aware.', valueHeader: 'N', sortable: true,
  compute: (_ctx, direction) => (direction === 'asc' ? rows(6, 'u') : rows(6, 'o')) };
const moded: BoardDef = { id: 'moded', tab: 'players', sub: 'alltime', title: 'Moded board', definition: 'Two readings.', valueHeader: 'Pts',
  modes: [{ id: 'total', label: 'Total', valueHeader: 'Pts' }, { id: 'ppg', label: 'PPG', valueHeader: 'PPG' }],
  compute: (_ctx, _direction, mode) => (mode === 'ppg' ? rows(7, 'g') : rows(7, 'x')) };
const ctx: BoardContext = { lines: [], players, champions: {}, lastPlaces: {}, year: null, currentYear: 2025, pos: 'All', picks: [], xfp: null, transactions: [], playerSeasons: {}, drafts: {}, ...emptyManagerCtx };
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Section', () => {
  it('expands only the boards in the same grid row and leaves short boards alone', () => {
    // two columns: row 1 = big + small, row 2 = sortable + moded
    wrap(<Section id="extras" title="Extras" note="Every season" boards={[big, small, sortable, moded]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const bigBoard = screen.getByRole('region', { name: 'Big board' });
    const sortBoard = screen.getByRole('region', { name: 'Sortable board' });
    const smallBoard = screen.getByRole('region', { name: 'Small board' });
    const modedBoard = screen.getByRole('region', { name: 'Moded board' });
    expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(sortBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(smallBoard).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(within(bigBoard).getByRole('button', { name: /show all/i }));
    expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(8);
    expect(within(sortBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(modedBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(smallBoard).getAllByRole('listitem')).toHaveLength(2);
    expect(within(smallBoard).queryByRole('button')).toBeNull();
    fireEvent.click(within(modedBoard).getByRole('button', { name: /show all/i }));
    expect(within(sortBoard).getAllByRole('listitem')).toHaveLength(6);
    expect(within(modedBoard).getAllByRole('listitem')).toHaveLength(7);
    expect(within(sortBoard).getByRole('button', { name: /show less/i })).toBeInTheDocument();
    fireEvent.click(within(sortBoard).getByRole('button', { name: /show less/i }));
    expect(within(modedBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(8); // row 1 untouched
  });

  it('groups rows by three in a three-column section', () => {
    const third: BoardDef = { ...big, id: 'third', title: 'Third board' };
    const fourth: BoardDef = { ...big, id: 'fourth', title: 'Fourth board' };
    wrap(<Section id="leaders" title="Leaders" note="" boards={[big, sortable, third, fourth]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={3} />);
    fireEvent.click(within(screen.getByRole('region', { name: 'Third board' })).getByRole('button', { name: /show all/i }));
    expect(within(screen.getByRole('region', { name: 'Big board' })).getAllByRole('listitem')).toHaveLength(8);
    expect(within(screen.getByRole('region', { name: 'Sortable board' })).getAllByRole('listitem')).toHaveLength(6);
    expect(within(screen.getByRole('region', { name: 'Fourth board' })).getAllByRole('listitem')).toHaveLength(5);
  });

  it('expands boards one at a time below the grid breakpoint and collapses everything when the layout changes', () => {
    let matches = false;
    const listeners: (() => void)[] = [];
    const mql = { get matches() { return matches; }, addEventListener: (_: string, fn: () => void) => listeners.push(fn), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    try {
      wrap(<Section id="extras" title="Extras" note="" boards={[big, sortable, moded]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={3} />);
      const bigBoard = screen.getByRole('region', { name: 'Big board' });
      fireEvent.click(within(bigBoard).getByRole('button', { name: /show all/i }));
      expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(8);
      expect(within(screen.getByRole('region', { name: 'Sortable board' })).getAllByRole('listitem')).toHaveLength(5);
      expect(within(screen.getByRole('region', { name: 'Moded board' })).getAllByRole('listitem')).toHaveLength(5);
      // widen: row 0 would now cover all three boards, so the stale row key must not expand the other two
      matches = true;
      act(() => { for (const fn of listeners) fn(); });
      for (const name of ['Big board', 'Sortable board', 'Moded board']) expect(within(screen.getByRole('region', { name })).getAllByRole('listitem')).toHaveLength(5);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps a second mode per board and asks the definition for empty copy', () => {
    const two: BoardDef = { ...moded, id: 'two', title: 'Two toggles', modes2: [{ id: 'total', label: 'Total', valueHeader: '' }, { id: 'pg', label: 'Per game', valueHeader: '/G' }],
      empty: (_ctx, _mode, mode2) => (mode2 === 'pg' ? 'Need more games.' : undefined),
      compute: (_ctx, _direction, mode, mode2) => (mode2 === 'pg' ? [] : mode === 'ppg' ? rows(7, 'g') : rows(7, 'x')) };
    wrap(<Section id="extras" title="Extras" note="" boards={[two]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const board = screen.getByRole('region', { name: 'Two toggles' });
    const perGame = within(board).getByRole('group', { name: 'Per game' });
    fireEvent.click(within(perGame).getByRole('button', { name: 'Per game' }));
    expect(within(board).getByText('Need more games.')).toBeInTheDocument();
    expect(within(board).getByText('Pts/G')).toBeInTheDocument(); // first toggle stays Total: 'Pts' + '/G'
    fireEvent.click(within(perGame).getByRole('button', { name: 'Total' }));
    expect(within(board).getAllByRole('listitem')).toHaveLength(5);
  });

  it('passes the chosen mode to a moded board and keeps it per board', () => {
    wrap(<Section id="extras" title="Extras" note="" boards={[moded]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const board = screen.getByRole('region', { name: 'Moded board' });
    expect(within(board).getAllByRole('listitem')[1]).toHaveTextContent('x1');
    expect(within(board).getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(board).getByRole('button', { name: 'PPG' }));
    expect(within(board).getAllByRole('listitem')[1]).toHaveTextContent('g1');
    expect(within(board).getByRole('button', { name: 'PPG' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('passes the direction to a sortable board', () => {
    wrap(<Section id="extras" title="Extras" note="" boards={[sortable]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const board = screen.getByRole('region', { name: 'Sortable board' });
    // row 0 is always q1; row 1's id carries the direction prefix ('o1' vs 'u1')
    expect(within(board).getAllByRole('listitem')[1]).toHaveTextContent('o1');
    fireEvent.click(within(board).getByRole('button', { name: 'Under' }));
    expect(within(board).getAllByRole('listitem')[1]).toHaveTextContent('u1');
  });

  it('gives each player board its own position dropdown that narrows that board alone and follows the section filter when it changes', () => {
    const lines = flattenLines([season(2025, [week(1, [game(2025, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('r1', 5)]))])])], players);
    const echo = (id: string, title: string, extra: Partial<BoardDef> = {}): BoardDef => ({ ...big, id, title, ...extra,
      compute: (c) => [{ key: c.pos, playerId: 'q1', value: 1, valueLabel: c.pos, meta: `${c.pos} meta`, detail: `${c.lines.length} lines`, userId: null, to: null }] });
    const posBoard = echo('posb', 'Pos board');
    const other = echo('other', 'Other board');
    const mboard = echo('mb', 'Manager board', { tab: 'managers', sub: 'mdraft', positions: true });
    const plain = echo('plain', 'Plain manager board', { tab: 'managers', sub: 'mdraft' });
    const ui = (pos: 'All' | 'WR') => <Section id="s" title="S" note="" boards={[posBoard, other, mboard, plain]} ctx={{ ...ctx, pos, lines: pos === 'All' ? lines : lines.filter((l) => l.position === pos) }} allLines={lines} players={players} managers={managers} pos={pos} onPos={() => {}} columns={2} />;
    const { rerender } = wrap(ui('All'));
    const region = (name: string) => screen.getByRole('region', { name });
    const select = (name: string) => within(region(name)).getByRole('combobox', { name: 'Position' });
    expect(select('Pos board')).toHaveValue('All');
    expect(within(region('Pos board')).getByText('2 lines')).toBeInTheDocument();
    fireEvent.change(select('Pos board'), { target: { value: 'RB' } });
    expect(select('Pos board')).toHaveValue('RB');
    expect(within(region('Pos board')).getByText('RB meta')).toBeInTheDocument();
    expect(within(region('Pos board')).getByText('1 lines')).toBeInTheDocument();
    expect(within(region('Other board')).getByText('2 lines')).toBeInTheDocument(); // untouched
    // a manager board that names players narrows by position but keeps every line
    fireEvent.change(select('Manager board'), { target: { value: 'QB' } });
    expect(within(region('Manager board')).getByText('QB meta')).toBeInTheDocument();
    expect(within(region('Manager board')).getByText('2 lines')).toBeInTheDocument();
    expect(within(region('Plain manager board')).queryByRole('combobox', { name: 'Position' })).toBeNull();
    // the section filter changing clears every override
    rerender(<MemoryRouter>{ui('WR')}</MemoryRouter>);
    expect(select('Pos board')).toHaveValue('WR');
    expect(within(region('Pos board')).getByText('WR meta')).toBeInTheDocument();
    expect(select('Manager board')).toHaveValue('WR');
  });

  it('renders its own position filter and optional season picker, and an empty message instead of boards', () => {
    const onPos = vi.fn();
    const onChange = vi.fn();
    wrap(<Section id="leaders" title="League leaders" note="" boards={[big]} ctx={ctx} players={players} managers={managers} pos="RB" onPos={onPos} columns={3}
      seasonPicker={{ years: [2024, 2025], value: 2025, onChange, allTime: true }} emptyMessage="Season has not started." />);
    expect(screen.getByRole('option', { name: 'All-time' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'League leaders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'TE' }));
    expect(onPos).toHaveBeenCalledWith('TE');
    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), { target: { value: '2024' } });
    expect(onChange).toHaveBeenCalledWith(2024);
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Big board' })).toBeNull();
  });
});
