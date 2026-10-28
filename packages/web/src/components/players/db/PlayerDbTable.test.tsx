import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useState } from 'react';
import PlayerDbTable, { sortAggs, useCollapsedGroups } from './PlayerDbTable';
import { aggregate } from '../../../lib/playerdb/aggregate';
import { COLUMNS, belowMin, columnValue, tabPositions } from '../../../lib/playerdb/columns';
import type { DbState } from '../../../lib/playerdb/url';
import { miniDb } from '../../../test/playerDbFixtures';

const base: DbState = { tab: 'wr', from: 1, to: 3, mode: 'total', roster: 'all', sort: 'pts', dir: 'desc', q: '', team: 'all', rookies: false };

function Harness({ state: initial, collapsed = new Set<string>() }: { state: DbState; collapsed?: Set<string> }) {
  const [state, setState] = useState(initial);
  const [col, setCol] = useState<ReadonlySet<string>>(collapsed);
  const db = miniDb();
  const aggs = aggregate(db, state.from, state.to).filter((a) => (state.tab === 'wr' ? ['WR', 'TE'] : tabPositions(state.tab)).includes(db.players[a.id].pos));
  return (
    <PlayerDbTable db={db} aggs={aggs} state={state} rosters={{ w1: 'A' }} collapsed={col}
      onToggleGroup={(g) => setCol((c) => { const n = new Set(c); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
      onSort={(key) => setState((s) => ({ ...s, sort: key, dir: s.sort === key ? (s.dir === 'desc' ? 'asc' : 'desc') : 'desc' }))} />
  );
}
const names = () => screen.getAllByTestId('db-row').map((r) => within(r).getByTestId('db-name').textContent);

describe('PlayerDbTable', () => {
  it('sorts by points by default, flips on a second click, and ranks rows', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    expect(names()).toEqual(['Wide One', 'Tight One', 'Wide Two']);
    const tgt = screen.getByRole('columnheader', { name: /^Tgt(?!%)/ });
    fireEvent.click(within(tgt).getByRole('button'));
    expect(names()).toEqual(['Wide One', 'Tight One', 'Wide Two']);
    fireEvent.click(within(tgt).getByRole('button'));
    expect(names()).toEqual(['Wide Two', 'Tight One', 'Wide One']);
    expect(screen.getAllByTestId('db-row')[0]).toHaveTextContent(/^1/);
  });
  it('has no manager column, tags free agents FA, and puts the position in its own sticky column left of the player', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    expect(screen.queryByRole('columnheader', { name: 'Mgr' })).toBeNull();
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads.indexOf('Pos')).toBe(heads.indexOf('Player') - 1);
    const rows = screen.getAllByTestId('db-row');
    expect(within(rows[0]).queryByTestId('fa-tag')).toBeNull();          // Wide One is rostered
    expect(within(rows[1]).getByTestId('fa-tag')).toHaveTextContent('FA'); // Tight One is not
    expect(within(rows[0]).getAllByRole('link').every((a) => a.getAttribute('href')?.startsWith('/player/'))).toBe(true); // no manager link, only his page
    const pos = within(rows[0]).getByTestId('db-pos');
    expect(pos).toHaveTextContent('WR');
    expect(pos).toHaveClass('sm:sticky');
    expect(pos.nextElementSibling).toBe(within(rows[0]).getByTestId('db-name').closest('td'));
    expect(within(rows[0]).getByTestId('db-name').closest('td')).toHaveClass('sticky');
  });
  it('on a phone keeps only the player fixed, the rank and position scrolling away', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    const row = screen.getAllByTestId('db-row')[0];
    const [rank, pos] = Array.from(row.querySelectorAll('td'));
    for (const td of [rank, pos]) { expect(td).not.toHaveClass('sticky'); expect(td).toHaveClass('sm:sticky'); }
    const name = within(row).getByTestId('db-name').closest('td')!;
    expect(name).toHaveClass('sticky');
    expect(name).toHaveClass('left-0');
  });
  it('tints rate cells and points by percentile', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    const rows = screen.getAllByTestId('db-row');
    expect(within(rows[0]).getByTestId('cell-tgt').style.background).toMatch(/^color-mix\(in srgb, color-mix\(in oklch, rgb\(47, 158, 95\) 100%/); // Wide One, 26 targets: full green
    expect(within(rows[1]).getByTestId('cell-tgt').style.background).toMatch(/^color-mix\(in srgb, rgb\(230, 194, 41\) 45%/);                     // Tight One, the middle: yellow
    expect(within(rows[2]).getByTestId('cell-tgt').style.background).toMatch(/^color-mix\(in srgb, color-mix\(in oklch, rgb\(214, 69, 69\) 100%/); // Wide Two, 10 targets: full red
    expect(within(rows[0]).getByTestId('cell-pts').style.background).toMatch(/rgb\(47, 158, 95\) 100%/); // top scorer: green
  });
  it('dims a rate under the sample minimum and shows a dash for a missing value', () => {
    render(<MemoryRouter><Harness state={{ ...base, tab: 'rb' }} /></MemoryRouter>);
    const r1 = screen.getByTestId('db-row');
    expect(within(r1).getByTestId('cell-ypt')).toHaveClass('text-muted');        // 6 targets < 3 × 3
    expect(within(r1).getByTestId('cell-ypt').style.background).toBe('');
    expect(within(r1).getByTestId('cell-ypc')).not.toHaveClass('text-muted');    // 50 carries ≥ 5 × 3
    expect(within(r1).getByTestId('cell-ybc')).toHaveTextContent('–');           // no PFR data in the fixture
  });
  it('marks estimated route columns', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    expect(within(screen.getAllByTestId('db-row')[0]).getByTestId('cell-yprr')).toHaveTextContent('°');
    expect(screen.getByRole('columnheader', { name: /^YPRR/ })).toHaveAttribute('title', expect.stringContaining('Estimated'));
  });
  it('collapses a group to one narrow column and expands it again', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    expect(screen.getByRole('columnheader', { name: /^Catch%/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Receiving' }));
    expect(screen.queryByRole('columnheader', { name: /^Catch%/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Receiving' }));
    expect(screen.getByRole('columnheader', { name: /^Catch%/ })).toBeInTheDocument();
  });
  it('expands one row at a time into its weeks', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    fireEvent.click(within(screen.getAllByTestId('db-row')[0]).getByRole('button', { name: /^Show weeks for / }));
    let weeks = screen.getByTestId('db-weeks');
    expect(within(weeks).getAllByTestId('db-week').map((r) => r.textContent?.slice(0, 1))).toEqual(['1', '2', '3']);
    expect(within(weeks).getByTestId('db-week-total')).toHaveTextContent('50.0');
    fireEvent.click(within(screen.getAllByTestId('db-row')[1]).getByRole('button', { name: /^Show weeks for / }));
    weeks = screen.getByTestId('db-weeks');
    expect(within(weeks).getAllByTestId('db-week')).toHaveLength(3);
    expect(screen.getAllByTestId('db-weeks')).toHaveLength(1);
    fireEvent.click(within(screen.getAllByTestId('db-row')[1]).getByRole('button', { name: /^Show weeks for / }));
    expect(screen.queryByTestId('db-weeks')).toBeNull();
  });
  it('links each name to the player page, the chevron beside it opening the weeks', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    const row = screen.getAllByTestId('db-row')[0];
    const name = within(row).getByTestId('db-name').textContent!;
    expect(within(row).getByRole('link', { name })).toHaveAttribute('href', expect.stringMatching(/^\/player\//));
    fireEvent.click(within(row).getByRole('button', { name: `Show weeks for ${name}` }));
    expect(screen.getByTestId('db-weeks')).toBeInTheDocument();
  });
  it('pages 25 at a time', () => {
    const db = miniDb();
    const many = Array.from({ length: 30 }, (_, i) => ({ ...db.rows[2], id: `w${i + 10}`, pts: 30 - i }));
    db.rows = [...db.rows, ...many];
    for (const r of many) db.players[r.id] = { ...db.players.w1, id: r.id, name: `Extra ${r.id}` };
    const aggs = aggregate(db, 1, 3).filter((a) => db.players[a.id].pos === 'WR');
    render(<MemoryRouter><PlayerDbTable db={db} aggs={aggs} state={base} rosters={{}} collapsed={new Set()} onToggleGroup={() => {}} onSort={() => {}} /></MemoryRouter>);
    expect(screen.getAllByTestId('db-row')).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: 'Show 25 more' }));
    expect(screen.getAllByTestId('db-row')).toHaveLength(32);
    expect(screen.queryByRole('button', { name: 'Show 25 more' })).toBeNull();
  });
  it('sortAggs puts nulls last in both directions', () => {
    const db = miniDb();
    const aggs = aggregate(db, 1, 3);
    const asc = sortAggs(aggs, { ...base, sort: 'sep', dir: 'asc' }).map((a) => a.id);
    const desc = sortAggs(aggs, { ...base, sort: 'sep', dir: 'desc' }).map((a) => a.id);
    expect(asc[0]).toBe('w1'); expect(desc[0]).toBe('w1');
    expect(asc.slice(1).sort()).toEqual(desc.slice(1).sort());
  });
  it('sortAggs ranks below-minimum rates after rows that meet it, in both directions', () => {
    const db = miniDb();
    const aggs = aggregate(db, 1, 3);
    const dims = aggs.filter((a) => belowMin(COLUMNS.ypt, a) || columnValue(COLUMNS.ypt, a, 'total') === null).map((a) => a.id);
    expect(dims).toContain('r1');
    for (const dir of ['asc', 'desc'] as const) {
      const ids = sortAggs(aggs, { ...base, sort: 'ypt', dir }).map((a) => a.id);
      const firstDim = Math.min(...dims.map((d) => ids.indexOf(d)));
      const lastOk = Math.max(-1, ...ids.map((id, i) => (dims.includes(id) ? -1 : i)));
      expect(firstDim).toBeGreaterThan(lastOk);
    }
  });
  it('per-game mode shows integer columns as integers except per-game ones', () => {
    render(<MemoryRouter><Harness state={{ ...base, mode: 'pg' }} /></MemoryRouter>);
    const r = screen.getAllByTestId('db-row')[0];
    expect(within(r).getByTestId('cell-g')).toHaveTextContent(/^3$/);
    expect(within(r).getByTestId('cell-tgt')).toHaveTextContent('8.7');
  });
  it('keeps header and body column counts equal', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    const first = document.querySelector('thead tr')!;
    const sum = [...first.children].reduce((n, c) => n + Number(c.getAttribute('colSpan') ?? 1), 0);
    expect(sum).toBe(screen.getAllByTestId('db-row')[0].children.length);
  });
  it('useCollapsedGroups persists per tab', () => {
    function Probe() {
      const [c, toggle] = useCollapsedGroups('rb');
      return <button onClick={() => toggle('Rushing')}>{[...c].join(',') || 'none'}</button>;
    }
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveTextContent('none');
    act(() => { fireEvent.click(screen.getByRole('button')); });
    expect(screen.getByRole('button')).toHaveTextContent('Rushing');
    expect(localStorage.getItem('playerdb.collapsed.rb')).toBe('["Rushing"]');
    localStorage.clear();
  });
  it('keeps a row\'s colours when the table is narrowed to it: tinted against the whole pool', () => {
    const db = miniDb();
    const pool = aggregate(db, 1, 3).filter((a) => ['WR', 'TE'].includes(db.players[a.id].pos));
    render(<MemoryRouter><PlayerDbTable db={db} aggs={pool.filter((a) => a.id === 'w2')} pool={pool} state={{ ...base, q: 'two' }} rosters={{}} collapsed={new Set()} onToggleGroup={() => {}} onSort={() => {}} /></MemoryRouter>);
    // Wide Two has the fewest targets of the three: red, not the yellow a lone row would get
    expect(screen.getByTestId('cell-tgt').style.background).toMatch(/rgb\(214, 69, 69\) 100%/);
  });
});
