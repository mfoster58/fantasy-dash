# Live Scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During games, the current week's scores refresh live in the browser: a scores ticker on every page, a live Scores page, and box scores with live stat lines, each starter's game state, projected finals and a win % bar.

**Architecture:** Pure helpers in `packages/web/src/lib/live/`:
- parse ESPN's scoreboard into NFL games
- turn a player's NFL team into a game state
- overlay Sleeper's live matchups on the synced `Week`
- compute projected finals and win %
- decide when to poll

A single `LiveProvider` in the layout polls Sleeper and ESPN and hands the result out through `useLive()`. Pages build the live week from it with `liveWeek(...)`, so the existing components render it with small additions.

**Tech Stack:** React 19, react-router 7, Vitest + Testing Library (jsdom, globals on), Tailwind 4, TypeScript. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-live-scores-design.md`

## Global Constraints

- **No server.** The browser calls:
  - `https://api.sleeper.app/v1/state/nfl`
  - `https://api.sleeper.app/v1/league/{leagueId}/matchups/{week}`
  - `https://api.sleeper.app/v1/stats/nfl/regular/{season}/{week}`
  - `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- **Polling:**
  - every 60 seconds, while the tab is visible and a game is in progress or kicks off within 15 minutes
  - otherwise once at page load
- **ESPN-failure windows** (Eastern time):
  - Thursday 20:00–24:00
  - Sunday 09:00–24:00
  - Monday 20:00–24:00
  - Saturday 13:00–24:00 in December
- **Failures:**
  - A failed request keeps the last good live data, or the synced data if there is none.
  - Three failures in a row stop polling until the next page load.
  - No error is shown.
- **Synced data stays as synced:** projections, lineup slots and the game list come from the sync, and a week's `played` flag isn't changed.
- **Win %:**
  - `P(A) = Φ((projA − projB) ÷ σ)`, with `σ² = K × remaining projected points of both teams` and `K = 4.4`
  - shown as whole percents, clamped to 1–99% while anything remains
  - 100/0 to the leader, or 50/50 on a tie, when nothing remains
- **Starter projection by game state:**
  - `live`: `points + projected × fractionLeft`
  - `final` or `bye`: `points`
  - `upcoming`: `projected`
  - `unknown`: `max(points, projected)`
- **Fraction left:**
  - quarters 1–4: `((4 − quarter) × 15 + minutesLeftInQuarter) ÷ 60`
  - overtime, `final` and `bye`: 0
  - `upcoming` and `unknown`: 1
- **Ticker label:** "{season} · Week {n}". It shows "LIVE" with a dot while polling.
- **Box score game-state labels:** "Q3 4:12", "Final", "Sun 1:00 PM", "Bye".
- **Tests never call the network:** every fetch is mocked.

## Rulings made while planning

- **Starters come from Sleeper's live `starters`, not the Tuesday sync.** Managers set lineups after the sync, so the synced starters would be wrong by Sunday. The slots stay the synced `rosterSlots`. Each player's projection comes from the synced roster lines (starters + bench); a player added since the sync has `projected: null`. The spec's rule that a roster with no lineup set keeps the synced starters still holds.
- **Live player points come from `players_points[id]`,** which equals `starters_points` by slot for starters and also covers the bench.
- **The three-failure stop counts Sleeper failures only.** An ESPN failure moves polling onto the fallback windows; counting it would stop polling within three minutes of ESPN going down, making the windows useless.
- **The ESPN scoreboard is fetched for the live week** (`?dates={season}&seasontype=2&week={week}`), not ESPN's default week, which rolls over on its own schedule.

## Review Focus

1. **A lineup changed after the sync.** A starter missing from the synced side must show with live points and `projected: null`, and count only his points toward the projected final. *(Task 3 and Task 2 tests.)*
2. **Halftime, overtime, and a kickoff that slipped past its listed time.**
   - Halftime gives fraction 0.5.
   - Overtime gives 0.
   - A `pre` game whose kickoff has passed keeps polling.
   *(Task 1 and Task 4 tests.)*
3. **Sleeper's week is one the sync doesn't have yet** (Tuesday rollover, or a week with no games). Nothing goes live and the synced data shows. *(Task 3 test.)*
4. **The tab is hidden mid-game and shown again.** Polling stops while hidden and refreshes at once when visible. *(Task 5 test.)*
5. **A box score is opened while the first load is still in flight.** The stats request must not be dropped. *(Task 5 test, the "again" flag.)*

---

## File structure

**Create:**
- `packages/web/src/lib/live/espn.ts`: ESPN scoreboard URL, parser, team-code normalising
- `packages/web/src/lib/live/gameState.ts`: a player's NFL game state, fraction left, labels
- `packages/web/src/lib/live/outlook.ts`: Φ, per-player outlook, a game's projected finals, win % and status
- `packages/web/src/lib/live/overlay.ts`: `liveWeek`, `liveWeekNumber`, `tickerWeek`
- `packages/web/src/lib/live/schedule.ts`: `shouldPoll`, `inFallbackWindow`
- `packages/web/src/lib/live/LiveProvider.tsx`: the poller, `useLive`, `useLiveStats`
- `packages/web/src/components/ScoreTicker.tsx`: the ticker
- `packages/web/src/components/LiveDot.tsx`: the pulsing LIVE label
- `packages/web/src/components/boxscore/LiveOutlook.tsx`: the projection bars and win % bar
- tests next to each file

**Modify:**
- `packages/core/src/season.ts`: export `pickStats`
- `packages/web/src/routes.tsx`: wrap the layout in `LiveProvider`; render `ScoreTicker` above `Nav`
- `packages/web/src/components/ScoreCard.tsx`: optional `live` outlook
- `packages/web/src/components/boxscore/WeekScores.tsx`: optional `live` flag
- `packages/web/src/components/boxscore/LineupTable.tsx`: optional `gameOf` for game-state labels
- `packages/web/src/pages/ScoresPage.tsx`, `packages/web/src/pages/BoxScorePage.tsx`: use the live week

**Test command for a single file:** `pnpm --filter @fantasy-dash/web exec vitest run <path relative to packages/web>`

**Full suite:** `pnpm test`

**Types:** `pnpm typecheck`

---

### Task 1: ESPN games and player game state

**Files:**
- Create: `packages/web/src/lib/live/espn.ts`, `packages/web/src/lib/live/gameState.ts`
- Test: `packages/web/src/lib/live/espn.test.ts`, `packages/web/src/lib/live/gameState.test.ts`

**Interfaces:**
- Produces:
  - `type NflState = 'pre' | 'in' | 'post'`
  - `interface NflGame { teams: [string, string]; state: NflState; period: number; clock: string; kickoff: string; halftime: boolean }`
  - `normTeam(abbr: string): string`
  - `scoreboardUrl(season: number, week: number): string`
  - `parseScoreboard(json: unknown): NflGame[]`
  - `type PlayerGame = { kind: 'live'; period: number; clock: string; halftime: boolean } | { kind: 'final' } | { kind: 'upcoming'; kickoff: string } | { kind: 'bye' } | { kind: 'unknown' }`
  - `gameFor(team: string, games: NflGame[] | null): PlayerGame`
  - `fractionLeft(g: PlayerGame): number`
  - `gameLabel(g: PlayerGame, timeZone?: string): string | null`
  - `playerGames(teamOf: (id: string) => string, games: NflGame[] | null): (id: string) => PlayerGame`

- [ ] **Step 1: Write the failing tests**

`packages/web/src/lib/live/espn.test.ts`:
```ts
import { normTeam, parseScoreboard, scoreboardUrl } from './espn';

const event = (home: string, away: string, state: string, period: number, clock: string, date: string, name = 'STATUS_IN_PROGRESS') => ({
  date,
  status: { period, displayClock: clock, type: { state, name } },
  competitions: [{ competitors: [{ team: { abbreviation: home } }, { team: { abbreviation: away } }] }],
});

describe('ESPN scoreboard', () => {
  it('asks for the given regular-season week', () => {
    expect(scoreboardUrl(2026, 8)).toBe('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=8');
  });
  it('turns ESPN team codes into Sleeper ones', () => {
    expect(normTeam('WSH')).toBe('WAS');
    expect(normTeam('KC')).toBe('KC');
  });
  it('reads each game\'s teams, state, quarter, clock, kickoff and halftime', () => {
    const games = parseScoreboard({ events: [
      event('KC', 'WSH', 'in', 3, '4:12', '2026-10-25T17:00Z'),
      event('SF', 'LAR', 'in', 2, '0:00', '2026-10-25T17:00Z', 'STATUS_HALFTIME'),
      event('BUF', 'MIA', 'pre', 0, '0:00', '2026-10-26T00:20Z', 'STATUS_SCHEDULED'),
    ] });
    expect(games[0]).toEqual({ teams: ['KC', 'WAS'], state: 'in', period: 3, clock: '4:12', kickoff: '2026-10-25T17:00Z', halftime: false });
    expect(games[1].halftime).toBe(true);
    expect(games[2].state).toBe('pre');
  });
  it('gives no games for a body it cannot read', () => {
    expect(parseScoreboard(null)).toEqual([]);
    expect(parseScoreboard({ events: [{ nope: 1 }] })).toEqual([]);
  });
});
```

`packages/web/src/lib/live/gameState.test.ts`:
```ts
import type { NflGame } from './espn';
import { fractionLeft, gameFor, gameLabel, playerGames } from './gameState';

const g = (teams: [string, string], state: NflGame['state'], period = 0, clock = '15:00', halftime = false): NflGame =>
  ({ teams, state, period, clock, kickoff: '2026-10-25T17:00Z', halftime });
const games = [g(['KC', 'WAS'], 'in', 3, '4:12'), g(['SF', 'LAR'], 'post', 4, '0:00'), g(['BUF', 'MIA'], 'pre')];

describe('gameFor', () => {
  it('finds the state of the player\'s NFL game', () => {
    expect(gameFor('WAS', games)).toEqual({ kind: 'live', period: 3, clock: '4:12', halftime: false });
    expect(gameFor('SF', games)).toEqual({ kind: 'final' });
    expect(gameFor('MIA', games)).toEqual({ kind: 'upcoming', kickoff: '2026-10-25T17:00Z' });
  });
  it('is a bye for a team with no game or a player with no team, and unknown without ESPN', () => {
    expect(gameFor('NYJ', games)).toEqual({ kind: 'bye' });
    expect(gameFor('', games)).toEqual({ kind: 'bye' });
    expect(gameFor('KC', null)).toEqual({ kind: 'unknown' });
  });
  it('looks each player\'s team up through playerGames', () => {
    const of = playerGames((id) => (id === 'p1' ? 'KC' : 'SF'), games);
    expect(of('p1').kind).toBe('live');
    expect(of('p2').kind).toBe('final');
  });
});

describe('fractionLeft', () => {
  it('counts the minutes left in regulation', () => {
    expect(fractionLeft({ kind: 'live', period: 3, clock: '4:12', halftime: false })).toBeCloseTo((15 + 4.2) / 60, 6);
    expect(fractionLeft({ kind: 'live', period: 1, clock: '15:00', halftime: false })).toBe(1);
    expect(fractionLeft({ kind: 'live', period: 2, clock: '0:00', halftime: true })).toBe(0.5);
  });
  it('is 0 in overtime, after the game and on a bye; 1 before kickoff or without ESPN', () => {
    expect(fractionLeft({ kind: 'live', period: 5, clock: '8:00', halftime: false })).toBe(0);
    expect(fractionLeft({ kind: 'final' })).toBe(0);
    expect(fractionLeft({ kind: 'bye' })).toBe(0);
    expect(fractionLeft({ kind: 'upcoming', kickoff: '2026-10-25T17:00Z' })).toBe(1);
    expect(fractionLeft({ kind: 'unknown' })).toBe(1);
  });
});

describe('gameLabel', () => {
  it('names the game state the way a box score reads', () => {
    expect(gameLabel({ kind: 'live', period: 3, clock: '4:12', halftime: false })).toBe('Q3 4:12');
    expect(gameLabel({ kind: 'live', period: 2, clock: '0:00', halftime: true })).toBe('Half');
    expect(gameLabel({ kind: 'live', period: 5, clock: '8:00', halftime: false })).toBe('OT 8:00');
    expect(gameLabel({ kind: 'final' })).toBe('Final');
    expect(gameLabel({ kind: 'bye' })).toBe('Bye');
    expect(gameLabel({ kind: 'upcoming', kickoff: '2026-10-25T17:00Z' }, 'America/New_York')).toBe('Sun 1:00 PM');
    expect(gameLabel({ kind: 'unknown' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/espn.test.ts src/lib/live/gameState.test.ts`

Expected: FAIL, because the modules `./espn` and `./gameState` can't be resolved.

- [ ] **Step 3: Implement**

`packages/web/src/lib/live/espn.ts`:
```ts
/** ESPN's public NFL scoreboard: the only feed that says which NFL games are on, in what quarter, with what clock. */
export type NflState = 'pre' | 'in' | 'post';

export interface NflGame {
  /** Sleeper team codes */
  teams: [string, string];
  state: NflState;
  /** 0 before kickoff, 1-4 in regulation, 5+ in overtime */
  period: number;
  /** "4:12" left in the quarter */
  clock: string;
  /** ISO kickoff time */
  kickoff: string;
  halftime: boolean;
}

/** ESPN codes that differ from Sleeper's */
const ESPN_TO_SLEEPER: Record<string, string> = { WSH: 'WAS' };
export const normTeam = (abbr: string): string => ESPN_TO_SLEEPER[abbr] ?? abbr;

export const scoreboardUrl = (season: number, week: number): string =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;

interface EspnEvent {
  date?: string;
  status?: { period?: number; displayClock?: string; type?: { state?: string; name?: string } };
  competitions?: { competitors?: { team?: { abbreviation?: string } }[] }[];
}

export function parseScoreboard(json: unknown): NflGame[] {
  const events = (json as { events?: EspnEvent[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const games: NflGame[] = [];
  for (const e of events) {
    const codes = e.competitions?.[0]?.competitors?.map((c) => c.team?.abbreviation).filter((a): a is string => !!a) ?? [];
    const state = e.status?.type?.state;
    if (codes.length !== 2 || (state !== 'pre' && state !== 'in' && state !== 'post') || !e.date) continue;
    games.push({
      teams: [normTeam(codes[0]), normTeam(codes[1])],
      state,
      period: e.status?.period ?? 0,
      clock: e.status?.displayClock ?? '0:00',
      kickoff: e.date,
      halftime: e.status?.type?.name === 'STATUS_HALFTIME',
    });
  }
  return games;
}
```

`packages/web/src/lib/live/gameState.ts`:
```ts
import type { NflGame } from './espn';

/** Where a player's NFL game stands. `unknown` when ESPN couldn't be read. */
export type PlayerGame =
  | { kind: 'live'; period: number; clock: string; halftime: boolean }
  | { kind: 'final' }
  | { kind: 'upcoming'; kickoff: string }
  | { kind: 'bye' }
  | { kind: 'unknown' };

export function gameFor(team: string, games: NflGame[] | null): PlayerGame {
  if (!games) return { kind: 'unknown' };
  const g = team ? games.find((x) => x.teams.includes(team)) : undefined;
  if (!g) return { kind: 'bye' };
  if (g.state === 'post') return { kind: 'final' };
  if (g.state === 'pre') return { kind: 'upcoming', kickoff: g.kickoff };
  return { kind: 'live', period: g.period, clock: g.clock, halftime: g.halftime };
}

export const playerGames = (teamOf: (id: string) => string, games: NflGame[] | null) =>
  (id: string): PlayerGame => gameFor(teamOf(id), games);

/** "4:12" -> 4.2 minutes; an unreadable clock counts as a full quarter */
function clockMinutes(clock: string): number {
  const m = /^(\d+):(\d{2})/.exec(clock);
  return m ? Number(m[1]) + Number(m[2]) / 60 : 15;
}

/** Share of the player's game still to play: drives how much of his projection is still to come. */
export function fractionLeft(g: PlayerGame): number {
  if (g.kind === 'upcoming' || g.kind === 'unknown') return 1;
  if (g.kind !== 'live' || g.period > 4) return 0;
  const left = ((4 - g.period) * 15 + Math.min(15, clockMinutes(g.clock))) / 60;
  return Math.max(0, Math.min(1, left));
}

/** "Q3 4:12", "Half", "OT 8:00", "Final", "Bye", "Sun 1:00 PM"; null without ESPN */
export function gameLabel(g: PlayerGame, timeZone?: string): string | null {
  switch (g.kind) {
    case 'live': return g.halftime ? 'Half' : g.period > 4 ? `OT ${g.clock}` : `Q${g.period} ${g.clock}`;
    case 'final': return 'Final';
    case 'bye': return 'Bye';
    case 'upcoming':
      return new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(g.kickoff));
    default: return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/espn.test.ts src/lib/live/gameState.test.ts`

Expected: PASS (all tests in both files).

If `Intl` puts a narrow no-break space before "PM" (newer ICU does), replace ` ` with a space in `gameLabel` and rerun.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/live/espn.ts packages/web/src/lib/live/gameState.ts packages/web/src/lib/live/espn.test.ts packages/web/src/lib/live/gameState.test.ts
git commit -m "Live scores: read ESPN's scoreboard into NFL game states"
```

---

### Task 2: Projected finals and win %

**Files:**
- Create: `packages/web/src/lib/live/outlook.ts`
- Test: `packages/web/src/lib/live/outlook.test.ts`

**Interfaces:**
- Consumes (Task 1): `PlayerGame`, `fractionLeft(g)`
- Consumes (core): `Game`, `GameSide`
- Produces:
  - `K = 4.4`
  - `phi(z: number): number`
  - `interface PlayerOutlook { final: number; remaining: number }`
  - `playerOutlook(points: number, projected: number | null, g: PlayerGame): PlayerOutlook`
  - `type LiveStatus = 'upcoming' | 'live' | 'final'`
  - `interface GameOutlook { projected: [number, number]; win: [number, number]; status: LiveStatus }`
  - `gameOutlook(game: Game, gameOf: (playerId: string) => PlayerGame): GameOutlook`

- [ ] **Step 1: Write the failing test**

`packages/web/src/lib/live/outlook.test.ts`:
```ts
import type { Game, GameSide, PlayerLine } from '@fantasy-dash/core';
import type { PlayerGame } from './gameState';
import { gameOutlook, phi, playerOutlook } from './outlook';

const live = (period: number, clock: string): PlayerGame => ({ kind: 'live', period, clock, halftime: false });
const UP: PlayerGame = { kind: 'upcoming', kickoff: '2026-10-25T17:00Z' };
const line = (playerId: string, points: number, projected: number | null): PlayerLine => ({ playerId, points, projected, stats: {} });
const side = (userId: string, lines: PlayerLine[]): GameSide => ({
  userId, points: lines.reduce((t, l) => t + l.points, 0), projected: 0, ceiling: 0, efficiency: 0,
  starters: lines.map((p) => ({ slot: 'FLEX', player: p })), bench: [], optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 0,
});
const game = (a: GameSide, b: GameSide): Game => ({ id: '2026-8-1', matchupId: 1, week: 8, tag: null, sides: [a, b], winner: null, margin: 0 });

describe('phi', () => {
  it('is the standard normal CDF', () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
    expect(phi(-1)).toBeCloseTo(0.1587, 3);
  });
});

describe('playerOutlook', () => {
  it('adds the share of his projection still to play while his game is on', () => {
    expect(playerOutlook(10, 20, live(3, '0:00'))).toEqual({ final: 15, remaining: 5 });
  });
  it('is his points when his game is over or he is on a bye, his projection before kickoff', () => {
    expect(playerOutlook(12, 20, { kind: 'final' })).toEqual({ final: 12, remaining: 0 });
    expect(playerOutlook(0, 20, { kind: 'bye' })).toEqual({ final: 0, remaining: 0 });
    expect(playerOutlook(0, 20, UP)).toEqual({ final: 20, remaining: 20 });
  });
  it('never drops below his points when the game state is unknown', () => {
    expect(playerOutlook(25, 20, { kind: 'unknown' })).toEqual({ final: 25, remaining: 20 });
    expect(playerOutlook(0, 20, { kind: 'unknown' })).toEqual({ final: 20, remaining: 20 });
  });
  it('counts only points for a player with no projection (added after the sync)', () => {
    expect(playerOutlook(7, null, live(2, '5:00'))).toEqual({ final: 7, remaining: 0 });
  });
});

describe('gameOutlook', () => {
  it('at kickoff, gives the win % from the projection gap and the points still to play', () => {
    const o = gameOutlook(game(side('a', [line('a1', 0, 130)]), side('b', [line('b1', 0, 120)])), () => UP);
    // sigma = sqrt(4.4 x 250) = 33.17; z = 10 / 33.17 = 0.3015; phi = 0.618
    expect(o).toEqual({ projected: [130, 120], win: [62, 38], status: 'upcoming' });
  });
  it('a big lead with almost nothing left is near certain, but held at 99', () => {
    const o = gameOutlook(game(side('a', [line('a1', 150, 20)]), side('b', [line('b1', 90, 20)])), () => live(4, '0:30'));
    expect(o.status).toBe('live');
    expect(o.win).toEqual([99, 1]);
  });
  it('when every game is over, gives 100 to the leader or 50/50 on a tie', () => {
    const fin = () => ({ kind: 'final' }) as PlayerGame;
    expect(gameOutlook(game(side('a', [line('a1', 101, 90)]), side('b', [line('b1', 100, 90)])), fin))
      .toEqual({ projected: [101, 100], win: [100, 0], status: 'final' });
    expect(gameOutlook(game(side('a', [line('a1', 100, 90)]), side('b', [line('b1', 100, 90)])), fin).win).toEqual([50, 50]);
  });
  it('is live once any starter has played, and treats empty slots as nothing', () => {
    const a = side('a', [line('a1', 8, 20)]);
    a.starters.push({ slot: 'FLEX', player: null });
    const o = gameOutlook(game(a, side('b', [line('b1', 0, 20)])), (id) => (id === 'a1' ? { kind: 'final' } : UP));
    expect(o.status).toBe('live');
    expect(o.projected).toEqual([8, 20]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/outlook.test.ts`

Expected: FAIL, because the module `./outlook` can't be resolved.

- [ ] **Step 3: Implement**

`packages/web/src/lib/live/outlook.ts`:
```ts
import type { Game, GameSide } from '@fantasy-dash/core';
import { fractionLeft, type PlayerGame } from './gameState';

/**
 * Variance of a team's final score per projected point still to play. In this league over 2023-2025
 * (420 team-weeks) actual minus projected had an SD of 24.1 against a mean projection of 130.7: 24.1² / 130.7 ≈ 4.4.
 */
export const K = 4.4;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e-7). */
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export interface PlayerOutlook { final: number; remaining: number }

export function playerOutlook(points: number, projected: number | null, g: PlayerGame): PlayerOutlook {
  const p = projected ?? 0;
  switch (g.kind) {
    case 'live': { const rest = p * fractionLeft(g); return { final: points + rest, remaining: rest }; }
    case 'final':
    case 'bye': return { final: points, remaining: 0 };
    case 'upcoming': return { final: p, remaining: p };
    default: return { final: Math.max(points, p), remaining: p };
  }
}

export type LiveStatus = 'upcoming' | 'live' | 'final';
export interface GameOutlook {
  /** each side's projected final */
  projected: [number, number];
  /** whole percents, summing to 100 */
  win: [number, number];
  status: LiveStatus;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function gameOutlook(game: Game, gameOf: (playerId: string) => PlayerGame): GameOutlook {
  const states: PlayerGame[] = [];
  const sum = (side: GameSide) => {
    let final = 0, remaining = 0;
    for (const e of side.starters) {
      if (!e.player) continue;
      const g = gameOf(e.player.playerId);
      states.push(g);
      const o = playerOutlook(e.player.points, e.player.projected, g);
      final += o.final;
      remaining += o.remaining;
    }
    return { final: round2(final), remaining };
  };
  const [a, b] = [sum(game.sides[0]), sum(game.sides[1])];
  const done = states.length > 0 && states.every((g) => g.kind === 'final' || g.kind === 'bye');
  const started = states.some((g) => g.kind === 'live' || g.kind === 'final') || game.sides.some((s) => s.points > 0);
  const status: LiveStatus = done ? 'final' : started ? 'live' : 'upcoming';

  const variance = K * (a.remaining + b.remaining);
  const diff = a.final - b.final;
  let pa: number;
  if (variance <= 0) pa = diff > 0 ? 100 : diff < 0 ? 0 : 50;
  else pa = Math.max(1, Math.min(99, Math.round(phi(diff / Math.sqrt(variance)) * 100)));
  return { projected: [a.final, b.final], win: [pa, 100 - pa], status };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/outlook.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/live/outlook.ts packages/web/src/lib/live/outlook.test.ts
git commit -m "Live scores: projected finals and win % from the points still to play"
```

---

### Task 3: The live overlay on a synced week

**Files:**
- Modify: `packages/core/src/season.ts`, line 81 (`function pickStats` becomes `export function pickStats`)
- Create: `packages/web/src/lib/live/overlay.ts`
- Test: `packages/web/src/lib/live/overlay.test.ts`

**Interfaces:**
- Consumes (core): `pickStats(line: Record<string, number> | undefined): Record<string, number>`, `round2`, `SleeperMatchup`, `StatMap`, `Season`, `Week`, `Manager`, `UserId`
- Produces:
  - `interface NflStateJson { season: string; season_type: string; week: number }`
  - `liveWeekNumber(season: Season, state: NflStateJson | null): number | null`
  - `liveWeek(week: Week, managers: Record<UserId, Manager>, matchups: SleeperMatchup[], stats: StatMap | null): Week`
  - `tickerWeek(season: Season, liveNo: number | null): Week | null`

- [ ] **Step 1: Write the failing test**

`packages/web/src/lib/live/overlay.test.ts`:
```ts
import type { Manager, PlayerLine, SleeperMatchup, Week } from '@fantasy-dash/core';
import { game, season, side, week } from '../../test/playerFixtures';
import { liveWeek, liveWeekNumber, tickerWeek } from './overlay';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: null, avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
};
const L = (playerId: string, projected: number | null, stats: Record<string, number> = {}): PlayerLine => ({ playerId, points: 0, projected, stats });

/** an unplayed synced week: a starts q1 at QB and r1 at RB, benches w1; b starts t1 and k1 */
function synced(): Week {
  const a = side('a', 0, [L('q1', 20, { pass_yd: 1 }), L('r1', 15)], [L('w1', 12)]);
  a.starters = [{ slot: 'QB', player: L('q1', 20, { pass_yd: 1 }) }, { slot: 'RB', player: L('r1', 15) }];
  a.projected = 35;
  const b = side('b', 0, [L('t1', 9), L('k1', 8)]);
  b.starters = [{ slot: 'QB', player: L('t1', 9) }, { slot: 'RB', player: L('k1', 8) }];
  const w = week(8, [game(2026, 8, 1, a, b)]);
  w.played = false;
  return w;
}
const m = (roster_id: number, starters: string[] | null, players: string[] | null, pp: Record<string, number>, points: number): SleeperMatchup =>
  ({ roster_id, matchup_id: 1, points, custom_points: null, starters, players, players_points: pp });

describe('liveWeek', () => {
  it('lays live points over each side by roster, keeping projections and the played flag', () => {
    const w = liveWeek(synced(), managers, [
      m(1, ['q1', 'r1'], ['q1', 'r1', 'w1'], { q1: 18.4, r1: 3, w1: 9 }, 21.4),
      m(2, ['t1', 'k1'], ['t1', 'k1'], { t1: 4 }, 4),
    ], null);
    const [a, b] = w.games[0].sides;
    expect(w.played).toBe(false);
    expect(a.points).toBe(21.4);
    expect(a.projected).toBe(35);
    expect(a.starters.map((e) => [e.slot, e.player?.playerId, e.player?.points, e.player?.projected])).toEqual([['QB', 'q1', 18.4, 20], ['RB', 'r1', 3, 15]]);
    expect(a.bench.map((l) => [l.playerId, l.points, l.projected])).toEqual([['w1', 9, 12]]);
    expect(b.starters[1].player?.points).toBe(0);
  });
  it('takes the lineup set since the sync, with no projection for a player the sync never saw', () => {
    const w = liveWeek(synced(), managers, [
      m(1, ['q1', 'w1'], ['q1', 'r1', 'w1'], { q1: 10, w1: 6 }, 16),
      m(2, ['t1', 'x9'], ['t1', 'x9'], { x9: 5 }, 5),
    ], null);
    const [a, b] = w.games[0].sides;
    expect(a.starters.map((e) => e.player?.playerId)).toEqual(['q1', 'w1']);
    expect(a.starters[1].player?.projected).toBe(12);
    expect(a.bench.map((l) => l.playerId)).toEqual(['r1']);
    expect(b.starters[1].player).toMatchObject({ playerId: 'x9', points: 5, projected: null });
  });
  it('keeps the synced starters when a team set no lineup, and an empty slot stays empty', () => {
    const w = liveWeek(synced(), managers, [m(1, [], null, {}, 0), m(2, ['t1', '0'], ['t1'], {}, 0)], null);
    expect(w.games[0].sides[0].starters.map((e) => e.player?.playerId)).toEqual(['q1', 'r1']);
    expect(w.games[0].sides[0].bench.map((l) => l.playerId)).toEqual(['w1']);
    expect(w.games[0].sides[1].starters[1].player).toBeNull();
  });
  it('replaces stat lines with live ones, trimmed to the kept keys, when live stats are loaded', () => {
    const w = liveWeek(synced(), managers, [m(1, ['q1', 'r1'], ['q1', 'r1'], { q1: 5 }, 5), m(2, ['t1', 'k1'], ['t1', 'k1'], {}, 0)],
      { q1: { pass_yd: 120, pass_att: 14, gms_active: 1 } });
    expect(w.games[0].sides[0].starters[0].player?.stats).toEqual({ pass_yd: 120, pass_att: 14 });
    expect(w.games[0].sides[0].starters[1].player?.stats).toEqual({});
  });
  it('leaves a side with no matching roster as synced', () => {
    const w = liveWeek(synced(), managers, [m(2, ['t1', 'k1'], ['t1', 'k1'], { t1: 3 }, 3)], null);
    expect(w.games[0].sides[0].starters[0].player?.stats).toEqual({ pass_yd: 1 });
    expect(w.games[0].sides[1].points).toBe(3);
  });
});

describe('liveWeekNumber', () => {
  const s = () => { const x = season(2026, [week(1, []), synced()]); x.weeks[0] = { ...synced(), week: 1 }; x.weeks[1] = synced(); return x; };
  it('is Sleeper\'s week when the sync has that week with games', () => {
    expect(liveWeekNumber(s(), { season: '2026', season_type: 'regular', week: 2 })).toBe(2);
  });
  it('is null for another season, the offseason, or a week the sync lacks or has no games for', () => {
    expect(liveWeekNumber(s(), { season: '2025', season_type: 'regular', week: 2 })).toBeNull();
    expect(liveWeekNumber(s(), { season: '2026', season_type: 'off', week: 2 })).toBeNull();
    expect(liveWeekNumber(s(), { season: '2026', season_type: 'regular', week: 3 })).toBeNull();
    const empty = s(); empty.weeks[1] = week(2, []);
    expect(liveWeekNumber(empty, { season: '2026', season_type: 'regular', week: 2 })).toBeNull();
    expect(liveWeekNumber(s(), null)).toBeNull();
  });
});

describe('tickerWeek', () => {
  const s = (lastScoredWeek: number) => { const x = season(2026, [{ ...synced(), week: 1, played: true }, synced()], null, lastScoredWeek); x.status = 'in_season'; return x; };
  it('is the live week when there is one, else the next week to play, else the last one played', () => {
    expect(tickerWeek(s(1), 1)?.week).toBe(1);
    expect(tickerWeek(s(1), null)?.week).toBe(8);
    expect(tickerWeek(s(2), null)?.week).toBe(8);
  });
  it('is null once the season is complete', () => {
    const done = s(2); done.status = 'complete';
    expect(tickerWeek(done, null)).toBeNull();
  });
});
```

(`synced()` is week 8, and `tickerWeek(s(1), null)` returns `season.weeks[1]`, which is that week-8 object; the assertion reads its `week` field.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/overlay.test.ts`

Expected: FAIL, because the module `./overlay` can't be resolved.

- [ ] **Step 3: Implement**

In `packages/core/src/season.ts`, change `function pickStats(` to:
```ts
/** A raw Sleeper stat line trimmed to STAT_KEYS, zeros dropped. */
export function pickStats(
```

`packages/web/src/lib/live/overlay.ts`:
```ts
import { pickStats, round2, type GameSide, type Manager, type PlayerLine, type Season, type SleeperMatchup, type StatMap, type UserId, type Week } from '@fantasy-dash/core';

/** GET /v1/state/nfl, the fields we read */
export interface NflStateJson { season: string; season_type: string; week: number }

/** The week Sleeper says is on, when the synced season has it with games; otherwise nothing is live. */
export function liveWeekNumber(season: Season, state: NflStateJson | null): number | null {
  if (!state || Number(state.season) !== season.year || state.season_type !== 'regular') return null;
  return season.weeks[state.week - 1]?.games.length ? state.week : null;
}

/** The week the ticker shows: the live one, else the next to play, else the last played; none once the season is over. */
export function tickerWeek(season: Season, liveNo: number | null): Week | null {
  if (season.status === 'complete') return null;
  if (liveNo !== null) return season.weeks[liveNo - 1] ?? null;
  const next = season.weeks[season.lastScoredWeek];
  if (next?.games.length) return next;
  const last = season.weeks[season.lastScoredWeek - 1];
  return last?.games.length ? last : null;
}

function overlaySide(side: GameSide, m: SleeperMatchup, stats: StatMap | null): GameSide {
  const pp = m.players_points ?? {};
  // the sync knows every rostered player's projection; anyone added since has none
  const known = new Map<string, PlayerLine>();
  for (const l of [...side.starters.map((e) => e.player), ...side.bench]) if (l) known.set(l.playerId, l);
  const line = (id: string): PlayerLine => ({
    playerId: id,
    points: round2(pp[id] ?? 0),
    projected: known.get(id)?.projected ?? null,
    stats: stats ? pickStats(stats[id]) : known.get(id)?.stats ?? {},
  });
  const liveStarters = m.starters ?? [];
  // lineups change after the Tuesday sync; a team that set none keeps the synced one
  const starters = liveStarters.length
    ? side.starters.map((e, i) => {
      const id = liveStarters[i];
      return { slot: e.slot, player: id && id !== '0' ? line(id) : null };
    })
    : side.starters.map((e) => ({ slot: e.slot, player: e.player ? line(e.player.playerId) : null }));
  const starting = new Set(starters.flatMap((e) => (e.player ? [e.player.playerId] : [])));
  const bench = m.players
    ? m.players.filter((id) => !starting.has(id)).map(line).sort((x, y) => y.points - x.points)
    : side.bench.filter((l) => !starting.has(l.playerId)).map((l) => line(l.playerId));
  return { ...side, points: round2(m.custom_points ?? m.points ?? 0), starters, bench };
}

/** The synced week with Sleeper's live points, lineups and (when loaded) stat lines laid over it. */
export function liveWeek(week: Week, managers: Record<UserId, Manager>, matchups: SleeperMatchup[], stats: StatMap | null): Week {
  const byRoster = new Map(matchups.map((m) => [m.roster_id, m]));
  const sideOf = (s: GameSide): GameSide => {
    const m = byRoster.get(managers[s.userId]?.rosterId ?? -1);
    return m ? overlaySide(s, m, stats) : s;
  };
  return { ...week, games: week.games.map((g) => ({ ...g, sides: [sideOf(g.sides[0]), sideOf(g.sides[1])] })) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/overlay.test.ts && pnpm --filter @fantasy-dash/core test`

Expected: PASS. Core stays at 204 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/season.ts packages/web/src/lib/live/overlay.ts packages/web/src/lib/live/overlay.test.ts
git commit -m "Live scores: overlay Sleeper's live matchups on the synced week"
```

---

### Task 4: When to poll

**Files:**
- Create: `packages/web/src/lib/live/schedule.ts`
- Test: `packages/web/src/lib/live/schedule.test.ts`

**Interfaces:**
- Consumes (Task 1): `NflGame`
- Produces:
  - `POLL_MS = 60_000`
  - `inFallbackWindow(now: number): boolean`
  - `shouldPoll(now: number, games: NflGame[] | null): boolean`

- [ ] **Step 1: Write the failing test**

`packages/web/src/lib/live/schedule.test.ts`:
```ts
import type { NflGame } from './espn';
import { inFallbackWindow, shouldPoll } from './schedule';

const at = (iso: string) => Date.parse(iso);
const g = (state: NflGame['state'], kickoff: string): NflGame => ({ teams: ['KC', 'BUF'], state, period: 0, clock: '15:00', kickoff, halftime: false });

describe('shouldPoll', () => {
  it('polls while any game is on', () => {
    expect(shouldPoll(at('2026-10-25T18:00Z'), [g('post', '2026-10-23T00:15Z'), g('in', '2026-10-25T17:00Z')])).toBe(true);
  });
  it('polls from 15 minutes before a kickoff, and keeps polling when a kickoff runs late', () => {
    expect(shouldPoll(at('2026-10-25T16:46Z'), [g('pre', '2026-10-25T17:00Z')])).toBe(true);
    expect(shouldPoll(at('2026-10-25T16:44Z'), [g('pre', '2026-10-25T17:00Z')])).toBe(false);
    expect(shouldPoll(at('2026-10-25T17:10Z'), [g('pre', '2026-10-25T17:00Z')])).toBe(true);
  });
  it('does not poll when every game is over or there are none', () => {
    expect(shouldPoll(at('2026-10-27T12:00Z'), [g('post', '2026-10-25T17:00Z')])).toBe(false);
    expect(shouldPoll(at('2026-10-27T12:00Z'), [])).toBe(false);
  });
  it('falls back to the game windows when ESPN could not be read', () => {
    expect(shouldPoll(at('2026-10-23T00:30Z'), null)).toBe(true);
    expect(shouldPoll(at('2026-10-21T18:00Z'), null)).toBe(false);
  });
});

describe('inFallbackWindow (Eastern time, either side of the clock change)', () => {
  it('covers Thursday and Monday nights from 8pm', () => {
    expect(inFallbackWindow(at('2026-10-23T00:30Z'))).toBe(true);  // Thu 8:30pm EDT
    expect(inFallbackWindow(at('2026-10-22T23:30Z'))).toBe(false); // Thu 7:30pm EDT
    expect(inFallbackWindow(at('2026-11-10T01:30Z'))).toBe(true);  // Mon 8:30pm EST
    expect(inFallbackWindow(at('2026-11-10T00:30Z'))).toBe(false); // Mon 7:30pm EST
  });
  it('covers Sundays from 9am', () => {
    expect(inFallbackWindow(at('2026-11-08T14:30Z'))).toBe(true);  // Sun 9:30am EST
    expect(inFallbackWindow(at('2026-11-08T13:30Z'))).toBe(false); // Sun 8:30am EST
    expect(inFallbackWindow(at('2026-10-25T13:30Z'))).toBe(true);  // Sun 9:30am EDT
  });
  it('covers December Saturdays from 1pm, but not other Saturdays', () => {
    expect(inFallbackWindow(at('2026-12-12T19:00Z'))).toBe(true);  // Sat 2pm EST
    expect(inFallbackWindow(at('2026-12-12T17:00Z'))).toBe(false); // Sat noon EST
    expect(inFallbackWindow(at('2026-11-14T19:00Z'))).toBe(false); // a November Saturday
  });
  it('is closed midweek', () => {
    expect(inFallbackWindow(at('2026-10-21T18:00Z'))).toBe(false); // Wednesday
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/schedule.test.ts`

Expected: FAIL, because the module `./schedule` can't be resolved.

- [ ] **Step 3: Implement**

`packages/web/src/lib/live/schedule.ts`:
```ts
import type { NflGame } from './espn';

export const POLL_MS = 60_000;
const LEAD_MS = 15 * 60_000;

const eastern = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23', month: 'numeric' });

/** When NFL games are usually on (Eastern time): used only when ESPN can't say which games are. */
export function inFallbackWindow(now: number): boolean {
  const parts = Object.fromEntries(eastern.formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  switch (parts.weekday) {
    case 'Thu': case 'Mon': return hour >= 20;
    case 'Sun': return hour >= 9;
    case 'Sat': return Number(parts.month) === 12 && hour >= 13;
    default: return false;
  }
}

/** Poll while a game is on or about to kick off (a late kickoff still counts); fall back to the usual windows without ESPN. */
export function shouldPoll(now: number, games: NflGame[] | null): boolean {
  if (!games) return inFallbackWindow(now);
  return games.some((g) => g.state === 'in' || (g.state === 'pre' && Date.parse(g.kickoff) - now <= LEAD_MS));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/schedule.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/live/schedule.ts packages/web/src/lib/live/schedule.test.ts
git commit -m "Live scores: poll while games are on, with fixed windows when ESPN is down"
```

---

### Task 5: LiveProvider, the poller

**Files:**
- Create: `packages/web/src/lib/live/LiveProvider.tsx`
- Test: `packages/web/src/lib/live/LiveProvider.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `parseScoreboard`, `scoreboardUrl`, `NflGame`
  - Task 3: `liveWeekNumber`, `NflStateJson`
  - Task 4: `shouldPoll`, `POLL_MS`
  - `loadSeason`, `currentSeason` from `../../data/load`
- Produces:
  - `interface LiveData { season: Season | null; week: number | null; matchups: SleeperMatchup[] | null; games: NflGame[] | null; stats: StatMap | null; polling: boolean }`
  - `LiveProvider({ children, load?, fetcher?, now? })`
  - `useLive(): LiveData`
  - `useLiveStats(on: boolean): void`

- [ ] **Step 1: Write the failing test**

`packages/web/src/lib/live/LiveProvider.test.tsx`:
```tsx
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/LiveProvider.test.tsx`

Expected: FAIL, because the module `./LiveProvider` can't be resolved.

- [ ] **Step 3: Implement**

`packages/web/src/lib/live/LiveProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Season, SleeperMatchup, StatMap } from '@fantasy-dash/core';
import { currentSeason, loadSeason } from '../../data/load';
import { parseScoreboard, scoreboardUrl, type NflGame } from './espn';
import { liveWeekNumber, type NflStateJson } from './overlay';
import { POLL_MS, shouldPoll } from './schedule';

const SLEEPER = 'https://api.sleeper.app/v1';

export interface LiveData {
  /** the current season as synced */
  season: Season | null;
  /** the week that is live, when Sleeper's week is one the sync has */
  week: number | null;
  matchups: SleeperMatchup[] | null;
  /** null when ESPN couldn't be read */
  games: NflGame[] | null;
  /** live stat lines, only while a box score asks for them */
  stats: StatMap | null;
  /** a refresh is scheduled */
  polling: boolean;
}

const EMPTY: LiveData = { season: null, week: null, matchups: null, games: null, stats: null, polling: false };
const LiveContext = createContext<{ data: LiveData; watchStats: () => () => void }>({ data: EMPTY, watchStats: () => () => {} });

type Fetcher = (url: string) => Promise<Response>;
const MAX_FAILURES = 3;

async function getJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const r = await fetcher(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<T>;
}

const visible = () => document.visibilityState === 'visible';

export function LiveProvider({ children, load = () => loadSeason(currentSeason.year), fetcher = (u) => fetch(u), now = Date.now }: {
  children: ReactNode; load?: () => Promise<Season>; fetcher?: Fetcher; now?: () => number;
}) {
  const [data, setData] = useState<LiveData>(EMPTY);
  const r = useRef({ season: null as Season | null, games: null as NflGame[] | null, failures: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined, watchers: 0, hasStats: false, stopped: false, busy: false, again: false });
  const tickRef = useRef<() => Promise<void>>(async () => {});

  tickRef.current = async () => {
    const s = r.current;
    if (s.stopped || !s.season) return;
    if (s.busy) { s.again = true; return; }
    s.busy = true;
    clearTimeout(s.timer);
    const schedule = (): boolean => {
      if (s.stopped || !visible() || !shouldPoll(now(), s.games)) return false;
      s.timer = setTimeout(() => void tickRef.current(), POLL_MS);
      return true;
    };
    const season = s.season;
    try {
      const state = await getJson<NflStateJson>(fetcher, `${SLEEPER}/state/nfl`);
      const week = liveWeekNumber(season, state);
      if (week === null) {
        s.failures = 0;
        setData((d) => ({ ...d, week: null, matchups: null, stats: null, polling: false }));
        return;
      }
      const wantStats = s.watchers > 0;
      const [matchups, games, stats] = await Promise.all([
        getJson<SleeperMatchup[]>(fetcher, `${SLEEPER}/league/${season.leagueId}/matchups/${week}`),
        getJson<unknown>(fetcher, scoreboardUrl(season.year, week)).then(parseScoreboard).catch(() => null),
        wantStats ? getJson<StatMap>(fetcher, `${SLEEPER}/stats/nfl/regular/${season.year}/${week}`).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      s.failures = 0;
      s.games = games;
      if (stats) s.hasStats = true;
      const polling = schedule();
      setData((d) => ({ ...d, week, matchups, games, stats: stats ?? (d.week === week ? d.stats : null), polling }));
    } catch {
      // Sleeper failed: keep what we have; three in a row and we stop until the next page load
      s.failures += 1;
      if (s.failures >= MAX_FAILURES) s.stopped = true;
      const polling = schedule();
      setData((d) => ({ ...d, polling }));
    } finally {
      s.busy = false;
      if (s.again) { s.again = false; void tickRef.current(); }
    }
  };

  useEffect(() => {
    const s = r.current;
    s.stopped = false;
    s.failures = 0;
    let alive = true;
    load().then((season) => {
      if (!alive) return;
      s.season = season;
      setData((d) => ({ ...d, season }));
      void tickRef.current();
    }).catch(() => {});
    const onVisibility = () => {
      if (visible()) void tickRef.current();
      else { clearTimeout(s.timer); setData((d) => (d.polling ? { ...d, polling: false } : d)); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false;
      s.stopped = true;
      clearTimeout(s.timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // load, fetcher and now are fixed for the provider's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watchStats = () => {
    const s = r.current;
    s.watchers += 1;
    if (!s.hasStats) void tickRef.current();
    return () => { s.watchers -= 1; };
  };

  return <LiveContext.Provider value={{ data, watchStats }}>{children}</LiveContext.Provider>;
}

export const useLive = (): LiveData => useContext(LiveContext).data;

/** Box scores call this so live stat lines are fetched only while one is open. */
export function useLiveStats(on: boolean): void {
  const { watchStats } = useContext(LiveContext);
  useEffect(() => (on ? watchStats() : undefined), [on]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

**Notes:**
- `watchStats` triggers a tick when stats were never loaded. If that happens mid-load, the `again` flag replays the tick once the first finishes, which covers the fourth Review Focus case.
- The stats-only tick also refreshes the matchups, which is harmless.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/live/LiveProvider.test.tsx`

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/live/LiveProvider.tsx packages/web/src/lib/live/LiveProvider.test.tsx
git commit -m "Live scores: one poller for the app, refreshing while NFL games are on"
```

---

### Task 6: The scores ticker

**Files:**
- Create: `packages/web/src/components/LiveDot.tsx`, `packages/web/src/components/ScoreTicker.tsx`
- Modify: `packages/web/src/routes.tsx` (the `Layout` function)
- Test: `packages/web/src/components/ScoreTicker.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `playerGames`
  - Task 2: `gameOutlook`, `LiveStatus`
  - Task 3: `liveWeek`, `tickerWeek`
  - Task 5: `useLive`, `LiveProvider`
  - `players` from `../data/load`, `playerTeam` from `../lib/players`
- Produces:
  - `ScoreTicker()` (default export)
  - `LiveDot({ on }: { on: boolean })` (default export)
  - `weekStatus(...)`, exported from `ScoreTicker.tsx` for the Scores page:
    ```ts
    weekStatus(season: Season, wk: Week, live: LiveData): { week: Week; isLive: boolean; outlookOf: (g: Game) => GameOutlook | null }
    ```

- [ ] **Step 1: Write the failing test**

`packages/web/src/components/ScoreTicker.test.tsx`:
```tsx
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import { game, line, season, side, week } from '../test/playerFixtures';
import { LiveProvider } from '../lib/live/LiveProvider';
import ScoreTicker from './ScoreTicker';

function current(): Season {
  const a = side('a', 0, [line('q1', 0)]); a.projected = 120.5; a.recordBefore = { w: 4, l: 2, t: 0 };
  const b = side('b', 0, [line('r1', 0)]); b.projected = 110; b.recordBefore = { w: 3, l: 3, t: 0 };
  const w = week(7, [game(2026, 7, 1, a, b)]); w.played = false;
  const s = season(2026, [...Array.from({ length: 6 }, (_, i) => week(i + 1, [])), w], null, 6);
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
    expect(bar).toHaveTextContent('2026 · Week 7');
    expect(within(bar).getByText('LIVE')).toBeInTheDocument();
    const card = within(bar).getByRole('link', { name: /Team Alice vs Team Bob/ });
    expect(card).toHaveAttribute('href', '/scores/2026/7/1');
    expect(card).toHaveTextContent('4-2');
    expect(within(card).getByText('70.10')).toHaveClass('font-semibold');
    expect(within(card).getByText('64.20')).not.toHaveClass('font-semibold');
  });

  it('marks a matchup FINAL once every starter\'s game is over', async () => {
    await show(current(), fetcher('post'));
    expect(screen.getByRole('link', { name: /Team Alice vs Team Bob/ })).toHaveTextContent('FINAL');
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('shows the synced projections, without LIVE, when nothing is live', async () => {
    await show(current(), fetcher('none'));
    const card = screen.getByRole('link', { name: /Team Alice vs Team Bob/ });
    expect(card).toHaveTextContent('120.50');
    expect(card).toHaveTextContent('proj');
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('is hidden once the season is complete', async () => {
    const s = current(); s.status = 'complete';
    await show(s, fetcher('none'));
    expect(screen.queryByRole('region', { name: 'Scores' })).not.toBeInTheDocument();
  });
});
```

`s.playerTeams` pins each starter's NFL team, so the test doesn't depend on the real player directory.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/ScoreTicker.test.tsx`

Expected: FAIL, because the module `./ScoreTicker` can't be resolved.

- [ ] **Step 3: Implement**

`packages/web/src/components/LiveDot.tsx`:
```tsx
/** "LIVE" with a pulsing dot while scores are refreshing. */
export default function LiveDot({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-loss">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
      </span>
      LIVE
    </span>
  );
}
```

`packages/web/src/components/ScoreTicker.tsx`:
```tsx
import { useRef } from 'react';
import { Link } from 'react-router';
import type { Game, GameSide, Manager, Season, Week } from '@fantasy-dash/core';
import Avatar from './Avatar';
import LiveDot from './LiveDot';
import { players } from '../data/load';
import { fmtPts, fmtRecord } from '../lib/format';
import { playerGames } from '../lib/live/gameState';
import { gameOutlook, type GameOutlook } from '../lib/live/outlook';
import { liveWeek, tickerWeek } from '../lib/live/overlay';
import { useLive, type LiveData } from '../lib/live/LiveProvider';
import { playerTeam } from '../lib/players';

/** A synced week as it stands now: live points and outlooks when it's the live week, the synced week otherwise. */
export function weekStatus(season: Season, wk: Week, live: LiveData): { week: Week; isLive: boolean; outlookOf: (g: Game) => GameOutlook | null } {
  const isLive = live.season?.year === season.year && live.week === wk.week && live.matchups !== null;
  if (!isLive) return { week: wk, isLive, outlookOf: () => null };
  const week = liveWeek(wk, season.managers, live.matchups!, live.stats);
  const gameOf = playerGames((id) => playerTeam(players, id, season.playerTeams), live.games);
  return { week, isLive, outlookOf: (g) => gameOutlook(g, gameOf) };
}

const nameOf = (s: GameSide, m?: Manager) => m?.teamName ?? m?.displayName ?? s.userId;

function Card({ game, season, outlook, played }: { game: Game; season: Season; outlook: GameOutlook | null; played: boolean }) {
  const status = outlook?.status ?? (played ? 'final' : 'upcoming');
  const [a, b] = game.sides;
  const scored = status !== 'upcoming';
  const lead = scored && a.points !== b.points ? (a.points > b.points ? a.userId : b.userId) : null;
  const row = (s: GameSide) => {
    const m = season.managers[s.userId];
    return (
      <div className="flex items-center gap-2">
        <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={20} />
        <span className={`min-w-0 flex-1 truncate ${lead === s.userId ? 'font-semibold text-ink' : ''}`}>{nameOf(s, m)}</span>
        <span className="num text-[11px] text-muted">{fmtRecord(s.recordBefore)}</span>
        <span className={`num w-12 text-right ${!scored ? 'text-muted' : lead === s.userId ? 'font-semibold text-ink' : ''}`}>{fmtPts(scored ? s.points : s.projected)}</span>
      </div>
    );
  };
  return (
    <Link
      to={`/scores/${season.year}/${game.week}/${game.matchupId}`}
      aria-label={`${nameOf(a, season.managers[a.userId])} vs ${nameOf(b, season.managers[b.userId])}`}
      className="block w-56 shrink-0 snap-start space-y-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted transition-colors hover:border-accent"
    >
      {row(a)}
      {row(b)}
      <div className="section-label text-right text-[10px]">{status === 'final' ? 'FINAL' : status === 'upcoming' ? 'proj' : ''}</div>
    </Link>
  );
}

export default function ScoreTicker() {
  const live = useLive();
  const strip = useRef<HTMLDivElement>(null);
  const season = live.season;
  const synced = season ? tickerWeek(season, live.week) : null;
  if (!season || !synced) return null;
  const { week, isLive, outlookOf } = weekStatus(season, synced, live);
  const scroll = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * 480, behavior: 'smooth' });
  return (
    <section aria-label="Scores" className="border-b border-line bg-surface-2/60">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-10">
        <div className="flex shrink-0 flex-col gap-0.5">
          <span className="num whitespace-nowrap text-xs font-semibold">{season.year} · Week {week.week}</span>
          <LiveDot on={isLive && live.polling} />
        </div>
        <button type="button" aria-label="Scroll scores left" onClick={() => scroll(-1)} className="hidden shrink-0 rounded px-1 text-muted hover:text-ink md:block">‹</button>
        <div ref={strip} className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto [scrollbar-width:none]">
          {week.games.map((g) => <Card key={g.id} game={g} season={season} outlook={outlookOf(g)} played={week.played} />)}
        </div>
        <button type="button" aria-label="Scroll scores right" onClick={() => scroll(1)} className="hidden shrink-0 rounded px-1 text-muted hover:text-ink md:block">›</button>
      </div>
    </section>
  );
}
```

In `packages/web/src/routes.tsx`:
- Add the imports `import ScoreTicker from './components/ScoreTicker';` and `import { LiveProvider } from './lib/live/LiveProvider';`.
- Replace `Layout` with:
```tsx
function Layout() {
  return (
    <LiveProvider>
      <div className="min-h-screen bg-bg text-ink">
        <ScoreTicker />
        <Nav />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </LiveProvider>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/ScoreTicker.test.tsx src/routes.test.tsx`

Expected: PASS.

If `bg-surface-2/60` isn't a defined utility, check `index.css` for the `surface-2` colour token and use `bg-surface-2`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/LiveDot.tsx packages/web/src/components/ScoreTicker.tsx packages/web/src/components/ScoreTicker.test.tsx packages/web/src/routes.tsx
git commit -m "Live scores: the scores ticker above the nav on every page"
```

---

### Task 7: The live Scores page

**Files:**
- Modify: `packages/web/src/components/ScoreCard.tsx`, `packages/web/src/components/boxscore/WeekScores.tsx`, `packages/web/src/pages/ScoresPage.tsx`
- Test: `packages/web/src/components/ScoreCard.test.tsx` (add cases), `packages/web/src/components/boxscore/WeekScores.test.tsx` (add a case)

**Interfaces:**
- Consumes:
  - Task 2: `GameOutlook`
  - Task 5: `useLive`
  - Task 6: `weekStatus`, `LiveDot`
- Produces:
  - `ScoreCard` takes an optional `live?: GameOutlook`
  - `WeekScores` takes an optional `live?: boolean`
  - `weekScoreRows(week, game?, live = false)`

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/src/components/ScoreCard.test.tsx` inside `describe('ScoreCard', ...)`, using that file's `side`, `base`, `managers`, `players` and `wrap`. A starter's points also appear under Top performers, after the team score, so the score assertions take the first match.
```tsx
  it('shows live points, the projected final and a Live status while the game is on', () => {
    const g = base(side('a', 64.2, [['q1', 64.2]]), side('b', 70.1, [['r1', 70.1]]), null);
    wrap(<ScoreCard seasonTeams={{}} game={g} played={false} managers={managers} players={players} to="/x" year={2026}
      live={{ projected: [118.4, 121.0], win: [44, 56], status: 'live' }} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getAllByText('64.20')[0]).toBeInTheDocument();
    expect(screen.getByText('proj 118.40')).toBeInTheDocument();
    expect(screen.queryByText('Efficiency')).not.toBeInTheDocument();
    expect(screen.getByText('Top performers')).toBeInTheDocument();
  });
  it('calls a live game Final, with the winner in bold, once every starter is done', () => {
    const g = base(side('a', 64.2, [['q1', 64.2]]), side('b', 70.1, [['r1', 70.1]]), null);
    wrap(<ScoreCard seasonTeams={{}} game={g} played={false} managers={managers} players={players} to="/x" year={2026}
      live={{ projected: [64.2, 70.1], win: [0, 100], status: 'final' }} />);
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getAllByText('70.10')[0]).toHaveClass('font-semibold');
    expect(screen.getAllByText('64.20')[0]).not.toHaveClass('font-semibold');
  });
```

Append to `packages/web/src/components/boxscore/WeekScores.test.tsx`, inside `describe('weekScoreRows', ...)` and using that file's `side(userId, points, projected)` and `game(matchupId, x, y)`:
```tsx
  it('ranks live points, with the pre-game projection as the track, in a live week', () => {
    const live: Week = { week: 3, isPlayoff: false, played: false, games: [game(1, side('a', 40, 100), side('b', 60, 90))], highScore: null };
    expect(weekScoreRows(live, undefined, true).map((r) => [r.userId, r.points, r.ceiling])).toEqual([['b', 60, 90], ['a', 40, 100]]);
    expect(weekScoreRows(live).map((r) => [r.userId, r.points])).toEqual([['a', 100], ['b', 90]]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/ScoreCard.test.tsx src/components/boxscore/WeekScores.test.tsx`

Expected: FAIL. ScoreCard shows "Upcoming" and the projected numbers rather than "Live"; `weekScoreRows` ignores its third argument.

- [ ] **Step 3: Implement**

**`ScoreCard.tsx`:**
- Add the import `import type { GameOutlook } from '../lib/live/outlook';`.
- Add to `Props`:
  ```ts
  /** the live outlook when this is the live week */
  live?: GameOutlook;
  ```
- Replace the body of `ScoreCard` up to and including the `played && (` efficiency block, and the performers block, as follows:
```tsx
export default function ScoreCard({ game, played, managers, players, seasonTeams, to, year, live }: Props) {
  const [a, b] = game.sides;
  const started = live ? live.status !== 'upcoming' : played;
  const winner = live
    ? (live.status === 'final' && a.points !== b.points ? (a.points > b.points ? a.userId : b.userId) : null)
    : played ? game.winner : null;
  const outcome = (side: GameSide): Outcome => (winner === null ? 'even' : winner === side.userId ? 'won' : 'lost');
  const status = live ? ({ upcoming: 'Upcoming', live: 'Live', final: 'Final' } as const)[live.status] : !played ? 'Upcoming' : game.winner === null ? 'Tie' : 'Final';
  return (
    <div className="card relative p-4 transition-colors hover:border-accent sm:p-5">
      <CoverLink to={to} label={`${teamName(a, managers[a.userId])} vs ${teamName(b, managers[b.userId])} box score`} className="rounded-xl" />
      <Header game={game} status={status} />
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-4">
        <Team side={a} manager={managers[a.userId]} played={started} outcome={outcome(a)} align="left" year={year} liveProj={live && live.status !== 'final' ? live.projected[0] : undefined} />
        <span className="section-label self-center px-0.5 text-[12px] lowercase tracking-[0.12em]" style={{ fontVariant: 'small-caps' }}>vs</span>
        <Team side={b} manager={managers[b.userId]} played={started} outcome={outcome(b)} align="right" year={year} liveProj={live && live.status !== 'final' ? live.projected[1] : undefined} />
        {played && !live && (
          <div className="col-span-3 mt-4 grid grid-cols-subgrid" title="Points scored as a share of the best possible lineup">
            <EffBar value={a.efficiency} align="left" />
            <span aria-hidden />
            <EffBar value={b.efficiency} align="right" />
          </div>
        )}
      </div>
      {started && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="section-label mb-2.5">Top performers</h3>
          <div className="grid gap-y-3 sm:grid-cols-2 sm:gap-x-8 [&>*+*]:max-sm:border-t [&>*+*]:max-sm:border-line [&>*+*]:max-sm:pt-3">
            {game.sides.map((s) => (
              <Performers key={s.userId} side={s} players={players} seasonTeams={seasonTeams} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ game, status }: { game: Game; status: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="font-semibold text-accent">{game.tag ? fmtTag(game.tag) : null}</span>
      <span className="section-label text-ink">{status}</span>
    </div>
  );
}
```

In `Team`:
- Add the prop `liveProj?: number` to its props type and destructuring.
- In the `played ?` branch, render:
```tsx
        <span className={`num flex shrink-0 flex-col items-center text-[28px] leading-none ${scoreTone}`}>
          {fmtPts(side.points)}
          {liveProj !== undefined && <span className="mt-1 text-[10px] font-normal leading-none text-muted">proj {fmtPts(liveProj)}</span>}
        </span>
```
- The bold-score test asserts on the element whose text is exactly `70.10`. Wrap `fmtPts(side.points)` in `<span className={scoreTone}>…</span>` inside that flex column, and drop `scoreTone` from the outer span, so the number carries the class.

**`WeekScores.tsx`:**
- Change `weekScoreRows` to:
```ts
/** Every team's score this week (projection when unplayed, live points in a live week), best first, with the viewed game's two teams flagged. */
export function weekScoreRows(week: Week, game?: Game, live = false): WeekScoreRow[] {
  const scored = week.played || live;
  const rows = week.games.flatMap((g) => g.sides.map((s) => ({
    userId: s.userId, points: scored ? s.points : s.projected, efficiency: s.efficiency,
    // a live week's track is the pre-game projection
    ceiling: week.played ? s.ceiling : live ? Math.max(s.points, s.projected) : s.projected,
    matchupId: g.matchupId, inGame: g.id === game?.id, rank: 0,
  })));
```
  (the rest is unchanged)
- Add `live?: boolean` to `Props` with the doc comment `/** the live week: rank live points */`. Destructure it in `WeekScores` and call `weekScoreRows(week, game, live)`.
- Change the subtitle to `{week.played ? 'score out of lineup max' : live ? 'live, out of projection' : 'projected'}`.
- Change the top-row caption's `week.played ? 'score' : 'projection'` to `week.played || live ? 'score' : 'projection'`.

**`ScoresPage.tsx`:**
- Add the imports `import LiveDot from '../components/LiveDot';`, `import { weekStatus } from '../components/ScoreTicker';` and `import { useLive } from '../lib/live/LiveProvider';`.
- In the component, add `const live = useLive();`.
- Replace the `weeks.map((wk) => (` block with:
```tsx
      {weeks.map((raw) => {
        const { week: wk, isLive, outlookOf } = weekStatus(season, raw, live);
        return (
          <div key={wk.week} className="space-y-3">
            {isLive && <LiveDot on={live.polling} />}
            {wk.games.length === 0 ? (
              <p className="text-sm text-muted">
                {wk.isPlayoff && !wk.played
                  ? 'Playoff matchups are set after the regular season.'
                  : 'No games scheduled.'}
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {wk.games.map((g) => (
                  <ScoreCard
                    key={g.id}
                    game={g}
                    played={wk.played}
                    managers={season.managers}
                    players={players}
                    seasonTeams={season.playerTeams}
                    to={`/scores/${season.year}/${wk.week}/${g.matchupId}`}
                    year={season.year}
                    live={outlookOf(g) ?? undefined}
                  />
                ))}
                <WeekScores week={wk} managers={season.managers} year={season.year} live={isLive} />
              </div>
            )}
          </div>
        );
      })}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/ScoreCard.test.tsx src/components/boxscore/WeekScores.test.tsx`

Expected: PASS, including every existing ScoreCard and WeekScores test.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/ScoreCard.tsx packages/web/src/components/ScoreCard.test.tsx packages/web/src/components/boxscore/WeekScores.tsx packages/web/src/components/boxscore/WeekScores.test.tsx packages/web/src/pages/ScoresPage.tsx
git commit -m "Live scores: the current week's scoreboard is live"
```

---

### Task 8: The live box score

**Files:**
- Create: `packages/web/src/components/boxscore/LiveOutlook.tsx`
- Modify: `packages/web/src/components/boxscore/LineupTable.tsx`, `packages/web/src/pages/BoxScorePage.tsx`
- Test: `packages/web/src/components/boxscore/LiveOutlook.test.tsx`, `packages/web/src/components/boxscore/LineupTable.test.tsx` (add a case)

**Interfaces:**
- Consumes:
  - Task 1: `PlayerGame`, `gameLabel`, `playerGames`
  - Task 2: `GameOutlook`
  - Task 5: `useLive`, `useLiveStats`
  - Task 6: `weekStatus`
- Produces:
  - `LiveOutlook({ outlook, pregame, names }: { outlook: GameOutlook; pregame: [number, number]; names: [string, string] })`
  - `LineupTable` takes an optional `gameOf?: (id: PlayerId) => PlayerGame`

- [ ] **Step 1: Write the failing tests**

`packages/web/src/components/boxscore/LiveOutlook.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import LiveOutlook from './LiveOutlook';

describe('LiveOutlook', () => {
  it('shows each side\'s projected final against its pre-game projection, and the win % split', () => {
    render(<LiveOutlook outlook={{ projected: [118.4, 96.2], win: [64, 36], status: 'live' }} pregame={[110, 105]} names={['Team Alice', 'Team Bob']} />);
    expect(screen.getByText('118.40')).toBeInTheDocument();
    expect(screen.getByText('96.20')).toBeInTheDocument();
    expect(screen.getByTestId('proj-bar-0')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('proj-bar-1').style.width).toBe(`${(96.2 / 118.4) * 100}%`);
    expect(screen.getByTestId('pregame-1').style.left).toBe(`${(105 / 118.4) * 100}%`);
    expect(screen.getByTestId('win-0')).toHaveStyle({ width: '64%' });
    expect(screen.getByTestId('win-1')).toHaveStyle({ width: '36%' });
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('36%')).toBeInTheDocument();
  });
});
```

Append to `packages/web/src/components/boxscore/LineupTable.test.tsx`, inside `describe('LineupTable', ...)` and using that file's `side(userId, starter, bench)` and `players`:
```tsx
  it('shows each starter\'s NFL game state when live', () => {
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', []), side('b', 'b1', [])]} slots={['QB']} players={players} seasonTeams={{}}
      gameOf={(id) => (id === 'a1' ? { kind: 'live', period: 3, clock: '4:12', halftime: false } : { kind: 'final' })} /></MemoryRouter>);
    expect(screen.getAllByTestId('game-state').map((e) => e.textContent)).toEqual(['Q3 4:12', 'Final']);
  });
  it('shows no game state outside the live week', () => {
    render(<MemoryRouter><LineupTable sides={[side('a', 'a1', []), side('b', 'b1', [])]} slots={['QB']} players={players} seasonTeams={{}} /></MemoryRouter>);
    expect(screen.queryByTestId('game-state')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/boxscore/LiveOutlook.test.tsx src/components/boxscore/LineupTable.test.tsx`

Expected: FAIL. The module `./LiveOutlook` can't be resolved, and LineupTable finds no `game-state` elements.

- [ ] **Step 3: Implement**

`packages/web/src/components/boxscore/LiveOutlook.tsx`:
```tsx
import { fmtPts } from '../../lib/format';
import type { GameOutlook } from '../../lib/live/outlook';

const COLORS = ['var(--accent)', 'var(--gold)'] as const;

/** Live projected finals (with the pre-game projection as a faint tick) and the two-colour win % bar. */
export default function LiveOutlook({ outlook, pregame, names }: { outlook: GameOutlook; pregame: [number, number]; names: [string, string] }) {
  const max = Math.max(1, ...outlook.projected, ...pregame);
  return (
    <section className="card grid gap-5 p-5 sm:grid-cols-2" aria-label="Live outlook">
      <div>
        <h2 className="section-label mb-2">Projected final</h2>
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-muted">{names[i]}</span>
              <span className="relative block h-2.5 rounded-full bg-surface-2">
                <span data-testid={`proj-bar-${i}`} className="block h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${(outlook.projected[i] / max) * 100}%`, background: COLORS[i] }} />
                <span data-testid={`pregame-${i}`} title={`Pre-game projection ${fmtPts(pregame[i])}`} className="absolute -top-1 h-4.5 w-0.5 bg-ink/40" style={{ left: `${(pregame[i] / max) * 100}%` }} />
              </span>
              <span className="num w-14 text-right font-semibold">{fmtPts(outlook.projected[i])}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="section-label mb-2">Win probability</h2>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {[0, 1].map((i) => (
            <span key={i} data-testid={`win-${i}`} className="block h-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${outlook.win[i]}%`, background: COLORS[i] }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span><span className="num font-semibold">{outlook.win[0]}%</span> <span className="text-muted">{names[0]}</span></span>
          <span><span className="text-muted">{names[1]}</span> <span className="num font-semibold">{outlook.win[1]}%</span></span>
        </div>
      </div>
    </section>
  );
}
```

**`LineupTable.tsx`:**
- Add the import `import { gameLabel, type PlayerGame } from '../../lib/live/gameState';`.
- Add to `Props`:
  ```ts
  /** the live week: each player's NFL game state */
  gameOf?: (id: PlayerId) => PlayerGame;
  ```
- Thread `gameOf` into every `PlayerCell` call (starters and bench), and add it to `PlayerCell`'s props.
- In `PlayerCell`, replace the stat line div with:
```tsx
        <div className="truncate text-xs text-muted">
          {statLine(pos, line.stats) || '-'}
          {gameOf && (() => { const label = gameLabel(gameOf(line.playerId)); return label ? <> · <span data-testid="game-state">{label}</span></> : null; })()}
        </div>
```

**`BoxScorePage.tsx`:**
- Add the imports:
  - `import LiveOutlook from '../components/boxscore/LiveOutlook';`
  - `import { weekStatus } from '../components/ScoreTicker';`
  - `import { playerGames } from '../lib/live/gameState';`
  - `import { useLive, useLiveStats } from '../lib/live/LiveProvider';`
  - `import { playerTeam } from '../lib/players';`
- Replace the top of `BoxScorePage`, down to the `if (!week || !game)` line, with:
```tsx
export default function BoxScorePage() {
  const season = useLoaderData() as Season;
  const { week: weekParam, matchupId } = useParams();
  const live = useLive();
  const synced = season.weeks[Number(weekParam) - 1];
  const isLiveWeek = !!synced && live.season?.year === season.year && live.week === synced.week;
  useLiveStats(isLiveWeek);
  const status = synced ? weekStatus(season, synced, live) : null;
  const week = status?.week;
  const game = week?.games.find((g) => g.matchupId === Number(matchupId));
  if (!week || !game) return <p className="text-muted">No such game.</p>;
  const outlook = status!.outlookOf(game);
  const gameOf = status!.isLive ? playerGames((id) => playerTeam(players, id, season.playerTeams), live.games) : undefined;
  const started = outlook ? outlook.status !== 'upcoming' : week.played;
```
- In the rest of the component:
  - `label` becomes `game.tag ? fmtTag(game.tag) : outlook ? ({ upcoming: 'Upcoming', live: 'Live', final: 'Final' } as const)[outlook.status] : !week.played ? 'Upcoming' : null`.
  - Both `TeamHeader` calls get `played={started}` instead of `played={week.played}`.
  - `outcome` stays based on `week.played`: a live game shows no winner until the sync records it.
- After `</header>`, insert:
```tsx
      {outlook && (
        <LiveOutlook
          outlook={outlook}
          pregame={[game.sides[0].projected, game.sides[1].projected]}
          names={[a, b].map((s) => season.managers[s.userId]?.teamName ?? season.managers[s.userId]?.displayName ?? s.userId) as [string, string]}
        />
      )}
```
- Pass `gameOf={gameOf}` to `LineupTable`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/boxscore src/pages/BoxScorePage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run the whole suite, types and build**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: every test passes (core 204; web 749 plus the new ones), no type errors, and the build succeeds.

- [ ] **Step 6: Look at it**

Run `pnpm dev`, open `/scores/2026/{lastScoredWeek + 1}` and one of its box scores, and screenshot them at desktop and phone widths, in light and dark themes.

Outside game windows the ticker shows projections with "proj". To see the live state, temporarily point `LiveProvider`'s `fetcher` at a stub that returns a live ESPN body and nonzero points. Revert it before committing.

Check:
- ticker cards don't overflow
- the bars render at both widths
- the LIVE dot is legible in both themes

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/boxscore/LiveOutlook.tsx packages/web/src/components/boxscore/LiveOutlook.test.tsx packages/web/src/components/boxscore/LineupTable.tsx packages/web/src/components/boxscore/LineupTable.test.tsx packages/web/src/pages/BoxScorePage.tsx
git commit -m "Live scores: box scores with live stat lines, game states, projected finals and win %"
```

---

## After the plan

During Thursday's game (2026-10-22), fetch `https://api.sleeper.app/projections/nfl/2026/8?season_type=regular&position[]=QB` and `https://api.sleeper.app/stats/nfl/2026/8?season_type=regular&position[]=QB`. If either carries a per-player game `status` that changes in-game, open a follow-up to replace ESPN in `LiveProvider` with it. `gameFor` and `parseScoreboard` are the only ESPN-shaped code.
