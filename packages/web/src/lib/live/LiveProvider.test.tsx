import { act, render, screen } from '@testing-library/react';
import type { Season } from '@fantasy-dash/core';
import { game, season, side, week } from '../../test/playerFixtures';
import { LiveProvider, useLive, useLiveStats } from './LiveProvider';

const SEASON: Season = (() => {
  const s = season(2026, [week(1, [game(2026, 1, 1, side('a', 0, []), side('b', 0, []))])]);
  s.leagueId = 'L1';
  s.status = 'in_season';
  return s;
})();
const espn = (state: string, date = '2026-10-25T17:00Z') => ({ events: [{ date, status: { period: 2, displayClock: '3:00', type: { state, name: '' } }, competitions: [{ competitors: [{ team: { abbreviation: 'KC' } }, { team: { abbreviation: 'BUF' } }] }] }] });

/** a fetch that answers by URL; `fail` makes the named source fail */
function fakeFetch(opts: { state?: string; fail?: ('sleeper' | 'espn')[] } = {}) {
  return vi.fn(async (url: string) => {
    const bad = (opts.fail ?? []).some((f) => (f === 'espn' ? url.includes('espn') : url.includes('sleeper')));
    if (bad) return { ok: false, status: 500, json: async () => ({}) } as Response;
    const body = url.endsWith('/state/nfl') ? { season: '2026', season_type: 'regular', week: 1 }
      : url.includes('/matchups/') ? [{ roster_id: 1, matchup_id: 1, points: 12.5, custom_points: null, starters: [], players: [], players_points: {} }]
        : url.includes('/stats/') ? { p1: { pass_yd: 100 } }
          : espn(opts.state ?? 'in');
    return { ok: true, status: 200, json: async () => body } as Response;
  });
}

function Probe({ stats = false }: { stats?: boolean }) {
  const live = useLive();
  useLiveStats(stats);
  return <div data-testid="probe">{JSON.stringify({ week: live.week, pts: live.matchups?.[0]?.points ?? null, games: live.games?.length ?? null, stats: !!live.stats, polling: live.polling })}</div>;
}
const read = () => JSON.parse(screen.getByTestId('probe').textContent!);
const calls = (f: ReturnType<typeof fakeFetch>, part: string) => f.mock.calls.filter(([u]) => String(u).includes(part)).length;
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const minute = () => act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
const setVisible = (v: 'visible' | 'hidden') => act(async () => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
});

function mount(fetcher: ReturnType<typeof fakeFetch>, now = Date.parse('2026-10-25T18:00Z'), stats = false) {
  return render(<LiveProvider load={async () => SEASON} fetcher={fetcher} now={() => now}><Probe stats={stats} /></LiveProvider>);
}

describe('LiveProvider', () => {
  beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('fetches once at load and stops when no game is on', async () => {
    const f = fakeFetch({ state: 'post' });
    mount(f);
    await flush();
    expect(read()).toEqual({ week: 1, pts: 12.5, games: 1, stats: false, polling: false });
    await minute();
    expect(calls(f, '/matchups/')).toBe(1);
    expect(calls(f, 'espn.com')).toBe(1);
    expect(f.mock.calls.find(([u]) => String(u).includes('espn'))![0]).toContain('dates=2026&seasontype=2&week=1');
  });

  it('polls every minute while a game is on', async () => {
    const f = fakeFetch({ state: 'in' });
    mount(f);
    await flush();
    expect(read().polling).toBe(true);
    await minute();
    await minute();
    expect(calls(f, '/matchups/')).toBe(3);
  });

  it('polls from 15 minutes before a kickoff', async () => {
    const f = fakeFetch({ state: 'pre' });
    mount(f, Date.parse('2026-10-25T16:50Z'));
    await flush();
    expect(read().polling).toBe(true);
  });

  it('stops while the tab is hidden and refreshes as soon as it is visible again', async () => {
    const f = fakeFetch({ state: 'in' });
    mount(f);
    await flush();
    await setVisible('hidden');
    expect(read().polling).toBe(false);
    await minute();
    expect(calls(f, '/matchups/')).toBe(1);
    await setVisible('visible');
    expect(calls(f, '/matchups/')).toBe(2);
    expect(read().polling).toBe(true);
  });

  it('falls back to the game windows when ESPN fails', async () => {
    const f = fakeFetch({ fail: ['espn'] });
    mount(f, Date.parse('2026-10-23T00:30Z')); // Thursday 8:30pm ET
    await flush();
    expect(read()).toMatchObject({ pts: 12.5, games: null, polling: true });
    const off = fakeFetch({ fail: ['espn'] });
    mount(off, Date.parse('2026-10-21T18:00Z')); // Wednesday
    await flush();
    expect(calls(off, '/matchups/')).toBe(1);
    await minute();
    expect(calls(off, '/matchups/')).toBe(1);
  });

  it('keeps the last good data through a failure and stops after three in a row', async () => {
    let n = 0;
    const good = fakeFetch({ state: 'in' });
    const bad = fakeFetch({ fail: ['sleeper'] });
    const f = vi.fn(async (u: string) => (n++ < 3 ? good(u) : bad(u))); // first tick ok (3 requests), then Sleeper fails
    mount(f as unknown as ReturnType<typeof fakeFetch>);
    await flush();
    expect(read().pts).toBe(12.5);
    await minute(); await minute(); await minute();
    expect(read()).toMatchObject({ pts: 12.5, polling: false });
    const stateCalls = calls(f as unknown as ReturnType<typeof fakeFetch>, '/state/nfl');
    await minute();
    expect(calls(f as unknown as ReturnType<typeof fakeFetch>, '/state/nfl')).toBe(stateCalls);
  });

  it('fetches live stats only while a box score asks for them, even when it asks mid-load', async () => {
    const f = fakeFetch({ state: 'post' });
    mount(f, undefined, true);
    await flush();
    await flush();
    expect(calls(f, '/stats/nfl/regular/2026/1')).toBe(1);
    expect(read().stats).toBe(true);
    const g = fakeFetch({ state: 'post' });
    mount(g);
    await flush();
    expect(calls(g, '/stats/')).toBe(0);
  });

  it('goes live for nothing when Sleeper\'s week is not in the synced season', async () => {
    const f = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (url.endsWith('/state/nfl') ? { season: '2026', season_type: 'regular', week: 9 } : {}) }) as Response);
    mount(f as unknown as ReturnType<typeof fakeFetch>);
    await flush();
    expect(read()).toMatchObject({ week: null, pts: null, polling: false });
    expect(calls(f as unknown as ReturnType<typeof fakeFetch>, '/matchups/')).toBe(0);
  });
});
