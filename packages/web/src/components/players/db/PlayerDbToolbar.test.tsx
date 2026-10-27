import { act, fireEvent, render, screen } from '@testing-library/react';
import PlayerDbToolbar from './PlayerDbToolbar';
import type { DbState } from '../../../lib/playerdb/url';

const state: DbState = { tab: 'all', from: 1, to: 6, mode: 'total', roster: 'all', sort: 'pts', dir: 'desc', q: '', team: 'all', rookies: false };
const managers = [{ userId: '1', name: 'Alice' }, { userId: '2', name: 'Bob' }];

function setup(over: Partial<DbState> = {}, year: number | 'all' = 2026) {
  const onChange = vi.fn();
  const onYear = vi.fn();
  render(<PlayerDbToolbar state={{ ...state, ...over }} onChange={onChange} years={[2025, 2026]} year={year} onYear={onYear} throughWeek={6} managers={managers} teams={['BUF', 'KC']} />);
  return { onChange, onYear };
}

describe('PlayerDbToolbar', () => {
  it('switches tabs, marking the current one pressed', () => {
    const { onChange } = setup({ tab: 'wr' });
    expect(screen.getByRole('button', { name: 'WR' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'RB' }));
    expect(onChange).toHaveBeenCalledWith({ tab: 'rb' });
  });
  it('sets the weeks from a row of week bubbles instead of From and To selects', () => {
    const { onChange } = setup();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Week 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Week 5' }));
    expect(onChange).toHaveBeenCalledWith({ from: 3, to: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Last 4' }));
    expect(onChange).toHaveBeenCalledWith({ from: 3, to: 6 });
    fireEvent.click(screen.getByRole('button', { name: 'Season' }));
    expect(onChange).toHaveBeenCalledWith({ from: 1, to: 6 });
  });
  it('toggles per-game mode and the roster filter, listing every manager', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Per game' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'pg' });
    const roster = screen.getByLabelText('Roster') as HTMLSelectElement;
    expect([...roster.options].map((o) => o.textContent)).toEqual(['All players', 'Rostered', 'Free agents', 'Alice', 'Bob']);
    fireEvent.change(roster, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ roster: '2' });
  });
  it('debounces the search box and changes the season', () => {
    vi.useFakeTimers();
    const { onChange, onYear } = setup();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search players' }), { target: { value: 'egb' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onChange).toHaveBeenCalledWith({ q: 'egb' });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '2025' } }); // the season picker is the first select
    expect(onYear).toHaveBeenCalledWith(2025);
    vi.useRealTimers();
  });
  it('toggles rookies only, and picks an NFL team', () => {
    const { onChange } = setup({ rookies: true });
    expect(screen.getByRole('button', { name: 'Rookies' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Rookies' }));
    expect(onChange).toHaveBeenCalledWith({ rookies: false });
    fireEvent.change(screen.getByRole('combobox', { name: 'NFL team' }), { target: { value: 'KC' } });
    expect(onChange).toHaveBeenCalledWith({ team: 'KC' });
  });
  it('has no rookies button across all seasons, where a rookie year means nothing', () => {
    setup({}, 'all');
    expect(screen.queryByRole('button', { name: 'Rookies' })).toBeNull();
  });
});
