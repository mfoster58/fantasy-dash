import { render, screen } from '@testing-library/react';
import Dumbbell from './Dumbbell';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());
const rows = [
  { id: 'a', from: 3, to: 4, label: '+1', tone: 'win' as const, fromTitle: '3 wins against the median', toTitle: '4 real wins' },
  { id: 'c', from: 2, to: 1, label: '-1', tone: 'loss' as const, fromTitle: '2 against the median', toTitle: '1 real win' },
];

describe('Dumbbell', () => {
  it('draws one row per manager with both dots titled, the label, and the tone', () => {
    render(<Dumbbell rows={rows} domain={[0, 4]} ticks={[0, 2, 4]} refs={refs} pin="c" ariaLabel="Schedule luck" />);
    const list = screen.getByRole('list', { name: 'Schedule luck' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTitle('4 real wins')).toBeInTheDocument();
    expect(screen.getByTitle('3 wins against the median')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(list.querySelector('li')).toHaveAttribute('data-tone', 'win');
    expect(list.querySelectorAll('li')[1]).toHaveAttribute('data-pinned', 'true');
    expect(list.querySelector('li')).toHaveAttribute('data-dim', 'true');
    expect(screen.getAllByText(/^[024]$/)).toHaveLength(3);
  });
});
