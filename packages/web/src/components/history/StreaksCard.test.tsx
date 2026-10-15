import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import type { Streak } from '../../lib/streaks';
import StreaksCard from './StreaksCard';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] },
};
const streaks: Streak[] = [
  { userId: 'a', kind: 'W', length: 7, from: { year: 2024, week: 12 }, to: { year: 2025, week: 3 }, active: true },
  { userId: 'b', kind: 'W', length: 4, from: { year: 2023, week: 1 }, to: { year: 2023, week: 4 }, active: false },
];

describe('StreaksCard', () => {
  it('lists streaks with length, span, active marker and manager link', () => {
    render(<MemoryRouter><StreaksCard title="Longest win streaks" streaks={streaks} managers={managers} /></MemoryRouter>);
    expect(screen.getByText('Longest win streaks')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('alice');
    expect(rows[0]).toHaveTextContent('7');
    expect(rows[0]).toHaveTextContent('2024 Wk 12 to 2025 Wk 3');
    expect(within(rows[0]).getByText('active')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/h2h?a=a');
    expect(within(rows[1]).queryByText('active')).toBeNull();
  });
  it('shows an empty state', () => {
    render(<MemoryRouter><StreaksCard title="Longest losing streaks" streaks={[]} managers={managers} /></MemoryRouter>);
    expect(screen.getByText('No streaks yet.')).toBeInTheDocument();
  });
});
