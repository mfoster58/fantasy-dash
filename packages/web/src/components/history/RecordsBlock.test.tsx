import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Manager } from '@fantasy-dash/core';
import RecordsBlock from './RecordsBlock';
import type { SeasonRecord } from '../../lib/records';

const managers: Record<string, Manager> = { a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 } };
const records: SeasonRecord[] = [{ key: 'pf', label: 'Most points', value: '1,900.5', userId: 'a', definition: 'Regular season points for' } as SeasonRecord];

describe('RecordsBlock', () => {
  it('names the record holder as a link to the career page', () => {
    render(<MemoryRouter><RecordsBlock records={records} managers={managers} /></MemoryRouter>);
    expect(screen.getByText('Most points')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
  });
});
