import { renderHook, waitFor } from '@testing-library/react';
import { useNflWeek } from './useNflWeek';

const board = { events: [{ date: '2026-10-25T17:00Z', status: { period: 4, displayClock: '0:00', type: { state: 'post', name: 'STATUS_FINAL' } },
  competitions: [{ competitors: [{ homeAway: 'home', score: '27', team: { id: '1', abbreviation: 'NYG' } }, { homeAway: 'away', score: '34', team: { id: '2', abbreviation: 'DAL' } }] }] }] };

describe('useNflWeek', () => {
  afterEach(() => vi.unstubAllGlobals());
  it("reads a past week's NFL scoreboard once, and nothing when off", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(board)));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useNflWeek(2026, 5, true));
    await waitFor(() => expect(result.current?.[0].score).toEqual({ NYG: 27, DAL: 34 }));
    renderHook(() => useNflWeek(2026, 5, true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(renderHook(() => useNflWeek(2026, 6, false)).result.current).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
