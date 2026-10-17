import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow } from '../../lib/playerBoards';
import Board from './Board';
import PositionFilter from './PositionFilter';

const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3, birthDate: null },
};
const managers: History['managers'] = { a: { displayName: 'alice', avatar: 'av', seasons: [2025] } };
const def: BoardDef = { id: 'x', tab: 'players', sub: 'alltime', title: 'Best week by a starter', definition: 'Most points in a week.', valueHeader: 'Pts', compute: () => [] };
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

  it('keeps the definition behind a ? button that opens on press, hover or focus, and titles the card with the title alone', () => {
    wrapB({ rows: [row(0)] });
    expect(screen.getByRole('heading', { name: 'Best week by a starter' })).toBeInTheDocument();
    expect(screen.queryByText('Most points in a week.')).toBeNull();
    const about = screen.getByRole('button', { name: 'What counts' });
    expect(about).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(about);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Most points in a week.');
    expect(about).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(about);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(about);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(about);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(about);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(about);
    expect(screen.queryByRole('tooltip')).toBeNull();
    // a phone tap is a mouseenter then a click, with no focus and no mouseleave: the first opens, the second closes
    fireEvent.mouseEnter(about); fireEvent.click(about);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseEnter(about); fireEvent.click(about);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(about);
    fireEvent.keyDown(about, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(about);
    expect(about).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
    // the definition sits in the flow of the header, under the title row, where the card's clipped overflow cannot cut it
    expect(screen.getByRole('tooltip').parentElement?.tagName).toBe('HEADER');
  });

  it('puts the position pill before the name', () => {
    wrapB({ rows: [row(0, { userId: 'a', to: '/scores/2025/1/3', detail: '3 starts' }), row(1)] });
    const first = screen.getAllByRole('listitem')[0];
    expect(first.textContent).toMatch(/^League recordQBQuincy One/);
    expect(within(first).getByText('100.00')).toBeInTheDocument();
    expect(within(first).getByText('3 starts')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/managers/a');
    expect(within(first).getByRole('link', { name: /2025 · Wk 1/ })).toHaveAttribute('href', '/scores/2025/1/3');
    const second = screen.getAllByRole('listitem')[1];
    expect(second.textContent).toMatch(/^2\?p1/); // unknown player: '?' pill then id
    expect(within(second).queryByRole('link')).toBeNull();
  });

  it('shows several managers as a count with a tooltip naming each, and one manager as the usual link', () => {
    const many = row(0, { userId: 'a', managers: [{ userId: 'b', weeks: 14 }, { userId: 'a', weeks: 9 }] });
    const one = row(1, { userId: 'a', managers: [{ userId: 'a', weeks: 3 }] });
    wrapB({ rows: [many, one], managers: { ...managers, b: { displayName: 'bob', avatar: null, seasons: [2025] } } });
    const first = screen.getAllByRole('listitem')[0];
    const toggle = within(first).getByRole('button', { name: '2 managers' });
    expect(toggle).toHaveAttribute('title', 'bob 14 wks, alice 9 wks');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(first).queryByRole('link', { name: /alice|bob/ })).toBeNull();
    // a tap opens the list inline, each manager a link, for phones and keyboards where the tooltip never shows
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(first).getByRole('link', { name: /bob 14 wks/ })).toHaveAttribute('href', '/managers/b');
    expect(within(first).getByRole('link', { name: /alice 9 wks/ })).toHaveAttribute('href', '/managers/a');
    fireEvent.click(toggle);
    expect(within(first).queryByRole('link', { name: /wks/ })).toBeNull();
    const second = screen.getAllByRole('listitem')[1];
    expect(within(second).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/managers/a');
    expect(within(second).queryByText(/managers/)).toBeNull();
  });

  it('shows an empty state and no button but the ? with no rows', () => {
    wrapB();
    expect(screen.getByText('No players at this position.')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['What counts']);
  });

  it('hides the toggle with five or fewer rows, even when expanded', () => {
    wrapB({ rows: [row(0)], expanded: true });
    expect(screen.queryByRole('button', { name: /show/i })).toBeNull();
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
    wrapB({ def: { ...def, modes }, rows: [row(0)], onMode }); // no mode given: first mode is the default
    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Touches')).toBeInTheDocument();
    cleanup();
    wrapB({ def: { ...def, modes }, rows: [row(0)] }); // uncontrolled: no toggle
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
  });

  it('renders a four-way mode set as pills, never a dropdown', () => {
    const onMode = vi.fn();
    const modes = [{ id: '1', label: 'Top scorer', valueHeader: 'Weeks' }, { id: '3', label: 'Top 3', valueHeader: 'Weeks' }, { id: '5', label: 'Top 5', valueHeader: 'Weeks' }, { id: '10', label: 'Top 10', valueHeader: 'Weeks' }];
    wrapB({ def: { ...def, modes }, rows: [row(0)], mode: '3', onMode });
    const group = screen.getByRole('group', { name: 'View' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Top scorer', 'Top 3', 'Top 5', 'Top 10']);
    expect(within(group).getByRole('button', { name: 'Top 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Top 10' }));
    expect(onMode).toHaveBeenCalledWith('10');
  });

  it('shows the empty copy it is given, else the position copy', () => {
    wrapB({ empty: 'No players with 3 games yet.' });
    expect(screen.getByText('No players with 3 games yet.')).toBeInTheDocument();
    cleanup();
    wrapB();
    expect(screen.getByText('No players at this position.')).toBeInTheDocument();
  });

  it('renders a second toggle, joins its header suffix, and colours toned values', () => {
    const modes = [{ id: 'both', label: 'Both', valueHeader: 'Touches' }, { id: 'rec', label: 'Rec', valueHeader: 'Rec' }];
    const modes2 = [{ id: 'total', label: 'Total', valueHeader: '' }, { id: 'pg', label: 'Per game', valueHeader: '/G' }];
    const onMode2 = vi.fn();
    wrapB({ def: { ...def, modes, modes2 }, rows: [row(0, { tone: 'win' }), row(1, { tone: 'loss' }), row(2)], mode: 'rec', onMode: vi.fn(), mode2: 'pg', onMode2 });
    expect(screen.getByText('Rec/G')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Per game' });
    expect(within(group).getByRole('button', { name: 'Per game' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: 'Total' }));
    expect(onMode2).toHaveBeenCalledWith('total');
    const [first, second, third] = screen.getAllByRole('listitem');
    expect(within(first).getByText('100.00')).toHaveClass('text-gold'); // the record row is gold whatever its tone
    expect(within(first).getByText('100.00')).not.toHaveClass('text-win');
    expect(within(second).getByText('99.00')).toHaveClass('text-loss');
    expect(within(third).getByText('98.00')).not.toHaveClass('text-win');
  });

  it('uses the direction labels from the definition', () => {
    wrapB({ def: { ...def, sortable: true, directionLabels: ['+', '\u2212'] }, rows: [row(0)], direction: 'asc', onDirection: vi.fn() });
    expect(screen.getByRole('button', { name: '\u2212' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Over' })).toBeNull();
  });
  it('renders a manager row with an avatar and name link, no position pill and no second manager link', () => {
    const mdef: BoardDef = { ...def, tab: 'managers', sub: 'malltime' };
    const rows: BoardRow[] = [
      { key: 'a', playerId: null, value: 42, valueLabel: '42', meta: '2023–2025 · 3 seasons', detail: '30-12', userId: 'a', to: null },
      { key: 'g', playerId: null, value: 180.4, valueLabel: '180.40', meta: '2025 · Wk 16 · Championship', detail: 'vs bob, 180.40–80.00', userId: 'a', to: '/scores/2025/16/3' },
    ];
    wrapB({ def: mdef, rows });
    const [first, second] = screen.getAllByRole('listitem');
    expect(first.textContent).toMatch(/^League recordalice/);
    expect(within(first).getAllByRole('link')).toHaveLength(1);
    expect(within(first).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/managers/a');
    expect(within(first).queryByText('QB')).toBeNull();
    expect(within(first).getByText('30-12')).toBeInTheDocument();
    expect(within(second).getByRole('link', { name: /2025 · Wk 16 · Championship/ })).toHaveAttribute('href', '/scores/2025/16/3');
  });

  it('crowns the record holder and anyone tied with it, in gold', () => {
    wrapB({ rows: [row(0), row(1, { value: 100, valueLabel: '100.00' }), row(2)] });
    const [first, second, third] = screen.getAllByRole('listitem');
    expect(within(first).getByTitle('League record')).toBeInTheDocument();
    expect(within(second).getByTitle('League record')).toBeInTheDocument();
    expect(within(third).queryByTitle('League record')).toBeNull();
    expect(third.textContent).toMatch(/^3/);
    expect(first).toHaveAttribute('data-rank', '1');
    expect(third).toHaveAttribute('data-rank', '3');
    expect(within(first).getAllByText('100.00')[0]).toHaveClass('text-gold');
    expect(within(third).getByText('98.00')).not.toHaveClass('text-gold');
  });

  it('crowns nobody when the tie at the top is more than three rows or the whole board', () => {
    const tied = (n: number, total: number) => Array.from({ length: total }, (_, i) => row(i, i < n ? { value: 100, valueLabel: '100.00' } : {}));
    wrapB({ rows: tied(4, 8) });
    expect(screen.queryByTitle('League record')).toBeNull();
    expect(screen.getAllByRole('listitem')[0].textContent).toMatch(/^1/);
    cleanup();
    wrapB({ rows: tied(3, 8) });
    expect(screen.getAllByTitle('League record')).toHaveLength(3);
    cleanup();
    wrapB({ rows: tied(2, 2) }); // everyone is tied: no record to show
    expect(screen.queryByTitle('League record')).toBeNull();
    cleanup();
    wrapB({ rows: [row(0)] }); // a lone row is the record
    expect(screen.getAllByTitle('League record')).toHaveLength(1);
  });

  it('shows the player a manager row names in a block of his own before the value, pill, headshot and name with the detail underneath', () => {
    const mdef: BoardDef = { ...def, tab: 'managers', sub: 'mdraft' };
    wrapB({ def: mdef, rows: [{ key: 'a', playerId: null, player: 'q1', value: 30, valueLabel: '+30.0', meta: '2024', detail: 'Rd 9, pick 81', userId: 'a', to: '/draft/2024?team=a' }] });
    const first = screen.getAllByRole('listitem')[0];
    expect(first.textContent).toMatch(/alice.*2024.*Quincy One.*Rd 9, pick 81.*\+30\.0$/);
    const block = within(first).getByTestId('row-player');
    expect(block).toHaveTextContent('QBQuincy OneRd 9, pick 81');
    expect(block.querySelector('img')).not.toBeNull(); // the headshot sits in the block, hard against the value, so headshots line up down the board
    // below the grid breakpoint the block takes a full second line of a wrapping row, so neither name is squeezed on a phone
    expect(first.className).toMatch(/\bflex-wrap\b/);
    expect(block.className).toMatch(/\border-last\b.*\bmd:order-none\b/);
    expect(block.className).toMatch(/\bbasis-full\b.*\bmd:basis-2\/5\b/);
    expect(within(first).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/managers/a');
    expect(within(first).getByRole('link', { name: '2024' })).toHaveAttribute('href', '/draft/2024?team=a');
    expect(within(first).queryByText('·')).toBeNull(); // the detail moved with the player, so nothing joins it to the meta
  });

  it('offers a position bar when the section controls one', () => {
    const onPosition = vi.fn();
    wrapB({ rows: [row(0)], position: 'RB', onPosition });
    const bar = screen.getByRole('group', { name: 'Position' });
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF']);
    expect(within(bar).getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(bar).getByRole('button', { name: 'TE' }));
    expect(onPosition).toHaveBeenCalledWith('TE');
    expect(screen.queryByRole('combobox')).toBeNull();
    cleanup();
    wrapB({ rows: [row(0)] });
    expect(screen.queryByRole('group', { name: 'Position' })).toBeNull();
  });

  it('uses a neutral empty copy on the managers tab', () => {
    wrapB({ def: { ...def, tab: 'managers', sub: 'malltime' } });
    expect(screen.getByText('Nothing recorded yet.')).toBeInTheDocument();
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
