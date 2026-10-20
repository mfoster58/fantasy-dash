import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import { game, line, season, side, week } from '../test/playerFixtures';
import { LiveProvider } from '../lib/live/LiveProvider';
import ScoreTicker from './ScoreTicker';

function current(): Season {
  const a = side('a', 0, [line('q1', 0)]); a.projected = 120.5; a.recordBefore = { w: 4, l: 2, t: 0 };
  const b = side('b', 0, [line('r1', 0)]); b.projected = 110; b.recordBefore = { w: 3, l: 3, t: 0 };
  const w = week(7, [game(2026, 7, 1, a, b)]); w.played = false;
  // week 6 is the only scored week before it
  const done = week(6, [game(2026, 6, 1, side('a', 101.5, [line('q1', 101.5)]), side('b', 99, [line('r1', 99)]))]);
  const s = season(2026, [...Array.from({ length: 5 }, (_, i) => week(i + 1, [])), done, w], null, 6);
  s.status = 'in_season';
  s.leagueId = 'L1';
  s.playerTeams = { q1: 'KC', r1: 'SF' };
  s.managers = {
    a: { userId: 'a', displayName: 'alice', teamName: 'Team Alice', avatar: null, rosterId: 1 },
    b: { userId: 'b', displayName: 'bob', teamName: 'Team Bob', avatar: null, rosterId: 2 },
  };
  return s;
}
const res = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
function fetcher(state: 'in' | 'post' | 'none') {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/state/nfl')) return state === 'none' ? res({ season: '2026', season_type: 'off', week: 7 }) : res({ season: '2026', season_type: 'regular', week: 7 });
    if (url.includes('/matchups/')) return res([
      { roster_id: 1, matchup_id: 1, points: 64.2, custom_points: null, starters: ['q1'], players: ['q1'], players_points: { q1: 64.2 } },
      { roster_id: 2, matchup_id: 1, points: 70.1, custom_points: null, starters: ['r1'], players: ['r1'], players_points: { r1: 70.1 } },
    ]);
    return res({ events: [
      { date: '2026-10-25T17:00Z', status: { period: 3, displayClock: '2:00', type: { state, name: '' } }, competitions: [{ competitors: [{ team: { abbreviation: 'KC' } }, { team: { abbreviation: 'BUF' } }] }] },
      { date: '2026-10-25T17:00Z', status: { period: 3, displayClock: '2:00', type: { state, name: '' } }, competitions: [{ competitors: [{ team: { abbreviation: 'SF' } }, { team: { abbreviation: 'SEA' } }] }] },
    ] });
  });
}
async function show(s: Season, f: ReturnType<typeof fetcher>) {
  render(<MemoryRouter><LiveProvider load={async () => s} fetcher={f} now={() => Date.parse('2026-10-25T18:00Z')}><ScoreTicker /></LiveProvider></MemoryRouter>);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

describe('ScoreTicker', () => {
  beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the live week\'s matchups with live scores, the leader in bold, linking to the box score', async () => {
    await show(current(), fetcher('in'));
    const bar = screen.getByRole('region', { name: 'Scores' });
    expect(bar).toHaveTextContent('2026');
    expect(bar).toHaveTextContent('Week 7');
    expect(within(bar).getByText('LIVE')).toBeInTheDocument();
    const card = within(bar).getByRole('link', { name: /Team Alice vs Team Bob/ });
    expect(card).toHaveAttribute('href', '/scores/2026/7/1');
    expect(card).toHaveTextContent('4-2');
    expect(card).toHaveTextContent('Live');
    expect(within(card).getByText('70.10')).toHaveClass('font-semibold');
    expect(within(card).getByText('64.20')).not.toHaveClass('font-semibold');
  });

  it('marks a matchup FINAL once every starter\'s game is over', async () => {
    await show(current(), fetcher('post'));
    expect(screen.getByRole('link', { name: /Team Alice vs Team Bob/ })).toHaveTextContent('Final');
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('shows the synced projections, without LIVE, when nothing is live', async () => {
    await show(current(), fetcher('none'));
    const card = screen.getByRole('link', { name: /Team Alice vs Team Bob/ });
    expect(card).toHaveTextContent('120.50');
    expect(card).toHaveTextContent('Projected');
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('steps back and forth through the weeks with matchups, showing finals for a past week', async () => {
    await show(current(), fetcher('in'));
    const prev = screen.getByRole('button', { name: 'Previous week' });
    const next = screen.getByRole('button', { name: 'Next week' });
    expect(next).toBeDisabled();
    fireEvent.click(prev);
    const bar = screen.getByRole('region', { name: 'Scores' });
    expect(bar).toHaveTextContent('Week 6');
    expect(within(bar).queryByText('LIVE')).not.toBeInTheDocument();
    const card = within(bar).getByRole('link', { name: /Team Alice vs Team Bob/ });
    expect(card).toHaveAttribute('href', '/scores/2026/6/1');
    expect(card).toHaveTextContent('Final');
    expect(within(card).getByText('101.50')).toHaveClass('font-semibold');
    expect(prev).toBeDisabled();
    fireEvent.click(next);
    expect(bar).toHaveTextContent('Week 7');
    expect(within(bar).getByText('70.10')).toBeInTheDocument();
  });

  it('names a playoff round on its card', async () => {
    const s = current();
    s.weeks[6].games[0].tag = 'Final';
    await show(s, fetcher('none'));
    expect(screen.getByRole('link', { name: /Team Alice vs Team Bob/ })).toHaveTextContent('Championship');
  });

  it('is hidden once the season is complete', async () => {
    const s = current(); s.status = 'complete';
    await show(s, fetcher('none'));
    expect(screen.queryByRole('region', { name: 'Scores' })).not.toBeInTheDocument();
  });
});
