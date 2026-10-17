import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
import type { GameSide, Manager } from '@fantasy-dash/core';
import FormBlock from './FormBlock';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
};
const side = (userId: string, points: number, projected: number, seasonPpg: number, missing: number): GameSide => ({
  userId, points, projected, ceiling: points, efficiency: 1,
  starters: [
    { slot: 'QB', player: { playerId: 'q', points: 10, projected: 12, stats: {} } },
    ...Array.from({ length: missing }, (_, i) => ({ slot: 'RB', player: { playerId: `r${i}`, points: 5, projected: null, stats: {} } })),
  ],
  bench: [], optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg,
});

describe('FormBlock', () => {
  it('shows signed differences against projection and season PPG', () => {
    render(<FormBlock sides={[side('a', 120, 110.5, 100, 0), side('b', 90, 100, 95.25, 2)]} managers={managers} />);
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByText('+9.5')).toBeInTheDocument();
    expect(screen.getByText('+20.0')).toBeInTheDocument();
    expect(screen.getByText('-10.0')).toBeInTheDocument();
    expect(screen.getByText('-5.3')).toBeInTheDocument();
  });
  it('shows points as a share of each baseline for the first team', () => {
    render(<FormBlock sides={[side('a', 120, 110.5, 100, 0), side('b', 90, 100, 95.25, 2)]} managers={managers} />);
    expect(screen.getByText(`${Math.round((120 / 110.5) * 100)}%`)).toBeInTheDocument(); // 109%
    expect(screen.getByText(`${Math.round((120 / 100) * 100)}%`)).toBeInTheDocument(); // 120%
  });
  it('flags starters without a projection', () => {
    render(<FormBlock sides={[side('a', 120, 110.5, 100, 0), side('b', 90, 100, 95.25, 2)]} managers={managers} />);
    expect(screen.getByText('2 starters had no projection.')).toBeInTheDocument();
    expect(screen.queryByText(/1 starter had/)).not.toBeInTheDocument();
  });
});
