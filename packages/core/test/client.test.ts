import { describe, it, expect, vi } from 'vitest';
import { SleeperClient } from '../src/sleeper/client';

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('SleeperClient', () => {
  it('builds v1 URLs and parses JSON', async () => {
    const fetchFn = vi.fn(async () => response(200, { league_id: 'x' }));
    const client = new SleeperClient({ fetchFn, minIntervalMs: 0 });
    const league = await client.getLeague('x');
    expect(league).toEqual({ league_id: 'x' });
    expect(fetchFn).toHaveBeenCalledWith('https://api.sleeper.app/v1/league/x');
  });

  it('returns null on 404', async () => {
    const client = new SleeperClient({ fetchFn: vi.fn(async () => response(404, null)), minIntervalMs: 0 });
    expect(await client.getMatchups('x', 3)).toBeNull();
  });

  it('retries failed requests with backoff', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(response(500, null))
      .mockRejectedValueOnce(new Error('socket'))
      .mockResolvedValueOnce(response(200, [1]));
    const client = new SleeperClient({ fetchFn, minIntervalMs: 0, retries: 3, backoffMs: 1 });
    expect(await client.getUsers('x')).toEqual([1]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('gives up after the configured retries', async () => {
    const fetchFn = vi.fn(async () => response(500, null));
    const client = new SleeperClient({ fetchFn, minIntervalMs: 0, retries: 1, backoffMs: 1 });
    await expect(client.getRosters('x')).rejects.toThrow(/HTTP 500/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throttles consecutive requests', async () => {
    const fetchFn = vi.fn(async () => response(200, {}));
    const client = new SleeperClient({ fetchFn, minIntervalMs: 40 });
    const start = Date.now();
    await client.getLeague('a');
    await client.getLeague('b');
    await client.getLeague('c');
    expect(Date.now() - start).toBeGreaterThanOrEqual(75);
  });

  it('throttles concurrent requests too', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) => response(200, {}));
    const client = new SleeperClient({ fetchFn, minIntervalMs: 40 });
    const start = Date.now();
    await Promise.all([client.getLeague('a'), client.getLeague('b'), client.getLeague('c')]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(75);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('uses the stats and projections paths', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) => response(200, {}));
    const client = new SleeperClient({ fetchFn, minIntervalMs: 0 });
    await client.getProjections('2025', 3);
    await client.getStats('2025', 3);
    await client.getPlayers();
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual([
      'https://api.sleeper.app/v1/projections/nfl/regular/2025/3',
      'https://api.sleeper.app/v1/stats/nfl/regular/2025/3',
      'https://api.sleeper.app/v1/players/nfl',
    ]);
  });
});
