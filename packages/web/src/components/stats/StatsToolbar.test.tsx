import { fireEvent, render, screen } from '@testing-library/react';
import StatsToolbar from './StatsToolbar';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());

describe('StatsToolbar', () => {
  it('offers every season plus all-time, and a pill per manager that pins and unpins', () => {
    const onSeason = vi.fn(), onPin = vi.fn();
    render(<StatsToolbar years={[2024, 2025]} season={2025} onSeason={onSeason} refs={refs} pin="b" onPin={onPin} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(onSeason).toHaveBeenCalledWith('all');
    const pills = screen.getByRole('group', { name: 'Pin a manager' });
    expect(pills.querySelectorAll('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'bob' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'bob' }));
    expect(onPin).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'alice' }));
    expect(onPin).toHaveBeenCalledWith('a');
  });
});
