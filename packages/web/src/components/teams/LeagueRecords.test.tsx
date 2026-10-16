import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import LeagueRecords from './LeagueRecords';
import type { ManagerRecord } from '../../lib/managerRecords';

const rec = (boardId: string, sub: string, subTitle: string, rank: number): ManagerRecord => ({ sub, subTitle, boardId, title: boardId, rank, valueLabel: '31', meta: '2023–2026', detail: null });

describe('LeagueRecords', () => {
  it('groups by sub-tab, counts the records, gilds rank one and links each row to its board', () => {
    render(<MemoryRouter><LeagueRecords records={[rec('wins', 'malltime', 'All-time', 1), rec('pts', 'malltime', 'All-time', 2), rec('streak', 'mstreaks', 'Streaks', 3)]} /></MemoryRouter>);
    expect(screen.getByText('1 league record · 3 top-three placings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All-time' })).toBeInTheDocument();
    const gold = screen.getByText('wins').closest('a')!;
    expect(gold).toHaveAttribute('data-rank', '1');
    expect(gold).toHaveAttribute('href', '/records?tab=managers&sub=malltime');
    expect(screen.getByText('streak').closest('a')).toHaveAttribute('data-rank', '3');
  });

  it('says so when the manager holds nothing', () => {
    render(<MemoryRouter><LeagueRecords records={[]} /></MemoryRouter>);
    expect(screen.getByText('No top-three placings yet.')).toBeInTheDocument();
  });
});
