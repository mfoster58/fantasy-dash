import { fireEvent, render, screen, within } from '@testing-library/react';
import StatTable from './StatTable';
import { managerRefs } from '../../lib/stats/scope';
import { statTable } from '../../lib/stats/table';
import { league, season2025 } from '../../test/statsFixtures';

const refs = managerRefs(league());
const names = () => screen.getAllByRole('row').slice(2).map((r) => within(r).getAllByRole('rowheader')[0].querySelector('span.truncate')!.textContent);

describe('StatTable', () => {
  it('starts sorted by points per game, with group headers and a sticky manager column', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    expect(names()).toEqual(['bob', 'alice', 'cara', 'dan']);
    expect(screen.getByRole('columnheader', { name: /^PPG/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByText('Scoring')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Yrs/ })).toBeNull();
    expect(screen.getAllByRole('rowheader')[0].className).toContain('sticky');
  });
  it('sorts a lower-is-better column ascending first, then flips', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    fireEvent.click(screen.getByRole('button', { name: /^PA\/G/ }));
    expect(names()).toEqual(['alice', 'dan', 'bob', 'cara']);
    expect(screen.getByRole('columnheader', { name: /^PA\/G/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: /^PA\/G/ }));
    expect(names()).toEqual(['cara', 'bob', 'dan', 'alice']);
  });
  it('shows the seasons column in all-time and tints the pinned manager\'s row', () => {
    render(<StatTable rows={statTable(league())} refs={refs} pin="c" allTime />);
    expect(screen.getByRole('columnheader', { name: /Yrs/ })).toBeInTheDocument();
    const cara = screen.getAllByRole('row').find((r) => r.textContent?.includes('cara'))!;
    expect(cara).toHaveAttribute('data-pinned', 'true');
    expect(within(cara).getAllByRole('cell')[0]).toHaveTextContent('2');
  });
  it('explains every column in its header title', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    expect(screen.getByRole('button', { name: 'xW' })).toHaveAttribute('title', 'Expected wins: all-play win rate × games played');
  });
});
