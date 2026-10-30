import { act, renderHook } from '@testing-library/react';
import cleTen from '../../test/fixtures/espn/401873013.json';
import { clearFinishedFeeds, FEED_POLL_MS, useGameFeeds, type FeedGame } from './useGameFeeds';

/** a summary for any event id, from the real Browns-Titans game */
const summary = (id: string) => ({ ...cleTen, header: { ...cleTen.header, id } });
function fakeFetch(fail: string[] = []) {
  return vi.fn(async (url: string) => {
    const id = new URL(url).searchParams.get('event')!;
    if (fail.includes(id)) return { ok: false, status: 500, json: async () => ({}) } as Response;
    return { ok: true, status: 200, json: async () => summary(id) } as Response;
  });
}
const calls = (f: ReturnType<typeof fakeFetch>, id: string) => f.mock.calls.filter(([u]) => String(u).endsWith(`event=${id}`)).length;
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const setVisible = (v: 'visible' | 'hidden') => act(async () => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
});
const mount = (games: FeedGame[], fetcher: ReturnType<typeof fakeFetch>) =>
  renderHook(({ g }) => useGameFeeds(g, { fetcher }), { initialProps: { g: games } });

describe('useGameFeeds', () => {
  beforeEach(() => { vi.useFakeTimers(); clearFinishedFeeds(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('reads each game that is on or over once at first, and none before kickoff', async () => {
    const f = fakeFetch();
    const { result } = mount([{ id: '1', state: 'in' }, { id: '2', state: 'post' }, { id: '3', state: 'pre' }], f);
    await flush();
    expect(Object.keys(result.current).sort()).toEqual(['1', '2']);
    expect(result.current['1'].plays.length).toBeGreaterThan(100);
    expect(calls(f, '3')).toBe(0);
  });

  it('checks the games on every 10 seconds, and never again for a finished one', async () => {
    expect(FEED_POLL_MS).toBe(10_000);
    const f = fakeFetch();
    mount([{ id: '1', state: 'in' }, { id: '2', state: 'post' }], f);
    await flush();
    await wait(FEED_POLL_MS * 3);
    expect(calls(f, '1')).toBe(4);
    expect(calls(f, '2')).toBe(1);
  });

  it('stops checking while the tab is hidden and catches up the moment it is back', async () => {
    const f = fakeFetch();
    mount([{ id: '1', state: 'in' }], f);
    await flush();
    await setVisible('hidden');
    await wait(FEED_POLL_MS * 3);
    expect(calls(f, '1')).toBe(1);
    await setVisible('visible');
    expect(calls(f, '1')).toBe(2);
    await wait(FEED_POLL_MS);
    expect(calls(f, '1')).toBe(3);
  });

  it('keeps the last good read of a game when a check fails', async () => {
    let fail: string[] = [];
    const f = vi.fn(async (url: string) => fakeFetch(fail)(url));
    const { result } = renderHook(() => useGameFeeds([{ id: '1', state: 'in' }], { fetcher: f }));
    await flush();
    const before = result.current['1'];
    fail = ['1'];
    await wait(FEED_POLL_MS);
    expect(result.current['1']).toBe(before);
  });

  it('reads a game once more when it goes final, then remembers it for the rest of the visit', async () => {
    const f = fakeFetch();
    const { rerender, unmount } = mount([{ id: '1', state: 'in' }], f);
    await flush();
    rerender({ g: [{ id: '1', state: 'post' }] });
    await flush();
    expect(calls(f, '1')).toBe(2);
    await wait(FEED_POLL_MS * 2);
    expect(calls(f, '1')).toBe(2);
    unmount();
    const again = mount([{ id: '1', state: 'post' }], f);
    await flush();
    expect(calls(f, '1')).toBe(2);
    expect(again.result.current['1']).toBeDefined();
  });

  it('stops when the page is left', async () => {
    const f = fakeFetch();
    const { unmount } = mount([{ id: '1', state: 'in' }], f);
    await flush();
    unmount();
    await wait(FEED_POLL_MS * 3);
    expect(calls(f, '1')).toBe(1);
  });
});
