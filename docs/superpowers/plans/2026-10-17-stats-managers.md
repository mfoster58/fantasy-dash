# Stats page, Managers tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/stats` page of charts and one sortable table about the league's managers, with a season picker (seasons or All-time) and a pin-a-manager control that highlights one manager in every chart.

**Architecture:** Pure functions under `packages/web/src/lib/stats/` compute every chart's numbers from the committed `Season[]` (one function per chart, sharing `TeamGame`s from `teamGamesOf` and an ownership timeline built from the draft and transaction log). Small presentational components under `packages/web/src/components/stats/` draw them: HTML/CSS grids for heatmaps, bars and dumbbells, SVG only for the two line charts and the age spectrum. `ManagersStats` composes the page; `StatsPage` is the route element. The pinned manager and season live in the URL.

**Tech Stack:** TypeScript, React 18, react-router v7 (`useSearchParams`, loaders), Tailwind v4 with the site's CSS tokens, Vitest + Testing Library (jsdom), pnpm workspace (`@fantasy-dash/core` types and `computeStandings`).

**Spec:** `docs/superpowers/specs/2026-10-17-stats-managers-design.md`

## Global Constraints

- Everything derives from the committed season JSON; the only data-file change is `data/players.json` gaining `birthDate` via `pnpm sync` (Task 1), and the page must work without it (estimated ages, caption says "estimated").
- Colours: pinned manager and best-of-week marks are `--gold`; red (`--loss`) and green (`--win`) always mean bad and good; unpinned marks use the new `--dim` token or `--muted`; never a per-manager colour palette.
- Close games are decided by **10 points or fewer**; blowouts by **30 or more**.
- Elo: start 1500, `K = 32 × min(2, 1 + margin / 40)`, expected `1 / (1 + 10^((opp − me) / 400))`, offseason `r = 1500 + (r − 1500) × 2/3`, every played game counts (regular, playoff, consolation).
- Median record: a week counts as a win when the manager's score is strictly above that week's league median (mean of the two middle scores).
- Regular season only for: standings race, scoring calendar, weekly finishes, consistency, schedule luck, strength of schedule, close and blowout records, streaks, PPG, PA/G, SD, floor and ceiling. Postseason = every playoff-week game, consolation included.
- Tooltips are SVG `<title>` or the HTML `title` attribute; no custom tooltip layer.
- Tests: `pnpm test` from the repo root must stay green; `npx tsc --noEmit -p tsconfig.json` in `packages/web` must be clean (vitest does not type-check). Gate on exit codes written to a log file, never on grep output.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work in a worktree (`EnterWorktree`), run `pnpm install --frozen-lockfile` there first. Add `.superpowers/` to `.gitignore` in Task 1.

## Review Focus

1. A season with no played weeks yet (a brand-new year before week 1): every chart and the table must render an empty state, never throw on `weeks[0]` or divide by zero. Pinned to Task 7 (`statTable` on a season with zero games) and Task 13 (page renders the "Season has not started" note).
2. A manager who joined in a later season: Elo must start him at 1500 in his first season and leave his earlier points `null`; the all-time table must show his seasons count; the standings race must not include him in years he did not play. Pinned to Task 3 (`eloHistory` with a late joiner) and Task 2 (`managerRefs`).
3. A drafted player who was dropped and re-added: his points after the re-add are a pickup, not draft returns; the drop week itself still counts for the dropper. Pinned to Task 2 (`ownership` test).
4. A player with no birth date and no `yearsExp`: roster age must skip him rather than produce NaN, and the chart must still render. Pinned to Task 6 (`rosterAge` test with a null-both player).
5. Ties: a tied game counts as neither win nor loss in close games, blowouts, moments, median record or Elo (actual 0.5); the form guide shows a grey T. Pinned to Task 5 (`scheduleLuck` and `moments` with a tied game) and Task 4 (`formGuide` with a tie).

## File structure

**Core (`packages/core`)**: `src/types.ts` (`PlayerInfo.birthDate`), `src/sleeper/types.ts` (`birth_date`), `src/players.ts`, `src/schema.ts`, `test/players.test.ts`.

**Web, data layer (`packages/web/src/lib/stats/`)**, all pure, each with a sibling `.test.ts`:
- `scope.ts` — `Scope`, `scopeSeasons`, `managerRefs`, `weekKey`, `medianOf`, `byWeek`.
- `ownership.ts` — `ownership(season)` → acquisition lookup.
- `elo.ts` — constants, `expectedScore`, `eloShift`, `eloHistory`, `eloFor`.
- `season.ts` — `standingsRace`, `formGuide`, `scoringCalendar`, `weeklyFinishes`.
- `strength.ts` — `consistency`, `scheduleLuck`, `strengthOfSchedule`, `allPlayGrid`, `postseasonForm`.
- `roster.ts` — `draftReturns`, `pointOrigins`, `rosterAge`, `wireActivity`.
- `moments.ts` — `moments`.
- `table.ts` — `StatRow`, `COLUMNS`, `statTable`.
- `src/test/statsFixtures.ts` — the four-manager, two-season mini league every stats test uses.

**Web, components (`packages/web/src/components/stats/`)**, each with a sibling `.test.tsx`:
- `pin.ts` — `usePinHover`, `tone` helpers; `About.tsx` (the "?" popover lifted from `Board.tsx`); `StatCard.tsx`; `ManagerName.tsx`.
- Primitives: `Heatmap.tsx`, `Dumbbell.tsx`, `MultiLine.tsx`.
- Charts: `StandingsRace.tsx`, `FormGuide.tsx`, `ScoringCalendar.tsx`, `WeeklyFinishes.tsx`, `PowerRating.tsx`, `Consistency.tsx`, `ScheduleLuck.tsx`, `StrengthOfSchedule.tsx`, `AllPlayGrid.tsx`, `PostseasonForm.tsx`, `DraftReturns.tsx`, `PointOrigins.tsx`, `RosterAge.tsx`, `WireActivity.tsx`, `Moments.tsx`, `StatTable.tsx`.
- `StatsToolbar.tsx`, `ManagersStats.tsx`.

**Web, wiring**: `src/pages/StatsPage.tsx`, `src/routes.tsx`, `src/components/Nav.tsx`, `src/index.css` (`--dim`), `src/components/players/Board.tsx` (uses the lifted `About`), `docs/superpowers/specs/2026-10-17-stats-managers-design.md` (closing notes).

---
### Task 1: Birth dates in the player file, worktree setup

**Files:**
- Modify: `packages/core/src/sleeper/types.ts:57-65`, `packages/core/src/types.ts:8-16`, `packages/core/src/players.ts:4-22`, `packages/core/src/schema.ts:162`
- Modify: `packages/core/test/players.test.ts`
- Modify: `.gitignore`
- Data: `data/players.json` (via `pnpm sync`)

**Interfaces:**
- Produces: `PlayerInfo.birthDate: string | null` (ISO `YYYY-MM-DD` or null), present on every entry of `data/players.json` once the sync has run; `src/test/playerFixtures.ts` players gain `birthDate: null`.

- [ ] **Step 1: Worktree and baseline**

Use `EnterWorktree` with name `stats-managers`. In it run:

```bash
pnpm install --frozen-lockfile > /tmp/claude-501/install.log 2>&1; echo "exit $?"
pnpm test > /tmp/claude-501/base.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/base.log
```
Expected: both exit 0; core 120 and web 387 tests passing (or whatever main has today).

Append `.superpowers/` on its own line to `.gitignore`.

- [ ] **Step 2: Write the failing core test**

In `packages/core/test/players.test.ts`, change the first test's inputs and expectations:

```ts
    const dir = toPlayerDirectory({
      '4034': { player_id: '4034', full_name: 'Christian McCaffrey', first_name: 'Christian', last_name: 'McCaffrey', position: 'RB', team: 'SF', years_exp: 7, birth_date: '1996-06-07' },
      'SF': { player_id: 'SF', first_name: 'San Francisco', last_name: '49ers', position: 'DEF', team: 'SF' },
      '999': { player_id: '999', first_name: 'No', last_name: 'Position', birth_date: '' },
    });
    expect(dir['4034']).toEqual({ id: '4034', name: 'Christian McCaffrey', firstName: 'Christian', lastName: 'McCaffrey', position: 'RB', team: 'SF', yearsExp: 7, birthDate: '1996-06-07' });
    expect(dir['SF']).toEqual({ id: 'SF', name: 'San Francisco 49ers', firstName: 'San Francisco', lastName: '49ers', position: 'DEF', team: 'SF', yearsExp: null, birthDate: null });
    expect(dir['999'].birthDate).toBeNull();
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd packages/core && npx vitest run test/players.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "×|Tests " /tmp/claude-501/t.log`
Expected: exit 1, the first test fails on the missing `birthDate` key.

- [ ] **Step 4: Implement**

`packages/core/src/sleeper/types.ts`, inside `SleeperPlayer`, after `years_exp`:
```ts
  /** 'YYYY-MM-DD'; empty or absent for team defenses and some retired players */
  birth_date?: string | null;
```
`packages/core/src/types.ts`, inside `PlayerInfo`, after `yearsExp`:
```ts
  /** 'YYYY-MM-DD'; null when Sleeper has none (team defenses, some older players) */
  birthDate: string | null;
```
`packages/core/src/players.ts`, in `toPlayerDirectory`, after `yearsExp:`:
```ts
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(p.birth_date ?? '') ? (p.birth_date as string) : null,
```
`packages/core/src/schema.ts` line 162, after `yearsExp: z.number().nullable(),`:
```ts
  birthDate: z.string().nullable(),
```

- [ ] **Step 5: Run core tests, then fix the web fixtures and type check**

Run: `cd packages/core && npx vitest run > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 0.

In `packages/web/src/test/playerFixtures.ts` add `, birthDate: null` to every entry of `players` (six entries). Then grep the web package for other hand-built `PlayerInfo`/`PlayerDirectory` literals and add `birthDate: null` to each:

```bash
cd packages/web && grep -rln "yearsExp:" src | grep -v "lib/stats"
```
Expected files include `ScoreCard.test.tsx`, `pages/GradingPage.test.tsx`, `pages/DraftPage.test.tsx` and others; add the key to each literal. Then:

Run: `cd packages/web && npx tsc --noEmit -p tsconfig.json > /tmp/claude-501/tsc.log 2>&1; echo "exit $?"; head /tmp/claude-501/tsc.log`
Expected: exit 0.

- [ ] **Step 6: Refresh the player file**

Run from the repo root: `pnpm sync > /tmp/claude-501/sync.log 2>&1; echo "exit $?"; tail -5 /tmp/claude-501/sync.log`
Expected: exit 0 and `data/players.json` now has `birthDate` on every entry: `node -e "const p=require('./data/players.json');const v=Object.values(p);console.log(v.length, v.filter(x=>x.birthDate).length)"` prints a non-zero second number.

If the sync fails (no network, Sleeper down), do not retry more than once; note it in the ledger as `Ruling: sync unavailable, ages estimated` and move on. Nothing later depends on the field being present. If the sync changed `data/seasons/*.json` or `data/history.json` as well, keep those changes only if `pnpm test` stays green; otherwise `git checkout -- data/seasons data/history.json` and keep just `data/players.json`.

- [ ] **Step 7: Full test run and commit**

Run: `pnpm test > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 0.

```bash
git add -A packages/core packages/web/src/test packages/web/src .gitignore data/players.json
git commit -m "Players carry a birth date for the roster age chart

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 2: Stats fixtures, scope helpers, ownership timeline

**Files:**
- Create: `packages/web/src/test/statsFixtures.ts`
- Create: `packages/web/src/lib/stats/scope.ts`, `packages/web/src/lib/stats/scope.test.ts`
- Create: `packages/web/src/lib/stats/ownership.ts`, `packages/web/src/lib/stats/ownership.test.ts`

**Interfaces:**
- Consumes: `teamGamesOf`, `TeamGame` from `src/lib/managerGames.ts`; `computeStandings` from `@fantasy-dash/core`; `game`, `line`, `side`, `week`, `season` from `src/test/playerFixtures.ts`.
- Produces:
  - `statsFixtures.ts`: `statsPlayers: PlayerDirectory`, `MANAGERS: Record<UserId, Manager>`, `season2024(): Season`, `season2025(): Season`, `league(): Season[]` (2024 then 2025).
  - `scope.ts`: `type Scope = number | 'all'`; `interface ManagerRef { id: UserId; name: string; avatar: string | null }`; `scopeSeasons(seasons, scope): Season[]`; `managerRefs(seasons): ManagerRef[]`; `weekKey(year, week): string`; `medianOf(values: number[]): number`; `byWeek(games: TeamGame[]): WeekGroup[]` with `interface WeekGroup { key: string; year: number; week: number; playoff: boolean; games: TeamGame[] }`; `regular(games): TeamGame[]`.
  - `ownership.ts`: `type Acquisition = { kind: 'draft'; round: number; pickNo: number } | { kind: 'waiver' | 'free_agent' | 'trade' | 'commissioner'; week: number; bid: number | null }`; `ownership(season): (playerId, userId, week) => Acquisition | null`.

The fixture league (used by every stats test; keep these numbers, later tasks' expectations are computed from them):

| 2025 | a (alice) | b (bob) | c (cara) | d (dan) |
|---|---|---|---|---|
| W1 | q1 60 + r2 60 = **120** vs b | r1 **100** vs a | w1 **90** vs d | t1 **110** vs c |
| W2 | q1 70 + r2 60 = **130** vs c | r1 **118** vs d | w1 **95** vs a | t1 **112** vs b |
| W3 | q1 50 + x1 30 = **80** vs d | r1 100 + x2 40 = **140** vs c | t1 **100** vs b | w1 **75** vs a |
| W4 | q1 60 + t2 40 = **100** vs b | r1 **99** vs a | t1 **130** vs d | w1 **60** vs c |
| W5 (playoff) | q1 100 + t2 50 = **150** vs d, Final | r1 **90** vs c, Toilet Bowl | t1 **95** vs b | w1 **120** vs a |

2024 (no playoffs, no draft, no transactions): W1 a q1 100 vs b r1 90, c w1 80 vs d t1 70; W2 a q1 90 vs c w1 100, b r1 110 vs d t1 60.

2025 draft (2 rounds, snake, slots a b c d): R1 a q1 (value 20), b r1 (15), c w1 (−5), d t1 (10); R2 d k1 (0), c KC (−2), b w2 (3), a t2 (−8). 2025 transactions in created order: week 2 waiver a adds x1 drops t2 bid 10; week 3 free agent b adds x2; week 3 trade c gets t1 from d, d gets w1 from c; week 4 waiver a adds t2 drops x1 bid 3.

- [ ] **Step 1: Write the fixtures**

`packages/web/src/test/statsFixtures.ts`:

```ts
import { computeStandings, type Draft, type DraftPick, type Manager, type PlayerDirectory, type PlayerLine, type Season, type Transaction, type UserId, type Week } from '@fantasy-dash/core';
import { game, line, side, week, season } from './playerFixtures';

const P = (id: string, name: string, position: string, yearsExp: number | null, birthDate: string | null) =>
  ({ id, name, firstName: name.split(' ')[0], lastName: name.split(' ')[1] ?? '', position, team: 'KC', yearsExp, birthDate });

export const statsPlayers: PlayerDirectory = {
  q1: P('q1', 'Quincy One', 'QB', 3, '1999-03-01'),
  r1: P('r1', 'Ricky One', 'RB', 5, '1995-09-02'),
  r2: P('r2', 'Ricky Two', 'RB', 1, null),
  w1: P('w1', 'Wally One', 'WR', 4, '1998-01-15'),
  w2: P('w2', 'Wally Two', 'WR', 2, '2000-05-05'),
  t1: P('t1', 'Tony One', 'TE', 6, '1996-11-30'),
  t2: P('t2', 'Tony Two', 'TE', 0, null),
  k1: P('k1', 'Kick One', 'K', 8, null),
  KC: P('KC', 'Kansas City Chiefs', 'DEF', null, null),
  x1: P('x1', 'Xavier One', 'RB', 9, '1992-02-02'),
  x2: P('x2', 'Xavier Two', 'WR', 10, null),
};

export const MANAGERS: Record<UserId, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team Alice', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team Bob', avatar: 'img-b', rosterId: 2 },
  c: { userId: 'c', displayName: 'cara', teamName: 'Team Cara', avatar: null, rosterId: 3 },
  d: { userId: 'd', displayName: 'dan', teamName: 'Team Dan', avatar: null, rosterId: 4 },
};
const IDS = ['a', 'b', 'c', 'd'];

/** a side whose points are the sum of its starters */
const S = (userId: string, starters: [string, number][]) => {
  const lines: PlayerLine[] = starters.map(([p, pts]) => line(p, pts));
  return side(userId, lines.reduce((t, l) => t + l.points, 0), lines);
};
const pick = (round: number, pickNo: number, slot: number, userId: string, playerId: string, value: number): DraftPick => ({
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: true,
  pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value, tradedTo: null,
});
const tx = (id: string, type: Transaction['type'], week: number, created: number, adds: [string, string][], drops: [string, string][], bid: number | null): Transaction =>
  ({ id, type, week, created, adds: adds.map(([playerId, userId]) => ({ playerId, userId })), drops: drops.map(([playerId, userId]) => ({ playerId, userId })), bid });

function finish(year: number, weeks: Week[], playoffWeekStart: number, extra: Partial<Season> = {}): Season {
  const s = season(year, weeks);
  s.playoffWeekStart = playoffWeekStart;
  s.playoffTeams = 2;
  s.managers = { ...MANAGERS };
  s.standings = computeStandings(weeks, IDS, playoffWeekStart);
  return { ...s, ...extra };
}

export function season2024(): Season {
  const y = 2024;
  return finish(y, [
    week(1, [game(y, 1, 1, S('a', [['q1', 100]]), S('b', [['r1', 90]])), game(y, 1, 2, S('c', [['w1', 80]]), S('d', [['t1', 70]]))]),
    week(2, [game(y, 2, 1, S('a', [['q1', 90]]), S('c', [['w1', 100]])), game(y, 2, 2, S('b', [['r1', 110]]), S('d', [['t1', 60]]))]),
  ], 3);
}

export function season2025(): Season {
  const y = 2025;
  const draft: Draft = {
    draftId: 'D25', type: 'snake', rounds: 2, slotOrder: IDS, expectedCurve: null, baselines: {},
    picks: [pick(1, 1, 1, 'a', 'q1', 20), pick(1, 2, 2, 'b', 'r1', 15), pick(1, 3, 3, 'c', 'w1', -5), pick(1, 4, 4, 'd', 't1', 10),
      pick(2, 5, 4, 'd', 'k1', 0), pick(2, 6, 3, 'c', 'KC', -2), pick(2, 7, 2, 'b', 'w2', 3), pick(2, 8, 1, 'a', 't2', -8)],
  };
  const transactions: Transaction[] = [
    tx('t1', 'waiver', 2, 1000, [['x1', 'a']], [['t2', 'a']], 10),
    tx('t2', 'free_agent', 3, 2000, [['x2', 'b']], [], null),
    tx('t3', 'trade', 3, 3000, [['t1', 'c'], ['w1', 'd']], [['t1', 'd'], ['w1', 'c']], null),
    tx('t4', 'waiver', 4, 4000, [['t2', 'a']], [['x1', 'a']], 3),
  ];
  const s = finish(y, [
    week(1, [game(y, 1, 1, S('a', [['q1', 60], ['r2', 60]]), S('b', [['r1', 100]])), game(y, 1, 2, S('c', [['w1', 90]]), S('d', [['t1', 110]]))]),
    week(2, [game(y, 2, 1, S('a', [['q1', 70], ['r2', 60]]), S('c', [['w1', 95]])), game(y, 2, 2, S('b', [['r1', 118]]), S('d', [['t1', 112]]))]),
    week(3, [game(y, 3, 1, S('a', [['q1', 50], ['x1', 30]]), S('d', [['w1', 75]])), game(y, 3, 2, S('b', [['r1', 100], ['x2', 40]]), S('c', [['t1', 100]]))]),
    week(4, [game(y, 4, 1, S('a', [['q1', 60], ['t2', 40]]), S('b', [['r1', 99]])), game(y, 4, 2, S('c', [['t1', 130]]), S('d', [['w1', 60]]))]),
    week(5, [game(y, 5, 1, S('a', [['q1', 100], ['t2', 50]]), S('d', [['w1', 120]]), 'Final'), game(y, 5, 2, S('b', [['r1', 90]]), S('c', [['t1', 95]]), 'Toilet Bowl')], true),
  ], 5, { draft, transactions, honors: { champion: 'a', runnerUp: 'd', third: null, pointsTitle: 'b', lastPlace: 'b' } });
  return s;
}

export const league = (): Season[] => [season2024(), season2025()];
```

- [ ] **Step 2: Write the failing scope tests**

`packages/web/src/lib/stats/scope.test.ts`:

```ts
import { byWeek, managerRefs, medianOf, regular, scopeSeasons, weekKey } from './scope';
import { teamGamesOf } from '../managerGames';
import { league, season2024, season2025 } from '../../test/statsFixtures';

describe('scopeSeasons', () => {
  it('keeps one year or every year, oldest first', () => {
    expect(scopeSeasons([season2025(), season2024()], 'all').map((s) => s.year)).toEqual([2024, 2025]);
    expect(scopeSeasons(league(), 2025).map((s) => s.year)).toEqual([2025]);
    expect(scopeSeasons(league(), 2023)).toEqual([]);
  });
});

describe('managerRefs', () => {
  it('follows the latest season\'s standings, then anyone who only played earlier, by name', () => {
    expect(managerRefs(league()).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(managerRefs(league())[1]).toEqual({ id: 'b', name: 'bob', avatar: 'img-b' });
    const old = season2024();
    old.managers = { ...old.managers, e: { userId: 'e', displayName: 'eve', teamName: null, avatar: null, rosterId: 5 } };
    expect(managerRefs([old, season2025()]).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('is empty without seasons', () => { expect(managerRefs([])).toEqual([]); });
});

describe('helpers', () => {
  it('keys weeks, takes the median of an even and an odd list, splits the regular season and groups games by week', () => {
    expect(weekKey(2025, 3)).toBe('2025-3');
    expect(medianOf([120, 100, 90, 110])).toBe(105);
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([])).toBe(0);
    const games = teamGamesOf([season2025()]);
    expect(regular(games)).toHaveLength(16);
    const weeks = byWeek(games);
    expect(weeks.map((w) => [w.key, w.playoff, w.games.length])).toEqual([['2025-1', false, 4], ['2025-2', false, 4], ['2025-3', false, 4], ['2025-4', false, 4], ['2025-5', true, 4]]);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `cd packages/web && npx vitest run src/lib/stats/scope.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Error|Tests " /tmp/claude-501/t.log | head -3`
Expected: exit 1, "Failed to resolve import './scope'".

- [ ] **Step 4: Implement scope.ts**

```ts
import type { Season, UserId } from '@fantasy-dash/core';
import type { TeamGame } from '../managerGames';

export type Scope = number | 'all';
export interface ManagerRef { id: UserId; name: string; avatar: string | null }
export interface WeekGroup { key: string; year: number; week: number; playoff: boolean; games: TeamGame[] }

/** the seasons a scope covers, oldest first */
export const scopeSeasons = (seasons: Season[], scope: Scope): Season[] =>
  seasons.filter((s) => scope === 'all' || s.year === scope).sort((a, b) => a.year - b.year);

/** every manager in the seasons: the latest season's standings order first, then anyone who only played earlier, by name */
export function managerRefs(seasons: Season[]): ManagerRef[] {
  const sorted = scopeSeasons(seasons, 'all');
  const latest = sorted[sorted.length - 1];
  if (!latest) return [];
  const refOf = (s: Season, id: UserId): ManagerRef => ({ id, name: s.managers[id]?.displayName ?? id, avatar: s.managers[id]?.avatar ?? null });
  const refs = new Map<UserId, ManagerRef>(latest.standings.map((r) => [r.userId, refOf(latest, r.userId)]));
  const rest: ManagerRef[] = [];
  for (const s of sorted) for (const m of Object.values(s.managers)) if (!refs.has(m.userId) && !rest.some((r) => r.id === m.userId)) rest.push(refOf(s, m.userId));
  rest.sort((x, y) => x.name.localeCompare(y.name));
  return [...refs.values(), ...rest];
}

export const weekKey = (year: number, week: number): string => `${year}-${week}`;

/** middle value, or the mean of the two middle values; 0 for nothing */
export function medianOf(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const m = v.length / 2;
  return v.length % 2 ? v[Math.floor(m)] : (v[m - 1] + v[m]) / 2;
}

export const regular = (games: TeamGame[]): TeamGame[] => games.filter((g) => !g.isPlayoff);

/** games grouped by (year, week) in order; each group holds one game per manager who played */
export function byWeek(games: TeamGame[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  for (const g of games) {
    const key = weekKey(g.year, g.week);
    let group = map.get(key);
    if (!group) { group = { key, year: g.year, week: g.week, playoff: g.isPlayoff, games: [] }; map.set(key, group); }
    group.games.push(g);
  }
  return [...map.values()].sort((x, y) => x.year - y.year || x.week - y.week);
}
```

- [ ] **Step 5: Run the scope tests**

Run: `cd packages/web && npx vitest run src/lib/stats/scope.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0, 4 passed.

- [ ] **Step 6: Write the failing ownership tests**

`packages/web/src/lib/stats/ownership.test.ts`:

```ts
import { ownership } from './ownership';
import { season2024, season2025 } from '../../test/statsFixtures';

describe('ownership', () => {
  const own = ownership(season2025());
  it('credits a drafted player to the drafter with his round and pick', () => {
    expect(own('q1', 'a', 1)).toEqual({ kind: 'draft', round: 1, pickNo: 1 });
    expect(own('q1', 'b', 1)).toBeNull();
  });
  it('a waiver add counts from its week, with the bid', () => {
    expect(own('x1', 'a', 1)).toBeNull();
    expect(own('x1', 'a', 2)).toEqual({ kind: 'waiver', week: 2, bid: 10 });
  });
  it('a drop takes effect the week after it is logged, so the drop week still belongs to the dropper', () => {
    expect(own('x1', 'a', 4)).toEqual({ kind: 'waiver', week: 2, bid: 10 });
    expect(own('x1', 'a', 5)).toBeNull();
  });
  it('a drafted player dropped and re-added is a pickup from the re-add on', () => {
    expect(own('t2', 'a', 1)).toEqual({ kind: 'draft', round: 2, pickNo: 8 });
    expect(own('t2', 'a', 3)).toBeNull();
    expect(own('t2', 'a', 4)).toEqual({ kind: 'waiver', week: 4, bid: 3 });
  });
  it('a trade moves the player to the other manager from the trade week', () => {
    expect(own('t1', 'd', 2)).toEqual({ kind: 'draft', round: 1, pickNo: 4 });
    expect(own('t1', 'c', 3)).toEqual({ kind: 'trade', week: 3, bid: null });
    expect(own('t1', 'd', 3)).toBeNull();
    expect(own('w1', 'd', 5)).toEqual({ kind: 'trade', week: 3, bid: null });
  });
  it('knows nothing about a player the log never mentions, and copes with a season without a draft', () => {
    expect(own('zz', 'a', 1)).toBeNull();
    expect(ownership(season2024())('q1', 'a', 1)).toBeNull();
  });
});
```

- [ ] **Step 7: Run to see them fail**

Run: `cd packages/web && npx vitest run src/lib/stats/ownership.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1 (module not found).

- [ ] **Step 8: Implement ownership.ts**

```ts
import type { PlayerId, Season, UserId } from '@fantasy-dash/core';

export type Acquisition =
  | { kind: 'draft'; round: number; pickNo: number }
  | { kind: 'waiver' | 'free_agent' | 'trade' | 'commissioner'; week: number; bid: number | null };

interface Event { week: number; order: number; add: { owner: UserId; acq: Acquisition } | null; dropBy: UserId | null }

/**
 * Who held a player in a given week and how he was acquired, from the draft (week 0) and the transaction
 * log in created order. An add counts from its week. A drop is logged against the just-played week, so it
 * takes effect the week after: a start in the drop week was still the dropper's.
 */
export function ownership(season: Season): (playerId: PlayerId, userId: UserId, week: number) => Acquisition | null {
  const events = new Map<PlayerId, Event[]>();
  const push = (p: PlayerId, e: Event) => { const list = events.get(p) ?? []; list.push(e); events.set(p, list); };
  for (const pk of season.draft?.picks ?? []) push(pk.playerId, { week: 0, order: pk.pickNo, add: { owner: pk.userId, acq: { kind: 'draft', round: pk.round, pickNo: pk.pickNo } }, dropBy: null });
  const txs = [...season.transactions].sort((x, y) => x.week - y.week || x.created - y.created || (x.id < y.id ? -1 : 1));
  txs.forEach((t, i) => {
    const kind = t.type === 'waiver' || t.type === 'free_agent' || t.type === 'trade' ? t.type : 'commissioner';
    for (const d of t.drops) push(d.playerId, { week: t.week, order: 1000 + i, add: null, dropBy: d.userId });
    for (const a of t.adds) push(a.playerId, { week: t.week, order: 1000 + i + 0.5, add: { owner: a.userId, acq: { kind, week: t.week, bid: t.bid } }, dropBy: null });
  });
  for (const list of events.values()) list.sort((x, y) => x.week - y.week || x.order - y.order);
  return (playerId, userId, week) => {
    let owner: UserId | null = null, acq: Acquisition | null = null;
    for (const e of events.get(playerId) ?? []) {
      if (e.add) { if (e.week > week) break; owner = e.add.owner; acq = e.add.acq; }
      else if (e.dropBy === owner && e.week < week) { owner = null; acq = null; }
    }
    return owner === userId ? acq : null;
  };
}
```

Note the drop rule: a drop event at week `w` only clears ownership when `w < week` (the week being asked about is later than the drop week); an add at week `w` applies when `w <= week`. Events are walked in order, and an add later than the asked week ends the walk.

- [ ] **Step 9: Run both test files, then commit**

Run: `cd packages/web && npx vitest run src/lib/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0, 10 passed.

```bash
git add packages/web/src/test/statsFixtures.ts packages/web/src/lib/stats
git commit -m "Stats: fixture league, scope helpers, ownership timeline

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 3: Elo power rating

**Files:**
- Create: `packages/web/src/lib/stats/elo.ts`, `packages/web/src/lib/stats/elo.test.ts`

**Interfaces:**
- Consumes: `scopeSeasons`, `managerRefs`, `Scope` from `./scope`.
- Produces: `ELO_START = 1500`, `ELO_K = 32`, `ELO_MARGIN = 40`, `ELO_CARRY = 2 / 3`; `expectedScore(me, opp): number`; `eloShift(me, opp, margin, actual: 1 | 0 | 0.5): number`; `interface EloPoint { year: number; week: number; playoff: boolean }`; `interface EloSeries { id: UserId; ratings: (number | null)[] }`; `interface EloHistory { points: EloPoint[]; series: EloSeries[] }`; `eloHistory(seasons): EloHistory`; `eloFor(history, scope): EloHistory`.

- [ ] **Step 1: Write the failing tests**

`packages/web/src/lib/stats/elo.test.ts`:

```ts
import { ELO_START, eloFor, eloHistory, eloShift, expectedScore } from './elo';
import { league, season2025 } from '../../test/statsFixtures';

describe('Elo maths', () => {
  it('expects a coin flip between equals and favours the higher rating', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1600, 1500)).toBeCloseTo(0.64, 2);
  });
  it('scales the move by the margin, capped at double, and moves nobody for an even tie', () => {
    expect(eloShift(1500, 1500, 20, 1)).toBe(24);   // K = 32 × 1.5
    expect(eloShift(1500, 1500, 60, 1)).toBe(32);   // K capped at 64
    expect(eloShift(1500, 1500, 0, 0.5)).toBe(0);
    expect(eloShift(1500, 1500, 20, 0)).toBe(-24);
  });
});

describe('eloHistory', () => {
  const h = eloHistory(league());
  const of = (id: string) => h.series.find((s) => s.id === id)!.ratings;
  it('records one point per played week across the seasons, playoff weeks flagged', () => {
    expect(h.points.map((p) => `${p.year}-${p.week}${p.playoff ? 'P' : ''}`)).toEqual(['2024-1', '2024-2', '2025-1', '2025-2', '2025-3', '2025-4', '2025-5P']);
  });
  it('walks every game: after 2024 the ratings are a 1500, b 1512, c 1540, d 1448', () => {
    expect(of('a')[1]).toBe(1500);
    expect(of('b')[1]).toBe(1512);
    expect(of('c')[1]).toBe(1540);
    expect(of('d')[1]).toBe(1448);
  });
  it('pulls everyone a third of the way back to 1500 between seasons, then keeps going', () => {
    // b enters 2025 at 1508, a at 1500; a beats b by 20 in week 1
    const ea = expectedScore(1500, 1508);
    expect(of('a')[2]).toBeCloseTo(1500 + 48 * (1 - ea), 6);
    expect(of('b')[2]).toBeCloseTo(1508 - 48 * (1 - ea), 6);
  });
  it('starts a manager who joins later at 1500 and leaves his earlier points empty', () => {
    const s = season2025();
    s.managers = { ...s.managers, e: { userId: 'e', displayName: 'eve', teamName: null, avatar: null, rosterId: 5 } };
    const late = eloHistory([league()[0], s]);
    const e = late.series.find((x) => x.id === 'e')!.ratings;
    expect(e.slice(0, 2)).toEqual([null, null]);
    expect(e[2]).toBe(ELO_START);
  });
});

describe('eloFor', () => {
  it('keeps everything for all-time and slices one season, ratings carried in', () => {
    const h = eloHistory(league());
    expect(eloFor(h, 'all')).toBe(h);
    const one = eloFor(h, 2025);
    expect(one.points.map((p) => p.week)).toEqual([1, 2, 3, 4, 5]);
    expect(one.series.find((s) => s.id === 'a')!.ratings[0]).toBe(h.series.find((s) => s.id === 'a')!.ratings[2]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/web && npx vitest run src/lib/stats/elo.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1 (module not found).

- [ ] **Step 3: Implement elo.ts**

```ts
import type { Season, UserId } from '@fantasy-dash/core';
import { managerRefs, scopeSeasons, type Scope } from './scope';

export const ELO_START = 1500;
export const ELO_K = 32;
/** a margin this big doubles the move; the cap */
export const ELO_MARGIN = 40;
/** share of the distance from 1500 a rating keeps across an offseason */
export const ELO_CARRY = 2 / 3;

export interface EloPoint { year: number; week: number; playoff: boolean }
export interface EloSeries { id: UserId; ratings: (number | null)[] }
export interface EloHistory { points: EloPoint[]; series: EloSeries[] }

/** chance the first rating beats the second */
export const expectedScore = (me: number, opp: number): number => 1 / (1 + 10 ** ((opp - me) / 400));

/** how far `me` moves after a game: K scaled by the margin, times the surprise */
export function eloShift(me: number, opp: number, margin: number, actual: 1 | 0 | 0.5): number {
  const k = ELO_K * Math.min(2, 1 + margin / ELO_MARGIN);
  return k * (actual - expectedScore(me, opp));
}

/**
 * Every manager's rating after every played week, across the seasons given: 1500 at a manager's first season,
 * a third of the way back to 1500 at each later one, every game counted (regular, playoff and consolation).
 * A manager not in a season has null for its weeks.
 */
export function eloHistory(seasons: Season[]): EloHistory {
  const sorted = scopeSeasons(seasons, 'all');
  const ids = managerRefs(sorted).map((r) => r.id);
  const rating = new Map<UserId, number>();
  const points: EloPoint[] = [];
  const series = new Map<UserId, (number | null)[]>(ids.map((id) => [id, []]));
  for (const s of sorted) {
    const inSeason = new Set(Object.keys(s.managers));
    for (const id of inSeason) { const r = rating.get(id); rating.set(id, r === undefined ? ELO_START : ELO_START + (r - ELO_START) * ELO_CARRY); }
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        const [x, y] = g.sides;
        const rx = rating.get(x.userId) ?? ELO_START, ry = rating.get(y.userId) ?? ELO_START;
        const actual = x.points > y.points ? 1 : x.points < y.points ? 0 : 0.5;
        const shift = eloShift(rx, ry, Math.abs(x.points - y.points), actual);
        rating.set(x.userId, rx + shift);
        rating.set(y.userId, ry - shift);
      }
      points.push({ year: s.year, week: wk.week, playoff: wk.isPlayoff });
      for (const id of ids) series.get(id)!.push(inSeason.has(id) ? rating.get(id)! : null);
    }
  }
  return { points, series: ids.map((id) => ({ id, ratings: series.get(id)! })) };
}

/** the whole history, or one season's weeks of it with the ratings as they were carried in */
export function eloFor(history: EloHistory, scope: Scope): EloHistory {
  if (scope === 'all') return history;
  const keep = history.points.map((p, i) => (p.year === scope ? i : -1)).filter((i) => i >= 0);
  return { points: keep.map((i) => history.points[i]), series: history.series.map((s) => ({ id: s.id, ratings: keep.map((i) => s.ratings[i]) })) };
}
```

- [ ] **Step 4: Run, then commit**

Run: `cd packages/web && npx vitest run src/lib/stats/elo.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0, 7 passed.

```bash
git add packages/web/src/lib/stats/elo.ts packages/web/src/lib/stats/elo.test.ts
git commit -m "Stats: Elo power rating

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 4: The season charts' numbers

**Files:**
- Create: `packages/web/src/lib/stats/season.ts`, `packages/web/src/lib/stats/season.test.ts`

**Interfaces:**
- Consumes: `teamGamesOf`, `TeamGame` (`../managerGames`); `byWeek`, `regular`, `managerRefs` (`./scope`).
- Produces:
  - `interface RaceData { weeks: number[]; playoffTeams: number; series: { id: UserId; ranks: number[] }[] }`; `standingsRace(season): RaceData`.
  - `interface FormCell { week: number; points: number; oppId: UserId; oppPoints: number; result: 'W' | 'L' | 'T'; matchupId: number; top: boolean }`; `interface FormData { weeks: { week: number; playoff: boolean }[]; rows: { id: UserId; cells: (FormCell | null)[] }[]; playoffAt: number | null }`; `formGuide(season): FormData`.
  - `interface CalendarCell { week: number; points: number; avg: number; delta: number }`; `interface CalendarData { weeks: number[]; rows: { id: UserId; cells: (CalendarCell | null)[] }[] }`; `scoringCalendar(season): CalendarData`.
  - `interface FinishRow { id: UserId; top: number; middle: number; bottom: number; weeks: number }`; `weeklyFinishes(seasons: Season[]): FinishRow[]` (top = rank ≤ 3; bottom = rank > max(3, n − 3); sorted by top desc, bottom asc, id).

- [ ] **Step 1: Write the failing tests**

`packages/web/src/lib/stats/season.test.ts`:

```ts
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from './season';
import { league, season2025 } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

const s25 = season2025();
const row = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;

describe('standingsRace', () => {
  it('ranks by wins then points after every regular-season week', () => {
    const r = standingsRace(s25);
    expect(r.weeks).toEqual([1, 2, 3, 4]);
    expect(r.playoffTeams).toBe(2);
    expect(row(r.series, 'a').ranks).toEqual([1, 1, 1, 1]);
    expect(row(r.series, 'b').ranks).toEqual([3, 3, 2, 2]);
    expect(row(r.series, 'c').ranks).toEqual([4, 4, 4, 3]);
    expect(row(r.series, 'd').ranks).toEqual([2, 2, 3, 4]);
  });
});

describe('formGuide', () => {
  it('lists every played week, flags the playoffs and marks the week\'s top score', () => {
    const f = formGuide(s25);
    expect(f.weeks).toEqual([{ week: 1, playoff: false }, { week: 2, playoff: false }, { week: 3, playoff: false }, { week: 4, playoff: false }, { week: 5, playoff: true }]);
    expect(f.playoffAt).toBe(4);
    expect(row(f.rows, 'a').cells[0]).toEqual({ week: 1, points: 120, oppId: 'b', oppPoints: 100, result: 'W', matchupId: 1, top: true });
    expect(row(f.rows, 'd').cells.map((c) => c!.result)).toEqual(['W', 'L', 'L', 'L', 'L']);
    expect(f.rows.map((r) => r.cells.filter((c) => c!.top).length)).toEqual([3, 1, 1, 0]);
  });
  it('shows a tie as T and leaves a cell empty for a week without a game', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 100, []), side('b', 100, []))])];
    const f = formGuide(s);
    expect(row(f.rows, 'a').cells[0]!.result).toBe('T');
    expect(row(f.rows, 'c').cells[0]).toBeNull();
    expect(f.playoffAt).toBeNull();
  });
});

describe('scoringCalendar', () => {
  it('compares every regular-season score with that week\'s league average', () => {
    const c = scoringCalendar(s25);
    expect(c.weeks).toEqual([1, 2, 3, 4]);
    expect(row(c.rows, 'a').cells.map((x) => [x!.points, x!.avg, x!.delta])).toEqual([[120, 105, 15], [130, 113.75, 16.25], [80, 98.75, -18.75], [100, 97.25, 2.75]]);
  });
});

describe('weeklyFinishes', () => {
  it('counts top-three and bottom weeks over one season, sorted by the top count', () => {
    const f = weeklyFinishes([s25]);
    expect(f.map((r) => [r.id, r.top, r.middle, r.bottom, r.weeks])).toEqual([['a', 4, 0, 0, 4], ['b', 4, 0, 0, 4], ['c', 2, 0, 2, 4], ['d', 2, 0, 2, 4]]);
  });
  it('adds up across seasons', () => {
    const f = weeklyFinishes(league());
    expect(row(f, 'a')).toEqual({ id: 'a', top: 6, middle: 0, bottom: 0, weeks: 6 });
    expect(row(f, 'd')).toEqual({ id: 'd', top: 2, middle: 0, bottom: 4, weeks: 6 });
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/web && npx vitest run src/lib/stats/season.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1 (module not found).

- [ ] **Step 3: Implement season.ts**

```ts
import type { Season, UserId } from '@fantasy-dash/core';
import { teamGamesOf, type TeamGame } from '../managerGames';
import { byWeek, regular } from './scope';

export interface RaceData { weeks: number[]; playoffTeams: number; series: { id: UserId; ranks: number[] }[] }
export interface FormCell { week: number; points: number; oppId: UserId; oppPoints: number; result: 'W' | 'L' | 'T'; matchupId: number; top: boolean }
export interface FormData { weeks: { week: number; playoff: boolean }[]; rows: { id: UserId; cells: (FormCell | null)[] }[]; playoffAt: number | null }
export interface CalendarCell { week: number; points: number; avg: number; delta: number }
export interface CalendarData { weeks: number[]; rows: { id: UserId; cells: (CalendarCell | null)[] }[] }
export interface FinishRow { id: UserId; top: number; middle: number; bottom: number; weeks: number }

const round2 = (n: number) => Math.round(n * 100) / 100;
const idsOf = (season: Season): UserId[] => season.standings.map((r) => r.userId);
const mine = (games: TeamGame[], id: UserId) => games.find((g) => g.userId === id) ?? null;

/** table position (wins, then points for) after each regular-season week */
export function standingsRace(season: Season): RaceData {
  const ids = idsOf(season);
  const weeks = byWeek(regular(teamGamesOf([season])));
  const wins = new Map<UserId, number>(ids.map((id) => [id, 0]));
  const pf = new Map<UserId, number>(ids.map((id) => [id, 0]));
  const ranks = new Map<UserId, number[]>(ids.map((id) => [id, []]));
  for (const w of weeks) {
    for (const g of w.games) { if (g.result === 'W') wins.set(g.userId, (wins.get(g.userId) ?? 0) + 1); pf.set(g.userId, (pf.get(g.userId) ?? 0) + g.points); }
    const order = [...ids].sort((x, y) => (wins.get(y)! - wins.get(x)!) || (pf.get(y)! - pf.get(x)!));
    order.forEach((id, i) => ranks.get(id)!.push(i + 1));
  }
  return { weeks: weeks.map((w) => w.week), playoffTeams: season.playoffTeams, series: ids.map((id) => ({ id, ranks: ranks.get(id)! })) };
}

/** one cell per manager per played week, regular and postseason, the week's top score marked */
export function formGuide(season: Season): FormData {
  const ids = idsOf(season);
  const weeks = byWeek(teamGamesOf([season]));
  const playoffAt = weeks.findIndex((w) => w.playoff);
  return {
    weeks: weeks.map((w) => ({ week: w.week, playoff: w.playoff })),
    playoffAt: playoffAt >= 0 ? playoffAt : null,
    rows: ids.map((id) => ({
      id,
      cells: weeks.map((w) => {
        const g = mine(w.games, id);
        if (!g) return null;
        const top = Math.max(...w.games.map((x) => x.points));
        return { week: w.week, points: g.points, oppId: g.opponentId, oppPoints: g.oppPoints, result: g.result, matchupId: g.matchupId, top: g.points === top };
      }),
    })),
  };
}

/** every regular-season score against that week's league average */
export function scoringCalendar(season: Season): CalendarData {
  const ids = idsOf(season);
  const weeks = byWeek(regular(teamGamesOf([season])));
  return {
    weeks: weeks.map((w) => w.week),
    rows: ids.map((id) => ({
      id,
      cells: weeks.map((w) => {
        const g = mine(w.games, id);
        if (!g) return null;
        const avg = round2(w.games.reduce((t, x) => t + x.points, 0) / w.games.length);
        return { week: w.week, points: g.points, avg, delta: round2(g.points - avg) };
      }),
    })),
  };
}

/** weeks finished in the top three scorers, the bottom three, and in between, over every regular-season week given */
export function weeklyFinishes(seasons: Season[]): FinishRow[] {
  const rows = new Map<UserId, FinishRow>();
  for (const w of byWeek(regular(teamGamesOf(seasons)))) {
    const n = w.games.length;
    const sorted = [...w.games].sort((x, y) => y.points - x.points);
    sorted.forEach((g, i) => {
      const rank = 1 + sorted.filter((o) => o.points > g.points).length;
      const row = rows.get(g.userId) ?? { id: g.userId, top: 0, middle: 0, bottom: 0, weeks: 0 };
      row.weeks += 1;
      if (rank <= 3) row.top += 1; else if (rank > Math.max(3, n - 3)) row.bottom += 1; else row.middle += 1;
      rows.set(g.userId, row);
      void i;
    });
  }
  return [...rows.values()].sort((x, y) => y.top - x.top || x.bottom - y.bottom || (x.id < y.id ? -1 : 1));
}
```

(Drop the `void i;` line and the unused index if the linter complains; it is only there to keep `forEach`'s signature obvious.)

- [ ] **Step 4: Run, then commit**

Run: `cd packages/web && npx vitest run src/lib/stats/season.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0, 6 passed.

```bash
git add packages/web/src/lib/stats/season.ts packages/web/src/lib/stats/season.test.ts
git commit -m "Stats: standings race, form guide, scoring calendar, weekly finishes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 5: Strength charts and moments

**Files:**
- Create: `packages/web/src/lib/stats/strength.ts`, `packages/web/src/lib/stats/strength.test.ts`
- Create: `packages/web/src/lib/stats/moments.ts`, `packages/web/src/lib/stats/moments.test.ts`

**Interfaces:**
- Consumes: `TeamGame` (`../managerGames`), `byWeek`, `medianOf`, `regular` (`./scope`).
- Produces (all take `games: TeamGame[]`, already scoped):
  - `interface ConsistencyRow { id; games; min; floor; median; ceiling; max }`; `consistency(games): ConsistencyRow[]` sorted by median desc (floor/ceiling = second-worst/second-best week, or min/max under four games).
  - `interface LuckRow { id; w; l; t; medianW; medianL; delta }`; `scheduleLuck(games): LuckRow[]` sorted by delta desc then id.
  - `interface SosRow { id; faced; leagueAvg; delta }`; `strengthOfSchedule(games): SosRow[]` sorted by delta desc.
  - `interface PairRecord { w; l; t; realW; realL; realT }`; `interface AllPlayGrid { ids: UserId[]; cells: Record<UserId, Record<UserId, PairRecord>> }`; `allPlayGrid(games, ids): AllPlayGrid` (regular weeks both played; `real*` are the actual matchups).
  - `interface PostseasonRow { id; regPpg; postPpg; postGames; delta }`; `postseasonForm(games): PostseasonRow[]` (only managers with a postseason game, sorted by delta desc).
  - `interface Moment { year; week; matchupId; winnerId; loserId; winPts; losePts; margin }`; `interface Moments { robbed; stolen; flattened; close: Moment[] }`; `moments(games, n = 4): Moments` (ties excluded).

- [ ] **Step 1: Write the failing strength tests**

`packages/web/src/lib/stats/strength.test.ts`:

```ts
import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from './strength';
import { teamGamesOf } from '../managerGames';
import { league, season2024, season2025 } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

const g25 = teamGamesOf([season2025()]);
const row = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;

describe('consistency', () => {
  it('takes the floor and ceiling one week in from the extremes, sorted by median', () => {
    const c = consistency(g25);
    expect(c.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(row(c, 'a')).toEqual({ id: 'a', games: 4, min: 80, floor: 100, median: 110, ceiling: 120, max: 130 });
    expect(row(c, 'd').median).toBe(92.5);
  });
  it('uses the extremes themselves under four games', () => {
    expect(row(consistency(teamGamesOf([season2024()])), 'a')).toEqual({ id: 'a', games: 2, min: 90, floor: 90, median: 95, ceiling: 100, max: 100 });
  });
});

describe('scheduleLuck', () => {
  it('compares the real record with the record against the weekly median', () => {
    const l = scheduleLuck(g25);
    expect(l.map((r) => r.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(row(l, 'a')).toEqual({ id: 'a', w: 4, l: 0, t: 0, medianW: 3, medianL: 1, delta: 1 });
    expect(row(l, 'c')).toEqual({ id: 'c', w: 1, l: 3, t: 0, medianW: 2, medianL: 2, delta: -1 });
  });
  it('counts a tie as neither, and scoring exactly the median as a median loss', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 100, []), side('b', 100, [])), game(2025, 1, 2, side('c', 90, []), side('d', 80, []))])];
    const l = scheduleLuck(teamGamesOf([s]));
    expect(row(l, 'a')).toEqual({ id: 'a', w: 0, l: 0, t: 1, medianW: 1, medianL: 0, delta: -1 });
    expect(row(l, 'c').medianW).toBe(0);
  });
});

describe('strengthOfSchedule', () => {
  it('measures opponents\' scoring against the league\'s weekly average', () => {
    const s = strengthOfSchedule(g25);
    expect(s.map((r) => r.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(row(s, 'a')).toEqual({ id: 'a', faced: 92.25, leagueAvg: 103.69, delta: -11.44 });
  });
});

describe('allPlayGrid', () => {
  it('counts the weeks each manager outscored each other, with the real matchup record alongside', () => {
    const grid = allPlayGrid(g25, ['a', 'b', 'c', 'd']);
    expect(grid.ids).toEqual(['a', 'b', 'c', 'd']);
    expect(grid.cells.a.b).toEqual({ w: 3, l: 1, t: 0, realW: 2, realL: 0, realT: 0 });
    expect(grid.cells.b.a).toEqual({ w: 1, l: 3, t: 0, realW: 0, realL: 2, realT: 0 });
    expect(grid.cells.a.c).toEqual({ w: 2, l: 2, t: 0, realW: 1, realL: 0, realT: 0 });
    expect(grid.cells.a.a).toBeUndefined();
  });
});

describe('postseasonForm', () => {
  it('sets postseason scoring against the regular season for everyone who played a postseason game', () => {
    const p = postseasonForm(g25);
    expect(p.map((r) => r.id)).toEqual(['a', 'd', 'c', 'b']);
    expect(row(p, 'a')).toEqual({ id: 'a', regPpg: 107.5, postPpg: 150, postGames: 1, delta: 42.5 });
    expect(postseasonForm(teamGamesOf([season2024()]))).toEqual([]);
    expect(postseasonForm(teamGamesOf(league())).find((r) => r.id === 'a')!.regPpg).toBeCloseTo((430 + 190) / 6, 2);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/web && npx vitest run src/lib/stats/strength.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1 (module not found).

- [ ] **Step 3: Implement strength.ts**

```ts
import type { UserId } from '@fantasy-dash/core';
import type { TeamGame } from '../managerGames';
import { byWeek, medianOf, regular } from './scope';

export interface ConsistencyRow { id: UserId; games: number; min: number; floor: number; median: number; ceiling: number; max: number }
export interface LuckRow { id: UserId; w: number; l: number; t: number; medianW: number; medianL: number; delta: number }
export interface SosRow { id: UserId; faced: number; leagueAvg: number; delta: number }
export interface PairRecord { w: number; l: number; t: number; realW: number; realL: number; realT: number }
export interface AllPlayGrid { ids: UserId[]; cells: Record<UserId, Record<UserId, PairRecord>> }
export interface PostseasonRow { id: UserId; regPpg: number; postPpg: number; postGames: number; delta: number }

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const group = (games: TeamGame[]): Map<UserId, TeamGame[]> => {
  const m = new Map<UserId, TeamGame[]>();
  for (const g of games) m.set(g.userId, [...(m.get(g.userId) ?? []), g]);
  return m;
};

/** worst to best regular-season week, with the floor and ceiling one week in from the ends once there are four */
export function consistency(games: TeamGame[]): ConsistencyRow[] {
  const rows: ConsistencyRow[] = [];
  for (const [id, mine] of group(regular(games))) {
    const pts = mine.map((g) => g.points).sort((x, y) => x - y);
    const n = pts.length;
    const inset = n >= 4 ? 1 : 0;
    rows.push({ id, games: n, min: pts[0], floor: pts[inset], median: medianOf(pts), ceiling: pts[n - 1 - inset], max: pts[n - 1] });
  }
  return rows.sort((x, y) => y.median - x.median || (x.id < y.id ? -1 : 1));
}

/** the real regular-season record against the record a manager would have against the weekly league median */
export function scheduleLuck(games: TeamGame[]): LuckRow[] {
  const rows = new Map<UserId, LuckRow>();
  for (const w of byWeek(regular(games))) {
    const median = medianOf(w.games.map((g) => g.points));
    for (const g of w.games) {
      const r = rows.get(g.userId) ?? { id: g.userId, w: 0, l: 0, t: 0, medianW: 0, medianL: 0, delta: 0 };
      if (g.result === 'W') r.w += 1; else if (g.result === 'L') r.l += 1; else r.t += 1;
      if (g.points > median) r.medianW += 1; else r.medianL += 1;
      rows.set(g.userId, r);
    }
  }
  return [...rows.values()].map((r) => ({ ...r, delta: r.w - r.medianW })).sort((x, y) => y.delta - x.delta || (x.id < y.id ? -1 : 1));
}

/** what opponents scored against each manager, against the league's average weekly score */
export function strengthOfSchedule(games: TeamGame[]): SosRow[] {
  const reg = regular(games);
  const leagueAvg = round2(mean(reg.map((g) => g.points)));
  return [...group(reg)].map(([id, mine]) => {
    const faced = round2(mean(mine.map((g) => g.oppPoints)));
    return { id, faced, leagueAvg, delta: round2(faced - leagueAvg) };
  }).sort((x, y) => y.delta - x.delta || (x.id < y.id ? -1 : 1));
}

/** for every ordered pair: the weeks the row outscored the column (both playing that regular week), plus the games they really played */
export function allPlayGrid(games: TeamGame[], ids: UserId[]): AllPlayGrid {
  const cells: AllPlayGrid['cells'] = {};
  const blank = (): PairRecord => ({ w: 0, l: 0, t: 0, realW: 0, realL: 0, realT: 0 });
  for (const a of ids) { cells[a] = {}; for (const b of ids) if (a !== b) cells[a][b] = blank(); }
  for (const w of byWeek(regular(games))) {
    for (const a of w.games) for (const b of w.games) {
      if (a.userId === b.userId || !cells[a.userId]?.[b.userId]) continue;
      const cell = cells[a.userId][b.userId];
      if (a.points > b.points) cell.w += 1; else if (a.points < b.points) cell.l += 1; else cell.t += 1;
      if (a.opponentId === b.userId) { if (a.result === 'W') cell.realW += 1; else if (a.result === 'L') cell.realL += 1; else cell.realT += 1; }
    }
  }
  return { ids, cells };
}

/** regular-season scoring against the postseason (every playoff-week game), for those who played one */
export function postseasonForm(games: TeamGame[]): PostseasonRow[] {
  const rows: PostseasonRow[] = [];
  for (const [id, mine] of group(games)) {
    const post = mine.filter((g) => g.isPlayoff);
    if (post.length === 0) continue;
    const regPpg = round2(mean(mine.filter((g) => !g.isPlayoff).map((g) => g.points)));
    const postPpg = round2(mean(post.map((g) => g.points)));
    rows.push({ id, regPpg, postPpg, postGames: post.length, delta: round2(postPpg - regPpg) });
  }
  return rows.sort((x, y) => y.delta - x.delta || (x.id < y.id ? -1 : 1));
}
```

- [ ] **Step 4: Run the strength tests**

Run: `cd packages/web && npx vitest run src/lib/stats/strength.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0, 8 passed.

- [ ] **Step 5: Write the failing moments test**

`packages/web/src/lib/stats/moments.test.ts`:

```ts
import { moments } from './moments';
import { teamGamesOf } from '../managerGames';
import { season2025 } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

describe('moments', () => {
  const m = moments(teamGamesOf([season2025()]));
  const brief = (x: { week: number; winnerId: string; loserId: string; margin: number }) => `${x.week}:${x.winnerId}>${x.loserId}:${x.margin}`;
  it('finds the highest losing scores, lowest winning scores, biggest and smallest margins', () => {
    expect(m.robbed.map(brief)).toEqual(['5:a>d:30', '2:b>d:6', '1:a>b:20', '3:b>c:40']);
    expect(m.stolen.map(brief)).toEqual(['3:a>d:5', '5:c>b:5', '4:a>b:1', '1:d>c:20']);
    expect(m.flattened.map(brief)).toEqual(['4:c>d:70', '3:b>c:40', '2:a>c:35', '5:a>d:30']);
    expect(m.close.map(brief)).toEqual(['4:a>b:1', '3:a>d:5', '5:c>b:5', '2:b>d:6']);
    expect(m.robbed[0]).toEqual({ year: 2025, week: 5, matchupId: 1, winnerId: 'a', loserId: 'd', winPts: 150, losePts: 120, margin: 30 });
  });
  it('leaves ties out and honours the list length', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 100, []), side('b', 100, [])), game(2025, 1, 2, side('c', 90, []), side('d', 80, []))])];
    const one = moments(teamGamesOf([s]), 1);
    expect(one.close).toHaveLength(1);
    expect(one.close[0].winnerId).toBe('c');
  });
});
```

- [ ] **Step 6: Run to see it fail, then implement moments.ts**

Run: `cd packages/web && npx vitest run src/lib/stats/moments.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

```ts
import type { UserId } from '@fantasy-dash/core';
import type { TeamGame } from '../managerGames';

export interface Moment { year: number; week: number; matchupId: number; winnerId: UserId; loserId: UserId; winPts: number; losePts: number; margin: number }
export interface Moments { robbed: Moment[]; stolen: Moment[]; flattened: Moment[]; close: Moment[] }

/** every decided game once, from the winner's side */
function decided(games: TeamGame[]): Moment[] {
  return games.filter((g) => g.result === 'W').map((g) => ({
    year: g.year, week: g.week, matchupId: g.matchupId, winnerId: g.userId, loserId: g.opponentId, winPts: g.points, losePts: g.oppPoints, margin: Math.round((g.points - g.oppPoints) * 100) / 100,
  }));
}
const chrono = (x: Moment, y: Moment) => x.year - y.year || x.week - y.week || x.matchupId - y.matchupId;

/** the season's injustices and demolitions: highest score in a loss, lowest in a win, biggest and smallest margins */
export function moments(games: TeamGame[], n = 4): Moments {
  const all = decided(games);
  const top = (by: (x: Moment, y: Moment) => number) => [...all].sort((x, y) => by(x, y) || chrono(x, y)).slice(0, n);
  return {
    robbed: top((x, y) => y.losePts - x.losePts),
    stolen: top((x, y) => x.winPts - y.winPts),
    flattened: top((x, y) => y.margin - x.margin),
    close: top((x, y) => x.margin - y.margin),
  };
}
```

- [ ] **Step 7: Run both, then commit**

Run: `cd packages/web && npx vitest run src/lib/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0.

```bash
git add packages/web/src/lib/stats
git commit -m "Stats: consistency, schedule luck, strength of schedule, all-play grid, postseason form, moments

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 6: Roster charts' numbers

**Files:**
- Create: `packages/web/src/lib/stats/roster.ts`, `packages/web/src/lib/stats/roster.test.ts`

**Interfaces:**
- Consumes: `ownership`, `Acquisition` (`./ownership`); `PlayerDirectory`, `Season` (core).
- Produces:
  - `interface DraftReturnCell { round: number; playerId: PlayerId | null; points: number }`; `interface DraftReturnRow { id: UserId; total: number; cells: DraftReturnCell[] }`; `interface DraftReturns { rounds: number; rows: DraftReturnRow[] }`; `draftReturns(season): DraftReturns | null` (null without a draft; rows sorted by total desc).
  - `interface OriginRow { id: UserId; draft: number; pickup: number; trade: number; other: number; total: number }`; `pointOrigins(seasons): OriginRow[]` (sorted by non-draft share desc).
  - `interface AgeRow { id: UserId; age: number; points: number; rookieShare: number; vetShare: number; estimated: boolean }`; `interface RosterAge { rows: AgeRow[]; estimated: boolean }`; `rosterAge(seasons, players): RosterAge` (age at 1 September of the season from `birthDate`, else `22 + yearsExp` and `estimated`, else the player is skipped; rows sorted by age asc; managers with no datable points left out).
  - `interface WireRow { id: UserId; perWeek: number[]; total: number; faab: number }`; `interface WireActivity { weeks: number[]; rows: WireRow[] }`; `wireActivity(season): WireActivity` (waiver and free-agent adds per played week; `faab` = sum of bids; sorted by total desc then id).

- [ ] **Step 1: Write the failing tests**

`packages/web/src/lib/stats/roster.test.ts`:

```ts
import { draftReturns, pointOrigins, rosterAge, wireActivity } from './roster';
import { league, season2024, season2025, statsPlayers } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

const row = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;

describe('draftReturns', () => {
  it('sums the started points each round\'s pick produced for the drafter, nothing after a drop', () => {
    const d = draftReturns(season2025())!;
    expect(d.rounds).toBe(2);
    expect(d.rows.map((r) => [r.id, r.total])).toEqual([['b', 507], ['a', 460], ['d', 222], ['c', 185]]);
    expect(row(d.rows, 'a').cells).toEqual([{ round: 1, playerId: 'q1', points: 340 }, { round: 2, playerId: 't2', points: 120 }]);
    expect(row(d.rows, 'b').cells[1]).toEqual({ round: 2, playerId: 'w2', points: 0 });
  });
  it('is null without a draft', () => { expect(draftReturns(season2024())).toBeNull(); });
});

describe('pointOrigins', () => {
  it('splits started points by draft, pickups and trades, wire-workers first', () => {
    const o = pointOrigins([season2025()]);
    expect(o.map((r) => r.id)).toEqual(['c', 'd', 'a', 'b']);
    expect(row(o, 'a')).toEqual({ id: 'a', draft: 460, pickup: 120, trade: 0, other: 0, total: 580 });
    expect(row(o, 'c')).toEqual({ id: 'c', draft: 185, pickup: 0, trade: 325, other: 0, total: 510 });
  });
  it('calls points of unknown origin "other" and adds seasons up', () => {
    expect(row(pointOrigins([season2024()]), 'a')).toEqual({ id: 'a', draft: 0, pickup: 0, trade: 0, other: 190, total: 190 });
    expect(row(pointOrigins(league()), 'a').total).toBe(770);
  });
});

describe('rosterAge', () => {
  it('weights each player\'s age at 1 September by his started points, youngest manager first', () => {
    const r = rosterAge([season2025()], statsPlayers);
    expect(r.rows.map((x) => x.id)).toEqual(['a', 'd', 'c', 'b']);
    expect(row(r.rows, 'b').age).toBeCloseTo(29.22, 2);   // r1 turns 30 the day after the cut-off; x2 is estimated at 32
    expect(row(r.rows, 'b').estimated).toBe(true);
    expect(row(r.rows, 'c').estimated).toBe(false);
    expect(row(r.rows, 'a').rookieShare).toBeCloseTo(90 / 580, 4);
    expect(row(r.rows, 'a').vetShare).toBeCloseTo(30 / 580, 4);
    expect(r.estimated).toBe(true);
  });
  it('skips a player with neither a birth date nor an experience count, and a manager with nothing datable', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 50, [{ playerId: 'zz', points: 50, projected: null, stats: {} }]), side('b', 10, [{ playerId: 'q1', points: 10, projected: null, stats: {} }]))])];
    const r = rosterAge([s], statsPlayers);
    expect(r.rows.map((x) => [x.id, x.age])).toEqual([['b', 26]]);
    expect(r.estimated).toBe(false);
  });
});

describe('wireActivity', () => {
  it('counts pickups per played week with the season total and FAAB spent, busiest first', () => {
    const w = wireActivity(season2025());
    expect(w.weeks).toEqual([1, 2, 3, 4, 5]);
    expect(w.rows.map((r) => [r.id, r.total, r.faab])).toEqual([['a', 2, 13], ['b', 1, 0], ['c', 0, 0], ['d', 0, 0]]);
    expect(row(w.rows, 'a').perWeek).toEqual([0, 1, 0, 1, 0]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/web && npx vitest run src/lib/stats/roster.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 3: Implement roster.ts**

```ts
import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import { ownership, type Acquisition } from './ownership';

export interface DraftReturnCell { round: number; playerId: PlayerId | null; points: number }
export interface DraftReturnRow { id: UserId; total: number; cells: DraftReturnCell[] }
export interface DraftReturns { rounds: number; rows: DraftReturnRow[] }
export interface OriginRow { id: UserId; draft: number; pickup: number; trade: number; other: number; total: number }
export interface AgeRow { id: UserId; age: number; points: number; rookieShare: number; vetShare: number; estimated: boolean }
export interface RosterAge { rows: AgeRow[]; estimated: boolean }
export interface WireRow { id: UserId; perWeek: number[]; total: number; faab: number }
export interface WireActivity { weeks: number[]; rows: WireRow[] }

/** one started line: who started him, when, for how much, and how he was acquired */
interface Start { id: UserId; year: number; week: number; playerId: PlayerId; points: number; acq: Acquisition | null }

const round2 = (n: number) => Math.round(n * 100) / 100;
const idsOf = (season: Season): UserId[] => season.standings.map((r) => r.userId);
const byId = (x: { id: string }, y: { id: string }) => (x.id < y.id ? -1 : 1);

function starts(season: Season): Start[] {
  const own = ownership(season);
  const out: Start[] = [];
  for (const wk of season.weeks) {
    if (!wk.played) continue;
    for (const g of wk.games) for (const sd of g.sides) for (const e of sd.starters) {
      if (!e.player) continue;
      out.push({ id: sd.userId, year: season.year, week: wk.week, playerId: e.player.playerId, points: e.player.points, acq: own(e.player.playerId, sd.userId, wk.week) });
    }
  }
  return out;
}

/** started points the drafter got from each round's pick */
export function draftReturns(season: Season): DraftReturns | null {
  const draft = season.draft;
  if (!draft) return null;
  const rows = idsOf(season).map((id): DraftReturnRow => {
    const cells: DraftReturnCell[] = [];
    for (let round = 1; round <= draft.rounds; round++) {
      const pick = draft.picks.find((p) => p.userId === id && p.round === round);
      cells.push({ round, playerId: pick?.playerId ?? null, points: 0 });
    }
    for (const s of starts(season)) if (s.id === id && s.acq?.kind === 'draft') { const cell = cells[s.acq.round - 1]; if (cell) cell.points = round2(cell.points + s.points); }
    return { id, cells, total: round2(cells.reduce((t, c) => t + c.points, 0)) };
  });
  return { rounds: draft.rounds, rows: rows.sort((x, y) => y.total - x.total || byId(x, y)) };
}

/** started points by how the player arrived: draft, waivers and free agents, trades, or nobody knows (no log) */
export function pointOrigins(seasons: Season[]): OriginRow[] {
  const rows = new Map<UserId, OriginRow>();
  for (const season of seasons) for (const s of starts(season)) {
    const r = rows.get(s.id) ?? { id: s.id, draft: 0, pickup: 0, trade: 0, other: 0, total: 0 };
    const k = !s.acq ? 'other' : s.acq.kind === 'draft' ? 'draft' : s.acq.kind === 'trade' ? 'trade' : s.acq.kind === 'commissioner' ? 'other' : 'pickup';
    r[k] = round2(r[k] + s.points);
    r.total = round2(r.total + s.points);
    rows.set(s.id, r);
  }
  const share = (r: OriginRow) => (r.total ? (r.total - r.draft) / r.total : 0);
  return [...rows.values()].sort((x, y) => share(y) - share(x) || byId(x, y));
}

/** age on 1 September of the year, from the birth date; else 22 plus NFL seasons (estimated); else null */
export function ageOf(player: PlayerDirectory[string] | undefined, year: number): { age: number; estimated: boolean } | null {
  if (!player) return null;
  if (player.birthDate) {
    const [by, bm, bd] = player.birthDate.split('-').map(Number);
    const before = bm > 9 || (bm === 9 && bd > 1);
    return { age: year - by - (before ? 1 : 0), estimated: false };
  }
  if (player.yearsExp !== null) return { age: 22 + player.yearsExp, estimated: true };
  return null;
}

/** average age behind each manager's started points, weighted by those points */
export function rosterAge(seasons: Season[], players: PlayerDirectory): RosterAge {
  const acc = new Map<UserId, { weighted: number; points: number; rookie: number; vet: number; estimated: boolean }>();
  for (const season of seasons) for (const s of starts(season)) {
    if (s.points <= 0) continue;
    const a = ageOf(players[s.playerId], season.year);
    if (!a) continue;
    const r = acc.get(s.id) ?? { weighted: 0, points: 0, rookie: 0, vet: 0, estimated: false };
    r.weighted += a.age * s.points;
    r.points += s.points;
    if (players[s.playerId]?.yearsExp === 0) r.rookie += s.points;
    if (a.age >= 30) r.vet += s.points;
    r.estimated = r.estimated || a.estimated;
    acc.set(s.id, r);
  }
  const rows = [...acc].filter(([, r]) => r.points > 0).map(([id, r]): AgeRow => ({ id, age: round2(r.weighted / r.points), points: round2(r.points), rookieShare: r.rookie / r.points, vetShare: r.vet / r.points, estimated: r.estimated }));
  return { rows: rows.sort((x, y) => x.age - y.age || byId(x, y)), estimated: rows.some((r) => r.estimated) };
}

/** waiver and free-agent pickups per played week, with the season's total and FAAB spent */
export function wireActivity(season: Season): WireActivity {
  const weeks = season.weeks.filter((w) => w.played).map((w) => w.week);
  const rows = idsOf(season).map((id): WireRow => ({ id, perWeek: weeks.map(() => 0), total: 0, faab: 0 }));
  const byUser = new Map(rows.map((r) => [r.id, r]));
  for (const t of season.transactions) {
    if (t.type !== 'waiver' && t.type !== 'free_agent') continue;
    for (const a of t.adds) {
      const r = byUser.get(a.userId);
      if (!r) continue;
      const i = weeks.indexOf(t.week);
      if (i >= 0) r.perWeek[i] += 1;
      r.total += 1;
      if (t.type === 'waiver' && t.bid) r.faab += t.bid;
    }
  }
  return { weeks, rows: rows.sort((x, y) => y.total - x.total || byId(x, y)) };
}
```

- [ ] **Step 4: Run, then commit**

Run: `cd packages/web && npx vitest run src/lib/stats/roster.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0, 7 passed.

```bash
git add packages/web/src/lib/stats/roster.ts packages/web/src/lib/stats/roster.test.ts
git commit -m "Stats: draft returns, point origins, roster age, wire activity

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 7: The numbers table's rows and columns

**Files:**
- Create: `packages/web/src/lib/stats/table.ts`, `packages/web/src/lib/stats/table.test.ts`

**Interfaces:**
- Consumes: `teamGamesOf` (`../managerGames`); `managerRefs`, `byWeek`, `regular`, `scopeSeasons` (`./scope`); `scheduleLuck`, `strengthOfSchedule`, `consistency` (`./strength`); `weeklyFinishes` (`./season`); `pointOrigins`, `wireActivity` (`./roster`); `fmtSigned`, `fmtWinPct` (`../format`).
- Produces:
  - `interface StatRow` with: `id, seasons, w, l, t, apW, apL, apT, xw, luck, medW, medL, streakW, streakL, ppg, paPg, highs, top3, bottom3, sd, floor, ceiling, closeW, closeL, blowW, blowL, sos, postW, postL, postGames, postPpg, eff, benchLeft, projPlus, dProj, faab, pickups, waiverShare, draftValue` (all numbers).
  - `interface ColumnDef { key: string; label: string; group: 'Record' | 'Scoring' | 'Games' | 'Lineups' | 'Roster' | 'Season'; title: string; higherBetter: boolean; value: (r: StatRow) => number; text: (r: StatRow) => string }`; `COLUMNS: ColumnDef[]` (the `Season` group holds only `seasons`, shown in All-time); `statTable(seasons: Season[]): StatRow[]` in `managerRefs` order.

- [ ] **Step 1: Write the failing tests**

`packages/web/src/lib/stats/table.test.ts`:

```ts
import { COLUMNS, statTable } from './table';
import { league, season2025 } from '../../test/statsFixtures';
import { season } from '../../test/playerFixtures';

const row = (rows: ReturnType<typeof statTable>, id: string) => rows.find((r) => r.id === id)!;

describe('statTable', () => {
  const rows = statTable([season2025()]);
  it('lists every manager in standings order with the season\'s record, all-play, expected wins and luck', () => {
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    const a = row(rows, 'a');
    expect([a.seasons, a.w, a.l, a.t, a.apW, a.apL, a.apT]).toEqual([1, 4, 0, 0, 9, 3, 0]);
    expect(a.xw).toBeCloseTo(3, 6);
    expect(a.luck).toBeCloseTo(1, 6);
    expect([a.medW, a.medL, a.streakW, a.streakL]).toEqual([3, 1, 4, 0]);
  });
  it('carries the scoring, game and lineup numbers', () => {
    const a = row(rows, 'a');
    expect([a.ppg, a.paPg, a.highs, a.top3, a.bottom3, a.floor, a.ceiling]).toEqual([107.5, 92.25, 2, 4, 0, 100, 120]);
    expect(a.sd).toBeCloseTo(19.2, 1);
    expect([a.closeW, a.closeL, a.blowW, a.blowL, a.sos]).toEqual([2, 0, 1, 0, -11.44]);
    expect([a.postW, a.postL, a.postGames, a.postPpg]).toEqual([1, 0, 1, 150]);
    expect(a.eff).toBeCloseTo(580 / 630, 4);
    expect(a.benchLeft).toBe(50);
    expect([a.projPlus, a.dProj]).toEqual([0.5, 7.5]);
  });
  it('carries the roster numbers', () => {
    const a = row(rows, 'a');
    expect([a.faab, a.pickups, a.draftValue]).toEqual([13, 2, 12]);
    expect(a.waiverShare).toBeCloseTo(120 / 580, 4);
    const b = row(rows, 'b');
    expect([b.streakW, b.streakL, b.closeW, b.closeL, b.draftValue]).toEqual([2, 1, 1, 1, 18]);
  });
  it('adds seasons up for all-time', () => {
    const a = row(statTable(league()), 'a');
    expect([a.seasons, a.w, a.l, a.ppg]).toEqual([2, 5, 1, (430 + 190) / 6]);
  });
  it('gives zeros, never NaN, for a season with nothing played', () => {
    const empty = season2026();
    const r = statTable([empty]);
    expect(r).toHaveLength(4);
    for (const col of COLUMNS) expect(col.text(r[0])).not.toMatch(/NaN|undefined/);
    expect(row(r, 'a').ppg).toBe(0);
  });
});

describe('COLUMNS', () => {
  const rows = statTable([season2025()]);
  it('formats every column as text and sorts records by win share', () => {
    const a = rows[0];
    const text = Object.fromEntries(COLUMNS.map((c) => [c.key, c.text(a)]));
    expect(text.rec).toBe('4-0');
    expect(text.allPlay).toBe('9-3');
    expect(text.xw).toBe('3.0');
    expect(text.luck).toBe('+1.0');
    expect(text.median).toBe('3-1');
    expect(text.streaks).toBe('W4 / L0');
    expect(text.eff).toBe('92%');
    expect(text.faab).toBe('$13');
    expect(text.sos).toBe('-11.4');
    expect(COLUMNS.find((c) => c.key === 'rec')!.value(a)).toBe(1);
    expect(COLUMNS.find((c) => c.key === 'postPpg')!.text(rows[1])).toBe('90.0');
    expect(COLUMNS.find((c) => c.key === 'postPpg')!.text({ ...a, postGames: 0 })).toBe('—');
  });
  it('knows which way is good', () => {
    expect(COLUMNS.find((c) => c.key === 'paPg')!.higherBetter).toBe(false);
    expect(COLUMNS.find((c) => c.key === 'sd')!.higherBetter).toBe(false);
    expect(COLUMNS.find((c) => c.key === 'ppg')!.higherBetter).toBe(true);
  });
});

function season2026() {
  const s = season(2026, []);
  s.status = 'in_season';
  s.managers = season2025().managers;
  s.standings = season2025().standings.map((r) => ({ ...r, w: 0, l: 0, t: 0, pf: 0, pa: 0, ppg: 0, winPct: 0, maxPoints: 0, efficiency: 0, allPlay: { w: 0, l: 0, t: 0, pct: 0 }, weeklyHighs: 0 }));
  return s;
}
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/web && npx vitest run src/lib/stats/table.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 3: Implement table.ts**

```ts
import type { Season, UserId } from '@fantasy-dash/core';
import { teamGamesOf, type TeamGame } from '../managerGames';
import { fmtSigned, fmtWinPct } from '../format';
import { byWeek, managerRefs, regular, scopeSeasons } from './scope';
import { consistency, scheduleLuck, strengthOfSchedule } from './strength';
import { weeklyFinishes } from './season';
import { pointOrigins, wireActivity } from './roster';

export interface StatRow {
  id: UserId; seasons: number;
  w: number; l: number; t: number; apW: number; apL: number; apT: number; xw: number; luck: number; medW: number; medL: number; streakW: number; streakL: number;
  ppg: number; paPg: number; highs: number; top3: number; bottom3: number; sd: number; floor: number; ceiling: number;
  closeW: number; closeL: number; blowW: number; blowL: number; sos: number; postW: number; postL: number; postGames: number; postPpg: number;
  eff: number; benchLeft: number; projPlus: number; dProj: number;
  faab: number; pickups: number; waiverShare: number; draftValue: number;
}
export type ColumnGroup = 'Season' | 'Record' | 'Scoring' | 'Games' | 'Lineups' | 'Roster';
export interface ColumnDef { key: string; label: string; group: ColumnGroup; title: string; higherBetter: boolean; value: (r: StatRow) => number; text: (r: StatRow) => string }

export const CLOSE_MARGIN = 10;
export const BLOWOUT_MARGIN = 30;

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const chrono = (x: TeamGame, y: TeamGame) => x.year - y.year || x.week - y.week;
const rec = (w: number, l: number, t: number) => (t ? `${w}-${l}-${t}` : `${w}-${l}`);
const share = (w: number, l: number, t: number) => (w + l + t ? (w + t / 2) / (w + l + t) : 0);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const one = (v: number) => v.toFixed(1);

function blank(id: UserId): StatRow {
  return { id, seasons: 0, w: 0, l: 0, t: 0, apW: 0, apL: 0, apT: 0, xw: 0, luck: 0, medW: 0, medL: 0, streakW: 0, streakL: 0, ppg: 0, paPg: 0, highs: 0, top3: 0, bottom3: 0, sd: 0, floor: 0, ceiling: 0, closeW: 0, closeL: 0, blowW: 0, blowL: 0, sos: 0, postW: 0, postL: 0, postGames: 0, postPpg: 0, eff: 0, benchLeft: 0, projPlus: 0, dProj: 0, faab: 0, pickups: 0, waiverShare: 0, draftValue: 0 };
}

/** every advanced number per manager over the seasons given */
export function statTable(seasons: Season[]): StatRow[] {
  const sorted = scopeSeasons(seasons, 'all');
  const refs = managerRefs(sorted);
  const games = teamGamesOf(sorted);
  const reg = regular(games);
  const luck = new Map(scheduleLuck(reg).map((r) => [r.id, r]));
  const sos = new Map(strengthOfSchedule(reg).map((r) => [r.id, r]));
  const spread = new Map(consistency(reg).map((r) => [r.id, r]));
  const finishes = new Map(weeklyFinishes(sorted).map((r) => [r.id, r]));
  const origins = new Map(pointOrigins(sorted).map((r) => [r.id, r]));
  const highs = new Map<UserId, number>();
  for (const w of byWeek(reg)) { const top = Math.max(...w.games.map((g) => g.points)); for (const g of w.games) if (g.points === top) highs.set(g.userId, (highs.get(g.userId) ?? 0) + 1); }
  return refs.map((ref) => {
    const r = blank(ref.id);
    const mine = games.filter((g) => g.userId === ref.id).sort(chrono);
    const myReg = mine.filter((g) => !g.isPlayoff);
    const myPost = mine.filter((g) => g.isPlayoff);
    for (const s of sorted) {
      const st = s.standings.find((x) => x.userId === ref.id);
      if (!st) continue;
      r.seasons += 1;
      r.apW += st.allPlay.w; r.apL += st.allPlay.l; r.apT += st.allPlay.t;
      for (const p of s.draft?.picks ?? []) if (p.userId === ref.id && p.value !== null) r.draftValue += p.value;
      const wire = wireActivity(s).rows.find((x) => x.id === ref.id);
      if (wire) { r.faab += wire.faab; r.pickups += wire.total; }
    }
    for (const g of myReg) { if (g.result === 'W') r.w += 1; else if (g.result === 'L') r.l += 1; else r.t += 1; }
    const l = luck.get(ref.id);
    if (l) { r.medW = l.medianW; r.medL = l.medianL; }
    const games_ = r.w + r.l + r.t;
    r.xw = share(r.apW, r.apL, r.apT) * games_;
    r.luck = r.w - r.xw;
    let runW = 0, runL = 0;
    for (const g of myReg) {
      runW = g.result === 'W' ? runW + 1 : 0; runL = g.result === 'L' ? runL + 1 : 0;
      r.streakW = Math.max(r.streakW, runW); r.streakL = Math.max(r.streakL, runL);
      const m = Math.abs(g.points - g.oppPoints);
      if (g.result !== 'T' && m <= CLOSE_MARGIN) { if (g.result === 'W') r.closeW += 1; else r.closeL += 1; }
      if (g.result !== 'T' && m >= BLOWOUT_MARGIN) { if (g.result === 'W') r.blowW += 1; else r.blowL += 1; }
    }
    const pts = myReg.map((g) => g.points);
    r.ppg = mean(pts);
    r.paPg = mean(myReg.map((g) => g.oppPoints));
    r.highs = highs.get(ref.id) ?? 0;
    const f = finishes.get(ref.id);
    if (f) { r.top3 = f.top; r.bottom3 = f.bottom; }
    r.sd = pts.length ? Math.sqrt(mean(pts.map((p) => (p - r.ppg) ** 2))) : 0;
    const sp = spread.get(ref.id);
    if (sp) { r.floor = sp.floor; r.ceiling = sp.ceiling; }
    r.sos = sos.get(ref.id)?.delta ?? 0;
    for (const g of myPost) { if (g.result === 'W') r.postW += 1; else if (g.result === 'L') r.postL += 1; }
    r.postGames = myPost.length;
    r.postPpg = mean(myPost.map((g) => g.points));
    const ceiling = mine.reduce((t, g) => t + g.ceiling, 0);
    r.eff = ceiling ? mine.reduce((t, g) => t + g.points, 0) / ceiling : 0;
    r.benchLeft = round2(mine.reduce((t, g) => t + g.benchPoints, 0));
    r.projPlus = myReg.length ? myReg.filter((g) => g.points > g.projected).length / myReg.length : 0;
    r.dProj = round2(mean(myReg.map((g) => g.points - g.projected)));
    const o = origins.get(ref.id);
    r.waiverShare = o && o.total ? o.pickup / o.total : 0;
    return r;
  });
}

const col = (key: string, label: string, group: ColumnGroup, title: string, higherBetter: boolean, value: (r: StatRow) => number, text: (r: StatRow) => string): ColumnDef => ({ key, label, group, title, higherBetter, value, text });

export const COLUMNS: ColumnDef[] = [
  col('seasons', 'Yrs', 'Season', 'Seasons played', true, (r) => r.seasons, (r) => String(r.seasons)),
  col('rec', 'Rec', 'Record', 'Regular-season record', true, (r) => share(r.w, r.l, r.t), (r) => rec(r.w, r.l, r.t)),
  col('allPlay', 'All-play', 'Record', 'Record against every other team every week', true, (r) => share(r.apW, r.apL, r.apT), (r) => rec(r.apW, r.apL, r.apT)),
  col('xw', 'xW', 'Record', 'Expected wins: all-play win rate × games played', true, (r) => r.xw, (r) => one(r.xw)),
  col('luck', 'Luck', 'Record', 'Wins minus expected wins', true, (r) => r.luck, (r) => fmtSigned(r.luck, 1)),
  col('median', 'vs med', 'Record', 'Record against the weekly league median', true, (r) => share(r.medW, r.medL, 0), (r) => rec(r.medW, r.medL, 0)),
  col('streaks', 'Streaks', 'Record', 'Longest win and loss streaks', true, (r) => r.streakW - r.streakL, (r) => `W${r.streakW} / L${r.streakL}`),
  col('ppg', 'PPG', 'Scoring', 'Points per game', true, (r) => r.ppg, (r) => one(r.ppg)),
  col('paPg', 'PA/G', 'Scoring', 'Points against per game', false, (r) => r.paPg, (r) => one(r.paPg)),
  col('highs', 'Highs', 'Scoring', 'Weeks as the top scorer', true, (r) => r.highs, (r) => String(r.highs)),
  col('top3', 'Top-3', 'Scoring', 'Weeks in the top three scorers', true, (r) => r.top3, (r) => String(r.top3)),
  col('bottom3', 'Bot-3', 'Scoring', 'Weeks in the bottom three scorers', false, (r) => r.bottom3, (r) => String(r.bottom3)),
  col('sd', 'SD', 'Scoring', 'Week-to-week spread (standard deviation)', false, (r) => r.sd, (r) => one(r.sd)),
  col('floor', 'Floor', 'Scoring', 'Second-worst week', true, (r) => r.floor, (r) => one(r.floor)),
  col('ceiling', 'Ceil', 'Scoring', 'Second-best week', true, (r) => r.ceiling, (r) => one(r.ceiling)),
  col('close', 'Close', 'Games', `Record in games decided by ${CLOSE_MARGIN} or fewer`, true, (r) => share(r.closeW, r.closeL, 0), (r) => rec(r.closeW, r.closeL, 0)),
  col('blow', 'Blowouts', 'Games', `Record in games decided by ${BLOWOUT_MARGIN} or more`, true, (r) => share(r.blowW, r.blowL, 0), (r) => rec(r.blowW, r.blowL, 0)),
  col('sos', 'SOS', 'Games', "Opponents' average score against the league average", false, (r) => r.sos, (r) => fmtSigned(r.sos, 1)),
  col('post', 'Post rec', 'Games', 'Postseason record, consolation included', true, (r) => share(r.postW, r.postL, 0), (r) => rec(r.postW, r.postL, 0)),
  col('postPpg', 'Post PPG', 'Games', 'Postseason points per game', true, (r) => r.postPpg, (r) => (r.postGames ? one(r.postPpg) : '—')),
  col('eff', 'Eff', 'Lineups', 'Points scored as a share of the best possible lineup', true, (r) => r.eff, (r) => pct(r.eff)),
  col('bench', 'Bench left', 'Lineups', 'Points the best lineup would have added', false, (r) => r.benchLeft, (r) => r.benchLeft.toFixed(0)),
  col('projPlus', 'Proj+', 'Lineups', "Share of weeks over Sleeper's projection", true, (r) => r.projPlus, (r) => pct(r.projPlus)),
  col('dProj', 'Δproj', 'Lineups', 'Average points over projection', true, (r) => r.dProj, (r) => fmtSigned(r.dProj, 1)),
  col('faab', 'FAAB', 'Roster', 'Dollars bid on won waiver claims', true, (r) => r.faab, (r) => `$${r.faab}`),
  col('pickups', 'Pickups', 'Roster', 'Waiver and free-agent adds', true, (r) => r.pickups, (r) => String(r.pickups)),
  col('waiverShare', 'Wire pts', 'Roster', 'Share of started points from pickups', true, (r) => r.waiverShare, (r) => pct(r.waiverShare)),
  col('draftValue', 'Draft', 'Roster', 'Sum of pick values from the draft grading', true, (r) => r.draftValue, (r) => fmtSigned(r.draftValue, 0)),
];
void fmtWinPct;
```

Remove the `void fmtWinPct;` line and the `fmtWinPct` import if nothing uses it (it is listed only because the records columns may want `.750`-style text later; drop it).

- [ ] **Step 4: Run, then commit**

Run: `cd packages/web && npx vitest run src/lib/stats/table.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log`
Expected: exit 0, 7 passed. If `a.sd` is off, the test expects the population standard deviation (divide by n), 19.20 for 120/130/80/100.

```bash
git add packages/web/src/lib/stats/table.ts packages/web/src/lib/stats/table.test.ts
git commit -m "Stats: the numbers table rows and columns

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 8: UI primitives: the pin, the About popover, StatCard, Heatmap, Dumbbell, MultiLine

**Files:**
- Modify: `packages/web/src/index.css` (add `--dim` in both themes and `--color-dim` in `@theme inline`)
- Create: `packages/web/src/components/About.tsx`; Modify: `packages/web/src/components/players/Board.tsx:55-80` (use the lifted hook)
- Create under `packages/web/src/components/stats/`: `pin.ts`, `pin.test.tsx`, `StatCard.tsx`, `StatCard.test.tsx`, `ManagerName.tsx`, `Heatmap.tsx`, `Heatmap.test.tsx`, `Dumbbell.tsx`, `Dumbbell.test.tsx`, `MultiLine.tsx`, `MultiLine.test.tsx`

**Interfaces:**
- Consumes: `ManagerRef` (`lib/stats/scope`), `Avatar`.
- Produces:
  - CSS tokens `--dim` (dark `#4a5666`, light `#aeb8c6`) and Tailwind colour `dim`.
  - `About.tsx`: `useAbout(): { open: boolean; buttonProps: Record<string, unknown> }` (moved verbatim from Board) and `AboutButton({ open, buttonProps, aboutId })`.
  - `pin.ts`: `type Pin = UserId | null`; `usePinHover(pin): { active: Pin; hoverProps: (id: UserId) => { onMouseEnter(): void; onMouseLeave(): void; onFocus(): void; onBlur(): void } }`; `markAttrs(id, active): { 'data-pinned'?: 'true'; 'data-dim'?: 'true' }`; `rowClass(id, active): string` (`'text-gold font-semibold'` for the active one, `'opacity-40'` for the rest when something is active, `''` otherwise); `lineStroke(id, active): string` (`'var(--gold)'` / `'var(--dim)'`); `lineWidth(id, active): number` (3 / 1.5).
  - `StatCard({ id, eyebrow, title, about?, caption?, wide?, children })`.
  - `ManagerName({ id, refs, active })` renders the avatar at 20px and the display name with `rowClass`.
  - `Heatmap`: `interface HeatCell { fill: string; text?: string; title: string; outline?: boolean; dot?: boolean }`; props `{ rows: { id: UserId }[]; cols: { key: string; label: string; divider?: boolean }[]; cell: (rowId: UserId, colKey: string) => HeatCell | null; refs: ManagerRef[]; pin: Pin; right?: (rowId: UserId) => string | null; ariaLabel: string }`.
  - `Dumbbell`: `interface DumbbellRow { id: UserId; from: number; to: number; label: string; tone: 'win' | 'loss' | 'even'; fromTitle: string; toTitle: string }`; props `{ rows: DumbbellRow[]; domain: [number, number]; ticks: number[]; refs; pin; ariaLabel: string }`.
  - `MultiLine`: `interface LineSeries { id: UserId; values: (number | null)[] }`; props `{ series: LineSeries[]; xLabels: string[]; yDomain: [number, number]; invertY?: boolean; guides?: { y: number; label?: string; tone: 'line' | 'win' | 'gold' }[]; dividers?: number[]; bands?: number[]; rightLabel: (s: LineSeries) => string; refs; pin; ariaLabel: string; height?: number }`.

- [ ] **Step 1: Tokens and the lifted About**

In `src/index.css` add after `--gold: #e3b341;` the line `  --dim: #4a5666;`, after the light `--gold: #b8860b;` the line `  --dim: #aeb8c6;`, and in `@theme inline` after `--color-gold` the line `  --color-dim: var(--dim);`.

Create `src/components/About.tsx` by moving `useAbout` out of `Board.tsx` unchanged (export it) and adding:

```tsx
/** The ? beside a title; the caller renders the panel in the flow of its header with `id={aboutId}` and `role="tooltip"`. */
export function AboutButton({ open, buttonProps, aboutId }: { open: boolean; buttonProps: Record<string, unknown>; aboutId: string }) {
  return (
    <button
      type="button"
      aria-label="What counts"
      aria-expanded={open}
      aria-describedby={open ? aboutId : undefined}
      {...buttonProps}
      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-semibold leading-none ${open ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:border-ink hover:text-ink'}`}
    >
      ?
    </button>
  );
}
```

In `Board.tsx` delete the local `useAbout`, import `{ useAbout, AboutButton } from '../About'`, and replace the inline `<button type="button" aria-label="What counts" …>?</button>` with `<AboutButton open={about.open} buttonProps={about.buttonProps} aboutId={aboutId} />`. Run `npx vitest run src/components/players/Board.test.tsx` — Expected: still green (the test queries the button by its label).

- [ ] **Step 2: Failing tests for the pin helpers and StatCard**

`src/components/stats/pin.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react';
import { lineStroke, lineWidth, markAttrs, rowClass, usePinHover } from './pin';

describe('pin helpers', () => {
  it('the hovered manager overrides the pinned one until the pointer leaves', () => {
    const { result } = renderHook(() => usePinHover('a'));
    expect(result.current.active).toBe('a');
    act(() => result.current.hoverProps('b').onMouseEnter());
    expect(result.current.active).toBe('b');
    act(() => result.current.hoverProps('b').onMouseLeave());
    expect(result.current.active).toBe('a');
  });
  it('marks the active manager and dims the rest only when someone is active', () => {
    expect(markAttrs('a', 'a')).toEqual({ 'data-pinned': 'true' });
    expect(markAttrs('b', 'a')).toEqual({ 'data-dim': 'true' });
    expect(markAttrs('b', null)).toEqual({});
    expect(rowClass('a', 'a')).toBe('text-gold font-semibold');
    expect(rowClass('b', 'a')).toBe('opacity-40');
    expect(rowClass('b', null)).toBe('');
    expect([lineStroke('a', 'a'), lineStroke('b', 'a'), lineStroke('b', null)]).toEqual(['var(--gold)', 'var(--dim)', 'var(--dim)']);
    expect([lineWidth('a', 'a'), lineWidth('b', 'a')]).toEqual([3, 1.5]);
  });
});
```

`src/components/stats/StatCard.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('has an eyebrow, a title, a ? that reveals the definition in the header, and a caption', () => {
    render(<StatCard id="x" eyebrow="Expected vs actual" title="Luck" about="What counts here" caption="Read it so."><p>body</p></StatCard>);
    expect(screen.getByRole('heading', { name: 'Luck' })).toBeInTheDocument();
    expect(screen.getByText('Expected vs actual')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What counts' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('What counts here');
    expect(screen.getByRole('tooltip').parentElement?.tagName).toBe('HEADER');
    expect(screen.getByText('Read it so.')).toBeInTheDocument();
  });
  it('spans two columns when wide', () => {
    render(<StatCard id="y" eyebrow="e" title="t" wide><p>body</p></StatCard>);
    expect(screen.getByRole('region', { name: 't' }).className).toContain('lg:col-span-2');
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1 (modules not found).

- [ ] **Step 3: Implement pin.ts, StatCard.tsx, ManagerName.tsx**

`pin.ts`:
```ts
import { useState } from 'react';
import type { UserId } from '@fantasy-dash/core';

export type Pin = UserId | null;

/** the manager a chart should light up: the one under the pointer, else the pinned one */
export function usePinHover(pin: Pin): { active: Pin; hoverProps: (id: UserId) => { onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void } } {
  const [hover, setHover] = useState<Pin>(null);
  return {
    active: hover ?? pin,
    hoverProps: (id) => ({ onMouseEnter: () => setHover(id), onMouseLeave: () => setHover(null), onFocus: () => setHover(id), onBlur: () => setHover(null) }),
  };
}

export const markAttrs = (id: UserId, active: Pin): { 'data-pinned'?: 'true'; 'data-dim'?: 'true' } =>
  active === null ? {} : id === active ? { 'data-pinned': 'true' } : { 'data-dim': 'true' };
export const rowClass = (id: UserId, active: Pin): string => (active === null ? '' : id === active ? 'text-gold font-semibold' : 'opacity-40');
export const lineStroke = (id: UserId, active: Pin): string => (id === active ? 'var(--gold)' : 'var(--dim)');
export const lineWidth = (id: UserId, active: Pin): number => (id === active ? 3 : 1.5);
/** colour-mix helper for tinted cells: `k` from 0 to 1 over the card's second surface */
export const tint = (token: 'win' | 'loss' | 'gold' | 'accent', k: number): string => `color-mix(in srgb, var(--${token}) ${Math.round(Math.max(0, Math.min(1, k)) * 85)}%, var(--surface-2))`;
```

`StatCard.tsx`:
```tsx
import type { ReactNode } from 'react';
import { AboutButton, useAbout } from '../About';

interface Props { id: string; eyebrow: string; title: string; about?: string; caption?: string; wide?: boolean; children: ReactNode }

/** One chart card: eyebrow, title with the ? definition, the chart, a one-line caption. */
export default function StatCard({ id, eyebrow, title, about, caption, wide = false, children }: Props) {
  const popover = useAbout();
  const aboutId = `about-${id}`;
  return (
    <section className={`card flex flex-col ${wide ? 'lg:col-span-2' : ''}`} aria-labelledby={`stat-${id}`}>
      <header className="border-b border-line px-4 pb-2 pt-3">
        <div className="section-label">{eyebrow}</div>
        <div className="flex items-center gap-1.5">
          <h3 id={`stat-${id}`} className="text-base font-semibold leading-tight text-ink">{title}</h3>
          {about && <AboutButton open={popover.open} buttonProps={popover.buttonProps} aboutId={aboutId} />}
        </div>
        {about && popover.open && <p id={aboutId} role="tooltip" className="mt-1.5 rounded-md bg-surface-2 px-2.5 py-2 text-xs leading-snug text-ink">{about}</p>}
      </header>
      <div className="min-w-0 flex-1 p-4">{children}</div>
      {caption && <p className="border-t border-line px-4 py-2 text-xs text-muted">{caption}</p>}
    </section>
  );
}
```

`ManagerName.tsx`:
```tsx
import type { UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import type { ManagerRef } from '../../lib/stats/scope';
import { rowClass, type Pin } from './pin';

/** avatar and name as a row label, gold when active, faded when someone else is */
export default function ManagerName({ id, refs, active, avatar = true }: { id: UserId; refs: ManagerRef[]; active: Pin; avatar?: boolean }) {
  const ref = refs.find((r) => r.id === id);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs ${rowClass(id, active)}`}>
      {avatar && <Avatar avatar={ref?.avatar ?? null} name={ref?.name ?? id} size={20} />}
      <span className="truncate">{ref?.name ?? id}</span>
    </span>
  );
}
```

Run: `cd packages/web && npx vitest run src/components/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 0 (4 tests).

- [ ] **Step 4: Failing tests for Heatmap, Dumbbell, MultiLine**

`Heatmap.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import Heatmap from './Heatmap';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());
const rows = refs.map((r) => ({ id: r.id }));
const cols = [{ key: '1', label: '1' }, { key: '2', label: '2', divider: true }];
const cell = (id: string, key: string) => (id === 'd' && key === '2' ? null : { fill: 'var(--win)', text: `${id}${key}`, title: `${id} in week ${key}`, dot: id === 'a' && key === '1', outline: id === 'b' });

describe('Heatmap', () => {
  it('draws a labelled grid with a cell per row and column, titles, dots, outlines and a dashed divider column', () => {
    render(<Heatmap rows={rows} cols={cols} cell={cell} refs={refs} pin={null} right={(id) => (id === 'a' ? '2 · $13' : null)} ariaLabel="Form" />);
    const table = screen.getByRole('table', { name: 'Form' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByTitle('a in week 1')).toHaveTextContent('a1');
    expect(screen.getByTitle('a in week 1').querySelector('[data-dot]')).not.toBeNull();
    expect(screen.getByTitle('b in week 1')).toHaveAttribute('data-outline', 'true');
    expect(screen.getByTitle('a in week 2')).toHaveAttribute('data-divider', 'true');
    expect(screen.getByText('2 · $13')).toBeInTheDocument();
    const dRow = within(table).getAllByRole('row')[4];
    expect(within(dRow).getAllByRole('cell')).toHaveLength(2);   // week 1 and an empty week 2 (the name is a row header)
  });
  it('fades every other row when a manager is pinned, and lets a hovered row take over', () => {
    render(<Heatmap rows={rows} cols={cols} cell={cell} refs={refs} pin="a" ariaLabel="Form" />);
    const [, a, b] = screen.getAllByRole('row');
    expect(a).toHaveAttribute('data-pinned', 'true');
    expect(b).toHaveAttribute('data-dim', 'true');
    fireEvent.mouseEnter(b);
    expect(b).toHaveAttribute('data-pinned', 'true');
    expect(a).toHaveAttribute('data-dim', 'true');
  });
});
```

`Dumbbell.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import Dumbbell from './Dumbbell';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());
const rows = [
  { id: 'a', from: 3, to: 4, label: '+1', tone: 'win' as const, fromTitle: '3 wins against the median', toTitle: '4 real wins' },
  { id: 'c', from: 2, to: 1, label: '-1', tone: 'loss' as const, fromTitle: '2 against the median', toTitle: '1 real win' },
];

describe('Dumbbell', () => {
  it('draws one row per manager with both dots titled, the label, and the tone', () => {
    render(<Dumbbell rows={rows} domain={[0, 4]} ticks={[0, 2, 4]} refs={refs} pin="c" ariaLabel="Schedule luck" />);
    const list = screen.getByRole('list', { name: 'Schedule luck' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTitle('4 real wins')).toBeInTheDocument();
    expect(screen.getByTitle('3 wins against the median')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(list.querySelector('li')).toHaveAttribute('data-tone', 'win');
    expect(list.querySelectorAll('li')[1]).toHaveAttribute('data-pinned', 'true');
    expect(list.querySelector('li')).toHaveAttribute('data-dim', 'true');
    expect(screen.getAllByText(/^[024]$/)).toHaveLength(3);
  });
});
```

`MultiLine.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import MultiLine from './MultiLine';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());
const series = [{ id: 'a', values: [1, 1, 2] }, { id: 'b', values: [2, null, 1] }];

describe('MultiLine', () => {
  it('draws one path per series, broken at a gap, with x labels, guides, a divider, a band and right labels', () => {
    render(<MultiLine series={series} xLabels={['wk 1', 'wk 2', 'wk 3']} yDomain={[1, 2]} invertY guides={[{ y: 1.5, label: 'playoff line', tone: 'win' }]} dividers={[2]} bands={[2]} rightLabel={(s) => s.id} refs={refs} pin="a" ariaLabel="Race" />);
    const svg = screen.getByRole('img', { name: 'Race' });
    const paths = svg.querySelectorAll('path[data-series]');
    expect(paths).toHaveLength(2);
    expect(svg.querySelector('path[data-series="a"]')).toHaveAttribute('data-pinned', 'true');
    expect(svg.querySelector('path[data-series="a"]')!.getAttribute('d')!.match(/M/g)).toHaveLength(1);
    expect(svg.querySelector('path[data-series="b"]')!.getAttribute('d')!.match(/M/g)).toHaveLength(2);
    expect(screen.getByText('wk 1')).toBeInTheDocument();
    expect(screen.getByText('playoff line')).toBeInTheDocument();
    expect(svg.querySelector('[data-divider]')).not.toBeNull();
    expect(svg.querySelector('[data-band]')).not.toBeNull();
    expect(svg.querySelector('text[data-series-label="a"]')).toHaveAttribute('data-pinned', 'true');
    // hovering a path lights that series instead
    fireEvent.mouseEnter(svg.querySelector('path[data-series="b"]')!);
    expect(svg.querySelector('path[data-series="b"]')).toHaveAttribute('data-pinned', 'true');
    expect(svg.querySelector('path[data-series="a"]')).toHaveAttribute('data-dim', 'true');
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1 (three modules not found).

- [ ] **Step 5: Implement Heatmap.tsx**

```tsx
import type { UserId } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import ManagerName from './ManagerName';
import { markAttrs, usePinHover, type Pin } from './pin';

export interface HeatCell { fill: string; text?: string; title: string; outline?: boolean; dot?: boolean }
export interface HeatCol { key: string; label: string; /** a dashed gold line down the left of this column */ divider?: boolean }
interface Props { rows: { id: UserId }[]; cols: HeatCol[]; cell: (rowId: UserId, colKey: string) => HeatCell | null; refs: ManagerRef[]; pin: Pin; right?: (rowId: UserId) => string | null; ariaLabel: string }

/** Managers down the side, periods across, a tinted square per cell. The first column is sticky so phones can scroll the rest. */
export default function Heatmap({ rows, cols, cell, refs, pin, right, ariaLabel }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  const divider = (c: HeatCol) => (c.divider ? 'border-l-2 border-dashed border-gold' : '');
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs" aria-label={ariaLabel}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface" />
            {cols.map((c) => <th key={c.key} scope="col" className={`num px-0.5 pb-1 text-center font-normal text-muted ${divider(c)}`}>{c.label}</th>)}
            {right && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={active !== null && active !== r.id ? 'opacity-40' : ''}>
              <th scope="row" className="sticky left-0 z-10 bg-surface pr-2 text-left font-normal"><ManagerName id={r.id} refs={refs} active={active} /></th>
              {cols.map((c) => {
                const v = cell(r.id, c.key);
                return (
                  <td key={c.key} title={v?.title} data-divider={c.divider ? 'true' : undefined} data-outline={v?.outline ? 'true' : undefined}
                    className={`relative h-7 min-w-7 rounded text-center ${divider(c)} ${v?.outline ? 'ring-2 ring-inset ring-loss' : ''}`}
                    style={{ background: v?.fill ?? 'transparent' }}>
                    {v?.text && <span className="num text-[11px] text-ink">{v.text}</span>}
                    {v?.dot && <span data-dot className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-gold" />}
                  </td>
                );
              })}
              {right && <td className="num whitespace-nowrap pl-2 text-right text-muted">{right(r.id)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Implement Dumbbell.tsx**

```tsx
import type { UserId } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import ManagerName from './ManagerName';
import { markAttrs, usePinHover, type Pin } from './pin';

export interface DumbbellRow { id: UserId; from: number; to: number; label: string; tone: 'win' | 'loss' | 'even'; fromTitle: string; toTitle: string }
interface Props { rows: DumbbellRow[]; domain: [number, number]; ticks: number[]; refs: ManagerRef[]; pin: Pin; ariaLabel: string }

const BAR: Record<DumbbellRow['tone'], string> = { win: 'var(--win)', loss: 'var(--loss)', even: 'var(--muted)' };

/** One row per manager: a hollow dot at `from`, a filled dot at `to`, a bar between them coloured by the tone. */
export default function Dumbbell({ rows, domain, ticks, refs, pin, ariaLabel }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  const [lo, hi] = domain;
  const x = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  return (
    <div>
      <ul className="space-y-1.5" aria-label={ariaLabel}>
        {rows.map((r) => (
          <li key={r.id} data-tone={r.tone} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="relative h-4">
              <span className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: x(Math.min(r.from, r.to)), width: `calc(${x(Math.max(r.from, r.to))} - ${x(Math.min(r.from, r.to))})`, background: BAR[r.tone], opacity: 0.7 }} />
              <span title={r.fromTitle} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted bg-surface" style={{ left: x(r.from) }} />
              <span title={r.toTitle} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: x(r.to), background: r.id === active ? 'var(--gold)' : BAR[r.tone] }} />
            </span>
            <span className="num text-right text-xs text-muted">{r.label}</span>
          </li>
        ))}
      </ul>
      <div className="relative ml-[7rem] mr-[3rem] mt-1 h-4 text-[10px] text-muted">
        {ticks.map((t) => <span key={t} className="num absolute -translate-x-1/2" style={{ left: x(t) }}>{t}</span>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Implement MultiLine.tsx**

```tsx
import type { UserId } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import { lineStroke, lineWidth, markAttrs, usePinHover, type Pin } from './pin';

export interface LineSeries { id: UserId; values: (number | null)[] }
interface Guide { y: number; label?: string; tone: 'line' | 'win' | 'gold' }
interface Props {
  series: LineSeries[]; xLabels: string[]; yDomain: [number, number]; invertY?: boolean; guides?: Guide[];
  /** indexes a dashed vertical line sits before */ dividers?: number[];
  /** indexes drawn over a faint band (playoff weeks) */ bands?: number[];
  rightLabel: (s: LineSeries) => string; refs: ManagerRef[]; pin: Pin; ariaLabel: string; height?: number;
}
const W = 640, PAD = { l: 34, r: 96, t: 12, b: 24 };
const GUIDE: Record<Guide['tone'], string> = { line: 'var(--line)', win: 'var(--win)', gold: 'var(--gold)' };

/** Several lines over the same x axis; the active manager's is gold on top, the rest dim. Labels sit at the right edge, pushed apart so they never overlap. */
export default function MultiLine({ series, xLabels, yDomain, invertY = false, guides = [], dividers = [], bands = [], rightLabel, refs, pin, ariaLabel, height = 240 }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  const n = xLabels.length;
  const [lo, hi] = yDomain;
  const x = (i: number) => PAD.l + (n > 1 ? (i / (n - 1)) * (W - PAD.l - PAD.r) : (W - PAD.l - PAD.r) / 2);
  const y = (v: number) => { const k = (v - lo) / (hi - lo || 1); return invertY ? PAD.t + k * (height - PAD.t - PAD.b) : height - PAD.b - k * (height - PAD.t - PAD.b); };
  const path = (vals: (number | null)[]) => { let d = '', pen = false; vals.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; }); return d.trim(); };
  // right-edge labels: sorted by their end value and nudged apart by 11px
  const ends = series.map((s) => { const last = [...s.values].reverse().find((v) => v !== null); return { s, y: last === null || last === undefined ? null : y(last) }; }).filter((e) => e.y !== null) as { s: LineSeries; y: number }[];
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
  const ordered = [...series].sort((a) => (a.id === active ? 1 : -1));
  const step = n > 1 ? (W - PAD.l - PAD.r) / (n - 1) : 0;
  void refs;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="block w-full" role="img" aria-label={ariaLabel}>
      {bands.map((i) => <rect key={`b${i}`} data-band x={x(i) - step / 2} y={PAD.t} width={step} height={height - PAD.t - PAD.b} fill="var(--gold)" opacity="0.07" />)}
      {dividers.map((i) => <line key={`d${i}`} data-divider x1={x(i) - step / 2} x2={x(i) - step / 2} y1={PAD.t} y2={height - PAD.b} stroke="var(--gold)" strokeDasharray="4 4" opacity="0.8" />)}
      {guides.map((g, i) => (
        <g key={`g${i}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(g.y)} y2={y(g.y)} stroke={GUIDE[g.tone]} strokeDasharray="3 4" opacity={g.tone === 'line' ? 1 : 0.7} />
          {g.label && <text x={PAD.l + 2} y={y(g.y) - 4} fontSize="10" fill={GUIDE[g.tone]}>{g.label}</text>}
        </g>
      ))}
      {xLabels.map((l, i) => (n <= 12 || i % Math.ceil(n / 12) === 0) && <text key={l + i} x={x(i)} y={height - 6} fontSize="10" textAnchor="middle" fill="var(--muted)" className="num">{l}</text>)}
      {ordered.map((s) => (
        <path key={s.id} data-series={s.id} {...markAttrs(s.id, active)} {...hoverProps(s.id)} d={path(s.values)} fill="none" stroke={lineStroke(s.id, active)} strokeWidth={lineWidth(s.id, active)} strokeLinejoin="round" strokeLinecap="round" opacity={active !== null && active !== s.id ? 0.45 : 1} style={{ cursor: 'default' }}>
          <title>{rightLabel(s)}</title>
        </path>
      ))}
      {ends.map(({ s, y: ly }) => (
        <text key={`l${s.id}`} data-series-label={s.id} {...markAttrs(s.id, active)} {...hoverProps(s.id)} x={W - PAD.r + 6} y={ly + 3} fontSize="10" fill={s.id === active ? 'var(--gold)' : 'var(--muted)'} fontWeight={s.id === active ? 600 : 400} opacity={active !== null && active !== s.id ? 0.5 : 1}>{rightLabel(s)}</text>
      ))}
    </svg>
  );
}
```

(Drop `void refs;` and the `refs` prop from the interface if the linter objects; `refs` is accepted so every chart passes the same props, and later labels may use it.)

- [ ] **Step 8: Run, type-check, commit**

Run: `cd packages/web && npx vitest run src/components/stats src/components/players/Board.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log; npx tsc --noEmit -p tsconfig.json > /tmp/claude-501/tsc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

```bash
git add packages/web/src/index.css packages/web/src/components/About.tsx packages/web/src/components/players/Board.tsx packages/web/src/components/stats
git commit -m "Stats: pin helpers, lifted About popover, StatCard, Heatmap, Dumbbell, MultiLine

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 9: The season charts

**Files:**
- Create under `packages/web/src/components/stats/`: `StandingsRace.tsx`, `FormGuide.tsx`, `ScoringCalendar.tsx`, `WeeklyFinishes.tsx`, `seasonCharts.test.tsx`
- Modify: `StatCard.tsx` (export `Empty`)

**Interfaces:**
- Consumes: `RaceData`, `FormData`, `CalendarData`, `FinishRow` (`lib/stats/season`); `Heatmap`, `MultiLine`, `ManagerName`, `pin.ts`, `StatCard`.
- Produces: `StandingsRace({ data: RaceData; refs; pin })`, `FormGuide({ data: FormData; refs; pin })`, `ScoringCalendar({ data: CalendarData; refs; pin })`, `WeeklyFinishes({ rows: FinishRow[]; refs; pin })`, and `Empty({ text? })` (named export of `StatCard.tsx`). Each chart renders only its body; `ManagersStats` wraps them in `StatCard`.

- [ ] **Step 1: Write the failing tests**

`seasonCharts.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import StandingsRace from './StandingsRace';
import FormGuide from './FormGuide';
import ScoringCalendar from './ScoringCalendar';
import WeeklyFinishes from './WeeklyFinishes';
import { managerRefs } from '../../lib/stats/scope';
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from '../../lib/stats/season';
import { league, season2025 } from '../../test/statsFixtures';

const refs = managerRefs(league());
const s25 = season2025();

describe('StandingsRace', () => {
  it('draws a line per manager over the regular-season weeks with the playoff line, the pinned one marked', () => {
    render(<StandingsRace data={standingsRace(s25)} refs={refs} pin="b" />);
    const svg = screen.getByRole('img', { name: 'Standings race' });
    expect(svg.querySelectorAll('path[data-series]')).toHaveLength(4);
    expect(svg.querySelector('path[data-series="b"]')).toHaveAttribute('data-pinned', 'true');
    expect(screen.getByText('playoff line')).toBeInTheDocument();
    expect(screen.getByText('wk 4')).toBeInTheDocument();
  });
  it('says so before anything is played', () => {
    render(<StandingsRace data={{ weeks: [], playoffTeams: 2, series: [] }} refs={refs} pin={null} />);
    expect(screen.getByText('Nothing played yet.')).toBeInTheDocument();
  });
});

describe('FormGuide', () => {
  it('shows a W or L square per game, the top score dotted, with a dashed line before the playoffs', () => {
    render(<FormGuide data={formGuide(s25)} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Form guide' });
    const a = within(table).getAllByRole('row')[1];
    expect(within(a).getAllByRole('cell').map((c) => c.textContent)).toEqual(['W', 'W', 'W', 'W', 'W']);
    expect(within(a).getAllByRole('cell')[0].querySelector('[data-dot]')).not.toBeNull();
    expect(within(a).getAllByRole('cell')[4]).toHaveAttribute('data-divider', 'true');
    expect(screen.getByTitle('Week 1: 120.00 vs bob 100.00')).toBeInTheDocument();
    const d = within(table).getAllByRole('row')[4];
    expect(within(d).getAllByRole('cell').map((c) => c.textContent)).toEqual(['W', 'L', 'L', 'L', 'L']);
  });
});

describe('ScoringCalendar', () => {
  it('prints the score in every regular-season cell and titles it against the week\'s average', () => {
    render(<ScoringCalendar data={scoringCalendar(s25)} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Scoring calendar' });
    expect(within(within(table).getAllByRole('row')[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['120', '130', '80', '100']);
    expect(screen.getByTitle('Week 3: 80.00, league average 98.75 (-18.75)')).toBeInTheDocument();
  });
});

describe('WeeklyFinishes', () => {
  it('draws a three-part bar per manager with the top and bottom counts printed', () => {
    render(<WeeklyFinishes rows={weeklyFinishes([s25])} refs={refs} pin="c" />);
    const list = screen.getByRole('list', { name: 'Weekly finishes' });
    const items = list.querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(items[2]).toHaveAttribute('data-pinned', 'true');
    expect(items[2].querySelector('[data-part="top"]')).toHaveTextContent('2');
    expect(items[2].querySelector('[data-part="bottom"]')).toHaveTextContent('2');
    expect(items[0].querySelector('[data-part="bottom"]')).toHaveTextContent('');
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats/seasonCharts.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 2: Implement**

Add to `StatCard.tsx`:
```tsx
/** the body of a chart with nothing to draw */
export function Empty({ text = 'Nothing played yet.' }: { text?: string }) {
  return <p className="py-6 text-center text-xs text-muted">{text}</p>;
}
```

`StandingsRace.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { RaceData } from '../../lib/stats/season';
import MultiLine from './MultiLine';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export default function StandingsRace({ data, refs, pin }: { data: RaceData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  return (
    <MultiLine
      series={data.series.map((s) => ({ id: s.id, values: s.ranks }))}
      xLabels={data.weeks.map((w) => `wk ${w}`)}
      yDomain={[1, Math.max(2, data.series.length)]}
      invertY
      guides={[{ y: data.playoffTeams + 0.5, label: 'playoff line', tone: 'win' }]}
      rightLabel={(s) => name(s.id)}
      refs={refs} pin={pin} ariaLabel="Standings race"
    />
  );
}
```

`FormGuide.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { FormData } from '../../lib/stats/season';
import { fmtPts } from '../../lib/format';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import type { Pin } from './pin';

const FILL = { W: 'var(--win)', L: 'var(--loss)', T: 'var(--muted)' } as const;

export default function FormGuide({ data, refs, pin }: { data: FormData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.findIndex((w) => String(w.week) === key);
    const c = data.rows.find((r) => r.id === rowId)?.cells[i];
    if (!c) return null;
    return { fill: FILL[c.result], text: c.result, dot: c.top, title: `Week ${c.week}: ${fmtPts(c.points)} vs ${name(c.oppId)} ${fmtPts(c.oppPoints)}` };
  };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w, i) => ({ key: String(w.week), label: String(w.week), divider: i === data.playoffAt }))} cell={cell} refs={refs} pin={pin} ariaLabel="Form guide" />;
}
```

`ScoringCalendar.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { CalendarData } from '../../lib/stats/season';
import { fmtPts, fmtSigned } from '../../lib/format';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

/** a swing this big fills the cell's colour */
const FULL = 45;

export default function ScoringCalendar({ data, refs, pin }: { data: CalendarData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.indexOf(Number(key));
    const c = data.rows.find((r) => r.id === rowId)?.cells[i];
    if (!c) return null;
    return { fill: tint(c.delta >= 0 ? 'win' : 'loss', Math.abs(c.delta) / FULL), text: String(Math.round(c.points)), title: `Week ${c.week}: ${fmtPts(c.points)}, league average ${fmtPts(c.avg)} (${fmtSigned(c.delta, 2)})` };
  };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w) => ({ key: String(w), label: String(w) }))} cell={cell} refs={refs} pin={pin} ariaLabel="Scoring calendar" />;
}
```

`WeeklyFinishes.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { FinishRow } from '../../lib/stats/season';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

export default function WeeklyFinishes({ rows, refs, pin }: { rows: FinishRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const pct = (n: number, of: number) => `${of ? (n / of) * 100 : 0}%`;
  return (
    <ul className="space-y-1.5" aria-label="Weekly finishes">
      {rows.map((r) => (
        <li key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
          <ManagerName id={r.id} refs={refs} active={active} />
          <span className="flex h-4 overflow-hidden rounded bg-surface-2 text-[10px] font-semibold text-bg">
            <span data-part="top" title={`${r.top} weeks in the top three`} className="flex items-center justify-start bg-win pl-1" style={{ width: pct(r.top, r.weeks) }}>{r.top || ''}</span>
            <span data-part="middle" className="flex-1" />
            <span data-part="bottom" title={`${r.bottom} weeks in the bottom three`} className="flex items-center justify-end bg-loss pr-1" style={{ width: pct(r.bottom, r.weeks) }}>{r.bottom || ''}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Run, type-check, commit**

Run: `cd packages/web && npx vitest run src/components/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit -p tsconfig.json > /tmp/claude-501/tsc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

```bash
git add packages/web/src/components/stats
git commit -m "Stats: standings race, form guide, scoring calendar and weekly finishes charts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 10: The strength charts

**Files:**
- Create under `packages/web/src/components/stats/`: `PowerRating.tsx`, `Consistency.tsx`, `ScheduleLuck.tsx`, `StrengthOfSchedule.tsx`, `AllPlayGrid.tsx`, `PostseasonForm.tsx`, `strengthCharts.test.tsx`

**Interfaces:**
- Consumes: `EloHistory`, `ELO_*` (`lib/stats/elo`); `ConsistencyRow`, `LuckRow`, `SosRow`, `AllPlayGrid as AllPlayData`, `PostseasonRow` (`lib/stats/strength`); the Task 8 primitives.
- Produces: `PowerRating({ history: EloHistory; refs; pin })`, `Consistency({ rows: ConsistencyRow[]; refs; pin })`, `ScheduleLuck({ rows: LuckRow[]; refs; pin })`, `StrengthOfSchedule({ rows: SosRow[]; refs; pin })`, `AllPlayGrid({ grid: AllPlayData; refs; pin })`, `PostseasonForm({ rows: PostseasonRow[]; refs; pin })`; `ELO_ABOUT: string` (the popover text) exported from `PowerRating.tsx`.

- [ ] **Step 1: Write the failing tests**

`strengthCharts.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import PowerRating, { ELO_ABOUT } from './PowerRating';
import Consistency from './Consistency';
import ScheduleLuck from './ScheduleLuck';
import StrengthOfSchedule from './StrengthOfSchedule';
import AllPlayGrid from './AllPlayGrid';
import PostseasonForm from './PostseasonForm';
import { managerRefs } from '../../lib/stats/scope';
import { eloFor, eloHistory } from '../../lib/stats/elo';
import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from '../../lib/stats/strength';
import { teamGamesOf } from '../../lib/managerGames';
import { league, season2024, season2025 } from '../../test/statsFixtures';

const refs = managerRefs(league());
const g25 = teamGamesOf([season2025()]);

describe('PowerRating', () => {
  it('draws every manager across all seasons with a 1500 guide, a divider between seasons, playoff weeks banded and the leader labelled with his rating', () => {
    render(<PowerRating history={eloHistory(league())} refs={refs} pin={null} />);
    const svg = screen.getByRole('img', { name: 'Power rating' });
    expect(svg.querySelectorAll('path[data-series]')).toHaveLength(4);
    expect(svg.querySelectorAll('[data-divider]')).toHaveLength(1);
    expect(svg.querySelectorAll('[data-band]')).toHaveLength(1);
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(svg.querySelector('text[data-series-label="a"]')!.textContent).toMatch(/^alice \d{4}$/);
);
    expect(ELO_ABOUT).toMatch(/1500/);
  });
  it('labels one season\'s weeks by week number', () => {
    render(<PowerRating history={eloFor(eloHistory(league()), 2025)} refs={refs} pin="a" />);
    expect(screen.getByText('wk 5')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Power rating' }).querySelector('path[data-series="a"]')).toHaveAttribute('data-pinned', 'true');
  });
});

describe('Consistency', () => {
  it('draws a strip per manager with the floor-to-ceiling box, the median tick and the extremes', () => {
    render(<Consistency rows={consistency(g25)} refs={refs} pin="a" />);
    const items = screen.getByRole('list', { name: 'Consistency' }).querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveAttribute('data-pinned', 'true');
    expect(items[0].querySelector('[data-box]')).toHaveAttribute('title', 'alice: floor 100.00, median 110.00, ceiling 120.00; worst 80.00, best 130.00');
    expect(screen.getAllByText(/^\d+$/).length).toBeGreaterThan(1);   // axis ticks
  });
});

describe('ScheduleLuck', () => {
  it('runs a dumbbell from the median record to the real one, green when the schedule helped and red when it hurt', () => {
    render(<ScheduleLuck rows={scheduleLuck(g25)} refs={refs} pin={null} />);
    const items = screen.getByRole('list', { name: 'Schedule luck' }).querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-tone', 'win');
    expect(items[3]).toHaveAttribute('data-tone', 'loss');
    expect(screen.getByTitle('alice: 3-1 against the weekly median')).toBeInTheDocument();
    expect(screen.getByTitle('alice: 4-0 for real')).toBeInTheDocument();
    expect(within(items[0]).getByText('+1')).toBeInTheDocument();
  });
});

describe('StrengthOfSchedule', () => {
  it('draws a bar per manager, red to the right for a hard schedule and green to the left for a soft one', () => {
    render(<StrengthOfSchedule rows={strengthOfSchedule(g25)} refs={refs} pin={null} />);
    const items = screen.getByRole('list', { name: 'Strength of schedule' }).querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-tone', 'loss');
    expect(items[3]).toHaveAttribute('data-tone', 'win');
    expect(screen.getByTitle("alice's opponents scored 92.25 a week against him, 11.44 under the league's 103.69")).toBeInTheDocument();
    expect(screen.getByText('league average 103.7')).toBeInTheDocument();
  });
});

describe('AllPlayGrid', () => {
  it('shows the weeks each manager outscored each other with the real record in the title', () => {
    render(<AllPlayGrid grid={allPlayGrid(g25, refs.map((r) => r.id))} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Head to head' });
    expect(within(within(table).getAllByRole('row')[1]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['', '3-1', '2-2', '4-0']);
    expect(screen.getByTitle('alice outscored bob in 3 of 4 weeks · played twice, 2-0')).toBeInTheDocument();
  });
});

describe('PostseasonForm', () => {
  it('runs a dumbbell from the regular-season average to the postseason one, or says the playoffs have not started', () => {
    render(<PostseasonForm rows={postseasonForm(g25)} refs={refs} pin={null} />);
    expect(screen.getByTitle('alice: 150.0 a game over 1 postseason game')).toBeInTheDocument();
    expect(screen.getByTitle('alice: 107.5 a game in the regular season')).toBeInTheDocument();
    render(<PostseasonForm rows={postseasonForm(teamGamesOf([season2024()]))} refs={refs} pin={null} />);
    expect(screen.getByText('The playoffs have not started.')).toBeInTheDocument();
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats/strengthCharts.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 2: Implement**

`PowerRating.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import { ELO_CARRY, ELO_K, ELO_MARGIN, ELO_START, type EloHistory } from '../../lib/stats/elo';
import MultiLine from './MultiLine';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export const ELO_ABOUT = `Everyone starts at ${ELO_START}. Before a game the rating gap sets the expected result; afterwards each side moves by up to ${ELO_K} points times how surprising the result was, doubled for a margin of ${ELO_MARGIN * 2} or more. Every game counts, playoffs and consolation included. Between seasons a rating keeps ${Math.round(ELO_CARRY * 100)}% of its distance from ${ELO_START}.`;

export default function PowerRating({ history, refs, pin }: { history: EloHistory; refs: ManagerRef[]; pin: Pin }) {
  if (history.points.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const years = new Set(history.points.map((p) => p.year));
  const xLabels = history.points.map((p) => (years.size > 1 ? (p.week === 1 ? String(p.year) : '') : `wk ${p.week}`));
  const dividers = history.points.map((p, i) => (i > 0 && p.year !== history.points[i - 1].year ? i : -1)).filter((i) => i >= 0);
  const bands = history.points.map((p, i) => (p.playoff ? i : -1)).filter((i) => i >= 0);
  const all = history.series.flatMap((s) => s.ratings).filter((v): v is number => v !== null);
  const lo = Math.min(ELO_START - 50, ...all) - 10, hi = Math.max(ELO_START + 50, ...all) + 10;
  const last = (s: EloHistory['series'][number]) => [...s.ratings].reverse().find((v) => v !== null);
  return (
    <MultiLine
      series={history.series.map((s) => ({ id: s.id, values: s.ratings }))}
      xLabels={xLabels} yDomain={[lo, hi]} guides={[{ y: ELO_START, label: String(ELO_START), tone: 'line' }]} dividers={dividers} bands={bands}
      rightLabel={(s) => { const v = last(history.series.find((x) => x.id === s.id)!); return v === undefined ? name(s.id) : `${name(s.id)} ${Math.round(v)}`; }}
      refs={refs} pin={pin} ariaLabel="Power rating"
    />
  );
}
```

Note `MultiLine` prints every x label when there are 12 or fewer, else every k-th; the all-time labels are the year at each season's week 1 and empty strings elsewhere, which render as nothing.

`Consistency.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { ConsistencyRow } from '../../lib/stats/strength';
import { fmtPts } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

export default function Consistency({ rows, refs, pin }: { rows: ConsistencyRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const lo = Math.floor(Math.min(...rows.map((r) => r.min)) / 10) * 10, hi = Math.ceil(Math.max(...rows.map((r) => r.max)) / 10) * 10;
  const x = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  const ticks = [lo, Math.round((lo + hi) / 20) * 10, hi];
  return (
    <div>
      <ul className="space-y-1.5" aria-label="Consistency">
        {rows.map((r) => (
          <li key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="relative h-4">
              <span className="absolute top-1/2 h-px -translate-y-1/2 bg-muted opacity-60" style={{ left: x(r.min), width: `calc(${x(r.max)} - ${x(r.min)})` }} />
              <span data-box title={`${name(r.id)}: floor ${fmtPts(r.floor)}, median ${fmtPts(r.median)}, ceiling ${fmtPts(r.ceiling)}; worst ${fmtPts(r.min)}, best ${fmtPts(r.max)}`} className="absolute top-0.5 h-3 rounded-sm" style={{ left: x(r.floor), width: `calc(${x(r.ceiling)} - ${x(r.floor)})`, background: r.id === active ? 'var(--gold)' : 'var(--dim)', opacity: 0.8 }} />
              <span className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-ink" style={{ left: x(r.median) }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="relative ml-[7rem] mt-1 h-4 text-[10px] text-muted">
        {ticks.map((t) => <span key={t} className="num absolute -translate-x-1/2" style={{ left: x(t) }}>{t}</span>)}
      </div>
    </div>
  );
}
```

`ScheduleLuck.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { LuckRow } from '../../lib/stats/strength';
import { fmtSigned } from '../../lib/format';
import Dumbbell from './Dumbbell';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export default function ScheduleLuck({ rows, refs, pin }: { rows: LuckRow[]; refs: ManagerRef[]; pin: Pin }) {
  if (rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const games = Math.max(...rows.map((r) => r.w + r.l + r.t));
  return (
    <Dumbbell
      rows={rows.map((r) => ({ id: r.id, from: r.medianW, to: r.w, label: fmtSigned(r.delta, 0), tone: r.delta >= 0 ? 'win' : 'loss', fromTitle: `${name(r.id)}: ${r.medianW}-${r.medianL} against the weekly median`, toTitle: `${name(r.id)}: ${r.w}-${r.l}${r.t ? `-${r.t}` : ''} for real` }))}
      domain={[0, games]} ticks={[0, Math.round(games / 2), games]} refs={refs} pin={pin} ariaLabel="Schedule luck"
    />
  );
}
```

`StrengthOfSchedule.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { SosRow } from '../../lib/stats/strength';
import { fmtPpg, fmtPts } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

export default function StrengthOfSchedule({ rows, refs, pin }: { rows: SosRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const span = Math.max(1, ...rows.map((r) => Math.abs(r.delta)));
  const half = (d: number) => `${(Math.abs(d) / span) * 50}%`;
  return (
    <div>
      <ul className="space-y-1.5" aria-label="Strength of schedule">
        {rows.map((r) => (
          <li key={r.id} data-tone={r.delta > 0 ? 'loss' : 'win'} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="relative h-4">
              <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
              <span title={`${name(r.id)}'s opponents scored ${fmtPts(r.faced)} a week against him, ${fmtPts(Math.abs(r.delta))} ${r.delta > 0 ? 'over' : 'under'} the league's ${fmtPts(r.leagueAvg)}`}
                className="absolute top-0.5 h-3 rounded-sm" style={{ left: r.delta > 0 ? '50%' : `calc(50% - ${half(r.delta)})`, width: half(r.delta), background: r.id === active ? 'var(--gold)' : r.delta > 0 ? 'var(--loss)' : 'var(--win)', opacity: 0.85 }} />
            </span>
            <span className="num text-right text-xs text-muted">{r.delta > 0 ? '+' : ''}{fmtPpg(r.delta)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-center text-[10px] text-muted">league average {fmtPpg(rows[0].leagueAvg)}</p>
    </div>
  );
}
```

`AllPlayGrid.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { AllPlayGrid as AllPlayData } from '../../lib/stats/strength';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

export default function AllPlayGrid({ grid, refs, pin }: { grid: AllPlayData; refs: ManagerRef[]; pin: Pin }) {
  if (grid.ids.length < 2) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const cell = (a: string, b: string): HeatCell | null => {
    const c = grid.cells[a]?.[b];
    if (!c) return null;
    const total = c.w + c.l + c.t;
    const p = total ? c.w / total : 0.5;
    const real = c.realW + c.realL + c.realT;
    return {
      fill: p === 0.5 ? 'var(--surface-2)' : tint(p > 0.5 ? 'win' : 'loss', Math.abs(p - 0.5) * 2),
      text: `${c.w}-${c.l}`,
      title: `${name(a)} outscored ${name(b)} in ${c.w} of ${total} weeks${real ? ` · played ${times(real)}, ${c.realW}-${c.realL}${c.realT ? `-${c.realT}` : ''}` : ' · never played'}`,
    };
  };
  return <Heatmap rows={grid.ids.map((id) => ({ id }))} cols={grid.ids.map((id) => ({ key: id, label: name(id).slice(0, 6) }))} cell={cell} refs={refs} pin={pin} ariaLabel="Head to head" />;
}
```

`PostseasonForm.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { PostseasonRow } from '../../lib/stats/strength';
import { fmtPpg, fmtSigned } from '../../lib/format';
import Dumbbell from './Dumbbell';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export default function PostseasonForm({ rows, refs, pin }: { rows: PostseasonRow[]; refs: ManagerRef[]; pin: Pin }) {
  if (rows.length === 0) return <Empty text="The playoffs have not started." />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const all = rows.flatMap((r) => [r.regPpg, r.postPpg]);
  const lo = Math.floor(Math.min(...all) / 25) * 25, hi = Math.ceil(Math.max(...all) / 25) * 25;
  return (
    <Dumbbell
      rows={rows.map((r) => ({ id: r.id, from: r.regPpg, to: r.postPpg, label: fmtSigned(r.delta, 1), tone: r.delta >= 0 ? 'win' : 'loss', fromTitle: `${name(r.id)}: ${fmtPpg(r.regPpg)} a game in the regular season`, toTitle: `${name(r.id)}: ${fmtPpg(r.postPpg)} a game over ${r.postGames} postseason game${r.postGames === 1 ? '' : 's'}` }))}
      domain={[lo, hi]} ticks={[lo, (lo + hi) / 2, hi]} refs={refs} pin={pin} ariaLabel="Postseason form"
    />
  );
}
```

- [ ] **Step 3: Run, type-check, commit**

Run: `cd packages/web && npx vitest run src/components/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit -p tsconfig.json > /tmp/claude-501/tsc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0. If the AllPlayGrid row test fails on the first cell's text, the diagonal renders an empty `td` (null cell) and the expectation `''` stands.

```bash
git add packages/web/src/components/stats
git commit -m "Stats: power rating, consistency, schedule luck, strength of schedule, head to head, postseason form charts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 11: The roster charts and the moments lists

**Files:**
- Create under `packages/web/src/components/stats/`: `DraftReturns.tsx`, `PointOrigins.tsx`, `RosterAge.tsx`, `WireActivity.tsx`, `Moments.tsx`, `rosterCharts.test.tsx`

**Interfaces:**
- Consumes: `DraftReturns as DraftData`, `OriginRow`, `RosterAge as AgeData`, `WireActivity as WireData` (`lib/stats/roster`); `Moments as MomentsData` (`lib/stats/moments`); `PlayerDirectory`; the primitives.
- Produces: `DraftReturns({ data: DraftData | null; players; refs; pin })`, `PointOrigins({ rows: OriginRow[]; refs; pin })`, `RosterAge({ data: AgeData; refs; pin })`, `WireActivity({ data: WireData; refs; pin })`, `Moments({ data: MomentsData; refs; pin })`.

- [ ] **Step 1: Write the failing tests**

`rosterCharts.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import DraftReturns from './DraftReturns';
import PointOrigins from './PointOrigins';
import RosterAge from './RosterAge';
import WireActivity from './WireActivity';
import Moments from './Moments';
import { managerRefs } from '../../lib/stats/scope';
import { draftReturns, pointOrigins, rosterAge, wireActivity } from '../../lib/stats/roster';
import { moments } from '../../lib/stats/moments';
import { teamGamesOf } from '../../lib/managerGames';
import { league, season2024, season2025, statsPlayers } from '../../test/statsFixtures';

const refs = managerRefs(league());
const s25 = season2025();

describe('DraftReturns', () => {
  it('tints each round by the points its pick returned and names the player on hover', () => {
    render(<DraftReturns data={draftReturns(s25)} players={statsPlayers} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Draft returns by round' });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getAllByRole('rowheader')[0]).toHaveTextContent('bob');   // sorted by total
    expect(within(rows[2]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['340', '120']);
    expect(screen.getByTitle('Quincy One · 340.00 started points')).toBeInTheDocument();
    expect(screen.getByTitle('Wally Two · 0.00 started points')).toHaveTextContent('');
  });
  it('says so without a draft', () => {
    render(<DraftReturns data={draftReturns(season2024())} players={statsPlayers} refs={refs} pin={null} />);
    expect(screen.getByText('No draft recorded.')).toBeInTheDocument();
  });
});

describe('PointOrigins', () => {
  it('stacks draft, pickup and trade shares per manager with a legend', () => {
    render(<PointOrigins rows={pointOrigins([s25])} refs={refs} pin="a" />);
    const items = screen.getByRole('list', { name: 'Where the points came from' }).querySelectorAll('li');
    expect(items).toHaveLength(4);
    const a = items[2];
    expect(a).toHaveAttribute('data-pinned', 'true');
    expect(a.querySelector('[data-part="draft"]')).toHaveTextContent('79%');
    expect(a.querySelector('[data-part="pickup"]')).toHaveTextContent('21%');
    expect(a.querySelector('[data-part="draft"]')).toHaveAttribute('title', 'Draft: 460.00 points, 79%');
    expect(screen.getByText('Waivers and free agents')).toBeInTheDocument();
  });
});

describe('RosterAge', () => {
  it('places a dot per manager on the rook-to-unc spectrum, the pinned one gold, with the shares in the title', () => {
    render(<RosterAge data={rosterAge([s25], statsPlayers)} refs={refs} pin="b" />);
    const svg = screen.getByRole('img', { name: 'Roster age' });
    expect(svg.querySelectorAll('circle[data-manager]')).toHaveLength(4);
    expect(svg.querySelector('circle[data-manager="b"]')).toHaveAttribute('data-pinned', 'true');
    expect(screen.getByTitle('alice: average age 25.1 · rookies 16%, 30 and over 5%')).toBeInTheDocument();
    expect(screen.getByText('ROOK')).toBeInTheDocument();
    expect(screen.getByText('UNC')).toBeInTheDocument();
  });
  it('says so with nothing to place', () => {
    render(<RosterAge data={{ rows: [], estimated: false }} refs={refs} pin={null} />);
    expect(screen.getByText('Nothing played yet.')).toBeInTheDocument();
  });
});

describe('WireActivity', () => {
  it('counts pickups per week with the totals and FAAB at the right', () => {
    render(<WireActivity data={wireActivity(s25)} refs={refs} pin={null} />);
    const table = screen.getByRole('table', { name: 'Wire activity' });
    const a = within(table).getAllByRole('row')[1];
    expect(within(a).getAllByRole('cell').map((c) => c.textContent)).toEqual(['', '1', '', '1', '', '2 · $13']);
    expect(screen.getByTitle('alice week 2: 1 pickup')).toBeInTheDocument();
  });
});

describe('Moments', () => {
  it('lists four kinds of game, each row linking to its box score', () => {
    render(<MemoryRouter><Moments data={moments(teamGamesOf([s25]))} refs={refs} pin={null} /></MemoryRouter>);
    for (const h of ['Robbed', 'Stolen', 'Flattened', 'Close calls']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    const robbed = screen.getByRole('list', { name: 'Robbed' });
    const first = robbed.querySelector('li')!;
    expect(first).toHaveTextContent('120.00');
    expect(first).toHaveTextContent('dan');
    expect(within(first).getByRole('link')).toHaveAttribute('href', '/scores/2025/5/1');
    expect(within(first).getByRole('link')).toHaveTextContent('wk 5 · 150.00–120.00 vs alice');
    expect(screen.getByRole('list', { name: 'Flattened' }).querySelector('li')).toHaveTextContent('+70.00');
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats/rosterCharts.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 2: Implement**

`DraftReturns.tsx`:
```tsx
import type { PlayerDirectory } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import type { DraftReturns as DraftData } from '../../lib/stats/roster';
import { fmtPts } from '../../lib/format';
import { playerName } from '../../lib/players';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

/** cells at or above this print their points */
const PRINT_FROM = 60;

export default function DraftReturns({ data, players, refs, pin }: { data: DraftData | null; players: PlayerDirectory; refs: ManagerRef[]; pin: Pin }) {
  if (!data) return <Empty text="No draft recorded." />;
  const max = Math.max(1, ...data.rows.flatMap((r) => r.cells.map((c) => c.points)));
  const cell = (rowId: string, key: string): HeatCell | null => {
    const c = data.rows.find((r) => r.id === rowId)?.cells[Number(key) - 1];
    if (!c) return null;
    return { fill: tint('win', c.points / max), text: c.points >= PRINT_FROM ? String(Math.round(c.points)) : undefined, title: c.playerId ? `${playerName(players, c.playerId)} · ${fmtPts(c.points)} started points` : 'No pick' };
  };
  const cols = Array.from({ length: data.rounds }, (_, i) => ({ key: String(i + 1), label: `R${i + 1}` }));
  return <Heatmap rows={data.rows} cols={cols} cell={cell} refs={refs} pin={pin} ariaLabel="Draft returns by round" />;
}
```

`PointOrigins.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { OriginRow } from '../../lib/stats/roster';
import { fmtPts } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

const PARTS: { key: 'draft' | 'pickup' | 'trade' | 'other'; label: string; colour: string }[] = [
  { key: 'draft', label: 'Draft', colour: 'var(--win)' }, { key: 'pickup', label: 'Waivers and free agents', colour: 'var(--gold)' },
  { key: 'trade', label: 'Trade', colour: 'var(--pos-K)' }, { key: 'other', label: 'Unknown', colour: 'var(--dim)' },
];

export default function PointOrigins({ rows, refs, pin }: { rows: OriginRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const used = PARTS.filter((p) => rows.some((r) => r[p.key] > 0));
  return (
    <div>
      <ul className="space-y-1.5" aria-label="Where the points came from">
        {rows.map((r) => (
          <li key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="flex h-4 overflow-hidden rounded bg-surface-2 text-[10px] font-semibold text-bg">
              {used.map((p) => { const share = r.total ? r[p.key] / r.total : 0; return (
                <span key={p.key} data-part={p.key} title={`${p.label}: ${fmtPts(r[p.key])} points, ${Math.round(share * 100)}%`} className="flex items-center justify-center" style={{ width: `${share * 100}%`, background: p.colour, opacity: r.id === active ? 1 : 0.85 }}>{share >= 0.08 ? `${Math.round(share * 100)}%` : ''}</span>
              ); })}
            </span>
          </li>
        ))}
      </ul>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
        {used.map((p) => <li key={p.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.colour }} />{p.label}</li>)}
      </ul>
    </div>
  );
}
```

`RosterAge.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { RosterAge as AgeData } from '../../lib/stats/roster';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

const W = 640, H = 150, PAD = 52, AXIS = 78;

/** a dot per manager on a spectrum from rookie-heavy to veteran-heavy rosters */
export default function RosterAge({ data, refs, pin }: { data: AgeData; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (data.rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const ages = data.rows.map((r) => r.age);
  const lo = Math.min(...ages) - 0.5, hi = Math.max(...ages) + 0.5;
  const x = (v: number) => PAD + ((v - lo) / (hi - lo || 1)) * (W - 2 * PAD);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Roster age">
      <defs><linearGradient id="roster-age-grad" x1="0" x2="1"><stop offset="0" stopColor="var(--win)" /><stop offset="0.5" stopColor="var(--gold)" /><stop offset="1" stopColor="var(--loss)" /></linearGradient></defs>
      <rect x={PAD} y={AXIS - 2} width={W - 2 * PAD} height="4" rx="2" fill="url(#roster-age-grad)" opacity="0.7" />
      <text x={PAD - 8} y={AXIS + 4} fontSize="11" fontWeight="700" fill="var(--win)" textAnchor="end">ROOK</text>
      <text x={W - PAD + 8} y={AXIS + 4} fontSize="11" fontWeight="700" fill="var(--loss)">UNC</text>
      {data.rows.map((r, i) => {
        const cx = x(r.age), up = i % 2 === 0, ty = up ? AXIS - 30 : AXIS + 36;
        const pinned = r.id === active, dim = active !== null && !pinned;
        return (
          <g key={r.id} {...hoverProps(r.id)} opacity={dim ? 0.4 : 1}>
            <line x1={cx} x2={cx} y1={up ? AXIS - 22 : AXIS + 8} y2={up ? AXIS - 8 : AXIS + 22} stroke={pinned ? 'var(--gold)' : 'var(--dim)'} />
            <circle data-manager={r.id} {...markAttrs(r.id, active)} cx={cx} cy={AXIS} r={pinned ? 6 : 4.5} fill={pinned ? 'var(--gold)' : 'var(--muted)'} stroke="var(--surface)" strokeWidth="1.5">
              <title>{`${name(r.id)}: average age ${r.age.toFixed(1)} · rookies ${Math.round(r.rookieShare * 100)}%, 30 and over ${Math.round(r.vetShare * 100)}%`}</title>
            </circle>
            <text x={cx} y={ty} fontSize="10" textAnchor="middle" fill={pinned ? 'var(--gold)' : 'var(--ink)'} fontWeight={pinned ? 600 : 400}>{name(r.id)}</text>
            <text x={cx} y={ty + (up ? -11 : 12)} fontSize="9" textAnchor="middle" fill="var(--muted)" className="num">{r.age.toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
  );
}
```

`WireActivity.tsx`:
```tsx
import type { ManagerRef } from '../../lib/stats/scope';
import type { WireActivity as WireData } from '../../lib/stats/roster';
import Heatmap, { type HeatCell } from './Heatmap';
import { Empty } from './StatCard';
import { tint, type Pin } from './pin';

export default function WireActivity({ data, refs, pin }: { data: WireData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const cell = (rowId: string, key: string): HeatCell | null => {
    const i = data.weeks.indexOf(Number(key));
    const n = data.rows.find((r) => r.id === rowId)?.perWeek[i];
    if (n === undefined) return null;
    return { fill: n ? tint('accent', n / 4) : 'var(--surface-2)', text: n ? String(n) : undefined, title: `${name(rowId)} week ${key}: ${n} pickup${n === 1 ? '' : 's'}` };
  };
  const right = (rowId: string) => { const r = data.rows.find((x) => x.id === rowId); return r ? `${r.total} · $${r.faab}` : null; };
  return <Heatmap rows={data.rows} cols={data.weeks.map((w) => ({ key: String(w), label: String(w) }))} cell={cell} refs={refs} pin={pin} right={right} ariaLabel="Wire activity" />;
}
```

`Moments.tsx`:
```tsx
import { Link } from 'react-router';
import type { ManagerRef } from '../../lib/stats/scope';
import type { Moment, Moments as MomentsData } from '../../lib/stats/moments';
import { fmtPts, fmtSigned } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

const LISTS: { key: keyof MomentsData; title: string; who: (m: Moment) => string; value: (m: Moment) => string }[] = [
  { key: 'robbed', title: 'Robbed', who: (m) => m.loserId, value: (m) => fmtPts(m.losePts) },
  { key: 'stolen', title: 'Stolen', who: (m) => m.winnerId, value: (m) => fmtPts(m.winPts) },
  { key: 'flattened', title: 'Flattened', who: (m) => m.winnerId, value: (m) => fmtSigned(m.margin, 2) },
  { key: 'close', title: 'Close calls', who: (m) => m.winnerId, value: (m) => fmtPts(m.margin) },
];

export default function Moments({ data, refs, pin }: { data: MomentsData; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (data.robbed.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {LISTS.map((l) => (
        <div key={l.key}>
          <h4 className="section-label mb-1">{l.title}</h4>
          <ol className="divide-y divide-line" aria-label={l.title}>
            {data[l.key].map((m) => { const who = l.who(m); const other = who === m.winnerId ? m.loserId : m.winnerId; return (
              <li key={`${m.year}-${m.week}-${m.matchupId}`} {...markAttrs(who, active)} {...hoverProps(who)} className={`grid grid-cols-[3.5rem_7rem_minmax(0,1fr)] items-center gap-2 py-1 text-xs ${active !== null && active !== who ? 'opacity-40' : ''}`}>
                <span className="num font-semibold text-gold">{l.value(m)}</span>
                <ManagerName id={who} refs={refs} active={active} avatar={false} />
                <Link to={`/scores/${m.year}/${m.week}/${m.matchupId}`} className="num truncate text-muted hover:text-accent">wk {m.week} · {fmtPts(m.winPts)}–{fmtPts(m.losePts)} vs {name(other)}</Link>
              </li>
            ); })}
          </ol>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run, type-check, commit**

Run: `cd packages/web && npx vitest run src/components/stats > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit -p tsconfig.json > /tmp/claude-501/tsc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0. (`playerName` lives in `src/lib/players.ts`; check its signature `(players, id)` there before use.)

```bash
git add packages/web/src/components/stats
git commit -m "Stats: draft returns, point origins, roster age, wire activity and moments

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 12: The numbers table

**Files:**
- Create: `packages/web/src/components/stats/StatTable.tsx`, `packages/web/src/components/stats/StatTable.test.tsx`

**Interfaces:**
- Consumes: `StatRow`, `COLUMNS`, `ColumnDef` (`lib/stats/table`); `ManagerName`, `pin.ts`.
- Produces: `StatTable({ rows: StatRow[]; refs; pin; allTime: boolean })`; the `Season` column group shows only when `allTime`; default sort `ppg` descending; clicking a header sorts by that column (descending first when `higherBetter`, ascending otherwise), clicking again flips; the manager column is sticky.

- [ ] **Step 1: Write the failing tests**

`StatTable.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import StatTable from './StatTable';
import { managerRefs } from '../../lib/stats/scope';
import { COLUMNS, statTable } from '../../lib/stats/table';
import { league, season2025 } from '../../test/statsFixtures';

const refs = managerRefs(league());
const names = () => screen.getAllByRole('row').slice(2).map((r) => within(r).getAllByRole('rowheader')[0].textContent);

describe('StatTable', () => {
  it('starts sorted by points per game, with group headers and a sticky manager column', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    expect(names()).toEqual(['bob', 'alice', 'cara', 'dan']);
    expect(screen.getByRole('columnheader', { name: /PPG/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByText('Scoring')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Yrs/ })).toBeNull();
    expect(screen.getAllByRole('rowheader')[0].className).toContain('sticky');
  });
  it('sorts a lower-is-better column ascending first, then flips', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'PA/G' }));
    expect(names()).toEqual(['alice', 'dan', 'bob', 'cara']);
    expect(screen.getByRole('columnheader', { name: /PA\/G/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: 'PA/G' }));
    expect(names()).toEqual(['cara', 'bob', 'dan', 'alice']);
  });
  it('shows the seasons column in all-time and tints the pinned manager\'s row', () => {
    render(<StatTable rows={statTable(league())} refs={refs} pin="c" allTime />);
    expect(screen.getByRole('columnheader', { name: /Yrs/ })).toBeInTheDocument();
    const cara = screen.getAllByRole('row').find((r) => r.textContent?.includes('cara'))!;
    expect(cara).toHaveAttribute('data-pinned', 'true');
    expect(within(cara).getAllByRole('cell')[0]).toHaveTextContent('2');
  });
  it('explains every column in its header title', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    expect(screen.getByRole('button', { name: 'xW' })).toHaveAttribute('title', 'Expected wins: all-play win rate × games played');
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats/StatTable.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 2: Implement StatTable.tsx**

```tsx
import { useState } from 'react';
import type { ManagerRef } from '../../lib/stats/scope';
import { COLUMNS, type ColumnDef, type StatRow } from '../../lib/stats/table';
import ManagerName from './ManagerName';
import { markAttrs, usePinHover, type Pin } from './pin';

interface Props { rows: StatRow[]; refs: ManagerRef[]; pin: Pin; allTime: boolean }
const PINNED_ROW = 'bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]';

/** Every manager, every advanced number, any column sortable. The manager column stays put while the rest scroll on a phone. */
export default function StatTable({ rows, refs, pin, allTime }: Props) {
  const { active, hoverProps } = usePinHover(pin);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'ppg', dir: 'desc' });
  const columns = COLUMNS.filter((c) => allTime || c.group !== 'Season');
  const groups = columns.reduce<{ group: ColumnDef['group']; span: number }[]>((acc, c) => { const last = acc[acc.length - 1]; if (last && last.group === c.group) last.span += 1; else acc.push({ group: c.group, span: 1 }); return acc; }, []);
  const by = columns.find((c) => c.key === sort.key) ?? columns[0];
  const sorted = [...rows].sort((x, y) => (by.value(x) - by.value(y)) * (sort.dir === 'asc' ? 1 : -1) || (x.id < y.id ? -1 : 1));
  const click = (c: ColumnDef) => setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.higherBetter ? 'desc' : 'asc' }));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface" />
            {groups.map((g, i) => <th key={g.group + i} colSpan={g.span} className="section-label border-b border-line px-2 pb-1 text-left text-[10px]">{g.group}</th>)}
          </tr>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-normal text-muted">Manager</th>
            {columns.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="whitespace-nowrap px-2 py-1.5 text-right">
                <button type="button" title={c.title} onClick={() => click(c)} className={`font-medium hover:text-ink ${sort.key === c.key ? 'text-ink underline decoration-dotted underline-offset-4' : 'text-muted'}`}>
                  {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▴' : ' ▾') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`border-t border-line ${r.id === active ? PINNED_ROW : active !== null ? 'opacity-60' : ''}`}>
              <th scope="row" className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-normal"><ManagerName id={r.id} refs={refs} active={active} /></th>
              {columns.map((c) => <td key={c.key} className="num whitespace-nowrap px-2 py-1.5 text-right">{c.text(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

The sticky manager cell carries the card's surface colour so scrolled columns slide under it; when a row is pinned the row tint is on the `tr`, so also add `${r.id === active ? PINNED_ROW : ''}` to the row-header `th`'s class so the tint continues under the sticky cell.

- [ ] **Step 3: Run, type-check, commit**

Run: `cd packages/web && npx vitest run src/components/stats/StatTable.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit -p tsconfig.json > /tmp/claude-501/tsc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0. The PA/G order ascending is alice 92.25, dan 104.5, bob 108, cara 110.

```bash
git add packages/web/src/components/stats/StatTable.tsx packages/web/src/components/stats/StatTable.test.tsx
git commit -m "Stats: the sortable numbers table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 13: Toolbar, the page, the route and the nav tab

**Files:**
- Create: `packages/web/src/components/stats/StatsToolbar.tsx`, `StatsToolbar.test.tsx`, `ManagersStats.tsx`, `ManagersStats.test.tsx`
- Create: `packages/web/src/pages/StatsPage.tsx`
- Modify: `packages/web/src/routes.tsx` (two routes), `packages/web/src/routes.test.tsx`, `packages/web/src/components/Nav.tsx:15-24` (one item), `packages/web/src/components/Nav.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2–12; `SeasonPicker`; `loadAllSeasons`, `history`, `currentSeason`, `players` (`src/data/load`).
- Produces: `StatsToolbar({ years: number[]; season: Scope; onSeason(s: Scope): void; refs: ManagerRef[]; pin: Pin; onPin(id: Pin): void })`; `ManagersStats({ seasons: Season[]; players: PlayerDirectory; years: number[]; currentYear: number })` reading `season` and `pin` from the URL; `StatsPage` (default export); routes `stats` (element) and `stats/managers` (redirect keeping the query string); nav item `Stats` after Records.

- [ ] **Step 1: Failing toolbar test**

`StatsToolbar.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import StatsToolbar from './StatsToolbar';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());

describe('StatsToolbar', () => {
  it('offers every season plus all-time, and a pill per manager that pins and unpins', () => {
    const onSeason = vi.fn(), onPin = vi.fn();
    render(<StatsToolbar years={[2024, 2025]} season={2025} onSeason={onSeason} refs={refs} pin="b" onPin={onPin} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(onSeason).toHaveBeenCalledWith('all');
    const pills = screen.getByRole('group', { name: 'Pin a manager' });
    expect(pills.querySelectorAll('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'bob' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'bob' }));
    expect(onPin).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'alice' }));
    expect(onPin).toHaveBeenCalledWith('a');
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats/StatsToolbar.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 2: Implement StatsToolbar.tsx**

```tsx
import type { ManagerRef, Scope } from '../../lib/stats/scope';
import Avatar from '../Avatar';
import SeasonPicker from '../SeasonPicker';
import type { Pin } from './pin';

interface Props { years: number[]; season: Scope; onSeason: (s: Scope) => void; refs: ManagerRef[]; pin: Pin; onPin: (id: Pin) => void }

/** Season picker and the pin row: one pill per manager; the pinned one is gold and lights up in every chart. */
export default function StatsToolbar({ years, season, onSeason, refs, pin, onPin }: Props) {
  return (
    <div className="sticky top-12 z-[5] -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <SeasonPicker years={years} value={season} onChange={onSeason} allTime />
      <div role="group" aria-label="Pin a manager" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5">
        {refs.map((r) => {
          const on = r.id === pin;
          return (
            <button key={r.id} type="button" aria-pressed={on} onClick={() => onPin(on ? null : r.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-gold bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-gold' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>
              <Avatar avatar={r.avatar} name={r.name} size={18} />{r.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Run the toolbar test — Expected: exit 0.

- [ ] **Step 3: Failing page tests**

`ManagersStats.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import ManagersStats from './ManagersStats';
import { league, season2025, statsPlayers } from '../../test/statsFixtures';
import { season } from '../../test/playerFixtures';

function Where() { const { search } = useLocation(); return <output data-testid="where">{search}</output>; }
const mount = (url = '/stats', seasons = league()) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/stats" element={<><ManagersStats seasons={seasons} players={statsPlayers} years={[2024, 2025]} currentYear={2025} /><Where /></>} /></Routes>
  </MemoryRouter>,
);
const card = (name: string) => screen.getByRole('region', { name });

describe('ManagersStats', () => {
  it('opens on the current season with every section and card', () => {
    mount();
    for (const s of ['The season', 'Strength', 'Roster', 'Moments', 'By the numbers']) expect(screen.getByRole('heading', { name: s })).toBeInTheDocument();
    for (const c of ['Standings race', 'Form guide', 'Scoring calendar', 'Weekly finishes', 'Power rating', 'Consistency', 'Schedule luck', 'Strength of schedule', 'Head to head', 'Postseason form', 'Draft returns by round', 'Where the points came from', 'Roster age', 'Wire activity', 'Robbed, stolen, flattened', 'The numbers']) expect(card(c)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('2025');
    expect(screen.getByTestId('where')).toBeEmptyDOMElement();
  });
  it('pins through the URL and lights the manager in every chart', () => {
    mount('/stats?pin=c');
    expect(screen.getByRole('button', { name: 'cara' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card('Form guide')).getAllByRole('row')[3]).toHaveAttribute('data-pinned', 'true');
    expect(within(card('The numbers')).getAllByRole('row').find((r) => r.textContent?.includes('cara'))).toHaveAttribute('data-pinned', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'alice' }));
    expect(screen.getByTestId('where')).toHaveTextContent('?pin=a');
    fireEvent.click(screen.getByRole('button', { name: 'alice' }));
    expect(screen.getByTestId('where')).toBeEmptyDOMElement();
  });
  it('switches to all-time: the week-by-week cards give way to a note, the rest aggregate, the table gains a seasons column', () => {
    mount();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(screen.getByTestId('where')).toHaveTextContent('?season=all');
    expect(screen.queryByRole('region', { name: 'Form guide' })).toBeNull();
    expect(screen.getByText('Pick a season for the week-by-week charts.')).toBeInTheDocument();
    expect(card('Power rating')).toBeInTheDocument();
    expect(within(card('The numbers')).getByRole('columnheader', { name: /Yrs/ })).toBeInTheDocument();
  });
  it('ignores a season that was never played and says so for a season with nothing played yet', () => {
    mount('/stats?season=1999');
    expect(screen.getByRole('combobox')).toHaveValue('2025');
    const blank = season(2026, []);
    blank.status = 'in_season';
    blank.managers = season2025().managers;
    blank.standings = [];
    render(
      <MemoryRouter initialEntries={['/stats?season=2026']}>
        <Routes><Route path="/stats" element={<ManagersStats seasons={[...league(), blank]} players={statsPlayers} years={[2024, 2025, 2026]} currentYear={2026} />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
  });
});
```

Run: `cd packages/web && npx vitest run src/components/stats/ManagersStats.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"` — Expected: exit 1.

- [ ] **Step 4: Implement ManagersStats.tsx**

```tsx
import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { PlayerDirectory, Season } from '@fantasy-dash/core';
import { teamGamesOf } from '../../lib/managerGames';
import { managerRefs, regular, scopeSeasons, type Scope } from '../../lib/stats/scope';
import { eloFor, eloHistory } from '../../lib/stats/elo';
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from '../../lib/stats/season';
import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from '../../lib/stats/strength';
import { draftReturns, pointOrigins, rosterAge, wireActivity } from '../../lib/stats/roster';
import { moments } from '../../lib/stats/moments';
import { statTable } from '../../lib/stats/table';
import StatCard from './StatCard';
import StatsToolbar from './StatsToolbar';
import StandingsRace from './StandingsRace';
import FormGuide from './FormGuide';
import ScoringCalendar from './ScoringCalendar';
import WeeklyFinishes from './WeeklyFinishes';
import PowerRating, { ELO_ABOUT } from './PowerRating';
import Consistency from './Consistency';
import ScheduleLuck from './ScheduleLuck';
import StrengthOfSchedule from './StrengthOfSchedule';
import AllPlayGrid from './AllPlayGrid';
import PostseasonForm from './PostseasonForm';
import DraftReturns from './DraftReturns';
import PointOrigins from './PointOrigins';
import RosterAge from './RosterAge';
import WireActivity from './WireActivity';
import Moments from './Moments';
import StatTable from './StatTable';
import type { Pin } from './pin';

interface Props { seasons: Season[]; players: PlayerDirectory; years: number[]; currentYear: number }

const TABLE_ABOUT = COLUMNS.map((c) => `${c.label}: ${c.title}.`).join(' ');

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-label">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

/** The Managers stats page: toolbar, five groups of chart cards, the table. The season and the pinned manager live in the URL. */
export default function ManagersStats({ seasons, players, years, currentYear }: Props) {
  const [params, setParams] = useSearchParams();
  const rawSeason = params.get('season');
  const scope: Scope = rawSeason === 'all' ? 'all' : years.includes(Number(rawSeason)) ? Number(rawSeason) : currentYear;
  const allTime = scope === 'all';
  const update = (mutate: (next: URLSearchParams) => void) => { const next = new URLSearchParams(params); mutate(next); setParams(next, { replace: true }); };

  const scoped = useMemo(() => scopeSeasons(seasons, scope), [seasons, scope]);
  const refs = useMemo(() => managerRefs(scoped), [scoped]);
  const pin: Pin = refs.some((r) => r.id === params.get('pin')) ? params.get('pin') : null;
  const single = allTime ? null : scoped[0] ?? null;
  const games = useMemo(() => teamGamesOf(scoped), [scoped]);
  const reg = useMemo(() => regular(games), [games]);
  const elo = useMemo(() => eloFor(eloHistory(seasons), scope), [seasons, scope]);
  const race = useMemo(() => (single ? standingsRace(single) : null), [single]);
  const form = useMemo(() => (single ? formGuide(single) : null), [single]);
  const calendar = useMemo(() => (single ? scoringCalendar(single) : null), [single]);
  const finishes = useMemo(() => weeklyFinishes(scoped), [scoped]);
  const spread = useMemo(() => consistency(reg), [reg]);
  const luck = useMemo(() => scheduleLuck(reg), [reg]);
  const sos = useMemo(() => strengthOfSchedule(reg), [reg]);
  const grid = useMemo(() => allPlayGrid(reg, refs.map((r) => r.id)), [reg, refs]);
  const post = useMemo(() => postseasonForm(games), [games]);
  const draft = useMemo(() => (single ? draftReturns(single) : null), [single]);
  const origins = useMemo(() => pointOrigins(scoped), [scoped]);
  const age = useMemo(() => rosterAge(scoped, players), [scoped, players]);
  const wire = useMemo(() => (single ? wireActivity(single) : null), [single]);
  const moment = useMemo(() => moments(games), [games]);
  const table = useMemo(() => statTable(scoped), [scoped]);

  const toolbar = (
    <StatsToolbar years={years} season={scope} onSeason={(s) => update((n) => { if (s === currentYear) n.delete('season'); else n.set('season', String(s)); })}
      refs={refs} pin={pin} onPin={(id) => update((n) => { if (id) n.set('pin', id); else n.delete('pin'); })} />
  );
  if (games.length === 0) return <div className="space-y-6">{toolbar}<p className="text-sm text-muted">Season has not started.</p></div>;
  const through = single && single.status === 'in_season' ? ` Through week ${single.lastScoredWeek}.` : '';
  const weekNote = <p className="text-sm text-muted lg:col-span-2">Pick a season for the week-by-week charts.</p>;
  return (
    <div className="space-y-8">
      {toolbar}
      <Group title="The season">
        {race && form && calendar ? (
          <>
            <StatCard id="race" eyebrow="Place in the table after every week" title="Standings race" caption="Each line is a manager; the dotted line is the playoff cut."><StandingsRace data={race} refs={refs} pin={pin} /></StatCard>
            <StatCard id="finishes" eyebrow="How often each manager was a top or bottom scorer" title="Weekly finishes" caption="Green: weeks in the top three scorers. Red: weeks in the bottom three."><WeeklyFinishes rows={finishes} refs={refs} pin={pin} /></StatCard>
            <StatCard id="form" eyebrow="Every game, every manager, one glance" title="Form guide" wide caption="W and L squares; the dashed line is where the playoffs start; a gold dot marks the week's top score. Hover a square for the score."><FormGuide data={form} refs={refs} pin={pin} /></StatCard>
            <StatCard id="calendar" eyebrow="Each week against the league average" title="Scoring calendar" wide caption="Greener the further above the week's average, redder below."><ScoringCalendar data={calendar} refs={refs} pin={pin} /></StatCard>
          </>
        ) : (
          <>
            {weekNote}
            <StatCard id="finishes" eyebrow="How often each manager was a top or bottom scorer, every season" title="Weekly finishes" caption="Green: weeks in the top three scorers. Red: weeks in the bottom three."><WeeklyFinishes rows={finishes} refs={refs} pin={pin} /></StatCard>
          </>
        )}
      </Group>
      <Group title="Strength">
        <StatCard id="elo" eyebrow={allTime ? 'Week by week across every season' : 'Week by week, margin-aware Elo'} title="Power rating" wide about={ELO_ABOUT} caption={allTime ? 'One line per manager; each season starts a third of the way back toward 1500.' : 'One line per manager; the pinned one is bright, the rest fade.'}><PowerRating history={elo} refs={refs} pin={pin} /></StatCard>
        <StatCard id="consistency" eyebrow="Floor, median and ceiling week" title="Consistency" caption="Box: second-worst to second-best week; tick: median; thin line: the full range. Short boxes are steady teams."><Consistency rows={spread} refs={refs} pin={pin} /></StatCard>
        <StatCard id="luck" eyebrow="Real record against the record versus the median" title="Schedule luck" caption="Hollow dot: wins if you had played the league median every week. Filled dot: what the schedule gave you."><ScheduleLuck rows={luck} refs={refs} pin={pin} /></StatCard>
        <StatCard id="sos" eyebrow="What opponents scored against each manager" title="Strength of schedule" caption="Red bars faced the hardest schedules, green the softest."><StrengthOfSchedule rows={sos} refs={refs} pin={pin} /></StatCard>
        {single && <StatCard id="post" eyebrow="Regular-season scoring against the postseason" title="Postseason form" caption="Hollow dot: regular-season average. Filled dot: postseason average, consolation games included."><PostseasonForm rows={post} refs={refs} pin={pin} /></StatCard>}
        <StatCard id="h2h" eyebrow="Who outscores whom, every week counted" title="Head to head" wide caption="Row beats column: every week counts as if the two had played, not only the real matchups, which are in the hover."><AllPlayGrid grid={grid} refs={refs} pin={pin} /></StatCard>
      </Group>
      <Group title="Roster">
        {single && <StatCard id="draft" eyebrow="Started points from each manager's pick in each round" title="Draft returns by round" wide caption="Brighter is more; hover a cell for the player. A bright late cell is a steal."><DraftReturns data={draft} players={players} refs={refs} pin={pin} /></StatCard>}
        <StatCard id="origins" eyebrow="Draft, pickups, trades" title="Where the points came from" caption="Sorted by the share of points that did not come from the draft."><PointOrigins rows={origins} refs={refs} pin={pin} /></StatCard>
        <StatCard id="age" eyebrow="Average age behind each manager's started points" title="Roster age" caption={age.estimated ? 'Some ages are estimated from NFL seasons where the birth date is missing.' : 'Weighted by the points each player scored.'}><RosterAge data={age} refs={refs} pin={pin} /></StatCard>
        {single && wire && <StatCard id="wire" eyebrow="Pickups per week, per manager" title="Wire activity" wide caption="Waiver and free-agent adds; totals and FAAB spent on the right."><WireActivity data={wire} refs={refs} pin={pin} /></StatCard>}
      </Group>
      <Group title="Moments">
        <StatCard id="moments" eyebrow="The injustices and demolitions" title="Robbed, stolen, flattened" wide caption="Highest score in a loss, lowest score in a win, biggest margins, closest calls. Each row opens the box score."><Moments data={moment} refs={refs} pin={pin} /></StatCard>
      </Group>
      <Group title="By the numbers">
        <StatCard id="table" eyebrow="Every advanced stat, click a header to rank by it" title="The numbers" wide about={TABLE_ABOUT} caption={`Regular season unless the column says otherwise.${through}`}><StatTable rows={table} refs={refs} pin={pin} allTime={allTime} /></StatCard>
      </Group>
    </div>
  );
}
```

`React.ReactNode` needs `import type { ReactNode } from 'react'` instead of the `React.` namespace; use that.

- [ ] **Step 5: Page, routes, nav, and their tests**

`src/pages/StatsPage.tsx`:
```tsx
import { useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import ManagersStats from '../components/stats/ManagersStats';
import { currentSeason, history, players } from '../data/load';

export default function StatsPage() {
  const seasons = useLoaderData() as Season[];
  return <ManagersStats seasons={seasons} players={players} years={history.seasons.map((s) => s.year)} currentYear={currentSeason.year} />;
}
```

`routes.tsx`: import `StatsPage`; after the `records` route add:
```tsx
      { path: 'stats', loader: () => loadAllSeasons(), element: <StatsPage /> },
      { path: 'stats/managers', loader: ({ request }: LoaderFunctionArgs) => redirect(`/stats${new URL(request.url).search}`) },
```

`routes.test.tsx`: add inside `describe('routes')`:
```ts
  it('serves stats with every season loaded and sends the managers alias to it with its query intact', async () => {
    expect(child('stats')?.element).toBeTruthy();
    expect(child('stats')?.loader).toBeTypeOf('function');
    const r = (await (child('stats/managers')!.loader as (a: LoaderFunctionArgs) => unknown)({ params: {}, request: new Request('http://x/stats/managers?season=all&pin=1'), context: {} } as LoaderFunctionArgs)) as Response;
    expect(r.headers.get('Location')).toBe('/stats?season=all&pin=1');
  });
```

`Nav.tsx` `items`: insert `{ kind: 'link', to: '/stats', label: 'Stats' },` after the Records item. `Nav.test.tsx`: add to the "links to Records" test: `expect(screen.getAllByRole('link', { name: 'Stats' })[0]).toHaveAttribute('href', '/stats');`.

- [ ] **Step 6: Run everything, type-check, commit**

Run: `pnpm test > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log; cd packages/web && npx tsc --noEmit -p tsconfig.json > /tmp/claude-501/tsc.log 2>&1; echo "tsc exit $?"`
Expected: all exit 0.

```bash
git add packages/web/src
git commit -m "Stats page: toolbar, the managers page, route and nav tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
### Task 14: Real-data smoke test, screenshots, docs, hand-off

**Files:**
- Create: `packages/web/src/lib/stats/smoke.test.ts`
- Modify: `docs/superpowers/specs/2026-10-17-stats-managers-design.md` (closing notes), the memory file noted below

- [ ] **Step 1: Write the smoke test over the committed data**

`smoke.test.ts`:
```ts
import { history, loadAllSeasons } from '../../data/load';
import { managerRefs, scopeSeasons, regular } from './scope';
import { teamGamesOf } from '../managerGames';
import { eloFor, eloHistory } from './elo';
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from './season';
import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from './strength';
import { draftReturns, pointOrigins, rosterAge, wireActivity } from './roster';
import { moments } from './moments';
import { COLUMNS, statTable } from './table';
import { players } from '../../data/load';

describe('stats over the committed seasons', () => {
  it('produces a row per manager for every season and all-time, with no NaN anywhere', async () => {
    const seasons = await loadAllSeasons();
    const scopes = [...history.seasons.map((s) => s.year), 'all' as const];
    for (const scope of scopes) {
      const scoped = scopeSeasons(seasons, scope);
      const refs = managerRefs(scoped);
      const games = teamGamesOf(scoped);
      const reg = regular(games);
      const rows = statTable(scoped);
      expect(rows).toHaveLength(refs.length);
      for (const r of rows) for (const c of COLUMNS) expect(c.text(r), `${scope} ${r.id} ${c.key}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(eloFor(eloHistory(seasons), scope).series).toHaveLength(managerRefs(seasons).length);
      weeklyFinishes(scoped); consistency(reg); scheduleLuck(reg); strengthOfSchedule(reg); allPlayGrid(reg, refs.map((r) => r.id)); postseasonForm(games); pointOrigins(scoped); rosterAge(scoped, players); moments(games);
      if (scope !== 'all') { const s = scoped[0]; standingsRace(s); formGuide(s); scoringCalendar(s); draftReturns(s); wireActivity(s); }
    }
  });
});
```

Run: `cd packages/web && npx vitest run src/lib/stats/smoke.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests |Error" /tmp/claude-501/t.log | head -4`
Expected: exit 0. A failure here is a real-data edge the fixtures missed: fix it in the owning module with a fixture-level test first (RED→GREEN), never by loosening this test.

- [ ] **Step 2: Build and screenshot**

```bash
pnpm build > /tmp/claude-501/build.log 2>&1; echo "build exit $?"
```
Start `npx vite preview --port 4199 --strictPort` in `packages/web` as a background task, then from a script under `/tmp/claude-501/` (never a heredoc inside the worktree) run headless Chrome at 1280×1800 and 400×1800 against `http://localhost:4199/stats`, `http://localhost:4199/stats?pin=<the 2025 champion's id>` and `http://localhost:4199/stats?season=all`, and view the PNGs with the Read tool. Look for: the toolbar sticking under the nav, two cards per row at 1280 with the wide ones spanning, the pinned manager gold with the rest faded, the dashed playoff line running the full height of the form guide, right-edge labels on the race and Elo charts not overlapping, the table scrolling horizontally at 400 with the manager column fixed, and nothing wider than the viewport at 400 (the known team-page overflow must not repeat here). Fix layout faults with a failing component test where one can express it, otherwise a direct fix noted in the ledger. Stop the preview (`pkill -f "vite preview --port 4199"`) when done.

- [ ] **Step 3: Light theme**

Repeat one screenshot at 1280 with `localStorage.theme = 'light'` set first (Chrome's `--headless=new` can run `--virtual-time-budget`; simplest is a one-line HTML shim under `/tmp/claude-501/` that sets the key then redirects to the preview URL). Check gold on the tinted cells and the red/green bars read on white.

- [ ] **Step 4: Docs and memory**

Append to the spec a short "Built" section: what shipped, the Elo season-view decision (ratings carried in, not reset), the head-to-head grid counting regular weeks only, the top/bottom-three rule for small leagues (`bottom = rank > max(3, n − 3)`), the ownership drop rule, whether the sync ran (real ages or estimated), and anything ruled during execution. Update `/Users/mathiasfoster/.claude/projects/-Users-mathiasfoster-repos-fantasy-dash/memory/statistics-page-pending.md`: the Managers stats page is built (main SHA once merged); the Players tab (move Leaders from Records, remove the Leaders sub-tab and `AllTimeTable`, add efficiency, consistency, expected points, journeymen) is the remaining project; note the `.superpowers/brainstorm/` mockups and the generator scripts' intent.

```bash
git add packages/web/src/lib/stats/smoke.test.ts docs/superpowers/specs/2026-10-17-stats-managers-design.md
git commit -m "Stats: real-data smoke test and closing notes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Finish**

Full suite, type check and build one last time (all exit 0), then the final whole-branch review on the most capable model per the executing skill, fix Critical/Important with RED→GREEN, and hand the branch to superpowers:finishing-a-development-branch. Mathias has not pre-chosen merge for this project: present the three options.
