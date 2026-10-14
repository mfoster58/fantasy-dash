import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { AllTimeRow, History } from '@fantasy-dash/core';
import AllTimeTable from './AllTimeTable';

const row = (userId: string, rank: number, extra: Partial<AllTimeRow> = {}): AllTimeRow => ({
  userId, rank, seasons: 3, w: 20, l: 10, t: 0, winPct: 0.6667, pf: 4000.5, pa: 3800, ppg: 133.4, maxPoints: 4400,
  efficiency: 0.9092, streak: 'W2', allPlay: { w: 180, l: 90, t: 0, pct: 0.6667 }, weeklyHighs: 5,
  titles: 1, runnerUps: 0, thirds: 2, playoffApps: 3, playoffWins: 4, toiletBowls: 0, ...extra,
});
const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2023, 2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024] },
};

describe('AllTimeTable', () => {
  it('renders career columns, honors and links each manager to head-to-head', () => {
    render(<MemoryRouter><AllTimeTable rows={[row('a', 1), row('b', 2, { seasons: 1, titles: 0, toiletBowls: 1, streak: 'L3' })]} managers={managers} /></MemoryRouter>);
    const rows = screen.getAllByTestId('alltime-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('alice');
    expect(rows[0]).toHaveTextContent('.667');
    expect(rows[0]).toHaveTextContent('90.9%');
    expect(rows[0]).toHaveTextContent('180-90');
    expect(rows[1]).toHaveTextContent('L3');
    expect(screen.getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/h2h?a=a');
    expect(screen.getByText('Titles')).toHaveAttribute('title', expect.stringContaining('Championships'));
  });
});
