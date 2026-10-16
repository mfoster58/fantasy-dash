import type {
  SleeperBracketGame, SleeperDraft, SleeperDraftPick, SleeperLeague, SleeperMatchup, SleeperPlayer, SleeperRoster, SleeperTransaction, SleeperUser, SleeperWeekStat, StatMap,
} from './types';

const BASE = 'https://api.sleeper.app/v1';
/** Sleeper's newer stats host; its weekly rows carry the player's team for that week, which the v1 stat map lacks. */
const STATS_BASE = 'https://api.sleeper.com';

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

  private async get<T>(path: string, base = BASE): Promise<T | null> {
    const url = `${base}${path}`;
    for (let attempt = 0; ; attempt++) {
      const at = Math.max(Date.now(), this.lastRequestAt + this.minIntervalMs);
      this.lastRequestAt = at;
      const wait = at - Date.now();
      if (wait > 0) await sleep(wait);
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
  getDrafts(leagueId: string) { return this.get<SleeperDraft[]>(`/league/${leagueId}/drafts`); }
  getDraftPicks(draftId: string) { return this.get<SleeperDraftPick[]>(`/draft/${draftId}/picks`); }
  getTransactions(leagueId: string, week: number) { return this.get<SleeperTransaction[]>(`/league/${leagueId}/transactions/${week}`); }
  getPlayers() { return this.get<Record<string, SleeperPlayer>>(`/players/nfl`); }
  getProjections(season: string, week: number) { return this.get<StatMap>(`/projections/nfl/regular/${season}/${week}`); }
  getStats(season: string, week: number) { return this.get<StatMap>(`/stats/nfl/regular/${season}/${week}`); }
  /** Every NFL player's stat row for the week, with the team they played for that week. */
  getWeekStats(season: string, week: number) { return this.get<SleeperWeekStat[]>(`/stats/nfl/${season}/${week}?season_type=regular`, STATS_BASE); }
}
