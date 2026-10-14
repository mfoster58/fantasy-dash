# Fantasy Dashboard Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the minimal dashboard: a sync script that pulls every season of the Sleeper league into JSON, a tested stats engine, and a static React app with Standings, Scoreboard, and Box Score pages, deployed to GitHub Pages on a weekly schedule.

**Architecture:** pnpm workspace with two packages. `packages/core` is pure TypeScript (Sleeper client, normalizer, stats engine, zod schemas) with no React. `packages/web` is a Vite + React + React Router + Tailwind single-page app that imports the generated JSON in `data/`. `scripts/sync.ts` wires the client to the engine and writes `data/`. A GitHub Action runs sync weekly, commits data, builds, and deploys.

**Tech Stack:** Node 22+, pnpm 10, TypeScript 5 (strict), Vitest 3, zod 3, tsx 4, Vite 6, React 19, react-router 7 (data router), Tailwind 4, @testing-library/react, jsdom.

**Spec:** `docs/superpowers/specs/2026-10-14-fantasy-dashboard-design.md`. Read the "Metric definitions" section before Tasks 4 to 8.

## Global Constraints

- League ID `1388299227519537152`; league name "Husky Fantasy". Both live only in `league.config.ts`.
- Managers keyed by Sleeper `user_id`. Never key by roster ID or team name across seasons.
- Regular season = weeks `1` to `playoffWeekStart - 1`. Everything in standings uses regular season only.
- Bracket outcomes are decided from scores: winners bracket higher scorer advances, consolation lower scorer advances. Tie falls back to Sleeper's `w` field.
- Playoff tags are exactly: `QF`, `SF`, `Final`, `3rd`, `5th`, `Cons-R1`, `Toilet Bowl`, `Cons-7th`.
- Scoring is read per season from `scoring_settings`; never hard-code point values.
- Sync is all-or-nothing: on any failure, `data/` is left untouched.
- Points rounded to 2 decimals; ratios (efficiency, win pct, all-play pct) stored as 0 to 1 with 4 decimals.
- Oracle results that tests must reproduce:

| Season | Champion | Runner-up | 3rd | Last place |
|---|---|---|---|---|
| 2025 | mattygggg | ErikOdd | faraz525 | vishwakn |
| 2024 | CurryLover53 | mattygggg | azhangatang | vishwakn |
| 2023 | BigBufoon | vishwakn | ErikOdd | CurryLover53 |

- Commit after every task with the message shown. Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Web UI work (Tasks 13 to 16) must invoke the `frontend-design:frontend-design` skill once, at Task 13, before writing styles. The skill may change token *values* and fonts; it must keep the token *names* defined in Task 13 because later tasks reference them.

## File Structure

```
fantasy-dash/
  package.json                      # workspace root, scripts: sync, test, dev, build
  pnpm-workspace.yaml
  tsconfig.base.json
  league.config.ts                  # leagueId, name, managerNames overrides
  .gitignore
  .github/workflows/sync.yml        # weekly sync + Pages deploy
  scripts/sync.ts                   # fetch -> build -> validate -> write data/
  data/                             # generated, committed
    players.json
    history.json
    seasons/{year}.json
  packages/core/
    package.json  tsconfig.json
    src/index.ts                    # re-exports
    src/types.ts                    # output data model
    src/scoring.ts                  # scoreStats, round helpers
    src/lineup.ts                   # optimalLineup, optimalSwaps
    src/standings.ts                # computeStreak, computeStandings
    src/bracket.ts                  # resolveBracket, tagFor, tagForGame, computeHonors
    src/players.ts                  # toPlayerDirectory, trimPlayers, collectPlayerIds
    src/season.ts                   # buildSeason (normalize + derive)
    src/history.ts                  # buildHistory
    src/schema.ts                   # zod schemas for output files
    src/sleeper/types.ts            # raw Sleeper shapes
    src/sleeper/client.ts           # SleeperClient with throttle + retry
    test/*.test.ts
    test/fixtures/mini.ts           # hand-built 4-team league
    test/fixtures/record.ts         # one-off recorder for real playoff data
    test/fixtures/playoffs-{2023,2024,2025}.json
  packages/web/
    package.json  tsconfig.json  vite.config.ts  index.html
    src/main.tsx  src/App.tsx  src/index.css
    src/data/load.ts                # history, players, loadSeason(year)
    src/lib/format.ts  src/lib/players.ts  src/lib/metrics.ts  src/lib/theme.ts
    src/components/Nav.tsx  ThemeToggle.tsx  Avatar.tsx  SeasonPicker.tsx  WeekStrip.tsx
    src/components/StandingsTable.tsx  ScoreCard.tsx
    src/components/boxscore/LineupTable.tsx  EfficiencyBlock.tsx  FormBlock.tsx
    src/pages/StandingsPage.tsx  ScoresPage.tsx  BoxScorePage.tsx
    src/test/setup.ts
    src/components/*.test.tsx
```

---

### Task 0: Toolchain

**Files:** none in repo.

- [ ] **Step 1: Upgrade Node and install pnpm**

```bash
brew upgrade node
hash -r
node --version      # expect v22 or newer
npm install -g pnpm@10
pnpm --version      # expect 10.x
```

If `brew upgrade node` reports Node is already current but `node --version` still prints 19, run `brew link --overwrite node`.

- [ ] **Step 2: Verify from the repo**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && node -e "console.log(process.versions.node)" && pnpm --version
```

Expected: a version 22 or newer, then a 10.x pnpm version.

No commit for this task.

---

### Task 1: Workspace scaffold and core package skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `league.config.ts`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/types.ts`
- Test: `packages/core/test/types.test.ts`

**Interfaces:**
- Produces: every type in `types.ts` below. All later tasks import from `../src/types` (tests) or `./types` (src).

- [ ] **Step 1: Root files**

`package.json`:
```json
{
  "name": "fantasy-dash",
  "private": true,
  "type": "module",
  "scripts": {
    "sync": "tsx scripts/sync.ts",
    "sync:dry": "tsx scripts/sync.ts --dry-run",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "dev": "pnpm --filter @fantasy-dash/web dev",
    "build": "pnpm --filter @fantasy-dash/web build"
  },
  "dependencies": {
    "@fantasy-dash/core": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.tmp/
*.log
.DS_Store
```

`league.config.ts`:
```ts
export const leagueConfig = {
  leagueId: '1388299227519537152',
  name: 'Husky Fantasy',
  /** Optional display-name overrides keyed by Sleeper user_id. */
  managerNames: {} as Record<string, string>,
};
```

- [ ] **Step 2: Core package files**

`packages/core/package.json`:
```json
{
  "name": "@fantasy-dash/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"]
}
```

`packages/core/src/types.ts`:
```ts
export type UserId = string;
export type PlayerId = string;

export type PlayoffTag =
  | 'QF' | 'SF' | 'Final' | '3rd' | '5th'
  | 'Cons-R1' | 'Toilet Bowl' | 'Cons-7th';

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  firstName: string;
  lastName: string;
  position: string | null;
  team: string | null;
  yearsExp: number | null;
}
export type PlayerDirectory = Record<PlayerId, PlayerInfo>;

export interface Manager {
  userId: UserId;
  displayName: string;
  teamName: string | null;
  avatar: string | null;
  rosterId: number;
}

export interface WLT { w: number; l: number; t: number }

export interface PlayerLine {
  playerId: PlayerId;
  points: number;
  /** null when Sleeper had no projection for this player that week */
  projected: number | null;
  stats: Record<string, number>;
}

export interface SlotEntry {
  slot: string;
  player: PlayerLine | null;
}

export interface Swap {
  /** null when the optimal player fills a slot that was left empty */
  out: PlayerId | null;
  in: PlayerId;
  gain: number;
}

export interface GameSide {
  userId: UserId;
  points: number;
  projected: number;
  ceiling: number;
  /** points / ceiling, 0..1, 4 decimals */
  efficiency: number;
  starters: SlotEntry[];
  bench: PlayerLine[];
  optimalSwaps: Swap[];
  /** regular-season record entering this week */
  recordBefore: WLT;
  /** regular-season PPG for the season through lastScoredWeek */
  seasonPpg: number;
}

export interface Game {
  /** `${year}-${week}-${matchupId}` */
  id: string;
  matchupId: number;
  week: number;
  tag: PlayoffTag | null;
  sides: [GameSide, GameSide];
  winner: UserId | null;
  margin: number;
}

export interface Week {
  week: number;
  isPlayoff: boolean;
  played: boolean;
  games: Game[];
  /** regular season only; null in playoffs or unplayed */
  highScore: UserId | null;
}

export interface AllPlay extends WLT { pct: number }

export interface StandingRow {
  userId: UserId;
  rank: number;
  w: number;
  l: number;
  t: number;
  winPct: number;
  pf: number;
  pa: number;
  ppg: number;
  maxPoints: number;
  efficiency: number;
  /** 'W3', 'L2', or '-' */
  streak: string;
  allPlay: AllPlay;
  weeklyHighs: number;
}

export type BracketKind = 'winners' | 'consolation';

export interface BracketGame {
  bracket: BracketKind;
  round: number;
  matchNo: number;
  placement: number | null;
  week: number;
  tag: PlayoffTag;
  home: UserId | null;
  away: UserId | null;
  homePoints: number | null;
  awayPoints: number | null;
  /** the team that moves on in this bracket's direction (see spec) */
  advanced: UserId | null;
  gameId: string | null;
}

export interface Honors {
  champion: UserId | null;
  runnerUp: UserId | null;
  third: UserId | null;
  pointsTitle: UserId | null;
  lastPlace: UserId | null;
}

export type SeasonStatus = 'complete' | 'in_season';

export interface Season {
  year: number;
  leagueId: string;
  status: SeasonStatus;
  lastScoredWeek: number;
  playoffWeekStart: number;
  playoffTeams: number;
  /** starting slots only, in Sleeper order */
  rosterSlots: string[];
  scoring: Record<string, number>;
  managers: Record<UserId, Manager>;
  /** index = week - 1 */
  weeks: Week[];
  brackets: { winners: BracketGame[]; consolation: BracketGame[] };
  standings: StandingRow[];
  honors: Honors;
}

export interface H2HGame {
  gameId: string;
  year: number;
  week: number;
  tag: PlayoffTag | null;
  aPoints: number;
  bPoints: number;
}

export interface H2HSeries {
  a: UserId;
  b: UserId;
  aWins: number;
  bWins: number;
  ties: number;
  /** newest first */
  games: H2HGame[];
}

export interface HistorySeason {
  year: number;
  leagueId: string;
  status: SeasonStatus;
  lastScoredWeek: number;
  playoffWeekStart: number;
}

export interface History {
  /** oldest first */
  seasons: HistorySeason[];
  managers: Record<UserId, { displayName: string; avatar: string | null; seasons: number[] }>;
  h2h: Record<string, H2HSeries>;
}

/** Stable key for a pair of managers: lexicographically smaller id first. */
export function h2hKey(a: UserId, b: UserId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
```

`packages/core/src/index.ts`:
```ts
export * from './types';
```

- [ ] **Step 3: Write a smoke test**

`packages/core/test/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { h2hKey } from '../src/types';

describe('h2hKey', () => {
  it('orders ids so the key is symmetric', () => {
    expect(h2hKey('b', 'a')).toBe('a|b');
    expect(h2hKey('a', 'b')).toBe('a|b');
  });
});
```

- [ ] **Step 4: Install and run**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && pnpm install && pnpm --filter @fantasy-dash/core test
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold pnpm workspace and core types

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Scoring

**Files:**
- Create: `packages/core/src/scoring.ts`
- Test: `packages/core/test/scoring.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `round2(n: number): number`, `round4(n: number): number`, `scoreStats(stats: Record<string, number>, scoring: Record<string, number>): number`

- [ ] **Step 1: Failing test**

`packages/core/test/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scoreStats, round2, round4 } from '../src/scoring';

describe('scoreStats', () => {
  const scoring = { pass_yd: 0.04, pass_td: 4, pass_int: -1, rush_yd: 0.1, rec: 1, bonus_rec_te: 0 };

  it('multiplies each stat by its weight and sums', () => {
    expect(scoreStats({ pass_yd: 250, pass_td: 2, pass_int: 1 }, scoring)).toBe(17);
  });

  it('ignores stats with no scoring weight and weights with no stat', () => {
    expect(scoreStats({ pass_yd: 100, pos_rank_ppr: 3 }, scoring)).toBe(4);
    expect(scoreStats({}, scoring)).toBe(0);
  });

  it('rounds to 2 decimals', () => {
    expect(scoreStats({ rush_yd: 33 }, scoring)).toBe(3.3);
    expect(scoreStats({ pass_yd: 7 }, scoring)).toBe(0.28);
  });
});

describe('rounding', () => {
  it('round2 and round4', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round4(0.123456)).toBe(0.1235);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- scoring
```
Expected: FAIL, cannot find module `../src/scoring`.

- [ ] **Step 3: Implement**

`packages/core/src/scoring.ts`:
```ts
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Apply a league's scoring_settings to a raw stat line. */
export function scoreStats(
  stats: Record<string, number>,
  scoring: Record<string, number>,
): number {
  let total = 0;
  for (const [key, weight] of Object.entries(scoring)) {
    if (weight === 0) continue;
    const value = stats[key];
    if (typeof value === 'number') total += value * weight;
  }
  return round2(total);
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './scoring';
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- scoring
```
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): scoreStats applies league scoring to stat lines

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Optimal lineup and swaps

**Files:**
- Create: `packages/core/src/lineup.ts`
- Test: `packages/core/test/lineup.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `round2` from `./scoring`, `Swap`, `PlayerId` from `./types`
- Produces:
  - `interface LineupPlayer { playerId: PlayerId; position: string | null; points: number }`
  - `interface Lineup { slots: { slot: string; playerId: PlayerId | null }[]; total: number }`
  - `optimalLineup(slots: string[], players: LineupPlayer[]): Lineup`
  - `optimalSwaps(actualStarters: (PlayerId | null)[], optimal: Lineup, info: (id: PlayerId) => LineupPlayer): Swap[]`

- [ ] **Step 1: Failing test**

`packages/core/test/lineup.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { optimalLineup, optimalSwaps, type LineupPlayer } from '../src/lineup';

const P = (playerId: string, position: string | null, points: number): LineupPlayer => ({ playerId, position, points });

const players: LineupPlayer[] = [
  P('qb1', 'QB', 20), P('qb2', 'QB', 25),
  P('rb1', 'RB', 10), P('rb2', 'RB', 8), P('rb3', 'RB', 12),
  P('wr1', 'WR', 11), P('te1', 'TE', 5),
];
const slots = ['QB', 'RB', 'RB', 'FLEX'];

describe('optimalLineup', () => {
  it('fills fixed slots with the best at each position, then FLEX from RB/WR/TE', () => {
    const lineup = optimalLineup(slots, players);
    expect(lineup.slots).toEqual([
      { slot: 'QB', playerId: 'qb2' },
      { slot: 'RB', playerId: 'rb3' },
      { slot: 'RB', playerId: 'rb1' },
      { slot: 'FLEX', playerId: 'wr1' },
    ]);
    expect(lineup.total).toBe(58);
  });

  it('leaves a slot empty when no eligible player exists', () => {
    const lineup = optimalLineup(['QB', 'K'], [P('qb1', 'QB', 9)]);
    expect(lineup.slots[1]).toEqual({ slot: 'K', playerId: null });
    expect(lineup.total).toBe(9);
  });

  it('ignores players with unknown position', () => {
    const lineup = optimalLineup(['RB'], [P('x', null, 99), P('rb1', 'RB', 3)]);
    expect(lineup.slots[0].playerId).toBe('rb1');
  });
});

describe('optimalSwaps', () => {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const info = (id: string) => byId.get(id)!;

  it('pairs each optimal addition with a benched starter of the same position when possible', () => {
    const optimal = optimalLineup(slots, players);
    const swaps = optimalSwaps(['qb1', 'rb1', 'rb2', 'te1'], optimal, info);
    expect(swaps).toEqual([
      { out: 'qb1', in: 'qb2', gain: 5 },
      { out: 'rb2', in: 'rb3', gain: 4 },
      { out: 'te1', in: 'wr1', gain: 6 },
    ]);
    const actualTotal = 20 + 10 + 8 + 5;
    expect(swaps.reduce((s, x) => s + x.gain, 0)).toBe(optimal.total - actualTotal);
  });

  it('returns no swaps when the lineup was already optimal', () => {
    const optimal = optimalLineup(slots, players);
    expect(optimalSwaps(['qb2', 'rb3', 'rb1', 'wr1'], optimal, info)).toEqual([]);
  });

  it('uses out: null for an empty starting slot', () => {
    const optimal = optimalLineup(['QB'], [P('qb1', 'QB', 20)]);
    expect(optimalSwaps([null], optimal, (id) => P(id, 'QB', 20))).toEqual([{ out: null, in: 'qb1', gain: 20 }]);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- lineup
```
Expected: FAIL, cannot find module `../src/lineup`.

- [ ] **Step 3: Implement**

`packages/core/src/lineup.ts`:
```ts
import type { PlayerId, Swap } from './types';
import { round2 } from './scoring';

export interface LineupPlayer {
  playerId: PlayerId;
  position: string | null;
  points: number;
}

export interface LineupSlot {
  slot: string;
  playerId: PlayerId | null;
}

export interface Lineup {
  slots: LineupSlot[];
  total: number;
}

/** Sleeper flex slot names and the positions they accept. */
export const FLEX_ELIGIBILITY: Record<string, string[]> = {
  FLEX: ['RB', 'WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  IDP_FLEX: ['DL', 'LB', 'DB'],
};

export function slotEligible(slot: string): string[] {
  return FLEX_ELIGIBILITY[slot] ?? [slot];
}

/**
 * Best possible lineup from a roster. Fixed-position slots are filled first with
 * the top scorers at that position; flex slots then take the best remaining
 * eligible player. Greedy is optimal because every flex slot accepts a superset
 * of the fixed slots it competes with.
 */
export function optimalLineup(slots: string[], players: LineupPlayer[]): Lineup {
  const remaining = players
    .filter((p) => p.position !== null)
    .sort((a, b) => b.points - a.points);
  const result: LineupSlot[] = slots.map((slot) => ({ slot, playerId: null }));

  const fill = (index: number) => {
    const eligible = slotEligible(result[index].slot);
    const i = remaining.findIndex((p) => eligible.includes(p.position as string));
    if (i >= 0) {
      result[index].playerId = remaining[i].playerId;
      remaining.splice(i, 1);
    }
  };

  slots.forEach((slot, i) => { if (!(slot in FLEX_ELIGIBILITY)) fill(i); });
  slots.forEach((slot, i) => { if (slot in FLEX_ELIGIBILITY) fill(i); });

  const points = new Map(players.map((p) => [p.playerId, p.points]));
  const total = round2(result.reduce((sum, r) => sum + (r.playerId ? points.get(r.playerId) ?? 0 : 0), 0));
  return { slots: result, total };
}

/**
 * The bench-for-starter replacements that turn the actual lineup into the
 * optimal one. Each optimal addition is paired with a removed starter of the
 * same position when one exists, otherwise with the lowest-scoring removed
 * starter, otherwise with null (an empty slot).
 */
export function optimalSwaps(
  actualStarters: (PlayerId | null)[],
  optimal: Lineup,
  info: (id: PlayerId) => LineupPlayer,
): Swap[] {
  const actual = new Set(actualStarters.filter((id): id is PlayerId => id !== null));
  const chosen = new Set(optimal.slots.map((s) => s.playerId).filter((id): id is PlayerId => id !== null));

  const outs = [...actual].filter((id) => !chosen.has(id)).sort((a, b) => info(a).points - info(b).points);
  const ins = [...chosen].filter((id) => !actual.has(id)).sort((a, b) => info(b).points - info(a).points);

  return ins.map((inId) => {
    const inPos = info(inId).position;
    let idx = outs.findIndex((id) => info(id).position === inPos);
    if (idx < 0) idx = outs.length ? 0 : -1;
    const outId = idx >= 0 ? outs.splice(idx, 1)[0] : null;
    const gain = round2(info(inId).points - (outId ? info(outId).points : 0));
    return { out: outId, in: inId, gain };
  });
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './lineup';
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- lineup
```
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): optimal lineup and swap computation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Standings, streaks, all-play

**Files:**
- Create: `packages/core/src/standings.ts`
- Test: `packages/core/test/standings.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Week`, `Game`, `GameSide`, `StandingRow`, `UserId` from `./types`; `round2`, `round4` from `./scoring`
- Produces:
  - `computeStreak(results: ('W' | 'L' | 'T')[]): string`
  - `isRegularSeason(week: number, playoffWeekStart: number): boolean`
  - `computeStandings(weeks: Week[], managerIds: UserId[], playoffWeekStart: number): StandingRow[]`

- [ ] **Step 1: Failing test**

`packages/core/test/standings.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeStreak, computeStandings } from '../src/standings';
import type { Week, Game, GameSide } from '../src/types';

/** Build a minimal GameSide; ceiling defaults to points (perfect efficiency). */
function side(userId: string, points: number, ceiling = points): GameSide {
  return {
    userId, points, projected: 0, ceiling,
    efficiency: ceiling ? points / ceiling : 0,
    starters: [], bench: [], optimalSwaps: [],
    recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 0,
  };
}

function game(week: number, matchupId: number, a: GameSide, b: GameSide): Game {
  const winner = a.points > b.points ? a.userId : b.points > a.points ? b.userId : null;
  return { id: `2024-${week}-${matchupId}`, matchupId, week, tag: null, sides: [a, b], winner, margin: Math.abs(a.points - b.points) };
}

function week(n: number, games: Game[], played = true, playoffWeekStart = 4): Week {
  const isPlayoff = n >= playoffWeekStart;
  const all = games.flatMap((g) => g.sides);
  const top = all.length ? all.reduce((m, s) => (s.points > m.points ? s : m)) : null;
  return { week: n, isPlayoff, played, games, highScore: played && !isPlayoff && top ? top.userId : null };
}

describe('computeStreak', () => {
  it('counts the trailing run', () => {
    expect(computeStreak(['W', 'L', 'L'])).toBe('L2');
    expect(computeStreak(['L', 'W', 'W', 'W'])).toBe('W3');
  });
  it('returns - for empty or trailing tie', () => {
    expect(computeStreak([])).toBe('-');
    expect(computeStreak(['W', 'T'])).toBe('-');
  });
});

describe('computeStandings', () => {
  // 4 teams, 3 regular-season weeks, playoffs start week 4.
  const weeks: Week[] = [
    week(1, [game(1, 1, side('A', 100), side('B', 90)), game(1, 2, side('C', 80), side('D', 70))]),
    week(2, [game(2, 1, side('A', 60, 82), side('C', 110)), game(2, 2, side('B', 95), side('D', 95))]),
    week(3, [game(3, 1, side('A', 120), side('D', 50)), game(3, 2, side('B', 70), side('C', 130))]),
    week(4, [game(4, 1, side('C', 999), side('A', 1))]),           // playoff: must be ignored
    week(5, [game(5, 1, side('A', 0), side('B', 0))], false, 99),  // unplayed: must be ignored
  ];
  const rows = computeStandings(weeks, ['A', 'B', 'C', 'D'], 4);
  const by = Object.fromEntries(rows.map((r) => [r.userId, r]));

  it('ranks by wins then points for', () => {
    expect(rows.map((r) => r.userId)).toEqual(['C', 'A', 'B', 'D']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('computes W L T, win pct, PF, PA, PPG', () => {
    expect(by.A).toMatchObject({ w: 2, l: 1, t: 0, winPct: 0.6667, pf: 280, pa: 250, ppg: 93.33 });
    expect(by.B).toMatchObject({ w: 0, l: 2, t: 1, winPct: 0.1667, pf: 255, pa: 325 });
    expect(by.C).toMatchObject({ w: 3, l: 0, t: 0, winPct: 1, pf: 320, pa: 200 });
    expect(by.D).toMatchObject({ w: 0, l: 2, t: 1, pf: 215, pa: 295 });
  });

  it('computes max points and efficiency from ceilings', () => {
    expect(by.A.maxPoints).toBe(302);
    expect(by.A.efficiency).toBe(0.9272);
    expect(by.C.efficiency).toBe(1);
  });

  it('computes streaks', () => {
    expect(by.A.streak).toBe('W1');
    expect(by.B.streak).toBe('L1');
    expect(by.C.streak).toBe('W3');
  });

  it('computes all-play records', () => {
    expect(by.A.allPlay).toEqual({ w: 5, l: 4, t: 0, pct: 0.5556 });
    expect(by.B.allPlay).toEqual({ w: 4, l: 4, t: 1, pct: 0.5 });
    expect(by.C.allPlay).toEqual({ w: 7, l: 2, t: 0, pct: 0.7778 });
    expect(by.D.allPlay).toEqual({ w: 1, l: 7, t: 1, pct: 0.1667 });
  });

  it('counts weekly high scores', () => {
    expect(by.A.weeklyHighs).toBe(1);
    expect(by.C.weeklyHighs).toBe(2);
    expect(by.B.weeklyHighs).toBe(0);
  });

  it('returns zero rows for managers with no games', () => {
    const r = computeStandings(weeks, ['Z'], 4)[0];
    expect(r).toMatchObject({ userId: 'Z', w: 0, l: 0, t: 0, pf: 0, ppg: 0, streak: '-', efficiency: 0 });
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- standings
```
Expected: FAIL, cannot find module `../src/standings`.

- [ ] **Step 3: Implement**

`packages/core/src/standings.ts`:
```ts
import type { StandingRow, UserId, Week } from './types';
import { round2, round4 } from './scoring';

export type Result = 'W' | 'L' | 'T';

export function isRegularSeason(week: number, playoffWeekStart: number): boolean {
  return week < playoffWeekStart;
}

/** 'W3' / 'L2' for the trailing run; '-' when empty or the last game was a tie. */
export function computeStreak(results: Result[]): string {
  if (results.length === 0) return '-';
  const last = results[results.length - 1];
  if (last === 'T') return '-';
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
  return `${last}${n}`;
}

interface Acc {
  w: number; l: number; t: number;
  pf: number; pa: number; max: number; games: number;
  results: Result[];
  ap: { w: number; l: number; t: number };
  highs: number;
}

export function computeStandings(
  weeks: Week[],
  managerIds: UserId[],
  playoffWeekStart: number,
): StandingRow[] {
  const acc = new Map<UserId, Acc>(
    managerIds.map((id) => [id, { w: 0, l: 0, t: 0, pf: 0, pa: 0, max: 0, games: 0, results: [], ap: { w: 0, l: 0, t: 0 }, highs: 0 }]),
  );

  for (const wk of weeks) {
    if (!wk.played || !isRegularSeason(wk.week, playoffWeekStart)) continue;
    const scores = wk.games.flatMap((g) => g.sides.map((s) => ({ userId: s.userId, points: s.points })));

    for (const g of wk.games) {
      g.sides.forEach((side, i) => {
        const opp = g.sides[1 - i];
        const a = acc.get(side.userId);
        if (!a) return;
        a.pf += side.points;
        a.pa += opp.points;
        a.max += side.ceiling;
        a.games += 1;
        const r: Result = side.points > opp.points ? 'W' : side.points < opp.points ? 'L' : 'T';
        if (r === 'W') a.w += 1; else if (r === 'L') a.l += 1; else a.t += 1;
        a.results.push(r);
        for (const o of scores) {
          if (o.userId === side.userId) continue;
          if (side.points > o.points) a.ap.w += 1;
          else if (side.points < o.points) a.ap.l += 1;
          else a.ap.t += 1;
        }
      });
    }
    if (wk.highScore) {
      const a = acc.get(wk.highScore);
      if (a) a.highs += 1;
    }
  }

  const rows: StandingRow[] = [...acc.entries()].map(([userId, a]) => {
    const apTotal = a.ap.w + a.ap.l + a.ap.t;
    return {
      userId,
      rank: 0,
      w: a.w, l: a.l, t: a.t,
      winPct: a.games ? round4((a.w + a.t / 2) / a.games) : 0,
      pf: round2(a.pf),
      pa: round2(a.pa),
      ppg: a.games ? round2(a.pf / a.games) : 0,
      maxPoints: round2(a.max),
      efficiency: a.max ? round4(a.pf / a.max) : 0,
      streak: computeStreak(a.results),
      allPlay: { ...a.ap, pct: apTotal ? round4((a.ap.w + a.ap.t / 2) / apTotal) : 0 },
      weeklyHighs: a.highs,
    };
  });

  rows.sort((x, y) => y.w - x.w || y.pf - x.pf);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './standings';
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- standings
```
Expected: `9 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): standings with streaks, all-play, efficiency

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Bracket resolution and honors

**Files:**
- Create: `packages/core/src/sleeper/types.ts`, `packages/core/src/bracket.ts`
- Test: `packages/core/test/bracket.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `BracketGame`, `BracketKind`, `PlayoffTag`, `Honors`, `StandingRow`, `UserId`, `SeasonStatus` from `./types`
- Produces:
  - Raw Sleeper types in `sleeper/types.ts` (used by Tasks 6, 7, 10, 11, 12)
  - `tagFor(kind: BracketKind, round: number, placement: number | null): PlayoffTag`
  - `resolveBracket(raw: SleeperBracketGame[], kind: BracketKind, playoffWeekStart: number, rosterToUser: Record<number, UserId>, weekPoints: (week: number, userId: UserId) => number | null): BracketGame[]`
  - `tagForGame(brackets: BracketGame[], week: number, a: UserId, b: UserId): PlayoffTag | null`
  - `computeHonors(winners: BracketGame[], consolation: BracketGame[], standings: StandingRow[], status: SeasonStatus): Honors`

- [ ] **Step 1: Raw Sleeper types**

`packages/core/src/sleeper/types.ts`:
```ts
/** Shapes returned by https://api.sleeper.app/v1. Only the fields we read. */

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string; // 'pre_draft' | 'drafting' | 'in_season' | 'complete'
  previous_league_id: string | null;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: {
    playoff_week_start: number;
    playoff_teams: number;
    last_scored_leg?: number;
    leg?: number;
    [key: string]: unknown;
  };
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string | null; [key: string]: unknown } | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  custom_points: number | null;
  players: string[] | null;
  starters: string[] | null;
  players_points: Record<string, number> | null;
}

export interface SleeperBracketGame {
  r: number;
  m: number;
  t1?: number | null;
  t2?: number | null;
  w?: number | null;
  l?: number | null;
  p?: number;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

export interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string | null;
  team?: string | null;
  years_exp?: number | null;
}

/** player_id -> stat line. Used for both /stats and /projections. */
export type StatMap = Record<string, Record<string, number>>;
```

- [ ] **Step 2: Failing test**

`packages/core/test/bracket.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { tagFor, resolveBracket, tagForGame, computeHonors } from '../src/bracket';
import type { SleeperBracketGame } from '../src/sleeper/types';
import type { StandingRow } from '../src/types';

const rosterToUser = { 1: 'u1', 2: 'u2', 3: 'u3', 4: 'u4' };

describe('tagFor', () => {
  it('tags winners bracket games', () => {
    expect(tagFor('winners', 1, null)).toBe('QF');
    expect(tagFor('winners', 2, null)).toBe('SF');
    expect(tagFor('winners', 2, 5)).toBe('5th');
    expect(tagFor('winners', 3, 1)).toBe('Final');
    expect(tagFor('winners', 3, 3)).toBe('3rd');
  });
  it('tags consolation games', () => {
    expect(tagFor('consolation', 1, null)).toBe('Cons-R1');
    expect(tagFor('consolation', 2, 1)).toBe('Toilet Bowl');
    expect(tagFor('consolation', 2, 3)).toBe('Cons-7th');
  });
});

describe('resolveBracket', () => {
  const points: Record<string, number> = { 'u1@15': 100, 'u2@15': 90, 'u3@15': 100, 'u4@15': 90 };
  const weekPoints = (week: number, userId: string) => points[`${userId}@${week}`] ?? null;

  it('advances the higher scorer in the winners bracket', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 1, t2: 2, w: 2, l: 1 }];
    const [g] = resolveBracket(raw, 'winners', 15, rosterToUser, weekPoints);
    expect(g).toMatchObject({ week: 15, tag: 'QF', home: 'u1', away: 'u2', homePoints: 100, awayPoints: 90, advanced: 'u1', gameId: null });
  });

  it('advances the lower scorer in the consolation bracket', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 3, t2: 4, w: 3, l: 4 }];
    const [g] = resolveBracket(raw, 'consolation', 15, rosterToUser, weekPoints);
    expect(g.advanced).toBe('u4');
  });

  it('falls back to the Sleeper w field on a tie', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 1, t2: 3, w: 3, l: 1 }];
    const [g] = resolveBracket(raw, 'winners', 15, rosterToUser, weekPoints);
    expect(g.advanced).toBe('u3');
  });

  it('leaves teams and outcome null when not yet decided', () => {
    const raw: SleeperBracketGame[] = [{ r: 2, m: 3, t1_from: { w: 1 }, t2_from: { w: 2 }, p: 1 }];
    const [g] = resolveBracket(raw, 'winners', 15, rosterToUser, weekPoints);
    expect(g).toMatchObject({ week: 16, tag: 'Final', home: null, away: null, homePoints: null, awayPoints: null, advanced: null });
  });
});

describe('tagForGame', () => {
  it('finds the tag for a pair in a week regardless of order', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 1, t2: 2 }];
    const b = resolveBracket(raw, 'winners', 15, rosterToUser, () => null);
    expect(tagForGame(b, 15, 'u2', 'u1')).toBe('QF');
    expect(tagForGame(b, 16, 'u2', 'u1')).toBeNull();
    expect(tagForGame(b, 15, 'u3', 'u1')).toBeNull();
  });
});

describe('computeHonors', () => {
  const standings = [
    { userId: 'u2', pf: 1500 }, { userId: 'u1', pf: 1600 }, { userId: 'u3', pf: 1000 }, { userId: 'u4', pf: 900 },
  ] as StandingRow[];
  const pts: Record<string, number> = { 'u1@16': 120, 'u2@16': 110, 'u3@16': 80, 'u4@16': 60, 'u1@15': 1, 'u3@15': 1 };
  const wp = (w: number, u: string) => pts[`${u}@${w}`] ?? null;
  const winners = resolveBracket(
    [{ r: 2, m: 1, t1: 1, t2: 2, p: 1 }, { r: 2, m: 2, t1: 3, t2: 4, p: 3 }], 'winners', 15, rosterToUser, wp);
  const consolation = resolveBracket(
    [{ r: 2, m: 1, t1: 3, t2: 4, p: 1 }], 'consolation', 15, rosterToUser, wp);

  it('reads champion, runner-up, third, last place and points title', () => {
    expect(computeHonors(winners, consolation, standings, 'complete')).toEqual({
      champion: 'u1', runnerUp: 'u2', third: 'u3', lastPlace: 'u4', pointsTitle: 'u1',
    });
  });

  it('is all null while the season is in progress', () => {
    expect(computeHonors(winners, consolation, standings, 'in_season')).toEqual({
      champion: null, runnerUp: null, third: null, lastPlace: null, pointsTitle: null,
    });
  });
});
```

- [ ] **Step 3: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- bracket
```
Expected: FAIL, cannot find module `../src/bracket`.

- [ ] **Step 4: Implement**

`packages/core/src/bracket.ts`:
```ts
import type { BracketGame, BracketKind, Honors, PlayoffTag, SeasonStatus, StandingRow, UserId } from './types';
import type { SleeperBracketGame } from './sleeper/types';

export function tagFor(kind: BracketKind, round: number, placement: number | null): PlayoffTag {
  if (kind === 'winners') {
    if (placement === 1) return 'Final';
    if (placement === 3) return '3rd';
    if (placement === 5) return '5th';
    return round === 1 ? 'QF' : 'SF';
  }
  if (placement === 1) return 'Toilet Bowl';
  if (placement === 3) return 'Cons-7th';
  return 'Cons-R1';
}

/**
 * Turn Sleeper's bracket into resolved games. Who played whom comes from the
 * bracket; who advanced comes from the scores. Winners bracket: higher scorer
 * advances. Consolation (toilet bowl): lower scorer advances. Ties fall back to
 * Sleeper's `w` field.
 */
export function resolveBracket(
  raw: SleeperBracketGame[],
  kind: BracketKind,
  playoffWeekStart: number,
  rosterToUser: Record<number, UserId>,
  weekPoints: (week: number, userId: UserId) => number | null,
): BracketGame[] {
  return raw.map((g) => {
    const week = playoffWeekStart + g.r - 1;
    const home = g.t1 != null ? rosterToUser[g.t1] ?? null : null;
    const away = g.t2 != null ? rosterToUser[g.t2] ?? null : null;
    const homePoints = home ? weekPoints(week, home) : null;
    const awayPoints = away ? weekPoints(week, away) : null;

    let advanced: UserId | null = null;
    if (home && away && homePoints !== null && awayPoints !== null) {
      if (homePoints === awayPoints) {
        advanced = g.w != null ? rosterToUser[g.w] ?? null : null;
      } else {
        const higher = homePoints > awayPoints ? home : away;
        const lower = higher === home ? away : home;
        advanced = kind === 'winners' ? higher : lower;
      }
    }

    return {
      bracket: kind,
      round: g.r,
      matchNo: g.m,
      placement: g.p ?? null,
      week,
      tag: tagFor(kind, g.r, g.p ?? null),
      home, away, homePoints, awayPoints, advanced,
      gameId: null,
    };
  });
}

export function tagForGame(brackets: BracketGame[], week: number, a: UserId, b: UserId): PlayoffTag | null {
  const g = brackets.find(
    (x) => x.week === week && ((x.home === a && x.away === b) || (x.home === b && x.away === a)),
  );
  return g?.tag ?? null;
}

function otherSide(g: BracketGame | undefined): UserId | null {
  if (!g || !g.advanced) return null;
  return g.advanced === g.home ? g.away : g.home;
}

export function computeHonors(
  winners: BracketGame[],
  consolation: BracketGame[],
  standings: StandingRow[],
  status: SeasonStatus,
): Honors {
  if (status !== 'complete') {
    return { champion: null, runnerUp: null, third: null, pointsTitle: null, lastPlace: null };
  }
  const final = winners.find((g) => g.tag === 'Final');
  const third = winners.find((g) => g.tag === '3rd');
  const toilet = consolation.find((g) => g.tag === 'Toilet Bowl');
  const pointsTitle = [...standings].sort((x, y) => y.pf - x.pf)[0]?.userId ?? null;
  return {
    champion: final?.advanced ?? null,
    runnerUp: otherSide(final),
    third: third?.advanced ?? null,
    pointsTitle,
    lastPlace: toilet?.advanced ?? null,
  };
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './bracket';
export * from './sleeper/types';
```

- [ ] **Step 5: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- bracket
```
Expected: `9 passed`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(core): bracket resolution, playoff tags, honors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Player directory helpers

**Files:**
- Create: `packages/core/src/players.ts`
- Test: `packages/core/test/players.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `SleeperPlayer` from `./sleeper/types`; `PlayerDirectory`, `PlayerId`, `Season` from `./types`
- Produces:
  - `toPlayerDirectory(raw: Record<string, SleeperPlayer>): PlayerDirectory`
  - `trimPlayers(dir: PlayerDirectory, keep: Set<PlayerId>): PlayerDirectory`
  - `collectPlayerIds(seasons: Season[]): Set<PlayerId>`

- [ ] **Step 1: Failing test**

`packages/core/test/players.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toPlayerDirectory, trimPlayers, collectPlayerIds } from '../src/players';
import type { Season } from '../src/types';

describe('toPlayerDirectory', () => {
  it('normalizes players and team defenses', () => {
    const dir = toPlayerDirectory({
      '4034': { player_id: '4034', full_name: 'Christian McCaffrey', first_name: 'Christian', last_name: 'McCaffrey', position: 'RB', team: 'SF', years_exp: 7 },
      'SF': { player_id: 'SF', first_name: 'San Francisco', last_name: '49ers', position: 'DEF', team: 'SF' },
      '999': { player_id: '999', first_name: 'No', last_name: 'Position' },
    });
    expect(dir['4034']).toEqual({ id: '4034', name: 'Christian McCaffrey', firstName: 'Christian', lastName: 'McCaffrey', position: 'RB', team: 'SF', yearsExp: 7 });
    expect(dir['SF']).toEqual({ id: 'SF', name: 'San Francisco 49ers', firstName: 'San Francisco', lastName: '49ers', position: 'DEF', team: 'SF', yearsExp: null });
    expect(dir['999'].position).toBeNull();
    expect(dir['999'].name).toBe('No Position');
  });
});

describe('trimPlayers', () => {
  it('keeps only requested ids', () => {
    const dir = toPlayerDirectory({ a: { player_id: 'a', full_name: 'A' }, b: { player_id: 'b', full_name: 'B' } });
    expect(Object.keys(trimPlayers(dir, new Set(['b', 'zzz'])))).toEqual(['b']);
  });
});

describe('collectPlayerIds', () => {
  it('gathers starters, bench and swap ids across seasons', () => {
    const season = {
      weeks: [{
        games: [{
          sides: [
            { starters: [{ slot: 'QB', player: { playerId: 'q1' } }, { slot: 'RB', player: null }], bench: [{ playerId: 'b1' }], optimalSwaps: [{ in: 'b1', out: 'q1' }] },
            { starters: [], bench: [{ playerId: 'b2' }], optimalSwaps: [] },
          ],
        }],
      }],
    } as unknown as Season;
    expect([...collectPlayerIds([season])].sort()).toEqual(['b1', 'b2', 'q1']);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- players
```
Expected: FAIL, cannot find module `../src/players`.

- [ ] **Step 3: Implement**

`packages/core/src/players.ts`:
```ts
import type { PlayerDirectory, PlayerId, PlayerInfo, Season } from './types';
import type { SleeperPlayer } from './sleeper/types';

export function toPlayerDirectory(raw: Record<string, SleeperPlayer>): PlayerDirectory {
  const dir: PlayerDirectory = {};
  for (const [id, p] of Object.entries(raw)) {
    const firstName = p.first_name ?? '';
    const lastName = p.last_name ?? '';
    const name = p.full_name ?? `${firstName} ${lastName}`.trim();
    const info: PlayerInfo = {
      id,
      name: name || id,
      firstName,
      lastName,
      position: p.position ?? null,
      team: p.team ?? null,
      yearsExp: typeof p.years_exp === 'number' ? p.years_exp : null,
    };
    dir[id] = info;
  }
  return dir;
}

export function trimPlayers(dir: PlayerDirectory, keep: Set<PlayerId>): PlayerDirectory {
  const out: PlayerDirectory = {};
  for (const id of keep) if (dir[id]) out[id] = dir[id];
  return out;
}

export function collectPlayerIds(seasons: Season[]): Set<PlayerId> {
  const ids = new Set<PlayerId>();
  for (const s of seasons) {
    for (const wk of s.weeks) {
      for (const g of wk.games) {
        for (const side of g.sides) {
          for (const e of side.starters) if (e.player) ids.add(e.player.playerId);
          for (const b of side.bench) ids.add(b.playerId);
          for (const sw of side.optimalSwaps) { ids.add(sw.in); if (sw.out) ids.add(sw.out); }
        }
      }
    }
  }
  return ids;
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './players';
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- players
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): player directory normalization and trimming

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Season builder

**Files:**
- Create: `packages/core/src/season.ts`, `packages/core/test/fixtures/mini.ts`
- Test: `packages/core/test/season.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 2 to 6
- Produces:
  - `interface RawSeasonInput { league: SleeperLeague; users: SleeperUser[]; rosters: SleeperRoster[]; matchups: Record<number, SleeperMatchup[]>; winnersBracket: SleeperBracketGame[]; losersBracket: SleeperBracketGame[]; projections: Record<number, StatMap>; stats: Record<number, StatMap>; players: PlayerDirectory }`
  - `buildSeason(input: RawSeasonInput, nameOverrides?: Record<UserId, string>): Season`
  - `STAT_KEYS` (readonly array of stat keys kept for box scores)
  - Test fixture `miniInput(): RawSeasonInput` (4 teams, 3 weeks, used again in Tasks 8 and 9)

- [ ] **Step 1: Hand-built fixture**

`packages/core/test/fixtures/mini.ts`:
```ts
import type { RawSeasonInput } from '../../src/season';
import type { SleeperMatchup, SleeperRoster, SleeperUser } from '../../src/sleeper/types';
import type { PlayerDirectory, PlayerInfo } from '../../src/types';

/**
 * Four teams (ua, ub, uc, ud), roster slots QB / RB / FLEX, three regular-season
 * weeks, playoffs would start week 4 (no brackets). Each team n owns players
 * q{n} (QB), r{n} (RB), w{n} (WR) as starters and b{n} (RB) on the bench.
 *
 * Default points split per week: QB = total - 20, RB = 10, WR = 10, bench 0,
 * so the ceiling equals the actual score. The one exception is team A in week 2,
 * which started an 8-point WR over a 30-point bench RB: actual 60, ceiling 82.
 *
 * Expected standings (hand computed):
 *   C 3-0   PF 320  PA 200  all-play 7-2-0  streak W3  highs 2
 *   A 2-1   PF 280  PA 250  all-play 5-4-0  streak W1  highs 1  max 302
 *   B 0-2-1 PF 255  PA 325  all-play 4-4-1  streak L1
 *   D 0-2-1 PF 215  PA 295  all-play 1-7-1  streak L1
 */
const ROSTER: Record<string, number> = { ua: 1, ub: 2, uc: 3, ud: 4 };
const TOTALS: Record<number, Record<string, number>> = {
  1: { ua: 100, ub: 90, uc: 80, ud: 70 },
  2: { ua: 60, uc: 110, ub: 95, ud: 95 },
  3: { ua: 120, ud: 50, ub: 70, uc: 130 },
};
const PAIRINGS: Record<number, [string, string][]> = {
  1: [['ua', 'ub'], ['uc', 'ud']],
  2: [['ua', 'uc'], ['ub', 'ud']],
  3: [['ua', 'ud'], ['ub', 'uc']],
};

function team(n: number) {
  return { q: `q${n}`, r: `r${n}`, w: `w${n}`, b: `b${n}` };
}

function matchup(userId: string, week: number, matchupId: number): SleeperMatchup {
  const n = ROSTER[userId];
  const t = team(n);
  const total = TOTALS[week][userId];
  let pp: Record<string, number> = { [t.q]: total - 20, [t.r]: 10, [t.w]: 10, [t.b]: 0 };
  if (userId === 'ua' && week === 2) pp = { [t.q]: 42, [t.r]: 10, [t.w]: 8, [t.b]: 30 };
  return {
    roster_id: n,
    matchup_id: matchupId,
    points: total,
    custom_points: null,
    players: [t.q, t.r, t.w, t.b],
    starters: [t.q, t.r, t.w],
    players_points: pp,
  };
}

function info(id: string, position: string): PlayerInfo {
  return { id, name: id.toUpperCase(), firstName: id, lastName: '', position, team: null, yearsExp: null };
}

function user(user_id: string, display_name: string, team_name: string | null): SleeperUser {
  return { user_id, display_name, avatar: null, metadata: team_name ? { team_name } : null };
}

export function miniInput(): RawSeasonInput {
  const matchups: Record<number, SleeperMatchup[]> = {};
  for (const [wk, pairs] of Object.entries(PAIRINGS)) {
    const week = Number(wk);
    matchups[week] = pairs.flatMap(([a, b], i) => [matchup(a, week, i + 1), matchup(b, week, i + 1)]);
  }
  const players: PlayerDirectory = {};
  const rosters: SleeperRoster[] = [];
  for (const [userId, n] of Object.entries(ROSTER)) {
    const t = team(n);
    players[t.q] = info(t.q, 'QB');
    players[t.r] = info(t.r, 'RB');
    players[t.w] = info(t.w, 'WR');
    players[t.b] = info(t.b, 'RB');
    rosters.push({ roster_id: n, owner_id: userId, players: [t.q, t.r, t.w, t.b], starters: [t.q, t.r, t.w] });
  }
  return {
    league: {
      league_id: 'L2024',
      name: 'Mini',
      season: '2024',
      status: 'complete',
      previous_league_id: null,
      total_rosters: 4,
      roster_positions: ['QB', 'RB', 'FLEX', 'BN'],
      scoring_settings: { pass_yd: 0.04, rush_yd: 0.1 },
      settings: { playoff_week_start: 4, playoff_teams: 2, last_scored_leg: 3 },
    },
    users: [user('ua', 'Alice', 'Team Alice'), user('ub', 'Bob', null), user('uc', 'Cara', 'Cara Crew'), user('ud', 'Dan', 'Dan Dynasty')],
    rosters,
    matchups,
    winnersBracket: [],
    losersBracket: [],
    projections: { 1: { q1: { pass_yd: 250 } } },
    stats: { 1: { q1: { pass_yd: 250, pass_td: 1, pos_rank_ppr: 5 } } },
    players,
  };
}
```

- [ ] **Step 2: Failing test**

`packages/core/test/season.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSeason } from '../src/season';
import { miniInput } from './fixtures/mini';

describe('buildSeason (mini league)', () => {
  const season = buildSeason(miniInput());
  const wk = (n: number) => season.weeks[n - 1];
  const sideOf = (week: number, userId: string) =>
    wk(week).games.flatMap((g) => g.sides).find((s) => s.userId === userId)!;

  it('sets season metadata', () => {
    expect(season).toMatchObject({
      year: 2024, leagueId: 'L2024', status: 'complete', lastScoredWeek: 3,
      playoffWeekStart: 4, playoffTeams: 2, rosterSlots: ['QB', 'RB', 'FLEX'],
    });
    expect(season.weeks).toHaveLength(3);
    expect(season.weeks.every((w) => w.played && !w.isPlayoff)).toBe(true);
    expect(season.brackets).toEqual({ winners: [], consolation: [] });
  });

  it('builds managers from users and rosters, with overrides', () => {
    expect(season.managers.ua).toEqual({ userId: 'ua', displayName: 'Alice', teamName: 'Team Alice', avatar: null, rosterId: 1 });
    expect(season.managers.ub.teamName).toBeNull();
    expect(buildSeason(miniInput(), { ub: 'Bobby' }).managers.ub.displayName).toBe('Bobby');
  });

  it('pairs matchups into games with ids, winners and margins', () => {
    const g = wk(1).games[0];
    expect(g).toMatchObject({ id: '2024-1-1', matchupId: 1, week: 1, tag: null, winner: 'ua', margin: 10 });
    expect(g.sides.map((s) => s.userId)).toEqual(['ua', 'ub']);
    const tie = wk(2).games[1];
    expect(tie).toMatchObject({ winner: null, margin: 0 });
  });

  it('builds starters in slot order with points, projections and trimmed stats', () => {
    const a = sideOf(1, 'ua');
    expect(a.starters).toEqual([
      { slot: 'QB', player: { playerId: 'q1', points: 80, projected: 10, stats: { pass_yd: 250, pass_td: 1 } } },
      { slot: 'RB', player: { playerId: 'r1', points: 10, projected: null, stats: {} } },
      { slot: 'FLEX', player: { playerId: 'w1', points: 10, projected: null, stats: {} } },
    ]);
    expect(a.bench).toEqual([{ playerId: 'b1', points: 0, projected: null, stats: {} }]);
    expect(a.projected).toBe(10);
  });

  it('computes ceiling, efficiency and swaps', () => {
    const a = sideOf(2, 'ua');
    expect(a).toMatchObject({ points: 60, ceiling: 82, efficiency: 0.7317 });
    expect(a.optimalSwaps).toEqual([{ out: 'w1', in: 'b1', gain: 22 }]);
    expect(sideOf(1, 'uc').optimalSwaps).toEqual([]);
    expect(sideOf(1, 'uc').efficiency).toBe(1);
  });

  it('annotates record entering the week and season PPG', () => {
    expect(sideOf(1, 'ua').recordBefore).toEqual({ w: 0, l: 0, t: 0 });
    expect(sideOf(3, 'ua').recordBefore).toEqual({ w: 1, l: 1, t: 0 });
    expect(sideOf(3, 'ub').recordBefore).toEqual({ w: 0, l: 1, t: 1 });
    expect(sideOf(1, 'ua').seasonPpg).toBe(93.33);
    expect(sideOf(3, 'ua').seasonPpg).toBe(93.33);
  });

  it('marks weekly high scores', () => {
    expect(season.weeks.map((w) => w.highScore)).toEqual(['ua', 'uc', 'uc']);
  });

  it('computes standings and honors', () => {
    expect(season.standings.map((r) => r.userId)).toEqual(['uc', 'ua', 'ub', 'ud']);
    expect(season.standings[1]).toMatchObject({ maxPoints: 302, efficiency: 0.9272, weeklyHighs: 1 });
    expect(season.honors).toEqual({ champion: null, runnerUp: null, third: null, lastPlace: null, pointsTitle: 'uc' });
  });

  it('treats a non-complete league as in season, limited to last_scored_leg', () => {
    const input = miniInput();
    input.league.status = 'in_season';
    input.league.settings.last_scored_leg = 2;
    const s = buildSeason(input);
    expect(s.status).toBe('in_season');
    expect(s.lastScoredWeek).toBe(2);
    expect(s.weeks[2].played).toBe(false);
    expect(s.weeks[2].games[0].winner).toBeNull();
    expect(s.weeks[2].games[0].sides[0].optimalSwaps).toEqual([]);
    expect(s.standings.find((r) => r.userId === 'uc')!.w).toBe(2);
  });
});
```

- [ ] **Step 3: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- season
```
Expected: FAIL, cannot find module `../src/season`.

- [ ] **Step 4: Implement**

`packages/core/src/season.ts`:
```ts
import type {
  Game, GameSide, Manager, PlayerDirectory, PlayerLine, Season, SeasonStatus,
  SlotEntry, UserId, Week, WLT,
} from './types';
import type {
  SleeperBracketGame, SleeperLeague, SleeperMatchup, SleeperRoster, SleeperUser, StatMap,
} from './sleeper/types';
import { round2, round4, scoreStats } from './scoring';
import { optimalLineup, optimalSwaps, type LineupPlayer } from './lineup';
import { computeHonors, resolveBracket, tagForGame } from './bracket';
import { computeStandings, isRegularSeason } from './standings';

export interface RawSeasonInput {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  /** week -> matchups */
  matchups: Record<number, SleeperMatchup[]>;
  winnersBracket: SleeperBracketGame[];
  losersBracket: SleeperBracketGame[];
  /** week -> player_id -> projected stat line */
  projections: Record<number, StatMap>;
  /** week -> player_id -> actual stat line */
  stats: Record<number, StatMap>;
  players: PlayerDirectory;
}

/** Raw stat keys kept for box-score stat lines. Everything else is dropped. */
export const STAT_KEYS = [
  'pass_cmp', 'pass_att', 'pass_yd', 'pass_td', 'pass_int', 'pass_2pt',
  'rush_att', 'rush_yd', 'rush_td', 'rush_2pt',
  'rec', 'rec_tgt', 'rec_yd', 'rec_td', 'rec_2pt',
  'fum_lost',
  'fgm', 'fga', 'xpm', 'xpa',
  'pts_allow', 'yds_allow', 'sack', 'int', 'ff', 'fum_rec', 'def_td', 'safe', 'blk_kick',
] as const;

const NON_STARTING_SLOTS = new Set(['BN', 'IR', 'TAXI']);

export function buildManagers(
  users: SleeperUser[],
  rosters: SleeperRoster[],
  nameOverrides: Record<UserId, string>,
): Record<UserId, Manager> {
  const byId = new Map(users.map((u) => [u.user_id, u]));
  const managers: Record<UserId, Manager> = {};
  for (const r of rosters) {
    const user = r.owner_id ? byId.get(r.owner_id) : undefined;
    const userId = r.owner_id ?? `roster-${r.roster_id}`;
    managers[userId] = {
      userId,
      displayName: nameOverrides[userId] ?? user?.display_name ?? `Team ${r.roster_id}`,
      teamName: user?.metadata?.team_name ?? null,
      avatar: user?.avatar ?? null,
      rosterId: r.roster_id,
    };
  }
  return managers;
}

function pickStats(line: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!line) return out;
  for (const k of STAT_KEYS) {
    const v = line[k];
    if (typeof v === 'number' && v !== 0) out[k] = v;
  }
  return out;
}

export function buildSeason(input: RawSeasonInput, nameOverrides: Record<UserId, string> = {}): Season {
  const { league, players } = input;
  const year = Number(league.season);
  const status: SeasonStatus = league.status === 'complete' ? 'complete' : 'in_season';
  const playoffWeekStart = league.settings.playoff_week_start;
  const rosterSlots = league.roster_positions.filter((p) => !NON_STARTING_SLOTS.has(p));
  const scoring = league.scoring_settings;

  const managers = buildManagers(input.users, input.rosters, nameOverrides);
  const rosterToUser: Record<number, UserId> = {};
  for (const m of Object.values(managers)) rosterToUser[m.rosterId] = m.userId;

  const rounds = input.winnersBracket.reduce((max, g) => Math.max(max, g.r), 0);
  const maxWeek = rounds > 0 ? playoffWeekStart + rounds - 1 : playoffWeekStart - 1;
  const lastScoredWeek = status === 'complete'
    ? maxWeek
    : Math.min(league.settings.last_scored_leg ?? 0, maxWeek);

  const matchupFor = (week: number, userId: UserId): SleeperMatchup | undefined => {
    const rosterId = managers[userId]?.rosterId;
    return (input.matchups[week] ?? []).find((m) => m.roster_id === rosterId);
  };
  const weekPoints = (week: number, userId: UserId): number | null => {
    if (week > lastScoredWeek) return null;
    const m = matchupFor(week, userId);
    return m ? m.custom_points ?? m.points ?? 0 : null;
  };

  const winners = resolveBracket(input.winnersBracket, 'winners', playoffWeekStart, rosterToUser, weekPoints);
  const consolation = resolveBracket(input.losersBracket, 'consolation', playoffWeekStart, rosterToUser, weekPoints);
  const allBracketGames = [...winners, ...consolation];

  const weeks: Week[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const played = week <= lastScoredWeek;
    const isPlayoff = !isRegularSeason(week, playoffWeekStart);
    const games = buildGames(week, input.matchups[week] ?? [], {
      year, played, rosterSlots, scoring, players, rosterToUser,
      projections: input.projections[week] ?? {},
      stats: input.stats[week] ?? {},
      tag: (a, b) => tagForGame(allBracketGames, week, a, b),
    });
    let highScore: UserId | null = null;
    if (played && !isPlayoff) {
      const top = games.flatMap((g) => g.sides)
        .reduce<GameSide | null>((best, s) => (!best || s.points > best.points ? s : best), null);
      highScore = top?.userId ?? null;
    }
    weeks.push({ week, isPlayoff, played, games, highScore });
  }

  annotateRecords(weeks, playoffWeekStart);

  for (const bg of allBracketGames) {
    const wk = weeks[bg.week - 1];
    const g = wk?.games.find((x) =>
      bg.home && bg.away &&
      x.sides.some((s) => s.userId === bg.home) &&
      x.sides.some((s) => s.userId === bg.away));
    bg.gameId = g?.id ?? null;
  }

  const standings = computeStandings(weeks, Object.keys(managers), playoffWeekStart);
  const honors = computeHonors(winners, consolation, standings, status);

  return {
    year,
    leagueId: league.league_id,
    status,
    lastScoredWeek,
    playoffWeekStart,
    playoffTeams: league.settings.playoff_teams,
    rosterSlots,
    scoring,
    managers,
    weeks,
    brackets: { winners, consolation },
    standings,
    honors,
  };
}

interface GameContext {
  year: number;
  played: boolean;
  rosterSlots: string[];
  scoring: Record<string, number>;
  players: PlayerDirectory;
  rosterToUser: Record<number, UserId>;
  projections: StatMap;
  stats: StatMap;
  tag: (a: UserId, b: UserId) => Game['tag'];
}

function buildGames(week: number, matchups: SleeperMatchup[], ctx: GameContext): Game[] {
  const byMatchup = new Map<number, SleeperMatchup[]>();
  for (const m of matchups) {
    if (m.matchup_id == null) continue;
    const list = byMatchup.get(m.matchup_id) ?? [];
    list.push(m);
    byMatchup.set(m.matchup_id, list);
  }
  const games: Game[] = [];
  for (const [matchupId, pair] of [...byMatchup.entries()].sort((x, y) => x[0] - y[0])) {
    if (pair.length !== 2) continue;
    const sides = pair.map((m) => buildSide(m, ctx)) as [GameSide, GameSide];
    const [a, b] = sides;
    const decided = ctx.played && a.points !== b.points;
    games.push({
      id: `${ctx.year}-${week}-${matchupId}`,
      matchupId,
      week,
      tag: ctx.tag(a.userId, b.userId),
      sides,
      winner: decided ? (a.points > b.points ? a.userId : b.userId) : null,
      margin: ctx.played ? round2(Math.abs(a.points - b.points)) : 0,
    });
  }
  return games;
}

function buildSide(m: SleeperMatchup, ctx: GameContext): GameSide {
  const userId = ctx.rosterToUser[m.roster_id] ?? `roster-${m.roster_id}`;
  const pp = m.players_points ?? {};

  const line = (id: string): PlayerLine => {
    const proj = ctx.projections[id];
    return {
      playerId: id,
      points: round2(pp[id] ?? 0),
      projected: proj ? scoreStats(proj, ctx.scoring) : null,
      stats: pickStats(ctx.stats[id]),
    };
  };

  const starterIds = (m.starters ?? []).map((id) => (id && id !== '0' ? id : null));
  const starters: SlotEntry[] = ctx.rosterSlots.map((slot, i) => {
    const id = starterIds[i] ?? null;
    return { slot, player: id ? line(id) : null };
  });
  const starterSet = new Set(starterIds.filter((id): id is string => id !== null));
  const allIds = m.players ?? [];
  const bench = allIds.filter((id) => !starterSet.has(id)).map(line).sort((x, y) => y.points - x.points);

  const lineupPlayers: LineupPlayer[] = allIds.map((id) => ({
    playerId: id,
    position: ctx.players[id]?.position ?? null,
    points: pp[id] ?? 0,
  }));
  const infoById = new Map(lineupPlayers.map((p) => [p.playerId, p]));
  const optimal = optimalLineup(ctx.rosterSlots, lineupPlayers);

  const points = round2(m.custom_points ?? m.points ?? 0);
  const projected = round2(starters.reduce((s, e) => s + (e.player?.projected ?? 0), 0));
  const swaps = ctx.played
    ? optimalSwaps(starterIds, optimal, (id) => infoById.get(id) ?? { playerId: id, position: null, points: 0 })
    : [];

  return {
    userId,
    points,
    projected,
    ceiling: optimal.total,
    efficiency: optimal.total > 0 ? round4(points / optimal.total) : 0,
    starters,
    bench,
    optimalSwaps: swaps,
    recordBefore: { w: 0, l: 0, t: 0 },
    seasonPpg: 0,
  };
}

/** Fill recordBefore (regular-season record entering the week) and seasonPpg. */
function annotateRecords(weeks: Week[], playoffWeekStart: number): void {
  const rec = new Map<UserId, WLT & { pf: number; games: number }>();
  const get = (u: UserId) => {
    let r = rec.get(u);
    if (!r) { r = { w: 0, l: 0, t: 0, pf: 0, games: 0 }; rec.set(u, r); }
    return r;
  };
  for (const wk of weeks) {
    for (const g of wk.games) {
      for (const s of g.sides) {
        const r = get(s.userId);
        s.recordBefore = { w: r.w, l: r.l, t: r.t };
      }
    }
    if (!wk.played || !isRegularSeason(wk.week, playoffWeekStart)) continue;
    for (const g of wk.games) {
      g.sides.forEach((s, i) => {
        const o = g.sides[1 - i];
        const r = get(s.userId);
        r.pf += s.points;
        r.games += 1;
        if (s.points > o.points) r.w += 1;
        else if (s.points < o.points) r.l += 1;
        else r.t += 1;
      });
    }
  }
  for (const wk of weeks) {
    for (const g of wk.games) {
      for (const s of g.sides) {
        const r = get(s.userId);
        s.seasonPpg = r.games ? round2(r.pf / r.games) : 0;
      }
    }
  }
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './season';
```

- [ ] **Step 5: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- season
```
Expected: `9 passed`. If the swap test fails with `out: 'r1'`, check that `optimalSwaps` falls back to the lowest-scoring removed starter only when no same-position starter was removed; here `w1` (WR) is the only removed starter.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(core): buildSeason normalizes Sleeper data and derives game stats

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: History builder

**Files:**
- Create: `packages/core/src/history.ts`
- Test: `packages/core/test/history.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Season`, `History`, `H2HSeries`, `h2hKey` from `./types`
- Produces: `buildHistory(seasons: Season[]): History`

- [ ] **Step 1: Failing test**

`packages/core/test/history.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSeason } from '../src/season';
import { buildHistory } from '../src/history';
import { miniInput } from './fixtures/mini';

describe('buildHistory', () => {
  const s2024 = buildSeason(miniInput());
  const later = miniInput();
  later.league.season = '2025';
  later.league.league_id = 'L2025';
  later.users[0].display_name = 'Alice II';
  const s2025 = buildSeason(later);
  const history = buildHistory([s2025, s2024]);

  it('lists seasons oldest first', () => {
    expect(history.seasons).toEqual([
      { year: 2024, leagueId: 'L2024', status: 'complete', lastScoredWeek: 3, playoffWeekStart: 4 },
      { year: 2025, leagueId: 'L2025', status: 'complete', lastScoredWeek: 3, playoffWeekStart: 4 },
    ]);
  });

  it('collects managers with the latest display name and their seasons', () => {
    expect(history.managers.ua).toEqual({ displayName: 'Alice II', avatar: null, seasons: [2024, 2025] });
    expect(Object.keys(history.managers)).toHaveLength(4);
  });

  it('accumulates head-to-head series with games newest first', () => {
    const ab = history.h2h['ua|ub'];
    expect(ab).toMatchObject({ a: 'ua', b: 'ub', aWins: 2, bWins: 0, ties: 0 });
    expect(ab.games).toEqual([
      { gameId: '2025-1-1', year: 2025, week: 1, tag: null, aPoints: 100, bPoints: 90 },
      { gameId: '2024-1-1', year: 2024, week: 1, tag: null, aPoints: 100, bPoints: 90 },
    ]);
    expect(history.h2h['ub|ud']).toMatchObject({ aWins: 0, bWins: 0, ties: 2 });
  });

  it('ignores unplayed games', () => {
    const input = miniInput();
    input.league.status = 'in_season';
    input.league.settings.last_scored_leg = 1;
    const h = buildHistory([buildSeason(input)]);
    expect(h.h2h['ua|ub'].games).toHaveLength(1);
    expect(h.h2h['ua|uc']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- history
```
Expected: FAIL, cannot find module `../src/history`.

- [ ] **Step 3: Implement**

`packages/core/src/history.ts`:
```ts
import { h2hKey, type H2HSeries, type History, type Season } from './types';

export function buildHistory(seasons: Season[]): History {
  const sorted = [...seasons].sort((a, b) => a.year - b.year);

  const managers: History['managers'] = {};
  for (const s of sorted) {
    for (const m of Object.values(s.managers)) {
      const entry = managers[m.userId] ?? { displayName: m.displayName, avatar: m.avatar, seasons: [] };
      entry.displayName = m.displayName;
      entry.avatar = m.avatar;
      entry.seasons.push(s.year);
      managers[m.userId] = entry;
    }
  }

  const h2h: Record<string, H2HSeries> = {};
  for (const s of sorted) {
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        const [x, y] = g.sides;
        const key = h2hKey(x.userId, y.userId);
        const [a, b] = key.split('|');
        const series = h2h[key] ?? { a, b, aWins: 0, bWins: 0, ties: 0, games: [] };
        const aSide = x.userId === a ? x : y;
        const bSide = aSide === x ? y : x;
        if (aSide.points > bSide.points) series.aWins += 1;
        else if (aSide.points < bSide.points) series.bWins += 1;
        else series.ties += 1;
        series.games.push({ gameId: g.id, year: s.year, week: g.week, tag: g.tag, aPoints: aSide.points, bPoints: bSide.points });
        h2h[key] = series;
      }
    }
  }
  for (const series of Object.values(h2h)) {
    series.games.sort((p, q) => q.year - p.year || q.week - p.week);
  }

  return {
    seasons: sorted.map((s) => ({
      year: s.year, leagueId: s.leagueId, status: s.status,
      lastScoredWeek: s.lastScoredWeek, playoffWeekStart: s.playoffWeekStart,
    })),
    managers,
    h2h,
  };
}
```

Add to `packages/core/src/index.ts`:
```ts
export * from './history';
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- history
```
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): buildHistory aggregates managers and head-to-head series

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Output schemas

**Files:**
- Create: `packages/core/src/schema.ts`
- Test: `packages/core/test/schema.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `SeasonSchema`, `HistorySchema`, `PlayerDirectorySchema` (zod schemas; `.parse(x)` throws on invalid data)

- [ ] **Step 1: Failing test**

`packages/core/test/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SeasonSchema, HistorySchema, PlayerDirectorySchema } from '../src/schema';
import { buildSeason } from '../src/season';
import { buildHistory } from '../src/history';
import { miniInput } from './fixtures/mini';

describe('output schemas', () => {
  const input = miniInput();
  const season = buildSeason(input);

  it('accept real builder output', () => {
    expect(() => SeasonSchema.parse(season)).not.toThrow();
    expect(() => HistorySchema.parse(buildHistory([season]))).not.toThrow();
    expect(() => PlayerDirectorySchema.parse(input.players)).not.toThrow();
  });

  it('reject malformed data', () => {
    expect(() => SeasonSchema.parse({})).toThrow();
    expect(() => SeasonSchema.parse({ ...season, standings: [{ userId: 1 }] })).toThrow();
    expect(() => HistorySchema.parse({ seasons: 'nope' })).toThrow();
    expect(() => PlayerDirectorySchema.parse({ x: { id: 'x' } })).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- schema
```
Expected: FAIL, cannot find module `../src/schema`.

- [ ] **Step 3: Implement**

`packages/core/src/schema.ts`:
```ts
import { z } from 'zod';

const WLT = z.object({ w: z.number(), l: z.number(), t: z.number() });
const PlayoffTag = z.enum(['QF', 'SF', 'Final', '3rd', '5th', 'Cons-R1', 'Toilet Bowl', 'Cons-7th']);
const Status = z.enum(['complete', 'in_season']);

const PlayerLine = z.object({
  playerId: z.string(),
  points: z.number(),
  projected: z.number().nullable(),
  stats: z.record(z.number()),
});
const SlotEntry = z.object({ slot: z.string(), player: PlayerLine.nullable() });
const Swap = z.object({ out: z.string().nullable(), in: z.string(), gain: z.number() });

const GameSide = z.object({
  userId: z.string(),
  points: z.number(),
  projected: z.number(),
  ceiling: z.number(),
  efficiency: z.number(),
  starters: z.array(SlotEntry),
  bench: z.array(PlayerLine),
  optimalSwaps: z.array(Swap),
  recordBefore: WLT,
  seasonPpg: z.number(),
});

const Game = z.object({
  id: z.string(),
  matchupId: z.number(),
  week: z.number(),
  tag: PlayoffTag.nullable(),
  sides: z.tuple([GameSide, GameSide]),
  winner: z.string().nullable(),
  margin: z.number(),
});

const Week = z.object({
  week: z.number(),
  isPlayoff: z.boolean(),
  played: z.boolean(),
  games: z.array(Game),
  highScore: z.string().nullable(),
});

const StandingRow = z.object({
  userId: z.string(),
  rank: z.number(),
  w: z.number(), l: z.number(), t: z.number(),
  winPct: z.number(),
  pf: z.number(), pa: z.number(), ppg: z.number(),
  maxPoints: z.number(),
  efficiency: z.number(),
  streak: z.string(),
  allPlay: WLT.extend({ pct: z.number() }),
  weeklyHighs: z.number(),
});

const BracketGame = z.object({
  bracket: z.enum(['winners', 'consolation']),
  round: z.number(),
  matchNo: z.number(),
  placement: z.number().nullable(),
  week: z.number(),
  tag: PlayoffTag,
  home: z.string().nullable(),
  away: z.string().nullable(),
  homePoints: z.number().nullable(),
  awayPoints: z.number().nullable(),
  advanced: z.string().nullable(),
  gameId: z.string().nullable(),
});

const Manager = z.object({
  userId: z.string(),
  displayName: z.string(),
  teamName: z.string().nullable(),
  avatar: z.string().nullable(),
  rosterId: z.number(),
});

const Honors = z.object({
  champion: z.string().nullable(),
  runnerUp: z.string().nullable(),
  third: z.string().nullable(),
  pointsTitle: z.string().nullable(),
  lastPlace: z.string().nullable(),
});

export const SeasonSchema = z.object({
  year: z.number(),
  leagueId: z.string(),
  status: Status,
  lastScoredWeek: z.number(),
  playoffWeekStart: z.number(),
  playoffTeams: z.number(),
  rosterSlots: z.array(z.string()),
  scoring: z.record(z.number()),
  managers: z.record(Manager),
  weeks: z.array(Week),
  brackets: z.object({ winners: z.array(BracketGame), consolation: z.array(BracketGame) }),
  standings: z.array(StandingRow),
  honors: Honors,
});

export const PlayerDirectorySchema = z.record(z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string().nullable(),
  team: z.string().nullable(),
  yearsExp: z.number().nullable(),
}));

export const HistorySchema = z.object({
  seasons: z.array(z.object({
    year: z.number(),
    leagueId: z.string(),
    status: Status,
    lastScoredWeek: z.number(),
    playoffWeekStart: z.number(),
  })),
  managers: z.record(z.object({
    displayName: z.string(),
    avatar: z.string().nullable(),
    seasons: z.array(z.number()),
  })),
  h2h: z.record(z.object({
    a: z.string(),
    b: z.string(),
    aWins: z.number(),
    bWins: z.number(),
    ties: z.number(),
    games: z.array(z.object({
      gameId: z.string(),
      year: z.number(),
      week: z.number(),
      tag: PlayoffTag.nullable(),
      aPoints: z.number(),
      bPoints: z.number(),
    })),
  })),
});
```

Add to `packages/core/src/index.ts`:
```ts
export * from './schema';
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- schema
```
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): zod schemas for generated data files

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Sleeper client

**Files:**
- Create: `packages/core/src/sleeper/client.ts`
- Test: `packages/core/test/client.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: raw types from `./sleeper/types`
- Produces: `class SleeperClient` with constructor `(opts?: { fetchFn?: typeof fetch; minIntervalMs?: number; retries?: number; backoffMs?: number })` and methods: `getLeague(id)`, `getUsers(id)`, `getRosters(id)`, `getMatchups(id, week)`, `getWinnersBracket(id)`, `getLosersBracket(id)`, `getPlayers()`, `getProjections(season, week)`, `getStats(season, week)`. Every method returns `Promise<T | null>`; null means HTTP 404.

- [ ] **Step 1: Failing test**

`packages/core/test/client.test.ts`:
```ts
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

  it('uses the stats and projections paths', async () => {
    const fetchFn = vi.fn(async () => response(200, {}));
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
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- client
```
Expected: FAIL, cannot find module `../src/sleeper/client`.

- [ ] **Step 3: Implement**

`packages/core/src/sleeper/client.ts`:
```ts
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
```

Add to `packages/core/src/index.ts`:
```ts
export * from './sleeper/client';
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- client
```
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): SleeperClient with throttling and retries

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Real-data oracle test for brackets

**Files:**
- Create: `packages/core/test/fixtures/record.ts`, `packages/core/test/fixtures/playoffs-2023.json`, `playoffs-2024.json`, `playoffs-2025.json`
- Test: `packages/core/test/oracle.test.ts`

**Interfaces:**
- Consumes: `SleeperClient`, `buildSeason`
- Fixture shape: `{ league, users, rosters, winnersBracket, losersBracket, matchups: Record<week, SleeperMatchup[]> }` with matchups for playoff weeks only.

- [ ] **Step 1: Recorder script**

`packages/core/test/fixtures/record.ts`:
```ts
/**
 * One-off recorder. Saves the real playoff data for completed seasons so the
 * oracle test runs offline. Re-run only if Sleeper data changes:
 *   pnpm --filter @fantasy-dash/core exec tsx test/fixtures/record.ts
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SleeperClient } from '../../src/sleeper/client';

const SEASONS: Record<number, string> = {
  2023: '1000241943814770688',
  2024: '1124847899579023360',
  2025: '1253602506592763904',
};

const client = new SleeperClient();
const dir = path.dirname(new URL(import.meta.url).pathname);

for (const [year, id] of Object.entries(SEASONS)) {
  const league = await client.getLeague(id);
  if (!league) throw new Error(`league ${id} missing`);
  const [users, rosters, winnersBracket, losersBracket] = await Promise.all([
    client.getUsers(id), client.getRosters(id), client.getWinnersBracket(id), client.getLosersBracket(id),
  ]);
  const start = league.settings.playoff_week_start;
  const rounds = Math.max(...(winnersBracket ?? []).map((g) => g.r));
  const matchups: Record<number, unknown> = {};
  for (let w = start; w < start + rounds; w++) matchups[w] = await client.getMatchups(id, w);
  const out = { league, users, rosters, winnersBracket, losersBracket, matchups };
  await writeFile(path.join(dir, `playoffs-${year}.json`), JSON.stringify(out));
  console.log(`recorded ${year}: weeks ${start}-${start + rounds - 1}`);
}
```

- [ ] **Step 2: Record fixtures (network)**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && pnpm --filter @fantasy-dash/core exec tsx test/fixtures/record.ts && ls -la packages/core/test/fixtures/
```
Expected: three lines `recorded 2023/2024/2025: weeks 15-17` and three JSON files of roughly 50 to 150 KB each. If `tsx` is not found inside the package, run `pnpm exec tsx packages/core/test/fixtures/record.ts` from the repo root instead.

- [ ] **Step 3: Failing test**

`packages/core/test/oracle.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSeason, type RawSeasonInput } from '../src/season';

const ORACLE = {
  2025: { champion: 'mattygggg', runnerUp: 'ErikOdd', third: 'faraz525', lastPlace: 'vishwakn' },
  2024: { champion: 'CurryLover53', runnerUp: 'mattygggg', third: 'azhangatang', lastPlace: 'vishwakn' },
  2023: { champion: 'BigBufoon', runnerUp: 'vishwakn', third: 'ErikOdd', lastPlace: 'CurryLover53' },
} as const;

function load(year: number): RawSeasonInput {
  const file = path.join(__dirname, 'fixtures', `playoffs-${year}.json`);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return { ...raw, projections: {}, stats: {}, players: {} };
}

describe('bracket oracle (real seasons)', () => {
  for (const [year, expected] of Object.entries(ORACLE)) {
    it(`resolves ${year} honors`, () => {
      const season = buildSeason(load(Number(year)));
      const name = (id: string | null) => (id ? season.managers[id].displayName : null);
      expect({
        champion: name(season.honors.champion),
        runnerUp: name(season.honors.runnerUp),
        third: name(season.honors.third),
        lastPlace: name(season.honors.lastPlace),
      }).toEqual(expected);
    });

    it(`tags ${year} playoff games`, () => {
      const season = buildSeason(load(Number(year)));
      const tags = season.weeks.slice(season.playoffWeekStart - 1).flatMap((w) => w.games.map((g) => g.tag));
      expect(tags.filter((t) => t === 'Final')).toHaveLength(1);
      expect(tags.filter((t) => t === 'Toilet Bowl')).toHaveLength(1);
      expect(tags.filter((t) => t === 'QF')).toHaveLength(2);
      expect(tags).not.toContain(null);
      const bracketGames = [...season.brackets.winners, ...season.brackets.consolation];
      expect(bracketGames.every((g) => g.gameId !== null)).toBe(true);
    });
  }
});
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test -- oracle
```
Expected: `6 passed`. If the 2024 `lastPlace` comes back as `tarunsauce`, the consolation rule is using Sleeper's `w` field instead of scores. Fix `resolveBracket`, not the test.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(core): oracle test against real 2023-2025 playoff data

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Sync script and first data pull

**Files:**
- Create: `scripts/sync.ts`, `tsconfig.json` (root, for scripts)
- Generate: `data/players.json`, `data/history.json`, `data/seasons/2023.json` ... `2026.json`

**Interfaces:**
- Consumes: `SleeperClient`, `buildSeason`, `buildHistory`, `toPlayerDirectory`, `trimPlayers`, `collectPlayerIds`, schemas; `leagueConfig`
- Produces: the `data/` directory the web app reads. `pnpm sync` and `pnpm sync:dry`.

- [ ] **Step 1: Root tsconfig for scripts**

`tsconfig.json`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["scripts", "league.config.ts"]
}
```

Add `"@types/node": "^22.0.0"` to root `devDependencies` and add a root script `"typecheck:scripts": "tsc -p tsconfig.json"`. Run `pnpm install`.

- [ ] **Step 2: Sync script**

`scripts/sync.ts`:
```ts
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SleeperClient, buildSeason, buildHistory, toPlayerDirectory, trimPlayers, collectPlayerIds,
  SeasonSchema, HistorySchema, PlayerDirectorySchema,
  type PlayerDirectory, type RawSeasonInput, type Season, type SleeperLeague, type SleeperMatchup, type StatMap,
} from '@fantasy-dash/core';
import { leagueConfig } from '../league.config';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT, 'data');
const dryRun = process.argv.includes('--dry-run');
const log = (msg: string) => console.log(`[sync] ${msg}`);

async function walkLeagueChain(client: SleeperClient, startId: string): Promise<SleeperLeague[]> {
  const out: SleeperLeague[] = [];
  const seen = new Set<string>();
  let id: string | null = startId;
  while (id && id !== '0' && !seen.has(id)) {
    seen.add(id);
    const league = await client.getLeague(id);
    if (!league) throw new Error(`League ${id} not found`);
    out.push(league);
    id = league.previous_league_id;
  }
  return out;
}

function pickIds(map: StatMap, ids: Set<string>): StatMap {
  const out: StatMap = {};
  for (const id of ids) if (map[id]) out[id] = map[id];
  return out;
}

async function fetchSeason(client: SleeperClient, league: SleeperLeague, players: PlayerDirectory): Promise<Season> {
  const id = league.league_id;
  const [users, rosters, winnersBracket, losersBracket] = await Promise.all([
    client.getUsers(id), client.getRosters(id), client.getWinnersBracket(id), client.getLosersBracket(id),
  ]);
  const playoffWeekStart = league.settings.playoff_week_start;
  const rounds = (winnersBracket ?? []).reduce((m, g) => Math.max(m, g.r), 0);
  const maxWeek = rounds > 0 ? playoffWeekStart + rounds - 1 : playoffWeekStart - 1;

  const matchups: Record<number, SleeperMatchup[]> = {};
  const projections: Record<number, StatMap> = {};
  const stats: Record<number, StatMap> = {};
  for (let week = 1; week <= maxWeek; week++) {
    const weekMatchups = (await client.getMatchups(id, week)) ?? [];
    matchups[week] = weekMatchups;
    const rostered = new Set(weekMatchups.flatMap((m) => m.players ?? []));
    const [proj, st] = await Promise.all([
      client.getProjections(league.season, week),
      client.getStats(league.season, week),
    ]);
    projections[week] = pickIds(proj ?? {}, rostered);
    stats[week] = pickIds(st ?? {}, rostered);
    log(`  ${league.season} week ${week}: ${weekMatchups.length} roster entries, ${rostered.size} players`);
  }

  const input: RawSeasonInput = {
    league,
    users: users ?? [],
    rosters: rosters ?? [],
    matchups,
    winnersBracket: winnersBracket ?? [],
    losersBracket: losersBracket ?? [],
    projections,
    stats,
    players,
  };
  return buildSeason(input, leagueConfig.managerNames);
}

async function writeAll(dir: string, seasons: Season[], players: PlayerDirectory, history: ReturnType<typeof buildHistory>) {
  await mkdir(path.join(dir, 'seasons'), { recursive: true });
  await writeFile(path.join(dir, 'players.json'), JSON.stringify(players));
  await writeFile(path.join(dir, 'history.json'), JSON.stringify(history, null, 1));
  for (const s of seasons) await writeFile(path.join(dir, 'seasons', `${s.year}.json`), JSON.stringify(s));
}

async function main() {
  const client = new SleeperClient();
  const leagues = await walkLeagueChain(client, leagueConfig.leagueId);
  log(`Found ${leagues.length} seasons: ${leagues.map((l) => l.season).join(', ')}`);

  log('Fetching player directory');
  const rawPlayers = await client.getPlayers();
  if (!rawPlayers) throw new Error('Player directory unavailable');
  const fullPlayers = toPlayerDirectory(rawPlayers);

  const seasons: Season[] = [];
  for (const league of leagues) {
    log(`Season ${league.season} (${league.league_id}, ${league.status})`);
    seasons.push(await fetchSeason(client, league, fullPlayers));
  }
  seasons.sort((a, b) => a.year - b.year);

  const players = trimPlayers(fullPlayers, collectPlayerIds(seasons));
  const history = buildHistory(seasons);

  for (const s of seasons) SeasonSchema.parse(s);
  HistorySchema.parse(history);
  PlayerDirectorySchema.parse(players);
  log(`Validated ${seasons.length} seasons and ${Object.keys(players).length} players`);

  const missing = [...collectPlayerIds(seasons)].filter((id) => !players[id]);
  if (missing.length) log(`WARNING: ${missing.length} player ids missing from directory: ${missing.slice(0, 10).join(', ')}`);

  if (dryRun) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-'));
    await writeAll(dir, seasons, players, history);
    log(`Dry run complete. Output in ${dir}`);
    return;
  }

  const staging = path.join(ROOT, '.tmp', 'data');
  await rm(staging, { recursive: true, force: true });
  await writeAll(staging, seasons, players, history);

  const backup = `${DATA_DIR}.old`;
  await rm(backup, { recursive: true, force: true });
  if (existsSync(DATA_DIR)) await rename(DATA_DIR, backup);
  await rename(staging, DATA_DIR);
  await rm(backup, { recursive: true, force: true });
  log(`Wrote ${DATA_DIR}`);
}

main().catch((err) => {
  console.error('[sync] FAILED:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck and dry run**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && pnpm typecheck:scripts && pnpm sync:dry
```
Expected: no type errors; log lines for 4 seasons and 17 weeks each (2026 may show fewer players for future weeks); ends with `Dry run complete. Output in /var/folders/.../fantasy-dash-XXXX`. Takes roughly 1 to 2 minutes because of throttling.

- [ ] **Step 4: Real sync and spot check**

```bash
pnpm sync && ls -la data data/seasons && du -sh data
```
Expected: `players.json`, `history.json`, `seasons/2023.json` to `2026.json`. Total size under 10 MB.

Spot check honors and standings against the oracle:
```bash
node -e '
const fs=require("fs");
for (const y of [2023,2024,2025,2026]) {
  const s=JSON.parse(fs.readFileSync(`data/seasons/${y}.json`));
  const n=id=>id?s.managers[id].displayName:null;
  console.log(y, s.status, "through wk", s.lastScoredWeek, "| champ", n(s.honors.champion), "| 2nd", n(s.honors.runnerUp), "| 3rd", n(s.honors.third), "| last", n(s.honors.lastPlace), "| pts", n(s.honors.pointsTitle));
  console.log("   top:", s.standings.slice(0,3).map(r=>`${n(r.userId)} ${r.w}-${r.l} ${r.pf} eff ${r.efficiency} strk ${r.streak} AP ${r.allPlay.w}-${r.allPlay.l}`).join(" | "));
}'
```
Expected: 2025 champ mattygggg, last vishwakn; 2024 champ CurryLover53, last vishwakn; 2023 champ BigBufoon, last CurryLover53; 2026 all honors null, through week 5 or later.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sync script and first data pull (2023-2026)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Web app scaffold, theme, shell

**Files:**
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`, `packages/web/vite.config.ts`, `packages/web/index.html`
- Create: `packages/web/src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/data/load.ts`, `src/lib/theme.ts`, `src/lib/format.ts`
- Create: `src/components/Nav.tsx`, `src/components/ThemeToggle.tsx`, `src/components/Avatar.tsx`, `src/components/SeasonPicker.tsx`, `src/pages/ErrorPage.tsx`, `src/pages/HomePage.tsx`
- Create: `src/test/setup.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `data/*.json` from Task 12; types from `@fantasy-dash/core`
- Produces (used by Tasks 14 to 16):
  - `history: History`, `players: PlayerDirectory`, `currentSeason: HistorySeason`, `loadSeason(year): Promise<Season>` from `src/data/load.ts`
  - `seasonLoader` and `router` in `src/App.tsx`
  - `fmtPts(n)`, `fmtPpg(n)`, `fmtPct(ratio, digits=1)`, `fmtWinPct(p)`, `fmtRecord({w,l,t})`, `fmtSigned(n, digits=1)` from `src/lib/format.ts`
  - `<Avatar avatar name size?>`, `<SeasonPicker years value onChange>`, `<Nav>` with a `links` array that later tasks append to
  - CSS tokens: `bg`, `surface`, `surface-2`, `line`, `ink`, `muted`, `accent`, `win`, `loss` (as Tailwind colors, e.g. `bg-surface`, `text-muted`), `--pos-QB` ... `--pos-DEF` CSS variables, and the `.num` utility class for tabular numerals.

- [ ] **Step 1: Invoke the frontend-design skill**

Invoke `frontend-design:frontend-design` now. Brief for it: calm, legible fantasy football dashboard; dark default with light option; one accent; tabular monospace numerals; dense tables; mobile-first stacking. It may refine the token values, fonts and spacing in `index.css` below. It must keep the token names and the `.num` class.

- [ ] **Step 2: Package files**

`packages/web/package.json`:
```json
{
  "name": "@fantasy-dash/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fantasy-dash/core": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.6.0",
    "vite": "^6.3.0",
    "vitest": "^3.1.0"
  }
}
```

`packages/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts", "../../league.config.ts"]
}
```

`packages/web/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? '/',
  server: { fs: { allow: ['../..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

`packages/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Husky Fantasy</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Styles and theme**

`packages/web/src/index.css` (the frontend-design skill may adjust values, not names):
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
@import "tailwindcss";

:root {
  color-scheme: dark;
  --bg: #0c0e12;
  --surface: #141820;
  --surface-2: #1b212b;
  --line: #262d39;
  --ink: #e6e9ee;
  --muted: #8a94a3;
  --accent: #58d68d;
  --win: #58d68d;
  --loss: #e0646b;
  --pos-QB: #e05a5a;
  --pos-RB: #3fb97a;
  --pos-WR: #4f8fe8;
  --pos-TE: #e3933b;
  --pos-K: #9b6ee8;
  --pos-DEF: #7d8794;
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-2: #eef0f4;
  --line: #dfe3ea;
  --ink: #15191f;
  --muted: #647081;
  --accent: #1f9d5a;
  --win: #1f9d5a;
  --loss: #c7414a;
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-line: var(--line);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-win: var(--win);
  --color-loss: var(--loss);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

html, body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
}

.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

`packages/web/src/lib/theme.ts`:
```ts
const KEY = 'fd-theme';
export type Theme = 'dark' | 'light';

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
}

export function initTheme(): void {
  applyTheme(getTheme());
}
```

- [ ] **Step 4: Failing format test**

`packages/web/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`packages/web/src/lib/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fmtPts, fmtPpg, fmtPct, fmtWinPct, fmtRecord, fmtSigned } from './format';

describe('format helpers', () => {
  it('formats points, ppg and percents', () => {
    expect(fmtPts(111.7)).toBe('111.70');
    expect(fmtPpg(93.333)).toBe('93.3');
    expect(fmtPct(0.9272)).toBe('92.7%');
    expect(fmtPct(0.9272, 0)).toBe('93%');
  });
  it('formats win pct without leading zero', () => {
    expect(fmtWinPct(0.6667)).toBe('.667');
    expect(fmtWinPct(1)).toBe('1.000');
    expect(fmtWinPct(0)).toBe('.000');
  });
  it('formats records and signed numbers', () => {
    expect(fmtRecord({ w: 5, l: 3, t: 0 })).toBe('5-3');
    expect(fmtRecord({ w: 5, l: 3, t: 1 })).toBe('5-3-1');
    expect(fmtSigned(4.25)).toBe('+4.3');
    expect(fmtSigned(-2)).toBe('-2.0');
    expect(fmtSigned(0)).toBe('0.0');
    expect(fmtSigned(1.234, 2)).toBe('+1.23');
  });
});
```

- [ ] **Step 5: Run, expect failure**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && pnpm install && pnpm --filter @fantasy-dash/web test
```
Expected: FAIL, cannot find module `./format`.

- [ ] **Step 6: Implement format, data loader, components, router**

`packages/web/src/lib/format.ts`:
```ts
import type { WLT } from '@fantasy-dash/core';

export const fmtPts = (n: number): string => n.toFixed(2);
export const fmtPpg = (n: number): string => n.toFixed(1);
export const fmtPct = (ratio: number, digits = 1): string => `${(ratio * 100).toFixed(digits)}%`;
export const fmtWinPct = (p: number): string => p.toFixed(3).replace(/^0\./, '.');
export const fmtRecord = (r: WLT): string => (r.t ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`);
export const fmtSigned = (n: number, digits = 1): string => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
```

`packages/web/src/data/load.ts`:
```ts
import type { History, HistorySeason, PlayerDirectory, Season } from '@fantasy-dash/core';

// import.meta.glob keeps tsc from type-inferring multi-megabyte JSON literals.
const historyMod = import.meta.glob<{ default: History }>('../../../../data/history.json', { eager: true });
const playersMod = import.meta.glob<{ default: PlayerDirectory }>('../../../../data/players.json', { eager: true });
const seasonMods = import.meta.glob<{ default: Season }>('../../../../data/seasons/*.json');

export const history: History = Object.values(historyMod)[0].default;
export const players: PlayerDirectory = Object.values(playersMod)[0].default;
export const currentSeason: HistorySeason = history.seasons[history.seasons.length - 1];

const cache = new Map<number, Promise<Season>>();

export function loadSeason(year: number): Promise<Season> {
  let pending = cache.get(year);
  if (!pending) {
    const key = Object.keys(seasonMods).find((k) => k.endsWith(`/${year}.json`));
    if (!key) return Promise.reject(new Response(`No data for season ${year}`, { status: 404 }));
    pending = seasonMods[key]().then((m) => m.default);
    cache.set(year, pending);
  }
  return pending;
}
```

`packages/web/src/components/Avatar.tsx`:
```tsx
interface Props { avatar: string | null; name: string; size?: number }

export default function Avatar({ avatar, name, size = 32 }: Props) {
  if (avatar) {
    return (
      <img
        src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-surface-2"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-medium text-muted"
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
```

`packages/web/src/components/ThemeToggle.tsx`:
```tsx
import { useState } from 'react';
import { applyTheme, getTheme, type Theme } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => { applyTheme(next); setTheme(next); }}
      className="rounded px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
      aria-label={`Switch to ${next} theme`}
    >
      {next === 'light' ? 'Light' : 'Dark'}
    </button>
  );
}
```

`packages/web/src/components/SeasonPicker.tsx`:
```tsx
interface Props { years: number[]; value: number; onChange: (year: number) => void }

export default function SeasonPicker({ years, value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Season
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="num rounded border border-line bg-surface px-2 py-1 text-ink"
      >
        {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}
```

`packages/web/src/components/Nav.tsx`:
```tsx
import { NavLink } from 'react-router';
import { leagueConfig } from '../../../../league.config';
import ThemeToggle from './ThemeToggle';

/** Tasks 14 and 15 append Standings and Scores here. */
export const links: { to: string; label: string }[] = [];

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-6 px-4">
        <NavLink to="/" className="font-semibold tracking-tight">{leagueConfig.name}</NavLink>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded px-2.5 py-1 transition-colors ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto"><ThemeToggle /></div>
      </div>
    </header>
  );
}
```

`packages/web/src/pages/ErrorPage.tsx`:
```tsx
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export default function ErrorPage() {
  const err = useRouteError();
  const message = isRouteErrorResponse(err)
    ? `${err.status} ${err.statusText || (err.status === 404 ? 'Not found' : '')}`.trim()
    : 'Something went wrong';
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 text-center">
      <p className="text-2xl font-semibold">{message}</p>
      <Link to="/" className="mt-4 inline-block text-accent">Back to the dashboard</Link>
    </div>
  );
}
```

`packages/web/src/pages/HomePage.tsx` (temporary; Task 15 replaces the index route with a redirect and deletes this file):
```tsx
import { history } from '../data/load';

export default function HomePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">Seasons</h1>
      <ul className="space-y-1 text-sm">
        {history.seasons.map((s) => (
          <li key={s.year} className="num">{s.year} <span className="text-muted">{s.status === 'complete' ? 'final' : `through week ${s.lastScoredWeek}`}</span></li>
        ))}
      </ul>
    </section>
  );
}
```

`packages/web/src/App.tsx`:
```tsx
import { createBrowserRouter, Outlet, type LoaderFunctionArgs } from 'react-router';
import Nav from './components/Nav';
import ErrorPage from './pages/ErrorPage';
import HomePage from './pages/HomePage';
import { loadSeason } from './data/load';

export async function seasonLoader({ params }: LoaderFunctionArgs) {
  const year = Number(params.season);
  if (!Number.isInteger(year)) throw new Response('Bad season', { status: 400 });
  return loadSeason(year);
}

function Layout() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <HomePage /> },
      ],
    },
  ],
  { basename },
);
```

`packages/web/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './App';
import { initTheme } from './lib/theme';
import './index.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Run tests, typecheck, build, and smoke the dev server**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck && pnpm build
```
Expected: `3 passed`, no type errors, `vite build` output lists `dist/index.html` and one or more season JSON chunks.

```bash
(pnpm dev --host 127.0.0.1 --port 5173 > /tmp/fd-dev.log 2>&1 &) ; sleep 4; curl -s http://127.0.0.1:5173/ | grep -c 'id="root"'; pkill -f "vite" || true
```
Expected: `1`. Also open http://127.0.0.1:5173/ in a browser once: the season list renders and the Dark/Light toggle switches the theme.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(web): Vite + React shell with theme tokens, nav, data loader

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Standings page

**Files:**
- Create: `packages/web/src/lib/metrics.ts`, `src/components/StandingsTable.tsx`, `src/pages/StandingsPage.tsx`
- Modify: `src/App.tsx` (routes), `src/components/Nav.tsx` (links)
- Test: `src/components/StandingsTable.test.tsx`

**Interfaces:**
- Consumes: `Season`, `StandingRow`, `Manager` from core; `fmt*`, `Avatar`, `SeasonPicker`, `history`, `currentSeason`, `seasonLoader`
- Produces: `METRIC_DEFS` and `topPerformers(game, n=3): { userId, playerId, points }[]` in `src/lib/metrics.ts` (Task 15 uses `topPerformers`); routes `/standings` and `/standings/:season`

- [ ] **Step 1: Failing test**

`packages/web/src/components/StandingsTable.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import type { Manager, StandingRow } from '@fantasy-dash/core';
import StandingsTable from './StandingsTable';

const row = (userId: string, rank: number, w: number, l: number, extra: Partial<StandingRow> = {}): StandingRow => ({
  userId, rank, w, l, t: 0, winPct: w / (w + l), pf: 1000 + rank, pa: 900, ppg: 100.5, maxPoints: 1200,
  efficiency: 0.8333, streak: 'W2', allPlay: { w: 20, l: 7, t: 0, pct: 0.7407 }, weeklyHighs: 1, ...extra,
});
const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
  c: { userId: 'c', displayName: 'cara', teamName: 'Team C', avatar: null, rosterId: 3 },
};

describe('StandingsTable', () => {
  it('renders rows in order with formatted metrics', () => {
    render(<StandingsTable rows={[row('a', 1, 6, 2), row('b', 2, 4, 4, { streak: 'L1', t: 1 }), row('c', 3, 1, 7)]} managers={managers} playoffTeams={2} />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Team A');
    expect(rows[0]).toHaveTextContent('alice');
    expect(rows[0]).toHaveTextContent('.750');
    expect(rows[0]).toHaveTextContent('83.3%');
    expect(rows[0]).toHaveTextContent('20-7');
    expect(rows[1]).toHaveTextContent('bob');
    expect(rows[1]).toHaveTextContent('L1');
  });

  it('marks the playoff cut line after the last playoff team', () => {
    render(<StandingsTable rows={[row('a', 1, 6, 2), row('b', 2, 4, 4), row('c', 3, 1, 7)]} managers={managers} playoffTeams={2} />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows[1]).toHaveAttribute('data-playoff-cut', 'true');
    expect(rows[0]).not.toHaveAttribute('data-playoff-cut');
    expect(rows[2]).not.toHaveAttribute('data-playoff-cut');
  });

  it('exposes metric definitions as header tooltips', () => {
    render(<StandingsTable rows={[]} managers={{}} playoffTeams={6} />);
    expect(screen.getByText('All-Play')).toHaveAttribute('title', expect.stringContaining('every other team'));
    expect(screen.getByText('Eff')).toHaveAttribute('title', expect.stringContaining('max points'));
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- StandingsTable
```
Expected: FAIL, cannot find module `./StandingsTable`.

- [ ] **Step 3: Implement**

`packages/web/src/lib/metrics.ts`:
```ts
import type { Game, PlayerId, UserId } from '@fantasy-dash/core';

export const METRIC_DEFS = {
  winPct: 'Win percentage. Wins plus half of ties, divided by games played.',
  pf: 'Points for. Total points scored in regular season games.',
  pa: 'Points against. Total points allowed in regular season games.',
  ppg: 'Points per game in the regular season.',
  max: 'Max points. The best possible lineup from the full roster each week, summed.',
  eff: 'Efficiency. Points for divided by max points.',
  strk: 'Current run of consecutive wins or losses. Regular season only.',
  allPlay: 'All-play record. Your record if you had played every other team each week.',
  highs: "Weeks with the league's top score.",
} as const;

export interface Performer { userId: UserId; playerId: PlayerId; points: number }

/** Highest-scoring starters across both sides of a game. */
export function topPerformers(game: Game, n = 3): Performer[] {
  return game.sides
    .flatMap((s) => s.starters.flatMap((e) => (e.player ? [{ userId: s.userId, playerId: e.player.playerId, points: e.player.points }] : [])))
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}
```

`packages/web/src/components/StandingsTable.tsx`:
```tsx
import type { Manager, StandingRow, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { fmtPct, fmtPpg, fmtPts, fmtWinPct } from '../lib/format';
import { METRIC_DEFS } from '../lib/metrics';

interface Props { rows: StandingRow[]; managers: Record<UserId, Manager>; playoffTeams: number }

const headers: { key: string; label: string; title?: string; left?: boolean }[] = [
  { key: 'rank', label: '#', left: true },
  { key: 'team', label: 'Team', left: true },
  { key: 'w', label: 'W' },
  { key: 'l', label: 'L' },
  { key: 't', label: 'T' },
  { key: 'pct', label: 'Win%', title: METRIC_DEFS.winPct },
  { key: 'pf', label: 'PF', title: METRIC_DEFS.pf },
  { key: 'pa', label: 'PA', title: METRIC_DEFS.pa },
  { key: 'ppg', label: 'PPG', title: METRIC_DEFS.ppg },
  { key: 'max', label: 'Max', title: METRIC_DEFS.max },
  { key: 'eff', label: 'Eff', title: METRIC_DEFS.eff },
  { key: 'strk', label: 'Strk', title: METRIC_DEFS.strk },
  { key: 'ap', label: 'All-Play', title: METRIC_DEFS.allPlay },
];

const cell = 'num px-3 py-2 text-right';

export default function StandingsTable({ rows, managers, playoffTeams }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h.key} scope="col" title={h.title} className={`px-3 py-2 font-medium ${h.left ? 'text-left' : 'text-right'}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const m = managers[r.userId];
            const cut = i === playoffTeams - 1 && i < rows.length - 1;
            const streakTone = r.streak.startsWith('W') ? 'text-win' : r.streak.startsWith('L') ? 'text-loss' : 'text-muted';
            return (
              <tr
                key={r.userId}
                data-testid="standings-row"
                data-playoff-cut={cut ? 'true' : undefined}
                className={`border-t border-line transition-colors hover:bg-surface-2 ${cut ? 'border-b-2 border-b-accent/60' : ''}`}
              >
                <td className="num px-3 py-2 text-muted">{r.rank}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={24} />
                    <div className="leading-tight">
                      <div className="font-medium">{m?.teamName ?? m?.displayName ?? r.userId}</div>
                      {m?.teamName && <div className="text-xs text-muted">{m.displayName}</div>}
                    </div>
                  </div>
                </td>
                <td className={cell}>{r.w}</td>
                <td className={cell}>{r.l}</td>
                <td className={`${cell} text-muted`}>{r.t}</td>
                <td className={cell}>{fmtWinPct(r.winPct)}</td>
                <td className={cell}>{fmtPts(r.pf)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.pa)}</td>
                <td className={cell}>{fmtPpg(r.ppg)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.maxPoints)}</td>
                <td className={cell}>{fmtPct(r.efficiency)}</td>
                <td className={`${cell} ${streakTone}`}>{r.streak}</td>
                <td className={cell}>
                  {r.allPlay.w}-{r.allPlay.l}{r.allPlay.t ? `-${r.allPlay.t}` : ''}{' '}
                  <span className="text-muted">({fmtWinPct(r.allPlay.pct)})</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`packages/web/src/pages/StandingsPage.tsx`:
```tsx
import { useLoaderData, useNavigate } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import StandingsTable from '../components/StandingsTable';
import SeasonPicker from '../components/SeasonPicker';
import { history } from '../data/load';

export default function StandingsPage() {
  const season = useLoaderData() as Season;
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const note = season.status === 'in_season' ? `through week ${season.lastScoredWeek}` : 'final';
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Standings <span className="num font-normal text-muted">{season.year} · {note}</span>
        </h1>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/standings/${y}`)} />
      </header>
      <StandingsTable rows={season.standings} managers={season.managers} playoffTeams={season.playoffTeams} />
      <p className="text-xs text-muted">
        Regular season only. Hover a column header for its definition. Top {season.playoffTeams} make the playoffs.
      </p>
    </section>
  );
}
```

Modify `packages/web/src/App.tsx`: add imports and routes.
```tsx
import { createBrowserRouter, Outlet, redirect, type LoaderFunctionArgs } from 'react-router';
import StandingsPage from './pages/StandingsPage';
import { currentSeason, loadSeason } from './data/load';
```
and inside `children`, after the index route:
```tsx
        { path: 'standings', loader: () => redirect(`/standings/${currentSeason.year}`) },
        { path: 'standings/:season', loader: seasonLoader, element: <StandingsPage /> },
```

Modify `packages/web/src/components/Nav.tsx`:
```tsx
export const links: { to: string; label: string }[] = [
  { to: '/standings', label: 'Standings' },
];
```

- [ ] **Step 4: Run, expect pass; check in browser**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck
```
Expected: `6 passed`, no type errors.

Start `pnpm dev` and open http://127.0.0.1:5173/standings/2025. Expect 10 rows, mattygggg's team near the top, a highlighted line under the 6th row, and the header "2025 · final". Switch to 2026 and expect "through week N". Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): standings page with metric tooltips and playoff cut

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Scoreboard page

**Files:**
- Create: `src/components/WeekStrip.tsx`, `src/components/ScoreCard.tsx`, `src/pages/ScoresPage.tsx`
- Modify: `src/App.tsx` (routes, index redirect), `src/components/Nav.tsx` (links)
- Delete: `src/pages/HomePage.tsx`
- Test: `src/components/ScoreCard.test.tsx`

**Interfaces:**
- Consumes: `Game`, `Week`, `Manager`, `PlayerDirectory` from core; `topPerformers`; `fmt*`; `Avatar`; `SeasonPicker`; `players`, `history`, `currentSeason`, `seasonLoader`
- Produces: `<ScoreCard game played managers players to>` (Phase 2 H2H page reuses it); routes `/`, `/scores`, `/scores/:season`, `/scores/:season/:week` where `:week` is a number or `season`

- [ ] **Step 1: Failing test**

`packages/web/src/components/ScoreCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Game, GameSide, Manager, PlayerDirectory } from '@fantasy-dash/core';
import ScoreCard from './ScoreCard';

const side = (userId: string, points: number, starters: [string, number][]): GameSide => ({
  userId, points, projected: 100, ceiling: points + 10, efficiency: 0.9,
  starters: starters.map(([id, pts], i) => ({ slot: i === 0 ? 'QB' : 'RB', player: { playerId: id, points: pts, projected: null, stats: {} } })),
  bench: [], optimalSwaps: [], recordBefore: { w: 3, l: 1, t: 0 }, seasonPpg: 105.5,
});
const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
};
const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3 },
  r1: { id: 'r1', name: 'Ricky One', firstName: 'Ricky', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 2 },
  q2: { id: 'q2', name: 'Quinn Two', firstName: 'Quinn', lastName: 'Two', position: 'QB', team: 'BUF', yearsExp: 5 },
  r2: { id: 'r2', name: 'Rob Two', firstName: 'Rob', lastName: 'Two', position: 'RB', team: 'DET', yearsExp: 1 },
};
const base = (a: GameSide, b: GameSide, winner: string | null, tag: Game['tag'] = null): Game => ({
  id: '2025-3-1', matchupId: 1, week: 3, tag, sides: [a, b], winner, margin: Math.abs(a.points - b.points),
});
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ScoreCard', () => {
  it('shows scores, records, efficiency and the top three starters', () => {
    const g = base(side('a', 120.5, [['q1', 30], ['r1', 12]]), side('b', 99.25, [['q2', 25], ['r2', 8]]), 'a');
    wrap(<ScoreCard game={g} played managers={managers} players={players} to="/x" />);
    expect(screen.getByText('120.50')).toBeInTheDocument();
    expect(screen.getByText('99.25')).toBeInTheDocument();
    expect(screen.getAllByText('3-1')).toHaveLength(2);
    expect(screen.getAllByText('90%')).toHaveLength(2);
    expect(screen.getByText('Quincy One')).toBeInTheDocument();
    expect(screen.getByText('Quinn Two')).toBeInTheDocument();
    expect(screen.getByText('Ricky One')).toBeInTheDocument();
    expect(screen.queryByText('Rob Two')).not.toBeInTheDocument();
    expect(screen.getByText('Week 3')).toBeInTheDocument();
  });

  it('labels a tie', () => {
    const g = base(side('a', 100, [['q1', 30]]), side('b', 100, [['q2', 30]]), null);
    wrap(<ScoreCard game={g} played managers={managers} players={players} to="/x" />);
    expect(screen.getByText('Tie')).toBeInTheDocument();
  });

  it('shows projections for an upcoming game and no performers', () => {
    const g = base(side('a', 0, []), side('b', 0, []), null);
    wrap(<ScoreCard game={g} played={false} managers={managers} players={players} to="/x" />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getAllByText(/100\.00 proj/)).toHaveLength(2);
    expect(screen.queryByText('Tie')).not.toBeInTheDocument();
  });

  it('shows the playoff tag and links to the box score', () => {
    const g = base(side('a', 100, [['q1', 30]]), side('b', 90, [['q2', 30]]), 'a', 'Final');
    wrap(<ScoreCard game={g} played managers={managers} players={players} to="/scores/2025/17/1" />);
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/scores/2025/17/1');
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- ScoreCard
```
Expected: FAIL, cannot find module `./ScoreCard`.

- [ ] **Step 3: Implement**

`packages/web/src/components/ScoreCard.tsx`:
```tsx
import { Link } from 'react-router';
import type { Game, GameSide, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { fmtPct, fmtPts, fmtRecord } from '../lib/format';
import { topPerformers } from '../lib/metrics';

interface Props {
  game: Game;
  played: boolean;
  managers: Record<UserId, Manager>;
  players: PlayerDirectory;
  to: string;
}

export default function ScoreCard({ game, played, managers, players, to }: Props) {
  const top = played ? topPerformers(game) : [];
  const status = !played ? 'Upcoming' : game.winner === null ? 'Tie' : null;
  return (
    <Link to={to} className="block rounded-lg border border-line bg-surface transition-colors hover:border-accent/60">
      <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted">
        <span className={game.tag ? 'font-medium text-accent' : ''}>{game.tag ?? `Week ${game.week}`}</span>
        {status && <span>{status}</span>}
      </div>
      <div className="space-y-2 px-4 py-2">
        {game.sides.map((side) => (
          <SideRow key={side.userId} side={side} manager={managers[side.userId]} isWinner={game.winner === side.userId} played={played} />
        ))}
      </div>
      {top.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs">
          {top.map((t) => (
            <span key={t.playerId} className="flex items-center gap-1.5">
              <span className="num text-ink">{fmtPts(t.points)}</span>
              <span className="truncate text-muted">{players[t.playerId]?.name ?? t.playerId}</span>
              <span className="text-muted/70">{managers[t.userId]?.displayName}</span>
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function SideRow({ side, manager, isWinner, played }: { side: GameSide; manager?: Manager; isWinner: boolean; played: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${isWinner || !played ? 'text-ink' : 'text-muted'}`}>
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{manager?.teamName ?? manager?.displayName ?? side.userId}</div>
        <div className="text-xs text-muted">{manager?.displayName} · <span>{fmtRecord(side.recordBefore)}</span></div>
      </div>
      {played && (
        <span className="num rounded bg-surface-2 px-1.5 py-0.5 text-[11px]" title="Efficiency: points divided by the best possible lineup">
          {fmtPct(side.efficiency, 0)}
        </span>
      )}
      <span className={`num text-lg ${isWinner ? 'font-semibold' : ''}`}>
        {played ? fmtPts(side.points) : <span className="text-sm text-muted">{fmtPts(side.projected)} proj</span>}
      </span>
    </div>
  );
}
```

`packages/web/src/components/WeekStrip.tsx`:
```tsx
import type { Week } from '@fantasy-dash/core';

interface Props { weeks: Week[]; selected: number | 'season'; onSelect: (week: number | 'season') => void }

export default function WeekStrip({ weeks, selected, onSelect }: Props) {
  const cls = (active: boolean, extra = '') =>
    `num shrink-0 rounded px-2.5 py-1 text-sm transition-colors ${active ? 'bg-ink text-bg' : 'text-muted hover:bg-surface-2 hover:text-ink'} ${extra}`;
  return (
    <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Week">
      {weeks.map((w) => (
        <button
          key={w.week}
          type="button"
          role="tab"
          aria-selected={selected === w.week}
          onClick={() => onSelect(w.week)}
          title={w.isPlayoff ? 'Playoffs' : undefined}
          className={cls(selected === w.week, `${w.isPlayoff ? 'underline decoration-accent/70 underline-offset-4' : ''} ${w.played ? '' : 'opacity-60'}`)}
        >
          {w.week}
        </button>
      ))}
      <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
      <button type="button" role="tab" aria-selected={selected === 'season'} onClick={() => onSelect('season')} className={cls(selected === 'season')}>
        Season
      </button>
    </div>
  );
}
```

`packages/web/src/pages/ScoresPage.tsx`:
```tsx
import { useLoaderData, useNavigate, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import ScoreCard from '../components/ScoreCard';
import SeasonPicker from '../components/SeasonPicker';
import WeekStrip from '../components/WeekStrip';
import { history, players } from '../data/load';

export default function ScoresPage() {
  const season = useLoaderData() as Season;
  const { week: weekParam } = useParams();
  const navigate = useNavigate();
  const selected: number | 'season' = weekParam === 'season' ? 'season' : Number(weekParam);
  const weeks = selected === 'season' ? season.weeks : season.weeks.filter((w) => w.week === selected);
  const years = history.seasons.map((s) => s.year);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Scoreboard <span className="num font-normal text-muted">{season.year}</span>
        </h1>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/scores/${y}`)} />
      </header>
      <WeekStrip weeks={season.weeks} selected={selected} onSelect={(w) => navigate(`/scores/${season.year}/${w}`)} />
      {weeks.length === 0 && <p className="text-sm text-muted">No week {weekParam} in {season.year}.</p>}
      {weeks.map((wk) => (
        <div key={wk.week} className="space-y-3">
          {selected === 'season' && (
            <h2 className="num text-xs uppercase tracking-wide text-muted">
              Week {wk.week}{wk.isPlayoff ? ' · Playoffs' : ''}{wk.played ? '' : ' · Upcoming'}
            </h2>
          )}
          {wk.games.length === 0 ? (
            <p className="text-sm text-muted">No games scheduled.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {wk.games.map((g) => (
                <ScoreCard
                  key={g.id}
                  game={g}
                  played={wk.played}
                  managers={season.managers}
                  players={players}
                  to={`/scores/${season.year}/${wk.week}/${g.matchupId}`}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
```

Modify `packages/web/src/App.tsx`: remove the `HomePage` import and index element; add `ScoresPage` import and these routes. The final `children` array is:
```tsx
      children: [
        { index: true, loader: () => redirect(`/scores/${currentSeason.year}/${Math.max(1, currentSeason.lastScoredWeek)}`) },
        { path: 'scores', loader: () => redirect(`/scores/${currentSeason.year}/${Math.max(1, currentSeason.lastScoredWeek)}`) },
        {
          path: 'scores/:season',
          loader: async (args: LoaderFunctionArgs) => {
            const season = await seasonLoader(args);
            return redirect(`/scores/${season.year}/${Math.max(1, season.lastScoredWeek)}`);
          },
        },
        { path: 'scores/:season/:week', loader: seasonLoader, element: <ScoresPage /> },
        { path: 'standings', loader: () => redirect(`/standings/${currentSeason.year}`) },
        { path: 'standings/:season', loader: seasonLoader, element: <StandingsPage /> },
      ],
```

Delete `packages/web/src/pages/HomePage.tsx`:
```bash
git rm packages/web/src/pages/HomePage.tsx
```

Modify `packages/web/src/components/Nav.tsx`:
```tsx
export const links: { to: string; label: string }[] = [
  { to: '/scores', label: 'Scores' },
  { to: '/standings', label: 'Standings' },
];
```

- [ ] **Step 4: Run, expect pass; check in browser**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck
```
Expected: `10 passed`, no type errors.

Start `pnpm dev`. Open http://127.0.0.1:5173/ and confirm it redirects to the current season's latest scored week with 5 cards. Click week 17 on 2025: cards show "Final", "3rd", and the consolation games show no tag because consolation ends week 16; week 16 shows "SF", "5th", "Toilet Bowl", "Cons-7th". Click "Season" and confirm all weeks stack. Click a card: it navigates to `/scores/2025/17/N` which 404s until Task 16. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): scoreboard with week strip, score cards, top performers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Box score page

**Files:**
- Create: `src/lib/players.ts`, `src/components/boxscore/LineupTable.tsx`, `src/components/boxscore/EfficiencyBlock.tsx`, `src/components/boxscore/FormBlock.tsx`, `src/pages/BoxScorePage.tsx`
- Modify: `src/App.tsx` (route)
- Test: `src/lib/players.test.ts`, `src/components/boxscore/FormBlock.test.tsx`

**Interfaces:**
- Consumes: `GameSide`, `PlayerLine`, `Manager`, `PlayerDirectory`, `h2hKey` from core; `fmt*`; `Avatar`; `history`, `players`, `seasonLoader`
- Produces: `playerName`, `playerPos`, `playerTeam`, `posColor`, `statLine` in `src/lib/players.ts`; route `/scores/:season/:week/:matchupId`

- [ ] **Step 1: Failing tests**

`packages/web/src/lib/players.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { statLine, posColor } from './players';

describe('statLine', () => {
  it('formats a quarterback line including rushing', () => {
    expect(statLine('QB', { pass_cmp: 20, pass_att: 30, pass_yd: 250, pass_td: 2, pass_int: 1, rush_att: 3, rush_yd: 12 }))
      .toBe('20/30, 250 yds · 2 TD · 1 INT · 3 car 12 yds');
  });
  it('formats rushing and receiving', () => {
    expect(statLine('RB', { rush_att: 18, rush_yd: 85, rush_td: 1, rec: 3, rec_yd: 20 })).toBe('18 car 85 yds 1 TD · 3 rec 20 yds');
    expect(statLine('WR', { rec: 5, rec_tgt: 8, rec_yd: 70, fum_lost: 1 })).toBe('5 rec 70 yds · 1 FUM');
  });
  it('formats kickers and defenses', () => {
    expect(statLine('K', { fgm: 2, fga: 3, xpm: 3, xpa: 3 })).toBe('2/3 FG, 3/3 XP');
    expect(statLine('DEF', { pts_allow: 17, sack: 3, int: 1 })).toBe('17 PA, 3 sck, 1 INT');
    expect(statLine('DEF', { pts_allow: 17, sack: 3, int: 1, def_td: 1 })).toBe('17 PA, 3 sck, 1 INT, 1 TD');
  });
  it('returns an empty string with no stats', () => {
    expect(statLine('QB', {})).toBe('');
    expect(statLine('RB', {})).toBe('');
  });
});

describe('posColor', () => {
  it('maps to the position CSS variable with a fallback', () => {
    expect(posColor('RB')).toBe('var(--pos-RB, var(--muted))');
  });
});
```

`packages/web/src/components/boxscore/FormBlock.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('+9.5')).toBeInTheDocument();
    expect(screen.getByText('+20.0')).toBeInTheDocument();
    expect(screen.getByText('-10.0')).toBeInTheDocument();
    expect(screen.getByText('-5.3')).toBeInTheDocument();
  });
  it('flags starters without a projection', () => {
    render(<FormBlock sides={[side('a', 120, 110.5, 100, 0), side('b', 90, 100, 95.25, 2)]} managers={managers} />);
    expect(screen.getByText('2 starters had no projection.')).toBeInTheDocument();
    expect(screen.queryByText(/1 starter had/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- players FormBlock
```
Expected: FAIL, cannot find modules `./players` and `./FormBlock`.

- [ ] **Step 3: Implement**

`packages/web/src/lib/players.ts`:
```ts
import type { PlayerDirectory, PlayerId } from '@fantasy-dash/core';

export function playerName(players: PlayerDirectory, id: PlayerId): string {
  return players[id]?.name ?? id;
}
export function playerPos(players: PlayerDirectory, id: PlayerId): string {
  return players[id]?.position ?? '?';
}
export function playerTeam(players: PlayerDirectory, id: PlayerId): string {
  return players[id]?.team ?? '';
}
export function posColor(pos: string): string {
  return `var(--pos-${pos}, var(--muted))`;
}

const n = (stats: Record<string, number>, key: string) => stats[key] ?? 0;

/** Compact stat line for a box-score row. Empty string when there are no stats. */
export function statLine(pos: string, stats: Record<string, number>): string {
  if (Object.keys(stats).length === 0) return '';
  const parts: string[] = [];
  if (pos === 'QB' || n(stats, 'pass_att') > 0) {
    parts.push(`${n(stats, 'pass_cmp')}/${n(stats, 'pass_att')}, ${n(stats, 'pass_yd')} yds`);
    if (n(stats, 'pass_td')) parts.push(`${n(stats, 'pass_td')} TD`);
    if (n(stats, 'pass_int')) parts.push(`${n(stats, 'pass_int')} INT`);
  }
  if (n(stats, 'rush_att') > 0) {
    parts.push(`${n(stats, 'rush_att')} car ${n(stats, 'rush_yd')} yds${n(stats, 'rush_td') ? ` ${n(stats, 'rush_td')} TD` : ''}`);
  }
  if (n(stats, 'rec') > 0 || n(stats, 'rec_tgt') > 0) {
    parts.push(`${n(stats, 'rec')} rec ${n(stats, 'rec_yd')} yds${n(stats, 'rec_td') ? ` ${n(stats, 'rec_td')} TD` : ''}`);
  }
  if (pos === 'K') {
    parts.push(`${n(stats, 'fgm')}/${n(stats, 'fga')} FG, ${n(stats, 'xpm')}/${n(stats, 'xpa')} XP`);
  }
  if (pos === 'DEF') {
    parts.push(`${n(stats, 'pts_allow')} PA, ${n(stats, 'sack')} sck, ${n(stats, 'int')} INT${n(stats, 'def_td') ? `, ${n(stats, 'def_td')} TD` : ''}`);
  }
  if (n(stats, 'fum_lost')) parts.push(`${n(stats, 'fum_lost')} FUM`);
  return parts.join(' · ');
}
```

`packages/web/src/components/boxscore/LineupTable.tsx`:
```tsx
import type { GameSide, PlayerDirectory, PlayerLine } from '@fantasy-dash/core';
import { fmtPts } from '../../lib/format';
import { playerName, playerPos, playerTeam, posColor, statLine } from '../../lib/players';

interface Props { sides: [GameSide, GameSide]; slots: string[]; players: PlayerDirectory }

function PlayerCell({ line, players, align }: { line: PlayerLine | null; players: PlayerDirectory; align: 'left' | 'right' }) {
  if (!line) return <div className={`text-sm text-muted ${align === 'right' ? 'text-right' : ''}`}>Empty</div>;
  const pos = playerPos(players, line.playerId);
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold text-white" style={{ background: posColor(pos) }}>
        {pos}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {playerName(players, line.playerId)} <span className="text-xs text-muted">{playerTeam(players, line.playerId)}</span>
        </div>
        <div className="truncate text-xs text-muted">{statLine(pos, line.stats) || '-'}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="num text-sm">{fmtPts(line.points)}</div>
        <div className="num text-[11px] text-muted">{line.projected === null ? 'no proj' : fmtPts(line.projected)}</div>
      </div>
    </div>
  );
}

export default function LineupTable({ sides, slots, players }: Props) {
  const [a, b] = sides;
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="divide-y divide-line">
        {slots.map((slot, i) => (
          <div key={`${slot}-${i}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2">
            <PlayerCell line={a.starters[i]?.player ?? null} players={players} align="left" />
            <span className="w-12 text-center text-[11px] uppercase tracking-wide text-muted">{slot}</span>
            <PlayerCell line={b.starters[i]?.player ?? null} players={players} align="right" />
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-surface-2 px-4 py-2 text-sm font-semibold">
          <span className="num">{fmtPts(a.points)}</span>
          <span className="w-12 text-center text-[11px] uppercase text-muted">Total</span>
          <span className="num text-right">{fmtPts(b.points)}</span>
        </div>
      </div>
      <details className="border-t border-line px-4 py-2">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted">Bench</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">{a.bench.map((l) => <PlayerCell key={l.playerId} line={l} players={players} align="left" />)}</div>
          <div className="space-y-2">{b.bench.map((l) => <PlayerCell key={l.playerId} line={l} players={players} align="right" />)}</div>
        </div>
      </details>
    </div>
  );
}
```

`packages/web/src/components/boxscore/EfficiencyBlock.tsx`:
```tsx
import type { GameSide, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import { fmtPct, fmtPts, fmtSigned } from '../../lib/format';
import { playerName } from '../../lib/players';

interface Props { sides: [GameSide, GameSide]; managers: Record<UserId, Manager>; players: PlayerDirectory }

export default function EfficiencyBlock({ sides, managers, players }: Props) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-muted" title="Points scored divided by the best possible lineup from the full roster">
        Efficiency
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((s) => (
          <div key={s.userId}>
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{managers[s.userId]?.displayName ?? s.userId}</span>
              <span className="num text-lg">{fmtPct(s.efficiency)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, s.efficiency * 100)}%` }} />
            </div>
            <div className="num mt-1 text-xs text-muted">{fmtPts(s.points)} of {fmtPts(s.ceiling)} ceiling</div>
            {s.optimalSwaps.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Optimal lineup.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {s.optimalSwaps.map((sw) => (
                  <li key={sw.in} data-testid="swap">
                    Start <span className="font-medium">{playerName(players, sw.in)}</span>
                    {sw.out && <> over {playerName(players, sw.out)}</>}{' '}
                    <span className="num text-win">{fmtSigned(sw.gain, 2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

`packages/web/src/components/boxscore/FormBlock.tsx`:
```tsx
import type { GameSide, Manager, UserId } from '@fantasy-dash/core';
import { fmtPts, fmtSigned } from '../../lib/format';

interface Props { sides: [GameSide, GameSide]; managers: Record<UserId, Manager> }

function Row({ label, value, detail }: { label: string; value: number; detail: string }) {
  const tone = value > 0 ? 'text-win' : value < 0 ? 'text-loss' : 'text-muted';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label} <span className="num text-xs">({detail})</span></span>
      <span className={`num ${tone}`}>{fmtSigned(value)}</span>
    </div>
  );
}

export default function FormBlock({ sides, managers }: Props) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-muted" title="Points scored relative to projection and to season average">Form</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((s) => {
          const missing = s.starters.filter((e) => e.player && e.player.projected === null).length;
          return (
            <div key={s.userId} className="space-y-2 text-sm">
              <div className="font-medium">{managers[s.userId]?.displayName ?? s.userId}</div>
              <Row label="vs projection" value={s.points - s.projected} detail={`projected ${fmtPts(s.projected)}`} />
              <Row label="vs season PPG" value={s.points - s.seasonPpg} detail={`averaging ${fmtPts(s.seasonPpg)}`} />
              {missing > 0 && (
                <p className="text-xs text-muted">{missing} starter{missing > 1 ? 's' : ''} had no projection.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

`packages/web/src/pages/BoxScorePage.tsx`:
```tsx
import { Link, useLoaderData, useParams } from 'react-router';
import { h2hKey, type GameSide, type Manager, type Season } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import EfficiencyBlock from '../components/boxscore/EfficiencyBlock';
import FormBlock from '../components/boxscore/FormBlock';
import LineupTable from '../components/boxscore/LineupTable';
import { history, players } from '../data/load';
import { fmtPpg, fmtPts, fmtRecord } from '../lib/format';

function TeamHeader({ side, manager, won, played, align }: { side: GameSide; manager?: Manager; won: boolean; played: boolean; align: 'left' | 'right' }) {
  const reverse = align === 'right';
  return (
    <div className={`flex min-w-0 items-center gap-3 ${reverse ? 'flex-row-reverse text-right' : ''}`}>
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{manager?.teamName ?? manager?.displayName ?? side.userId}</div>
        <div className="num text-xs text-muted">{manager?.displayName} · {fmtRecord(side.recordBefore)} · {fmtPpg(side.seasonPpg)} ppg</div>
      </div>
      <div className={`num text-2xl ${won ? 'font-semibold' : 'text-muted'}`}>{played ? fmtPts(side.points) : fmtPts(side.projected)}</div>
    </div>
  );
}

export default function BoxScorePage() {
  const season = useLoaderData() as Season;
  const { week: weekParam, matchupId } = useParams();
  const week = season.weeks[Number(weekParam) - 1];
  const game = week?.games.find((g) => g.matchupId === Number(matchupId));
  if (!week || !game) return <p className="text-muted">No such game.</p>;

  const [a, b] = game.sides;
  const series = history.h2h[h2hKey(a.userId, b.userId)];
  const winsFor = (userId: string) => (series ? (series.a === userId ? series.aWins : series.bWins) : 0);
  const ties = series?.ties ?? 0;
  const label = [game.tag ?? `Week ${game.week}`, !week.played ? 'Upcoming' : game.winner === null ? 'Tie' : null].filter(Boolean).join(' · ');

  return (
    <article className="space-y-4">
      <nav className="text-xs text-muted">
        <Link to={`/scores/${season.year}/${game.week}`} className="hover:text-ink">&larr; {season.year} week {game.week}</Link>
      </nav>
      <header className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-3 text-xs uppercase tracking-wide text-muted">{label}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamHeader side={a} manager={season.managers[a.userId]} won={game.winner === a.userId} played={week.played} align="left" />
          <div className="hidden text-center text-xs text-muted sm:block">{week.played ? 'Final' : 'Proj'}</div>
          <TeamHeader side={b} manager={season.managers[b.userId]} won={game.winner === b.userId} played={week.played} align="right" />
        </div>
      </header>

      <LineupTable sides={game.sides} slots={season.rosterSlots} players={players} />

      {week.played && (
        <div className="grid gap-4 lg:grid-cols-2">
          <EfficiencyBlock sides={game.sides} managers={season.managers} players={players} />
          <FormBlock sides={game.sides} managers={season.managers} />
        </div>
      )}

      <footer className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <span className="text-muted">All-time series: </span>
        <span className="font-medium">{season.managers[a.userId]?.displayName}</span>{' '}
        <span className="num">{winsFor(a.userId)}</span>
        <span className="text-muted"> to </span>
        <span className="num">{winsFor(b.userId)}</span>{' '}
        <span className="font-medium">{season.managers[b.userId]?.displayName}</span>
        {ties > 0 && <span className="text-muted"> ({ties} tie{ties > 1 ? 's' : ''})</span>}
      </footer>
    </article>
  );
}
```

Modify `packages/web/src/App.tsx`: import `BoxScorePage` and add after the `scores/:season/:week` route:
```tsx
        { path: 'scores/:season/:week/:matchupId', loader: seasonLoader, element: <BoxScorePage /> },
```

- [ ] **Step 4: Run, expect pass; check in browser**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck && pnpm build
```
Expected: `17 passed`, no type errors, build succeeds.

Start `pnpm dev`. Open the 2025 week 17 Final from the scoreboard. Confirm: both managers with record and ppg under their names; 10 slot rows with position pills, stat lines, projected and actual; Bench expands; Efficiency shows percentages, a bar, and "Start X over Y" lines or "Optimal lineup."; Form shows signed numbers; footer shows the all-time series. Open a 2026 future week card and confirm it says Upcoming, shows projections, and hides the Efficiency and Form blocks. Check at a 400px wide viewport that nothing overflows horizontally except inside the lineup grid. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): box score with lineups, efficiency, form, series record

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: Weekly sync and GitHub Pages deploy

**Files:**
- Create: `.github/workflows/sync.yml`
- Modify: `README.md`

- [ ] **Step 1: Workflow**

`.github/workflows/sync.yml`:
```yaml
name: Sync and deploy

on:
  schedule:
    # Tuesdays 11:00 UTC = 06:00 EST / 07:00 EDT, after Monday night stat corrections.
    - cron: '0 11 * * 2'
  workflow_dispatch:
  push:
    branches: [main]

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: sync-deploy
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Sync Sleeper data
        if: github.event_name != 'push'
        run: pnpm sync

      - name: Test
        run: pnpm test

      - name: Commit refreshed data
        if: github.event_name != 'push'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data
          if git diff --cached --quiet; then
            echo "No data changes"
          else
            git commit -m "chore(data): sync $(date -u +%Y-%m-%d)"
            git push
          fi

      - name: Build site
        env:
          VITE_BASE: /fantasy-dash/
        run: |
          pnpm build
          cp packages/web/dist/index.html packages/web/dist/404.html

      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README**

Replace `README.md` with:
```markdown
# fantasy-dash

Dashboard for the Husky Fantasy Sleeper league. Static site, data refreshed weekly.

## Layout

- `packages/core` - Sleeper client, normalizer, stats engine, schemas (pure TypeScript)
- `packages/web` - Vite + React app
- `scripts/sync.ts` - pulls every season from Sleeper into `data/`
- `data/` - generated JSON, committed
- `docs/superpowers/specs` - design spec; `docs/superpowers/plans` - implementation plans

## Commands

```bash
pnpm install
pnpm sync          # refresh data/ from Sleeper (about 2 minutes)
pnpm sync:dry      # same, but writes to a temp dir
pnpm test          # all packages
pnpm dev           # web dev server
pnpm build         # production build to packages/web/dist
```

## Deploy

`.github/workflows/sync.yml` runs every Tuesday morning and on manual dispatch: sync, test, commit `data/`, build, deploy to GitHub Pages. One-time setup in the GitHub repo: Settings, Pages, Source = GitHub Actions.

## Config

`league.config.ts` holds the league ID, display name, and optional manager display-name overrides.
```

- [ ] **Step 3: Verify a production build with the Pages base path**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && VITE_BASE=/fantasy-dash/ pnpm build && grep -c '/fantasy-dash/assets/' packages/web/dist/index.html && pnpm test
```
Expected: build succeeds, grep prints `1` or more, all tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add -A && git commit -m "ci: weekly Sleeper sync and GitHub Pages deploy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push -u origin main
```

Then, in the GitHub repo settings, set Pages Source to "GitHub Actions" (one-time, manual). Trigger the workflow from the Actions tab with "Run workflow" and confirm the site loads at `https://mfoster58.github.io/fantasy-dash/`. Deep links such as `/fantasy-dash/standings/2025` must load thanks to the `404.html` copy.

---

## Phase 1 exit criteria

- `pnpm test` passes in both packages, including the real-data oracle.
- `pnpm sync` regenerates `data/` deterministically from Sleeper.
- The deployed site serves `/`, `/scores/:season/:week`, `/scores/:season/:week/:matchupId`, and `/standings/:season` for 2023 to 2026.
- Weekly sync action runs green.

Phases 2 to 4 (Head-to-Head and All-Time, League History, Draft Analysis) get their own plans after this one ships.
