import type {
  SleeperBracketGame, SleeperLeague, SleeperMatchup, SleeperPlayer, SleeperRoster, SleeperUser, StatMap,
} from './types';

const BASE = 'https://api.sleeper.app/v1';

export interface SleeperClientOptions {
  fetchFn?: typeof fetch;
  /** minimum gap between requests; Sleeper allows ~1000/min, default 120ms */
  minIntervalMs?: number;
  /** retries after the first attempt, default 3 */
  retries?: number;
  /** base backoff, doubled per attempt, default 500ms */
  backoffMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SleeperClient {
  private lastRequestAt = 0;
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;

  constructor(opts: SleeperClientOptions = {}) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.minIntervalMs = opts.minIntervalMs ?? 120;
    this.retries = opts.retries ?? 3;
    this.backoffMs = opts.backoffMs ?? 500;
  }

  private async get<T>(path: string): Promise<T | null> {
    const url = `${BASE}${path}`;
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      try {
        const res = await this.fetchFn(url);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
        return (await res.json()) as T;
      } catch (err) {
        if (attempt >= this.retries) throw err;
        await sleep(this.backoffMs * 2 ** attempt);
      }
    }
  }

  getLeague(id: string) { return this.get<SleeperLeague>(`/league/${id}`); }
  getUsers(id: string) { return this.get<SleeperUser[]>(`/league/${id}/users`); }
  getRosters(id: string) { return this.get<SleeperRoster[]>(`/league/${id}/rosters`); }
  getMatchups(id: string, week: number) { return this.get<SleeperMatchup[]>(`/league/${id}/matchups/${week}`); }
  getWinnersBracket(id: string) { return this.get<SleeperBracketGame[]>(`/league/${id}/winners_bracket`); }
  getLosersBracket(id: string) { return this.get<SleeperBracketGame[]>(`/league/${id}/losers_bracket`); }
  getPlayers() { return this.get<Record<string, SleeperPlayer>>(`/players/nfl`); }
  getProjections(season: string, week: number) { return this.get<StatMap>(`/projections/nfl/regular/${season}/${week}`); }
  getStats(season: string, week: number) { return this.get<StatMap>(`/stats/nfl/regular/${season}/${week}`); }
}
