import { act, fireEvent, render, screen } from '@testing-library/react';
import PlayerDbToolbar from './PlayerDbToolbar';
import type { DbState } from '../../../lib/playerdb/url';

const state: DbState = { tab: 'all', from: 1, to: 6, mode: 'total', roster: 'all', sort: 'pts', dir: 'desc', q: '' };
const managers = [{ userId: '1', name: 'Alice' }, { userId: '2', name: 'Bob' }];

function setup(over: Partial<DbState> = {}) {
  const onChange = vi.fn();
  const onYear = vi.fn();
  render(<PlayerDbToolbar state={{ ...state, ...over }} onChange={onChange} years={[2025, 2026]} year={2026} onYear={onYear} throughWeek={6} managers={managers} />);
  return { onChange, onYear };
}

describe('PlayerDbToolbar', () => {
  it('switches tabs, marking the current one pressed', () => {
    const { onChange } = setup({ tab: 'wr' });
    expect(screen.getByRole('button', { name: 'WR' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'RB' }));
    expect(onChange).toHaveBeenCalledWith({ tab: 'rb' });
  });
  it('sets the week range from the selects and the chips', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ from: 3 });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({ to: 5 });
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
});
