import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import AllTimeRecords from './AllTimeRecords';
import type { AllTimeRecords as Records } from '../lib/allTimeRecords';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: 'av-a', seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: 'av-b', seasons: [2024, 2025] },
};

const records: Records = {
  highScores: [{ gameId: '2025-16-3', year: 2025, week: 16, tag: 'Final', userId: 'a', points: 180.4, opponent: 'b', oppPoints: 80 }],
  lowScores: [{ gameId: '2025-16-3', year: 2025, week: 16, tag: 'Final', userId: 'b', points: 80, opponent: 'a', oppPoints: 180.4 }],
  closest: [{ gameId: '2024-1-2', year: 2024, week: 1, tag: null, high: { userId: 'a', points: 90 }, low: { userId: 'b', points: 90 }, margin: 0 }],
  blowouts: [{ gameId: '2025-16-3', year: 2025, week: 16, tag: 'Final', high: { userId: 'a', points: 180.4 }, low: { userId: 'b', points: 80 }, margin: 100.4 }],
};

describe('AllTimeRecords', () => {
  it('shows each list and links every row to its box score', () => {
    render(<MemoryRouter><AllTimeRecords records={records} managers={managers} /></MemoryRouter>);

    const high = screen.getByTestId('records-highScores');
    expect(within(high).getByText('High scores')).toBeInTheDocument();
    const highRow = within(high).getByRole('link');
    expect(highRow).toHaveAttribute('href', '/scores/2025/16/3');
    expect(highRow).toHaveTextContent('alice');
    expect(highRow).toHaveTextContent('180.40');
    expect(highRow).toHaveTextContent('vs bob');
    expect(highRow).toHaveTextContent('2025 · Wk 16 · Championship');

    const low = screen.getByTestId('records-lowScores');
    expect(within(low).getByText('Low scores')).toBeInTheDocument();
    expect(within(low).getByRole('link')).toHaveTextContent('bob');

    const closest = screen.getByTestId('records-closest');
    expect(within(closest).getByText('Closest matchups')).toBeInTheDocument();
    const closeRow = within(closest).getByRole('link');
    expect(closeRow).toHaveAttribute('href', '/scores/2024/1/2');
    expect(closeRow).toHaveTextContent('Tie');
    expect(closeRow).toHaveTextContent('2024 · Wk 1');
    expect(closeRow).not.toHaveTextContent('·  ·');

    const blow = screen.getByTestId('records-blowouts');
    expect(within(blow).getByText('Blowouts')).toBeInTheDocument();
    const blowRow = within(blow).getByRole('link');
    expect(blowRow).toHaveTextContent('alice180.40vs80.00bob');
    expect(blowRow).not.toHaveTextContent('–');
    expect(blowRow).toHaveTextContent('+100.40');
  });

  it('says so when a list is empty', () => {
    const empty: Records = { highScores: [], lowScores: [], closest: [], blowouts: [] };
    render(<MemoryRouter><AllTimeRecords records={empty} managers={managers} /></MemoryRouter>);
    expect(screen.getAllByText('No games yet.')).toHaveLength(4);
  });
});
