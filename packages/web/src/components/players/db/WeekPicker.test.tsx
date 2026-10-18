import { fireEvent, render, screen } from '@testing-library/react';
import WeekPicker from './WeekPicker';

function setup(from: number, to: number, throughWeek = 6) {
  const onChange = vi.fn();
  render(<WeekPicker from={from} to={to} throughWeek={throughWeek} lastWeek={18} playoffAt={15} onChange={onChange} />);
  return onChange;
}
const week = (n: number) => screen.getByRole('button', { name: `Week ${n}` });

describe('WeekPicker', () => {
  it('shows every week of the season, greying the ones not played yet', () => {
    setup(1, 6);
    expect(screen.getAllByRole('button', { name: /^Week \d+$/ })).toHaveLength(18);
    expect(week(6)).toBeEnabled();
    expect(week(7)).toBeDisabled();
    expect(screen.getByTestId('playoff-gap')).toBeInTheDocument();
  });
  it('marks the selected weeks', () => {
    setup(2, 4);
    expect([2, 3, 4].map((n) => week(n).getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true']);
    expect(week(1)).toHaveAttribute('aria-pressed', 'false');
  });
  it('starts in Week mode for a single week, where a tap picks that week alone', () => {
    const onChange = setup(3, 3);
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(week(5));
    expect(onChange).toHaveBeenCalledWith({ from: 5, to: 5 });
  });
  it('starts in Range mode for a range, where the first tap sets the start and the second the end, in either order', () => {
    const onChange = setup(1, 6);
    expect(screen.getByRole('button', { name: 'Range' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Tap the first week')).toBeInTheDocument();
    fireEvent.click(week(5));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Tap the last week')).toBeInTheDocument();
    fireEvent.click(week(2));
    expect(onChange).toHaveBeenCalledWith({ from: 2, to: 5 });
  });
  it('switches to Week mode on the last week of the range', () => {
    const onChange = setup(2, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(onChange).toHaveBeenCalledWith({ from: 5, to: 5 });
  });
  it('has Season and Last 4 shortcuts, pressed when they match', () => {
    const onChange = setup(3, 6);
    expect(screen.getByRole('button', { name: 'Last 4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Season' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Season' }));
    expect(onChange).toHaveBeenCalledWith({ from: 1, to: 6 });
  });
});
