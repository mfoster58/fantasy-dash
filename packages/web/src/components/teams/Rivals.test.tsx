import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import Rivals from './Rivals';
import type { Rivalry } from '../../lib/teamProfile';

const managers: History['managers'] = { b: { displayName: 'bob', avatar: null, seasons: [] }, c: { displayName: 'cara', avatar: null, seasons: [] }, d: { displayName: 'dan', avatar: null, seasons: [] } };
const r = (opponentId: string, w: number, l: number, streak: number): Rivalry => ({ opponentId, w, l, t: 0, pf: 500, pa: 450, games: w + l, winPct: (w) / (w + l), streak });

describe('Rivals', () => {
  it('colours winning records green, losing red, level muted, with streak and head-to-head links', () => {
    render(<MemoryRouter><Rivals rivalries={[r('b', 3, 1, 2), r('c', 1, 1, -1), r('d', 0, 2, -2)]} managers={managers} userId="a" /></MemoryRouter>);
    const series = screen.getAllByRole('link', { name: /series/i });
    expect(series.map((l) => l.getAttribute('href'))).toEqual(['/h2h?a=a&b=b', '/h2h?a=a&b=c', '/h2h?a=a&b=d']);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'win');
    expect(rows[0]).toHaveTextContent('W2');
    expect(rows[1].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'even');
    expect(rows[2].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'loss');
    expect(rows[2]).toHaveTextContent('L2');
    expect(rows[2]).toHaveTextContent('.000');
  });

  it('links each rival\'s name to the career page, above the row\'s series link', () => {
    render(<MemoryRouter><Rivals rivalries={[r('b', 3, 1, 2)]} managers={managers} userId="a" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'bob' })).toHaveAttribute('href', '/managers/b');
    expect(screen.getByRole('link', { name: 'Series against bob' })).toHaveAttribute('href', '/h2h?a=a&b=b');
  });
});
