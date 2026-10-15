# Player Stats v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Season pickers on three Player stats sections, per-game modes on volume boards, best and worst postseason single-week starts, and an expanded Extras section fed by two new per-season data sets (league transactions, NFL-wide player season totals).

**Architecture:** Core gains `transactionsOf` and `playerSeasonsOf`, both pure, wired into `buildSeason` and the zod schema; the sync keeps every completed transaction and the data is re-synced. On the web, `lib/playerBoards.ts` is split into `lib/boards/{shared,leaders,career,postseason,extras}.ts`; `BoardContext` carries a nullable `year` plus the new data, and every section narrows lines by season before boards run. `Board` and `Section` gain a second mode toggle, direction labels, value tone and a computed empty message.

**Tech Stack:** TypeScript, pnpm workspace, Vitest + Testing Library, React 18, react-router v7, Tailwind v4, zod. Sync via `tsx scripts/sync.ts` against the public Sleeper API.

**Spec:** `docs/superpowers/specs/2026-10-15-player-stats-v3-design.md`

## Global Constraints

- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work in a worktree under `.claude/worktrees/<name>`; the main checkout is shared with another session. No compound git commands; no `git stash`.
- Signed values use `fmtSigned(v, digits)` (hyphen-minus); points `fmtPts` (2 dp); per-game `fmtPpg` (1 dp).
- Per-game minimum games: 3 when a season is chosen, 12 under All-time (`minGames(ctx)`); postseason PPG keeps 3.
- Row cap stays `MAX_ROWS = 25`; tie order stays value → secondary → newest year/week → playerId asc.
- Copy: sentence case, no trailing periods on labels, board definitions are full sentences.
- Kickers and defenses are excluded from Loyalty, Ironman, Mr. Irrelevant, Breakout and Fall-off (`KICKING_DEF`).
- Tests run from the package dir: `cd packages/core && npx vitest run <file>` / `cd packages/web && npx vitest run <file>`; the whole suite is `pnpm test` at the root; build is `pnpm build`.

## Review Focus

1. A waiver claim whose player is dropped in the same week it was claimed: the window is empty and the row must not appear (Task 9 test "claim dropped the same week").
2. A season chosen on Extras while the previous season has no `playerSeasons` (2023 is the first): Breakout and Fall-off must be empty, not crash (Task 10 test "first season has no pair").
3. Ironman across the season boundary when the player sat on no roster in week 1 of the next season: the run must end at the last week of the prior season and not report `active` (Task 8 test "ends at a missing week across seasons").
4. `?careerSeason=all` on the Career section and `?season=all` on leaders: both must be honoured and omitted from the URL only when they equal the section default (Task 4 test "writes and reads All-time per section").
5. A draft whose last positional pick's player has no `playerSeasons` entry (zero games): Mr. Irrelevant shows 0.00 points with `—` for the finish rather than dropping the season (Task 10 test "last pick with no games").

---

### Task 1: Core transactions

**Files:**
- Create: `packages/core/src/transactions.ts`, `packages/core/test/transactions.test.ts`
- Modify: `packages/core/src/types.ts` (append), `packages/core/src/sleeper/types.ts:90-102`, `packages/core/src/schema.ts` (Season), `packages/core/src/season.ts:14-36,150-163,165-181`, `packages/core/src/index.ts`, `packages/core/test/fixtures/mini.ts:98`, `packages/core/test/oracle.test.ts:15`, `packages/core/test/draft.test.ts:207`, `scripts/sync.ts:80,107,125,127`

**Interfaces:**
- Produces: `Transaction`, `TransactionMove`, `TransactionType` in `@fantasy-dash/core`; `transactionsOf(raw: SleeperTransaction[], rosterToUser: Record<number, UserId>): Transaction[]`; `Season.transactions: Transaction[]`; `RawSeasonInput.transactions: SleeperTransaction[]` (replaces `trades`).

- [ ] **Step 1: Write the failing test**

`packages/core/test/transactions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { transactionsOf } from '../src/transactions';
import type { SleeperTransaction } from '../src/sleeper/types';

const tx = (over: Partial<SleeperTransaction>): SleeperTransaction => ({
  transaction_id: 't', type: 'trade', status: 'complete', leg: 3, created: 100, adds: null, drops: null, roster_ids: [], settings: null, ...over,
});
const users = { 1: 'ua', 2: 'ub' };

describe('transactionsOf', () => {
  it('keeps completed transactions, resolves rosters, carries the FAAB bid, sorts by time', () => {
    const out = transactionsOf([
      tx({ transaction_id: 'w1', type: 'waiver', leg: 4, created: 400, adds: { p3: 1 }, drops: { p9: 1 }, settings: { waiver_bid: 12, seq: 1 } }),
      tx({ transaction_id: 't1', adds: { p1: 2, p2: 1 }, drops: { p1: 1, p2: 2 }, roster_ids: [1, 2] }),
      tx({ transaction_id: 'f1', type: 'free_agent', leg: 5, created: 500, adds: { p4: 2 } }),
      tx({ transaction_id: 'c1', type: 'commissioner', leg: 5, created: 500, drops: { p5: 1 } }),
      tx({ transaction_id: 'x1', type: 'weird', leg: 6, created: 600, adds: { p6: 1 } }),
    ], users);
    expect(out).toEqual([
      { id: 't1', type: 'trade', week: 3, created: 100, adds: [{ playerId: 'p1', userId: 'ub' }, { playerId: 'p2', userId: 'ua' }], drops: [{ playerId: 'p1', userId: 'ua' }, { playerId: 'p2', userId: 'ub' }], bid: null },
      { id: 'w1', type: 'waiver', week: 4, created: 400, adds: [{ playerId: 'p3', userId: 'ua' }], drops: [{ playerId: 'p9', userId: 'ua' }], bid: 12 },
      { id: 'c1', type: 'commissioner', week: 5, created: 500, adds: [], drops: [{ playerId: 'p5', userId: 'ua' }], bid: null },
      { id: 'f1', type: 'free_agent', week: 5, created: 500, adds: [{ playerId: 'p4', userId: 'ub' }], drops: [], bid: null },
      { id: 'x1', type: 'commissioner', week: 6, created: 600, adds: [{ playerId: 'p6', userId: 'ua' }], drops: [], bid: null },
    ]);
  });
  it('drops failed transactions, unknown rosters, and transactions left empty', () => {
    const out = transactionsOf([
      tx({ transaction_id: 'bad', status: 'failed', adds: { p1: 1 } }),
      tx({ transaction_id: 'ghost', type: 'waiver', adds: { p2: 9 }, settings: { waiver_bid: 3 } }),
      tx({ transaction_id: 'half', adds: { p3: 9, p4: 1 } }),
    ], users);
    expect(out).toEqual([{ id: 'half', type: 'trade', week: 3, created: 100, adds: [{ playerId: 'p4', userId: 'ua' }], drops: [], bid: null }]);
  });
  it('treats a waiver with no bid as bid 0', () => {
    expect(transactionsOf([tx({ type: 'waiver', adds: { p1: 1 } })], users)[0].bid).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run test/transactions.test.ts`
Expected: FAIL, cannot find module `../src/transactions`.

- [ ] **Step 3: Add the types**

Append to `packages/core/src/types.ts`:

```ts
export type TransactionType = 'trade' | 'waiver' | 'free_agent' | 'commissioner';
export interface TransactionMove { playerId: PlayerId; userId: UserId }
/** One completed league transaction, rosters resolved to managers. */
export interface Transaction {
  id: string;
  /** any Sleeper type outside trade / waiver / free_agent is kept as 'commissioner' */
  type: TransactionType;
  /** Sleeper `leg`: the week the move applied to */
  week: number;
  /** epoch ms */
  created: number;
  adds: TransactionMove[];
  drops: TransactionMove[];
  /** FAAB dollars for a waiver claim (0 when the claim carried no bid); null for every other type */
  bid: number | null;
}
```

Add `transactions: Transaction[];` to the `Season` interface, after `draft: Draft | null;`.

In `packages/core/src/sleeper/types.ts`, add to `SleeperTransaction` after `roster_ids`:

```ts
  /** waiver claims carry the FAAB bid here */
  settings: { waiver_bid?: number; seq?: number } | null;
```

- [ ] **Step 4: Write the builder**

`packages/core/src/transactions.ts`:

```ts
import type { Transaction, TransactionMove, TransactionType, UserId } from './types';
import type { SleeperTransaction } from './sleeper/types';

const KNOWN: ReadonlySet<string> = new Set(['trade', 'waiver', 'free_agent']);

const typeOf = (t: string): TransactionType => (KNOWN.has(t) ? (t as TransactionType) : 'commissioner');

function moves(map: Record<string, number> | null, rosterToUser: Record<number, UserId>): TransactionMove[] {
  if (!map) return [];
  const out: TransactionMove[] = [];
  for (const [playerId, rosterId] of Object.entries(map)) {
    const userId = rosterToUser[rosterId];
    if (userId) out.push({ playerId, userId });
  }
  return out;
}

/** Completed transactions with rosters resolved to managers, oldest first (ties by id). Moves to unknown rosters are dropped; a transaction left with no moves is dropped. */
export function transactionsOf(raw: SleeperTransaction[], rosterToUser: Record<number, UserId>): Transaction[] {
  const out: Transaction[] = [];
  for (const t of raw) {
    if (t.status !== 'complete') continue;
    const adds = moves(t.adds, rosterToUser);
    const drops = moves(t.drops, rosterToUser);
    if (adds.length === 0 && drops.length === 0) continue;
    const type = typeOf(t.type);
    out.push({ id: t.transaction_id, type, week: t.leg, created: t.created, adds, drops, bid: type === 'waiver' ? t.settings?.waiver_bid ?? 0 : null });
  }
  return out.sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
```

Add `export * from './transactions';` to `packages/core/src/index.ts` after the `draft` line.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && npx vitest run test/transactions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire into the season, schema, fixtures and sync**

`packages/core/src/season.ts`: replace the `trades` field of `RawSeasonInput` with

```ts
  /** every transaction for weeks 1..maxWeek, any status; builders filter */
  transactions: SleeperTransaction[];
```

Import `transactionsOf` from `./transactions`. In `buildSeason`, change `trades: tradesFromTransactions(input.trades, rosterToUser)` to `trades: tradesFromTransactions(input.transactions, rosterToUser)`, and add `transactions: transactionsOf(input.transactions, rosterToUser),` to the returned object after `draft`.

`packages/core/src/schema.ts`: before `SeasonSchema` add

```ts
const TransactionMove = z.object({ playerId: z.string(), userId: z.string() });
const Transaction = z.object({
  id: z.string(),
  type: z.enum(['trade', 'waiver', 'free_agent', 'commissioner']),
  week: z.number(),
  created: z.number(),
  adds: z.array(TransactionMove),
  drops: z.array(TransactionMove),
  bid: z.number().nullable(),
});
```

and `transactions: z.array(Transaction),` after `draft: Draft.nullable(),` in `SeasonSchema`.

Fixtures: in `packages/core/test/fixtures/mini.ts:98` change `trades: []` to `transactions: []`; in `packages/core/test/oracle.test.ts:15` likewise; in `packages/core/test/draft.test.ts:207` add `settings: null` to the `tx` helper's defaults.

`scripts/sync.ts`: rename `const trades: SleeperTransaction[] = [];` to `const transactions: SleeperTransaction[] = [];`; replace line 107 with `for (const t of tx ?? []) transactions.push(t);`; in the `input` object replace `trades` with `transactions`; change the log line to `${transactions.length} transactions`.

Add a schema test to `packages/core/test/transactions.test.ts`:

```ts
import { buildSeason } from '../src/season';
import { SeasonSchema } from '../src/schema';
import { miniInput } from './fixtures/mini';

describe('season transactions', () => {
  it('are built from the raw input and validate', () => {
    const input = miniInput();
    input.transactions = [tx({ transaction_id: 'w', type: 'waiver', leg: 2, created: 5, adds: { q1: 1 }, drops: { q4: 1 }, settings: { waiver_bid: 7 } })];
    const season = buildSeason(input);
    expect(season.transactions).toEqual([{ id: 'w', type: 'waiver', week: 2, created: 5, adds: [{ playerId: 'q1', userId: 'ua' }], drops: [{ playerId: 'q4', userId: 'ua' }], bid: 7 }]);
    expect(() => SeasonSchema.parse(season)).not.toThrow();
    expect(() => SeasonSchema.parse({ ...season, transactions: [{ id: 1 }] })).toThrow();
  });
});
```

(Confirm in `mini.ts` that roster 1 belongs to `ua`; the existing season test asserts `rosterId: 1` for `ua`.)

- [ ] **Step 7: Run the core suite and type-check**

Run: `cd packages/core && npx vitest run && npx tsc --noEmit -p .`
Expected: all pass; no type errors. If `tsc` flags `scripts/sync.ts` via the root config, run `npx tsc --noEmit -p ../../tsconfig.json` or `pnpm build` at the root; expected clean.

- [ ] **Step 8: Commit**

```bash
git add packages/core scripts/sync.ts
git commit -m "feat(core): keep every completed league transaction on the season" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Core player season totals

**Files:**
- Create: `packages/core/src/playerSeasons.ts`, `packages/core/test/playerSeasons.test.ts`
- Modify: `packages/core/src/types.ts`, `packages/core/src/schema.ts`, `packages/core/src/season.ts`, `packages/core/src/index.ts`, `scripts/sync.ts:181-182`

**Interfaces:**
- Produces: `PlayerSeasonLine { points: number; games: number; posRank: number | null }`; `playerSeasonsOf(points, games, players): Record<PlayerId, PlayerSeasonLine>`; `trimPlayerSeasons(season: Season, keep: Set<PlayerId>): Season`; `Season.playerSeasons`.

- [ ] **Step 1: Write the failing test**

`packages/core/test/playerSeasons.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { playerSeasonsOf, trimPlayerSeasons } from '../src/playerSeasons';
import { buildSeason } from '../src/season';
import { SeasonSchema } from '../src/schema';
import { miniInput } from './fixtures/mini';
import type { PlayerDirectory } from '../src/types';

const dir: PlayerDirectory = {
  a: { id: 'a', name: 'A', firstName: 'A', lastName: '', position: 'WR', team: 'KC', yearsExp: 1 },
  b: { id: 'b', name: 'B', firstName: 'B', lastName: '', position: 'WR', team: 'KC', yearsExp: 1 },
  c: { id: 'c', name: 'C', firstName: 'C', lastName: '', position: 'WR', team: 'KC', yearsExp: 1 },
  q: { id: 'q', name: 'Q', firstName: 'Q', lastName: '', position: 'QB', team: 'KC', yearsExp: 1 },
  u: { id: 'u', name: 'U', firstName: 'U', lastName: '', position: null, team: null, yearsExp: null },
};

describe('playerSeasonsOf', () => {
  it('ranks within position by points, ties by id, and skips players with no games', () => {
    const out = playerSeasonsOf({ a: 50, b: 80, c: 50, q: 300, u: 10, z: 99 }, { a: 10, b: 12, c: 9, q: 17, u: 3 }, dir);
    expect(out).toEqual({
      a: { points: 50, games: 10, posRank: 2 },
      b: { points: 80, games: 12, posRank: 1 },
      c: { points: 50, games: 9, posRank: 3 },
      q: { points: 300, games: 17, posRank: 1 },
      u: { points: 10, games: 3, posRank: null },
    });
  });
  it('keeps a player with games but zero points', () => {
    expect(playerSeasonsOf({}, { a: 2 }, dir)).toEqual({ a: { points: 0, games: 2, posRank: 1 } });
  });
});

describe('season playerSeasons', () => {
  it('are built from the raw input, validate, and trim to a kept set', () => {
    const input = miniInput();
    input.playerGames = { q1: 3, q3: 3 };
    const season = buildSeason(input);
    expect(season.playerSeasons.q3).toEqual({ points: 90, games: 3, posRank: 1 });
    expect(season.playerSeasons.q1).toEqual({ points: 80, games: 3, posRank: 2 });
    expect(season.playerSeasons.r1).toBeUndefined(); // no games recorded
    expect(() => SeasonSchema.parse(season)).not.toThrow();
    const trimmed = trimPlayerSeasons(season, new Set(['q1']));
    expect(Object.keys(trimmed.playerSeasons)).toEqual(['q1']);
    expect(trimmed.playerSeasons.q1.posRank).toBe(2); // rank was computed before the trim
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run test/playerSeasons.test.ts`
Expected: FAIL, cannot find module `../src/playerSeasons`.

- [ ] **Step 3: Implement**

Append to `packages/core/src/types.ts`:

```ts
/** NFL-wide season totals under league scoring for one player. */
export interface PlayerSeasonLine {
  /** weeks 1..lastScoredWeek */
  points: number;
  /** scored weeks with gp >= 1 */
  games: number;
  /** rank among players at the same position by points (ties by id); null for an unknown position */
  posRank: number | null;
}
```

Add `playerSeasons: Record<PlayerId, PlayerSeasonLine>;` to `Season` after `transactions`.

`packages/core/src/playerSeasons.ts`:

```ts
import type { PlayerDirectory, PlayerId, PlayerSeasonLine, Season } from './types';
import { round2 } from './scoring';

/** Every player with at least one game, ranked within their position by points desc, id asc. */
export function playerSeasonsOf(points: Record<PlayerId, number>, games: Record<PlayerId, number>, players: PlayerDirectory): Record<PlayerId, PlayerSeasonLine> {
  const out: Record<PlayerId, PlayerSeasonLine> = {};
  const byPos = new Map<string, PlayerId[]>();
  for (const [id, g] of Object.entries(games)) {
    if (g < 1) continue;
    out[id] = { points: round2(points[id] ?? 0), games: g, posRank: null };
    const pos = players[id]?.position ?? null;
    if (pos) byPos.set(pos, [...(byPos.get(pos) ?? []), id]);
  }
  for (const ids of byPos.values()) {
    ids.sort((a, b) => out[b].points - out[a].points || (a < b ? -1 : a > b ? 1 : 0));
    ids.forEach((id, i) => { out[id].posRank = i + 1; });
  }
  return out;
}

/** Keep only the listed players; ranks are untouched. */
export function trimPlayerSeasons(season: Season, keep: Set<PlayerId>): Season {
  const playerSeasons: Record<PlayerId, PlayerSeasonLine> = {};
  for (const [id, line] of Object.entries(season.playerSeasons)) if (keep.has(id)) playerSeasons[id] = line;
  return { ...season, playerSeasons };
}
```

`packages/core/src/season.ts`: import `playerSeasonsOf` and add `playerSeasons: playerSeasonsOf(input.playerSeasonPoints, input.playerGames, players),` to the returned object after `transactions`.

`packages/core/src/schema.ts`: add before `SeasonSchema`

```ts
const PlayerSeasonLine = z.object({ points: z.number(), games: z.number(), posRank: z.number().nullable() });
```

and `playerSeasons: z.record(PlayerSeasonLine),` after `transactions`.

`packages/core/src/index.ts`: `export * from './playerSeasons';`.

`scripts/sync.ts`: import `trimPlayerSeasons` from core; after `const players = trimPlayers(fullPlayers, collectPlayerIds(seasons));` add

```ts
  const kept = new Set(Object.keys(players));
  for (let i = 0; i < seasons.length; i++) seasons[i] = trimPlayerSeasons(seasons[i], kept);
```

- [ ] **Step 4: Run tests and type-check**

Run: `cd packages/core && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core scripts/sync.ts
git commit -m "feat(core): NFL-wide player season totals with positional rank on the season" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Re-sync data and update web fixtures

**Files:**
- Modify: `data/seasons/*.json`, `data/players.json`, `data/history.json` (regenerated), `packages/web/src/test/playerFixtures.ts:26-31`

- [ ] **Step 1: Dry run**

Run: `pnpm sync -- --dry-run 2>&1 | tail -8`
Expected: `[sync] Validated 4 seasons and N players`, `Dry run complete. Output in /tmp/...`. If any week logs a missing stats/projections warning, note it; it is pre-existing behaviour.

- [ ] **Step 2: Real sync**

Run: `pnpm sync 2>&1 | tail -3 && git status --short data | head`
Expected: `[sync] Wrote .../data`; the four season files and `players.json` modified.

- [ ] **Step 3: Probe the new data**

Run:

```bash
node -e "for (const y of [2023,2024,2025,2026]) { const s=require('./data/seasons/'+y+'.json'); const w=s.transactions.filter(t=>t.type==='waiver'); console.log(y, s.transactions.length, 'tx', w.length, 'waivers, max bid', Math.max(0,...w.map(t=>t.bid)), Object.keys(s.playerSeasons).length, 'playerSeasons') }"
```

Expected: each season reports dozens to a few hundred transactions, waivers with bids up to roughly 100, and a few hundred playerSeasons. 2026 may have fewer.

- [ ] **Step 4: Update the web fixture**

In `packages/web/src/test/playerFixtures.ts`, in `season()` add `transactions: [], playerSeasons: {},` after `draft: null,`.

- [ ] **Step 5: Run everything**

Run: `pnpm test 2>&1 | grep -E "Tests |FAIL" && pnpm build 2>&1 | grep -E "error|built in"`
Expected: core and web suites pass; build green.

- [ ] **Step 6: Commit**

```bash
git add data packages/web/src/test/playerFixtures.ts
git commit -m "data: re-sync with transactions and player season totals" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Board context by season, file split, Career rename, section pickers

**Files:**
- Create: `packages/web/src/lib/boards/shared.ts`, `leaders.ts`, `career.ts`, `postseason.ts`, `extras.ts`
- Modify: `packages/web/src/lib/playerBoards.ts` (becomes registry + re-exports), `packages/web/src/lib/playerBoards.test.ts`, `packages/web/src/components/SeasonPicker.tsx`, `packages/web/src/components/players/PlayersView.tsx`, `PlayersView.test.tsx`, `Section.tsx`, `Section.test.tsx`

**Interfaces:**
- Produces: `BoardContext` (spec shape, with `year: number | null`, `currentYear`, `transactions: SeasonTransactions[]`, `playerSeasons: Record<number, Record<PlayerId, PlayerSeasonLine>>`, `drafts: Record<number, Draft | null>`); `DraftValue { year, playerId, value, round, pickNo }`; `Section = 'leaders' | 'career' | 'postseason' | 'extras'`; helpers in `shared.ts`: `minGames(ctx)`, `metaOf(ctx)`, `inYear(ctx, year)`, `rank`, `groupBy`, `momentBoard(lines, value, label, direction?)`, `careerBoard(lines, value, label, detail, meta?, secondary?)`, `leaderBoard(ctx, build, label, direction?)`, `pointsBoard`, `plural`, `parts`, `yearsOf`, `seasonsOf`, `sum`, `started`, `skillOnly`, `matchesPos`, `KICKING_DEF`, `round1`, `round2`, `intLabel`, `fmt1`, `when`, `boxScore`, `pointsModes(min)`, `TOUCH_MODES`.
- `SeasonPicker` props: `{ years: number[]; value: number | 'all'; onChange: (v: number | 'all') => void; allTime?: boolean }`.

- [ ] **Step 1: Split the library (no behaviour change)**

Move the contents of `packages/web/src/lib/playerBoards.ts` into:

- `lib/boards/shared.ts`: imports, `Section` type (now `'leaders' | 'career' | 'postseason' | 'extras'`), `Direction`, `BoardRow`, `DraftValue`, `BoardMode`, `BoardContext`, `BoardDef`, `MAX_ROWS`, the `MIN_*` constants, `pointsModes`, `TOUCH_MODES`, `championsOf`, `lastPlacesOf`, `draftValuesOf`, and every helper from `when` through `pointsBoard`. Export all of them (`export const`/`export function`).
- `lib/boards/career.ts`: `bestWeek`, `bestSeason`, `careerPoints`, `weeksStarted`, `benchBlunder`.
- `lib/boards/postseason.ts`: `postseasonStarted`, `postPoints` … `postToiletBowl`, `rosterSeasons`, `championshipRosters`, `lastPlaceRosters`.
- `lib/boards/extras.ts`: `boomStarts`, `dudStarts`, `journeyman`, `draftValue`.
- `lib/boards/leaders.ts`: `LeaderItem`, `leaderBoard`, `positive`, `leadPoints` … `leadXfp`, `modelled`.
- `lib/playerBoards.ts`: `export * from './boards/shared'; export * from './boards/leaders'; export * from './boards/career'; export * from './boards/postseason'; export * from './boards/extras';` plus the `BOARDS` array, with every `section: 'allTime'` changed to `section: 'career'`.

Each board file imports what it needs from `./shared`. Keep `leaderBoard` in `leaders.ts` and export it (Extras boards in later tasks use it).

- [ ] **Step 2: Run the existing tests**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts src/components/players`
Expected: the registry test fails on `ids('allTime')` only. Update that line to `ids('career')` and re-run; expected PASS.

- [ ] **Step 3: Commit the split**

```bash
git add packages/web/src/lib
git commit -m "refactor(web): split player boards by section" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 4: Write the failing lib tests for the new context**

Append to `packages/web/src/lib/playerBoards.test.ts` (the `ctx` at the top of the file gains `year: null, transactions: [], playerSeasons: {}, drafts: {}`; keep `currentYear: 2025`):

```ts
describe('season-aware context', () => {
  it('leaders rank whatever lines they are given and label rows by the chosen year or by seasons', () => {
    const all = { ...ctx, year: null };
    // q1: 40+25+31 (2024, a) + 35+18+50 (2025, b) = 199 ; latest manager b
    expect(leadPoints(all)[0]).toMatchObject({ playerId: 'q1', value: 199, meta: '2 seasons', userId: 'b' });
    const one = { ...ctx, year: 2024, lines: ctx.lines.filter((l) => l.year === 2024) };
    expect(leadPoints(one)[0]).toMatchObject({ playerId: 'q1', value: 96, meta: '2024', userId: 'a' });
  });
  it('per-game minimum is 3 for a season and 12 for all-time', () => {
    expect(minGames({ ...ctx, year: 2025 })).toBe(3);
    expect(minGames({ ...ctx, year: null })).toBe(12);
    expect(leadPoints({ ...ctx, year: 2025, lines: ctx.lines.filter((l) => l.year === 2025) }, 'desc', 'ppg').map((r) => r.playerId)).toEqual(['q1', 'r1']);
    expect(leadPoints({ ...ctx, year: null }, 'desc', 'ppg')).toEqual([]);
    expect(careerPoints({ ...ctx, year: 2024, lines: ctx.lines.filter((l) => l.year === 2024) }, 'desc', 'ppg').map((r) => [r.playerId, r.value])).toEqual([['q1', 32], ['r1', 13]]);
  });
  it('draft values carry the slot', () => {
    const d = { ...season(2024, []), draft: { draftId: 'd', type: 'snake', rounds: 1, slotOrder: [], expectedCurve: null, baselines: {}, picks: [{
      round: 2, pickNo: 15, slot: 3, userId: 'a', playerId: 'q1', isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null,
      healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: 4.5, tradedTo: null }] } };
    expect(draftValuesOf([d])).toEqual([{ year: 2024, playerId: 'q1', value: 4.5, round: 2, pickNo: 15 }]);
  });
});
```

Add `minGames` to the import list. Expected failures: `minGames` missing, `meta` mismatch, the leaders All-time value (today `leaderBoard` filters by `currentYear`).

- [ ] **Step 5: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: FAIL on the three new tests (import error first; fix by adding the export stub only after writing the implementation in Step 6).

- [ ] **Step 6: Implement the context changes in `shared.ts` and `leaders.ts`**

In `shared.ts`:

```ts
import type { Draft, PlayerDirectory, PlayerId, PlayerSeasonLine, Season, Transaction, UserId } from '@fantasy-dash/core';

export interface DraftValue { year: number; playerId: PlayerId; value: number; round: number; pickNo: number }
export interface SeasonTransactions { year: number; transactions: Transaction[] }

export interface BoardContext {
  /** already narrowed to the section's position and season */
  lines: PlayerLine[];
  players: PlayerDirectory;
  champions: Record<number, UserId | null>;
  lastPlaces: Record<number, UserId | null>;
  /** chosen season, or null for All-time */
  year: number | null;
  /** newest season in the data */
  currentYear: number;
  pos: PosFilter;
  /** every season; boards narrow with inYear */
  picks: DraftValue[];
  xfp: XfpModel | null;
  transactions: SeasonTransactions[];
  playerSeasons: Record<number, Record<PlayerId, PlayerSeasonLine>>;
  drafts: Record<number, Draft | null>;
}

export const MIN_SEASON_GAMES = 3;
export const MIN_ALLTIME_GAMES = 12;
/** played games needed before a per-game reading ranks a player */
export const minGames = (ctx: BoardContext): number => (ctx.year === null ? MIN_ALLTIME_GAMES : MIN_SEASON_GAMES);
export const inYear = (ctx: BoardContext, year: number): boolean => ctx.year === null || year === ctx.year;
/** "2025" when a season is chosen, else "N seasons" */
export const metaOf = (ctx: BoardContext) => (ls: PlayerLine[]): string => (ctx.year === null ? seasonsOf(ls) : String(ctx.year));
```

`draftValuesOf` pushes `{ year: s.year, playerId: p.playerId, value: p.value, round: p.round, pickNo: p.pickNo }`.

`pointsModes(min)` stays, but `careerPoints` and `leadPoints` now take the minimum from `minGames(ctx)`; `pointsBoard(lines, mode, minGames, meta)` is unchanged. In `career.ts`:

```ts
export const careerPoints = (ctx: BoardContext, _direction?: Direction, mode?: string): BoardRow[] => pointsBoard(started(ctx), mode, minGames(ctx), metaOf(ctx));
export const weeksStarted = (ctx: BoardContext): BoardRow[] => careerBoard(started(ctx), (ls) => ls.length, String, (ls) => plural(ls.length, 'start'), metaOf(ctx));
```

In `leaders.ts`, `leaderBoard` drops the `currentYear` filter and uses `metaOf(ctx)`:

```ts
export function leaderBoard(ctx: BoardContext, build: (ls: PlayerLine[]) => LeaderItem | null, label: (v: number) => string, direction: Direction = 'desc'): BoardRow[] {
  const items: { playerId: string; value: number; detail: string | null; userId: UserId; latestYear: number; latestWeek: number; lines: PlayerLine[] }[] = [];
  for (const [playerId, g] of groupBy(ctx.lines, (l) => l.playerId)) {
    const built = build(g.lines);
    if (!built) continue;
    const latest = g.lines.reduce((a, b) => (b.year > a.year || (b.year === a.year && b.week > a.week) ? b : a));
    items.push({ playerId, value: built.value, detail: built.detail, userId: latest.userId, latestYear: g.latestYear, latestWeek: g.latestWeek, lines: g.lines });
  }
  const meta = metaOf(ctx);
  return rank(items, direction).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value), meta: meta(i.lines), detail: i.detail, userId: i.userId, to: null }));
}
```

`leadPoints` ppg branch: `if (played.length < minGames(ctx)) return null;`. `leadFpoe` and `leadXfp`: `if (m.length < minGames(ctx)) return null;`.

In `extras.ts`, `journeyman`, `boomStarts`, `dudStarts` pass `metaOf(ctx)` as the meta argument.

In the `BOARDS` registry, every `pointsModes(MIN_LEADER_GAMES)` / `pointsModes(MIN_PPG_GAMES)` becomes `pointsModes()` with the empty copy computed later (Task 5 replaces `BoardMode.empty` with `BoardDef.empty`). For now change `pointsModes` to take no argument and drop its `empty` string; the Board test "uses the mode empty message" and the PlayersView PPG test are adjusted in Task 5. Temporarily set those two expectations to `'No players at this position.'` so the suite stays green at this commit.

- [ ] **Step 7: Run the lib tests**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the failing component tests**

`SeasonPicker` has no test file; add `packages/web/src/components/SeasonPicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import SeasonPicker from './SeasonPicker';

describe('SeasonPicker', () => {
  it('lists years newest first and reports a number', () => {
    const onChange = vi.fn();
    render(<SeasonPicker years={[2024, 2025]} value={2025} onChange={onChange} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['2025', '2024']);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } });
    expect(onChange).toHaveBeenCalledWith(2024);
  });
  it('offers All-time first when asked and reports it as "all"', () => {
    const onChange = vi.fn();
    render(<SeasonPicker years={[2024, 2025]} value="all" onChange={onChange} allTime />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['All-time', '2025', '2024']);
    expect(screen.getByRole('combobox')).toHaveValue('all');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2025' } });
    expect(onChange).toHaveBeenCalledWith(2025);
  });
});
```

In `PlayersView.test.tsx` replace the "renders the four sections" heading list to use `'Career'` instead of `'All-time'`, and every `region('All-time')` with `region('Career')`, `?all=RB` with `?career=RB`, and `all=` with `career=`. Add:

```tsx
  it('writes and reads All-time per section', () => {
    mount('/players?season=all&extrasSeason=2024');
    const pickers = screen.getAllByRole('combobox');
    expect(pickers).toHaveLength(3); // leaders, career, extras
    expect(pickers[0]).toHaveValue('all');
    expect(pickers[1]).toHaveValue('all'); // career default
    expect(pickers[2]).toHaveValue('2024');
    expect(firstRow('Most points')).toHaveTextContent('2 seasons'); // q1 across both seasons
    fireEvent.change(pickers[1], { target: { value: '2024' } });
    expect(screen.getByTestId('loc').textContent).toContain('careerSeason=2024');
    expect(firstRow('Best week by a starter')).toHaveTextContent('2024 · Wk 1');
    fireEvent.change(pickers[0], { target: { value: '2025' } });
    expect(screen.getByTestId('loc').textContent).not.toContain('season=all');
    fireEvent.change(pickers[2], { target: { value: 'all' } });
    expect(screen.getByTestId('loc').textContent).not.toContain('extrasSeason');
  });
  it('shows the season note per section', () => {
    mount('/players?careerSeason=2025');
    expect(within(region('Career')).getByText('2025 season')).toBeInTheDocument();
    expect(within(region('Extras')).getByText('Every season')).toBeInTheDocument();
  });
```

The existing "switches the leaders season from the picker" test uses `screen.getByRole('combobox')`; change it to `screen.getAllByRole('combobox')[0]`. The "falls back for junk parameters" test: `expect(screen.getAllByRole('combobox')[0]).toHaveValue('2025')`.

In `Section.test.tsx` the `ctx` literal gains `year: null, transactions: [], playerSeasons: {}, drafts: {}`; the seasonPicker test passes `seasonPicker={{ years: [2024, 2025], value: 2025, onChange, allTime: true }}` and additionally asserts `expect(screen.getByRole('option', { name: 'All-time' })).toBeInTheDocument()`.

- [ ] **Step 9: Run to verify failure**

Run: `cd packages/web && npx vitest run src/components`
Expected: FAIL on the new SeasonPicker All-time test and the new PlayersView tests (three comboboxes expected, one found).

- [ ] **Step 10: Implement SeasonPicker, Section note, PlayersView**

`SeasonPicker.tsx`:

```tsx
interface Props { years: number[]; value: number | 'all'; onChange: (v: number | 'all') => void; allTime?: boolean }

export default function SeasonPicker({ years, value, onChange, allTime = false }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Season
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        className="num rounded border border-line bg-surface px-2 py-1 text-ink"
      >
        {allTime && <option value="all">All-time</option>}
        {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}
```

`Section.tsx`: `seasonPicker?: { years: number[]; value: number | 'all'; onChange: (v: number | 'all') => void; allTime?: boolean }`; pass `allTime` through. The `note` prop is now computed by the caller (see below), so Section is otherwise unchanged.

`PlayersView.tsx`:

```tsx
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import { BOARDS, championsOf, draftValuesOf, lastPlacesOf, type BoardContext, type Section as SectionId } from '../../lib/playerBoards';
import { filterLines, flattenLines, isPosFilter, type PosFilter } from '../../lib/playerLines';
import { fitXfp } from '../../lib/xfp';
import Section from './Section';

interface Props { seasons: Season[]; players: PlayerDirectory; managers: History['managers']; years: number[]; currentYear: number; lastScoredWeek: number }

type SeasonPick = number | 'all';
const SECTIONS: { id: SectionId; param: string; seasonParam: string | null; defaultSeason: 'current' | 'all' | null; title: string; note: string | null; columns: 2 | 3 }[] = [
  { id: 'leaders', param: 'lead', seasonParam: 'season', defaultSeason: 'current', title: 'League leaders', note: null, columns: 3 },
  { id: 'career', param: 'career', seasonParam: 'careerSeason', defaultSeason: 'all', title: 'Career', note: null, columns: 2 },
  { id: 'postseason', param: 'post', seasonParam: null, defaultSeason: null, title: 'Postseason', note: 'Championship bracket unless the board says otherwise', columns: 2 },
  { id: 'extras', param: 'extra', seasonParam: 'extrasSeason', defaultSeason: 'all', title: 'Extras', note: null, columns: 2 },
];

export default function PlayersView({ seasons, players, managers, years, currentYear, lastScoredWeek }: Props) {
  const [params, setParams] = useSearchParams();
  const update = (mutate: (next: URLSearchParams) => void) => { const next = new URLSearchParams(params); mutate(next); setParams(next, { replace: true }); };
  const posOf = (param: string): PosFilter => { const raw = params.get(param); return isPosFilter(raw) ? raw : 'All'; };
  const setPos = (param: string) => (p: PosFilter) => update((next) => { if (p === 'All') next.delete(param); else next.set(param, p); });
  const pickOf = (param: string, fallback: SeasonPick): SeasonPick => {
    const raw = params.get(param);
    if (raw === 'all') return 'all';
    const n = Number(raw);
    return years.includes(n) ? n : fallback;
  };
  const setPick = (param: string, fallback: SeasonPick) => (v: SeasonPick) => update((next) => { if (v === fallback) next.delete(param); else next.set(param, String(v)); });

  const allLines = useMemo(() => flattenLines(seasons, players), [seasons, players]);
  const champions = useMemo(() => championsOf(seasons), [seasons]);
  const lastPlaces = useMemo(() => lastPlacesOf(seasons), [seasons]);
  const picks = useMemo(() => draftValuesOf(seasons), [seasons]);
  const xfp = useMemo(() => fitXfp(allLines), [allLines]);
  const transactions = useMemo(() => seasons.map((s) => ({ year: s.year, transactions: s.transactions })), [seasons]);
  const playerSeasons = useMemo(() => Object.fromEntries(seasons.map((s) => [s.year, s.playerSeasons])), [seasons]);
  const drafts = useMemo(() => Object.fromEntries(seasons.map((s) => [s.year, s.draft])), [seasons]);

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Player stats <span className="num font-normal text-muted">through {currentYear} week {lastScoredWeek}</span></h1>
        <nav aria-label="Sections" className="flex flex-wrap gap-3 text-xs">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="text-muted hover:text-accent">{s.title}</a>)}
        </nav>
      </header>
      {SECTIONS.map((s) => {
        const pos = posOf(s.param);
        const fallback: SeasonPick = s.defaultSeason === 'current' ? currentYear : 'all';
        const pick: SeasonPick = s.seasonParam ? pickOf(s.seasonParam, fallback) : 'all';
        const year = pick === 'all' ? null : pick;
        const lines = filterLines(allLines, pos).filter((l) => year === null || l.year === year);
        const ctx: BoardContext = { lines, players, champions, lastPlaces, year, currentYear, pos, picks, xfp, transactions, playerSeasons, drafts };
        const note = s.note ?? (year === null ? 'Every season' : `${year} season`);
        const empty = s.id === 'leaders' && year !== null && !allLines.some((l) => l.year === year) ? 'Season has not started.' : null;
        return (
          <Section
            key={s.id}
            id={s.id}
            title={s.title}
            note={note}
            boards={BOARDS.filter((b) => b.section === s.id)}
            ctx={ctx}
            players={players}
            managers={managers}
            pos={pos}
            onPos={setPos(s.param)}
            columns={s.columns}
            seasonPicker={s.seasonParam ? { years, value: pick, onChange: setPick(s.seasonParam, fallback), allTime: true } : undefined}
            emptyMessage={empty}
          />
        );
      })}
    </section>
  );
}
```

- [ ] **Step 11: Run the web suite and build**

Run: `cd packages/web && npx vitest run && cd ../.. && pnpm build 2>&1 | grep -E "error|built in"`
Expected: all pass; build green.

- [ ] **Step 12: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): season pickers with All-time on leaders, Career and Extras; boards read a nullable year" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Second toggle, per-game modes, direction labels, tone, computed empty copy

**Files:**
- Modify: `packages/web/src/lib/boards/shared.ts`, `leaders.ts`, `career.ts`, `extras.ts`, `packages/web/src/lib/playerBoards.ts`, `packages/web/src/lib/playerBoards.test.ts`, `packages/web/src/components/players/Board.tsx`, `Board.test.tsx`, `Section.tsx`, `Section.test.tsx`, `PlayersView.test.tsx`

**Interfaces:**
- Produces: `BoardDef.modes2?: readonly BoardMode[]` (headers are suffixes), `BoardDef.directionLabels?: [string, string]`, `BoardDef.empty?: (ctx: BoardContext, mode?: string, mode2?: string) => string | undefined`, `BoardRow.tone?: 'win' | 'loss'`, `compute(ctx, direction?, mode?, mode2?)`, `perGameModes(header: string)`, `PER_GAME_SUFFIX_MODES`, `perGame(lines, f)` helper. `Board` props add `mode2`, `onMode2`, `empty`.

- [ ] **Step 1: Write the failing lib tests**

Append to `playerBoards.test.ts`:

```ts
describe('per-game modes and tone', () => {
  const split = season(2025, [
    week(1, [game(2025, 1, 1, side('a', 50, [line('q1', 30, { pass_yd: 300 }), line('r1', 20, { rush_yd: 90, rush_att: 20, rec: 2 })]), side('b', 15, [line('w1', 15, { rec_yd: 110, rec: 7 })]))]),
    week(2, [game(2025, 2, 1, side('a', 20, [line('q1', 20, { pass_yd: 200 }), line('r1', 0, {})]), side('b', 5, [line('w1', 5, { rec_yd: 40, rec: 3 })]))]),
    week(3, [game(2025, 3, 1, side('a', 10, [line('q1', 10, { pass_yd: 100 })]), side('b', 5, [line('w1', 5, { rec_yd: 50, rec: 1 })]))]),
  ]);
  const c = { ...ctx, year: 2025, lines: flattenLines([split], players) };
  it('yards, touches and xFP read per played game with the minimum', () => {
    expect(leadYards(c, 'desc', 'pg').map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 200, '200.0', '600 pass'], ['w1', 66.7, '66.7', '200 rec']]); // r1: 1 played game < 3
    expect(leadTouches(c, 'desc', 'both', 'pg').map((r) => [r.playerId, r.value])).toEqual([['w1', 3.7]]); // 11 touches over 3 games; r1 only 1 played game
    expect(leadTouches(c, 'desc', 'rec', 'total').map((r) => [r.playerId, r.value])).toEqual([['w1', 11], ['r1', 2]]);
    const flat: XfpModel = { coef: {}, predict: (l) => (l.position === 'QB' ? 30 : null) };
    expect(leadXfp({ ...c, xfp: flat }, 'desc', 'pg').map((r) => [r.playerId, r.value, r.detail])).toEqual([['q1', 30, 'actual 20.0 per game']]);
  });
  it('best season reads PPG over played starts', () => {
    expect(bestSeason(c, 'desc', 'ppg').map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 20, '20.0', '3 games'], ['w1', 8.33, '8.3', '3 games']]);
  });
  it('FPOE and draft value carry a tone by sign', () => {
    const flat: XfpModel = { coef: {}, predict: (l) => (l.position === 'QB' ? 15 : l.position === 'WR' ? 10 : null) };
    const rows = leadFpoe({ ...c, xfp: flat });
    expect(rows.map((r) => [r.playerId, r.value, r.tone])).toEqual([['q1', 15, 'win'], ['w1', -5, 'loss']]);
    const picks = [{ year: 2025, playerId: 'q1', value: 3, round: 1, pickNo: 1 }, { year: 2025, playerId: 'r1', value: -2, round: 2, pickNo: 20 }, { year: 2025, playerId: 'w1', value: 0, round: 3, pickNo: 30 }];
    expect(draftValue({ ...c, picks }).map((r) => [r.playerId, r.tone ?? null])).toEqual([['q1', 'win'], ['w1', null], ['r1', 'loss']]);
    expect(draftValue({ ...c, picks }, 'asc').map((r) => r.playerId)).toEqual(['r1', 'w1', 'q1']);
  });
  it('registry: toggles and empty copy', () => {
    const def = (id: string) => BOARDS.find((b) => b.id === id)!;
    expect(def('leadYards').modes!.map((m) => [m.id, m.valueHeader])).toEqual([['total', 'Yds'], ['pg', 'Yds/G']]);
    expect(def('leadTouches').modes2!.map((m) => [m.id, m.valueHeader])).toEqual([['total', ''], ['pg', '/G']]);
    expect(def('leadXfp').modes!.map((m) => m.valueHeader)).toEqual(['xFP', 'xFP/G']);
    expect(def('bestSeason').modes!.map((m) => m.label)).toEqual(['Total', 'PPG']);
    expect(def('draftValue').sortable).toBe(true);
    expect(def('draftValue').directionLabels).toEqual(['+', '−']);
    expect(def('leadPoints').empty!({ ...ctx, year: 2025 }, 'ppg')).toBe('No players with 3 games yet.');
    expect(def('leadPoints').empty!({ ...ctx, year: null }, 'ppg')).toBe('No players with 12 games yet.');
    expect(def('leadPoints').empty!(ctx, 'total')).toBeUndefined();
    expect(def('leadTouches').empty!({ ...ctx, year: 2025 }, 'both', 'pg')).toBe('No players with 3 games yet.');
    expect(def('careerPoints').empty!({ ...ctx, year: null }, 'ppg')).toBe('No players with 12 games yet.');
    expect(def('postPoints').empty!(ctx, 'ppg')).toBe('No players with 3 games yet.');
  });
});
```

Add `bestSeason, leadYards, leadTouches, leadXfp, leadFpoe, draftValue` to the imports if missing. Remove the old `empty` assertions from the "points boards offer a Total/PPG mode" test (the `BoardMode.empty` field goes away).

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: FAIL (4 new tests).

- [ ] **Step 3: Implement in the lib**

`shared.ts`:

```ts
export interface BoardRow { /* existing fields */ tone?: 'win' | 'loss' }
export interface BoardDef {
  id: string; section: Section; title: string; definition: string; valueHeader: string;
  sortable?: boolean;
  /** Over / Under by default */
  directionLabels?: [string, string];
  modes?: readonly BoardMode[];
  /** second, independent toggle; its valueHeaders are suffixes appended to the first header */
  modes2?: readonly BoardMode[];
  /** empty-state copy when the mode's own threshold, not the position filter, is the usual reason */
  empty?: (ctx: BoardContext, mode?: string, mode2?: string) => string | undefined;
  compute: (ctx: BoardContext, direction?: Direction, mode?: string, mode2?: string) => BoardRow[];
}
export const perGameModes = (header: string): readonly BoardMode[] => [
  { id: 'total', label: 'Total', valueHeader: header },
  { id: 'pg', label: 'Per game', valueHeader: `${header}/G` },
];
export const PER_GAME_SUFFIX_MODES: readonly BoardMode[] = [{ id: 'total', label: 'Total', valueHeader: '' }, { id: 'pg', label: 'Per game', valueHeader: '/G' }];
export const pointsModes = (): readonly BoardMode[] => [{ id: 'total', label: 'Total', valueHeader: 'Pts' }, { id: 'ppg', label: 'PPG', valueHeader: 'PPG' }];
export const minGamesCopy = (n: number) => `No players with ${n} games yet.`;
/** empty copy for a board whose `ppg` or `pg` reading needs minGames(ctx) */
export const perGameEmpty = (ctx: BoardContext, mode?: string, mode2?: string): string | undefined =>
  (mode === 'ppg' || mode === 'pg' || mode2 === 'pg' ? minGamesCopy(minGames(ctx)) : undefined);
export const toneOf = (v: number): 'win' | 'loss' | undefined => (v > 0 ? 'win' : v < 0 ? 'loss' : undefined);
/** per played game, or null below the minimum */
export const perGame = (ctx: BoardContext, ls: PlayerLine[], f: (l: PlayerLine) => number): { value: number; games: number } | null => {
  const played = ls.filter((l) => l.played);
  if (played.length < minGames(ctx)) return null;
  return { value: round1(sum(played, f) / played.length), games: played.length };
};
```

`leaders.ts`:

```ts
export const leadYards = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] => {
  const split = (ls: PlayerLine[]) => parts([[sum(ls, (l) => l.passYards), 'pass'], [sum(ls, (l) => l.rushYards), 'rush'], [sum(ls, (l) => l.recYards), 'rec']]);
  if (mode === 'pg') return leaderBoard(ctx, (ls) => { const g = perGame(ctx, ls, (l) => l.yards); return g && g.value > 0 ? { value: g.value, detail: split(ls) } : null; }, fmt1);
  return leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.yards), split), intLabel);
};
export const leadTouches = (ctx: BoardContext, _d?: Direction, mode?: string, mode2?: string): BoardRow[] => {
  const pick = (l: PlayerLine) => (mode === 'rec' ? l.receptions : mode === 'car' ? l.carries : l.receptions + l.carries);
  const detail = (ls: PlayerLine[]) => parts([[sum(ls, (l) => l.receptions), 'rec'], [sum(ls, (l) => l.carries), 'car'], [sum(ls, (l) => l.targets), 'tgt']]);
  if (mode2 === 'pg') return leaderBoard(ctx, (ls) => { const g = perGame(ctx, ls, pick); return g && g.value > 0 ? { value: g.value, detail: detail(ls) } : null; }, fmt1);
  return leaderBoard(ctx, positive((ls) => sum(ls, pick), detail), intLabel);
};
export const leadXfp = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] => leaderBoard(ctx, (ls) => {
  const m = modelled(ctx, ls);
  if (m.length < minGames(ctx)) return null;
  const expected = m.reduce((s, x) => s + x.xfp, 0);
  const actual = m.reduce((s, x) => s + x.line.points, 0);
  if (mode === 'pg') return { value: round1(expected / m.length), detail: `actual ${fmt1(actual / m.length)} per game` };
  return { value: round1(expected), detail: `actual ${fmt1(actual)}` };
}, fmt1);
```

`leadFpoe`: after building rows, map `tone: toneOf(row.value)`:

```ts
export const leadFpoe = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => leaderBoard(ctx, (ls) => { /* unchanged */ }, (v) => fmtSigned(v, 1), direction).map((r) => ({ ...r, tone: toneOf(r.value) }));
```

`career.ts` `bestSeason`:

```ts
export const bestSeason = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] => {
  const groups = groupBy(started(ctx), (l) => `${l.playerId}|${l.userId}|${l.year}`);
  const ppg = mode === 'ppg';
  const items: { playerId: string; userId: string; year: number; value: number; starts: number; games: number; latestYear: number; latestWeek: number }[] = [];
  for (const [k, g] of groups) {
    const [playerId, userId, year] = k.split('|');
    const played = g.lines.filter((l) => l.played);
    if (ppg && played.length < MIN_SEASON_GAMES) continue;
    const value = ppg ? round2(sum(played, (l) => l.points) / played.length) : sum(g.lines, (l) => l.points);
    items.push({ playerId, userId, year: Number(year), value, starts: g.lines.length, games: played.length, latestYear: g.latestYear, latestWeek: g.latestWeek });
  }
  return rank(items).map((i) => ({
    key: `${i.playerId}-${i.userId}-${i.year}`, playerId: i.playerId, value: i.value, valueLabel: ppg ? fmtPpg(i.value) : fmtPts(i.value),
    meta: String(i.year), detail: ppg ? plural(i.games, 'game') : plural(i.starts, 'start'), userId: i.userId, to: `/scores/${i.year}`,
  }));
};
```

(Best season PPG always uses the 3-game season minimum, since each row is one season.)

`extras.ts` `draftValue` (interim; Task 10 replaces it): accept `direction` and add `tone`:

```ts
export const draftValue = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => {
  /* existing grouping */
  return rank(items, direction).map((i) => ({ /* existing */, tone: toneOf(i.value) }));
};
```

Registry changes in `playerBoards.ts`:

```ts
{ id: 'leadPoints', ..., modes: pointsModes(), empty: perGameEmpty, compute: leadPoints },
{ id: 'leadYards', ..., definition: 'Passing, rushing and receiving yards this season on any roster. Per game averages over weeks the player played.', valueHeader: 'Yds', modes: perGameModes('Yds'), empty: perGameEmpty, compute: leadYards },
{ id: 'leadTouches', ..., modes: TOUCH_MODES, modes2: PER_GAME_SUFFIX_MODES, empty: perGameEmpty, compute: leadTouches },
{ id: 'leadXfp', ..., modes: perGameModes('xFP'), empty: perGameEmpty, compute: leadXfp },
{ id: 'bestSeason', ..., definition: 'Most points a player scored for one manager in one season while started. PPG averages over played starts, at least 3.', modes: pointsModes(), empty: () => undefined, compute: bestSeason },
{ id: 'careerPoints', ..., modes: pointsModes(), empty: perGameEmpty, compute: careerPoints },
{ id: 'postPoints', ..., modes: pointsModes(), empty: (_ctx, mode) => (mode === 'ppg' ? minGamesCopy(MIN_POST_GAMES) : undefined), compute: postPoints },
{ id: 'draftValue', ..., sortable: true, directionLabels: ['+', '−'], compute: draftValue },
```

Update the `bestSeason` definition to drop the `empty` key if `undefined` reads awkwardly; `empty` is optional.

- [ ] **Step 4: Run the lib tests**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing component tests**

`Board.test.tsx`: replace "uses the mode empty message when the mode has one" with

```tsx
  it('shows the empty copy it is given, else the position copy', () => {
    wrapB({ empty: 'No players with 3 games yet.' });
    expect(screen.getByText('No players with 3 games yet.')).toBeInTheDocument();
    cleanup();
    wrapB();
    expect(screen.getByText('No players at this position.')).toBeInTheDocument();
  });
  it('renders a second toggle, joins its header suffix, and colours toned values', () => {
    const modes = [{ id: 'both', label: 'Both', valueHeader: 'Touches' }, { id: 'rec', label: 'Rec', valueHeader: 'Rec' }];
    const modes2 = [{ id: 'total', label: 'Total', valueHeader: '' }, { id: 'pg', label: 'Per game', valueHeader: '/G' }];
    const onMode2 = vi.fn();
    wrapB({ def: { ...def, modes, modes2 }, rows: [row(0, { tone: 'win' }), row(1, { tone: 'loss' }), row(2)], mode: 'rec', onMode: vi.fn(), mode2: 'pg', onMode2 });
    expect(screen.getByText('Rec/G')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Per game' });
    expect(within(group).getByRole('button', { name: 'Per game' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(group).getByRole('button', { name: 'Total' }));
    expect(onMode2).toHaveBeenCalledWith('total');
    const [first, second, third] = screen.getAllByRole('listitem');
    expect(within(first).getByText('100.00')).toHaveClass('text-win');
    expect(within(second).getByText('99.00')).toHaveClass('text-loss');
    expect(within(third).getByText('98.00')).not.toHaveClass('text-win');
  });
  it('uses the direction labels from the definition', () => {
    wrapB({ def: { ...def, sortable: true, directionLabels: ['+', '−'] }, rows: [row(0)], direction: 'asc', onDirection: vi.fn() });
    expect(screen.getByRole('button', { name: '−' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Over' })).toBeNull();
  });
```

`Section.test.tsx`: add

```tsx
  it('keeps a second mode per board and asks the definition for empty copy', () => {
    const two: BoardDef = { ...moded, id: 'two', title: 'Two toggles', modes2: [{ id: 'total', label: 'Total', valueHeader: '' }, { id: 'pg', label: 'Per game', valueHeader: '/G' }],
      empty: (_ctx, _mode, mode2) => (mode2 === 'pg' ? 'Need more games.' : undefined),
      compute: (_ctx, _direction, mode, mode2) => (mode2 === 'pg' ? [] : mode === 'ppg' ? rows(7, 'g') : rows(7, 'x')) };
    wrap(<Section id="extras" title="Extras" note="" boards={[two]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const board = screen.getByRole('region', { name: 'Two toggles' });
    fireEvent.click(within(board).getByRole('button', { name: 'Per game' }));
    expect(within(board).getByText('Need more games.')).toBeInTheDocument();
    expect(within(board).getByText('Pts/G')).toBeInTheDocument(); // mode stays Total: 'Pts' + '/G'
    fireEvent.click(within(board).getByRole('button', { name: 'Total' }));
    expect(within(board).getAllByRole('listitem')).toHaveLength(5);
  });
```

`PlayersView.test.tsx` "switches the leaders points board to PPG": restore `'No players with 3 games yet.'`.

- [ ] **Step 6: Run to verify failure**

Run: `cd packages/web && npx vitest run src/components/players`
Expected: FAIL on the new Board, Section and PlayersView expectations.

- [ ] **Step 7: Implement Board and Section**

`Board.tsx` props:

```tsx
  mode?: string; onMode?: (m: string) => void;
  mode2?: string; onMode2?: (m: string) => void;
  /** empty-state copy from the definition; falls back to the position copy */
  empty?: string;
```

Body:

```tsx
  const activeMode = def.modes?.find((m) => m.id === mode) ?? def.modes?.[0];
  const activeMode2 = def.modes2?.find((m) => m.id === mode2) ?? def.modes2?.[0];
  const header = (activeMode?.valueHeader ?? def.valueHeader) + (activeMode2?.valueHeader ?? '');
  const [over, under] = def.directionLabels ?? ['Over', 'Under'];
  const directions: { id: Direction; label: string }[] = [{ id: 'desc', label: over }, { id: 'asc', label: under }];
  ...
  <span className="section-label">{header}</span>
  {def.sortable && onDirection && <Toggle label="Direction" options={directions} value={direction} onChange={onDirection} />}
  {def.modes && activeMode && onMode && <Toggle label="View" options={def.modes.map((m) => ({ id: m.id, label: m.label }))} value={activeMode.id} onChange={onMode} />}
  {def.modes2 && activeMode2 && onMode2 && <Toggle label="Per game" options={def.modes2.map((m) => ({ id: m.id, label: m.label }))} value={activeMode2.id} onChange={onMode2} />}
  ...
  <p className="px-3 py-4 text-sm text-muted">{empty ?? 'No players at this position.'}</p>
  ...
  <span className={`num shrink-0 text-base font-semibold ${r.tone === 'win' ? 'text-win' : r.tone === 'loss' ? 'text-loss' : ''}`}>{r.valueLabel}</span>
```

Remove the `DIRECTIONS` constant. `Section.tsx`: add `const [modes2, setModes2] = useState<Record<string, string>>({});`, compute `const mode2 = modes2[b.id] ?? b.modes2?.[0]?.id;`, pass `rows={b.compute(ctx, direction, mode, mode2)}`, `mode2={mode2}`, `onMode2={b.modes2 ? (m) => setModes2((s) => ({ ...s, [b.id]: m })) : undefined}`, `empty={b.empty?.(ctx, mode, mode2)}`.

- [ ] **Step 8: Run the web suite and build**

Run: `cd packages/web && npx vitest run && cd ../.. && pnpm build 2>&1 | grep -E "error|built in"`
Expected: PASS; build green.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): per-game modes on yards, touches and xFP; best season PPG; direction labels; toned values; computed empty copy" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Championship and last-place rosters rank the stars first

**Files:**
- Modify: `packages/web/src/lib/boards/shared.ts` (`rank`, `careerBoard`), `postseason.ts` (`rosterSeasons`), `playerBoards.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the `championshipRosters` test:

```ts
describe('championshipRosters', () => {
  it('counts seasons on the champion roster in the final, bench included, breaking ties by postseason points on that roster', () => {
    const rows = championshipRosters(ctx);
    // 2024 final: a (champion) started q1 31, benched t1 3. 2025 final: b (champion) started r1 22, benched q1 50.
    expect(rows.map((r) => [r.playerId, r.value, r.meta, r.detail])).toEqual([['q1', 2, '2024, 2025', '81.00 pts'], ['r1', 1, '2025', '22.00 pts'], ['t1', 1, '2024', '3.00 pts']]);
  });
  it('ties on seasons fall to points even when the lower scorer is newer', () => {
    const c = { ...ctx, champions: { 2024: 'a', 2025: 'b' } };
    // t1 (2024, 3 pts) vs r1 (2025, 22 pts): both 1 season; points decide before recency
    expect(championshipRosters(c).slice(1).map((r) => r.playerId)).toEqual(['r1', 't1']);
  });
});
```

(The second test pins the order already asserted by the first; keep it since it names the rule.)

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts -t championshipRosters`
Expected: FAIL: detail is `null` and order differs.

- [ ] **Step 3: Implement**

`shared.ts` `rank`: items may carry `secondary?: number`:

```ts
export function rank<T extends { value: number; latestYear: number; latestWeek: number; playerId: string; secondary?: number }>(items: T[], direction: Direction = 'desc'): T[] {
  const sign = direction === 'asc' ? -1 : 1;
  return [...items]
    .sort((x, y) => sign * (y.value - x.value) || (y.secondary ?? 0) - (x.secondary ?? 0) || y.latestYear - x.latestYear || y.latestWeek - x.latestWeek || (x.playerId < y.playerId ? -1 : x.playerId > y.playerId ? 1 : 0))
    .slice(0, MAX_ROWS);
}
```

`careerBoard` gains a trailing `secondary?: (ls: PlayerLine[]) => number` parameter and sets `secondary: secondary?.(g.lines)` on each item.

`postseason.ts` `rosterSeasons`:

```ts
function rosterSeasons(ctx: BoardContext, tag: PlayerLine['tag'], bracket: (l: PlayerLine) => boolean, owner: Record<number, UserId | null>): BoardRow[] {
  const onOwner = (l: PlayerLine) => owner[l.year] != null && owner[l.year] === l.userId;
  const pointsBy = new Map<string, number>();
  for (const l of ctx.lines) if (bracket(l) && onOwner(l)) pointsBy.set(l.playerId, round2((pointsBy.get(l.playerId) ?? 0) + l.points));
  const on = ctx.lines.filter((l) => l.tag === tag && onOwner(l));
  const seen = new Set<string>();
  const unique = on.filter((l) => { const k = `${l.playerId}|${l.year}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const pts = (ls: PlayerLine[]) => pointsBy.get(ls[0].playerId) ?? 0;
  return careerBoard(unique, (ls) => ls.length, String, (ls) => `${fmtPts(pts(ls))} pts`, yearsOf, pts);
}
export const championshipRosters = (ctx: BoardContext): BoardRow[] => rosterSeasons(ctx, 'Final', (l) => l.postseason, ctx.champions);
export const lastPlaceRosters = (ctx: BoardContext): BoardRow[] => rosterSeasons(ctx, 'Toilet Bowl', (l) => l.consolation, ctx.lastPlaces);
```

Update the `lastPlaceRosters` test's expected rows to include the detail: k1 `'4.00 pts'` (1 in 2023 + 3 in 2024), q1 `'0.00 pts'`. Update the registry definitions: championship rosters "…in the championship game. Ties fall to postseason points on that roster." and likewise for last place with "consolation points".

- [ ] **Step 4: Run tests**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): championship and last place rosters break ties by bracket points" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Best playoff starts and worst toilet bowl starts

**Files:**
- Modify: `packages/web/src/lib/boards/shared.ts` (`momentBoard` direction), `postseason.ts`, `playerBoards.ts` (registry), `playerBoards.test.ts`, `PlayersView.test.tsx`

**Interfaces:**
- Produces: `bestPlayoffStarts(ctx, direction?, mode?)` modes `all` / `final`; `worstToiletStarts(ctx, direction?, mode?)` modes `all` / `toilet`; `momentBoard(lines, value, label, direction = 'desc')`.

- [ ] **Step 1: Write the failing tests**

Append to `playerBoards.test.ts`:

```ts
describe('postseason moments', () => {
  const bracket = season(2023, [
    week(3, [game(2023, 3, 1, side('a', 20, [line('q1', 20)]), side('b', 10, [line('r1', 10)]), 'SF'),
             game(2023, 3, 2, side('c', 9, [line('w1', 9)]), side('d', 1, [line('t1', 1)]), 'Cons-R1')], true),
    week(4, [game(2023, 4, 1, side('a', 33, [line('q1', 33)]), side('b', 12, [line('r1', 12)]), 'Final'),
             game(2023, 4, 2, side('c', 2, [line('w1', 2)]), side('d', 0, [line('t1', 0, {}), line('k1', 0.5)]), 'Toilet Bowl')], true),
  ]);
  const c = { ...ctx, lines: flattenLines([bracket], players) };
  it('best playoff starts rank bracket starts, Final only on request', () => {
    expect(bestPlayoffStarts(c).map((r) => [r.playerId, r.value, r.meta, r.to])).toEqual([
      ['q1', 33, '2023 · Wk 4 · Championship', '/scores/2023/4/1'], ['q1', 20, '2023 · Wk 3 · Semifinal', '/scores/2023/3/1'], ['r1', 12, '2023 · Wk 4 · Championship', '/scores/2023/4/1'], ['r1', 10, '2023 · Wk 3 · Semifinal', '/scores/2023/3/1'],
    ]);
    expect(bestPlayoffStarts(c, 'desc', 'final').map((r) => [r.playerId, r.value])).toEqual([['q1', 33], ['r1', 12]]);
  });
  it('worst toilet bowl starts rank played consolation starts lowest first, Toilet Bowl only on request', () => {
    expect(worstToiletStarts(c).map((r) => [r.playerId, r.value, r.meta])).toEqual([
      ['k1', 0.5, '2023 · Wk 4 · Toilet Bowl'], ['t1', 1, '2023 · Wk 3 · Consolation R1'], ['w1', 2, '2023 · Wk 4 · Toilet Bowl'], ['w1', 9, '2023 · Wk 3 · Consolation R1'],
    ]); // t1's 0 in the toilet bowl is unplayed and excluded
    expect(worstToiletStarts(c, 'desc', 'toilet').map((r) => r.playerId)).toEqual(['k1', 'w1']);
  });
  it('registry: postseason grid order', () => {
    expect(BOARDS.filter((b) => b.section === 'postseason').map((b) => b.id)).toEqual(['postPoints', 'postStarts', 'postTouchdowns', 'postYards', 'postReceptions', 'bestPlayoffStarts', 'championshipRosters', 'postToiletBowl', 'worstToiletStarts', 'lastPlaceRosters']);
  });
});
```

Check the tag labels in `lib/format.ts` (`fmtTag`) and use its exact strings for SF, Cons-R1 and Toilet Bowl in the expectations. Update the existing "BOARDS registry" postseason order assertion to match. Add `bestPlayoffStarts, worstToiletStarts` to the imports. In `PlayersView.test.tsx` add `'Best playoff starts', 'Worst toilet bowl starts'` to the heading list.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: FAIL: exports missing.

- [ ] **Step 3: Implement**

`shared.ts` `momentBoard`:

```ts
export function momentBoard(lines: PlayerLine[], value: (l: PlayerLine) => number, label: (v: number) => string, direction: Direction = 'desc'): BoardRow[] {
  const items = lines.map((l) => ({ ...l, value: value(l), latestYear: l.year, latestWeek: l.week }));
  return rank(items, direction).map((l) => ({ key: `${l.gameId}-${l.playerId}`, playerId: l.playerId, value: l.value, valueLabel: label(l.value), meta: when(l), detail: null, userId: l.userId, to: boxScore(l) }));
}
```

`postseason.ts`:

```ts
export const PLAYOFF_MODES: readonly BoardMode[] = [{ id: 'all', label: 'All rounds', valueHeader: 'Pts' }, { id: 'final', label: 'Final', valueHeader: 'Pts' }];
export const CONSOLATION_MODES: readonly BoardMode[] = [{ id: 'all', label: 'All consolation', valueHeader: 'Pts' }, { id: 'toilet', label: 'Toilet Bowl', valueHeader: 'Pts' }];
export const bestPlayoffStarts = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] =>
  momentBoard(postseasonStarted(ctx).filter((l) => mode !== 'final' || l.tag === 'Final'), (l) => l.points, fmtPts);
export const worstToiletStarts = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] =>
  momentBoard(started(ctx).filter((l) => l.consolation && l.played && (mode !== 'toilet' || l.tag === 'Toilet Bowl')), (l) => l.points, fmtPts, 'asc');
```

Registry entries:

```ts
{ id: 'bestPlayoffStarts', section: 'postseason', title: 'Best playoff starts', definition: 'Most points by a starter in one championship-bracket game. Final narrows to the championship game.', valueHeader: 'Pts', modes: PLAYOFF_MODES, compute: bestPlayoffStarts },
{ id: 'worstToiletStarts', section: 'postseason', title: 'Worst toilet bowl starts', definition: 'Fewest points by a starter who played in one consolation game. Toilet Bowl narrows to the last-place game.', valueHeader: 'Pts', modes: CONSOLATION_MODES, compute: worstToiletStarts },
```

Place them per the grid order in the test.

- [ ] **Step 4: Run tests**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts src/components/players`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): best playoff starts and worst toilet bowl starts" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Extras: bench blunder moves, bench warmers, loyalty, ironman

**Files:**
- Create: `packages/web/src/lib/ironman.ts`, `packages/web/src/lib/ironman.test.ts`, `packages/web/src/lib/boards/extras.test.ts`
- Modify: `packages/web/src/lib/boards/extras.ts`, `career.ts` (remove `benchBlunder`), `playerBoards.ts` (registry), `playerBoards.test.ts` (registry order), `PlayersView.test.tsx`

**Interfaces:**
- Produces: `longestStartRun(lines: PlayerLine[]): Map<PlayerId, StartRun>` with `StartRun { length: number; from: { year, week }; to: { year, week }; active: boolean }`; boards `benchWarmers`, `loyalty`, `ironman`.

- [ ] **Step 1: Write the failing ironman test**

`packages/web/src/lib/ironman.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { flattenLines } from './playerLines';
import { longestStartRun } from './ironman';
import { game, line, players, season, side, week } from '../test/playerFixtures';

// league weeks: 2024 wk1-3, 2025 wk1-2
const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('r1', 5)], [line('w1', 1)]))]),
    week(2, [game(2024, 2, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('r1', 5)], [line('w1', 1)]))]),
    week(3, [game(2024, 3, 1, side('b', 10, [line('q1', 10)]), side('a', 5, [line('w1', 5)]))]),
  ]),
  season(2025, [
    week(1, [game(2025, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('w1', 5)]))]),
    week(2, [game(2025, 2, 1, side('a', 10, [line('r1', 10)]), side('b', 5, [line('w1', 5)]))]),
  ]),
];
const lines = flattenLines(seasons, players);

describe('longestStartRun', () => {
  it('counts consecutive league weeks started by any manager, across seasons', () => {
    const runs = longestStartRun(lines);
    expect(runs.get('q1')).toEqual({ length: 4, from: { year: 2024, week: 1 }, to: { year: 2025, week: 1 }, active: false });
  });
  it('ends at a missing week across seasons and never reports a stale run as active', () => {
    const runs = longestStartRun(lines);
    expect(runs.get('r1')).toEqual({ length: 2, from: { year: 2024, week: 1 }, to: { year: 2024, week: 2 }, active: false }); // 2025 wk2 is a new run of 1
  });
  it('bench weeks break a run; the latest week keeps it active', () => {
    const runs = longestStartRun(lines);
    expect(runs.get('w1')).toEqual({ length: 3, from: { year: 2024, week: 3 }, to: { year: 2025, week: 2 }, active: true });
  });
  it('keeps the earliest run on a tie', () => {
    const only = lines.filter((l) => l.playerId === 'r1');
    expect(longestStartRun(only).get('r1')!.from).toEqual({ year: 2024, week: 1 });
    expect(longestStartRun([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/ironman.test.ts`
Expected: FAIL: module not found.

- [ ] **Step 3: Implement `lib/ironman.ts`**

```ts
import type { PlayerId } from '@fantasy-dash/core';
import type { PlayerLine } from './playerLines';

export interface WeekRef { year: number; week: number }
export interface StartRun { length: number; from: WeekRef; to: WeekRef; active: boolean }

const key = (w: WeekRef) => w.year * 100 + w.week;

/**
 * Longest run of consecutive league weeks in which the player was started by any manager.
 * The week sequence is every distinct (year, week) in `lines`, in order; a week without a
 * started line ends the run. A run reaching the final week is active. Earliest run wins ties.
 */
export function longestStartRun(lines: PlayerLine[]): Map<PlayerId, StartRun> {
  const weeks = [...new Map(lines.map((l) => [key(l), { year: l.year, week: l.week }])).values()].sort((a, b) => key(a) - key(b));
  const startedAt = new Map<PlayerId, Set<number>>();
  for (const l of lines) {
    if (!l.started) continue;
    const set = startedAt.get(l.playerId) ?? new Set<number>();
    set.add(key(l));
    startedAt.set(l.playerId, set);
  }
  const out = new Map<PlayerId, StartRun>();
  const last = weeks[weeks.length - 1];
  for (const [playerId, set] of startedAt) {
    let best: StartRun | null = null;
    let run: { from: WeekRef; to: WeekRef; length: number } | null = null;
    for (const w of weeks) {
      if (set.has(key(w))) {
        run = run ? { ...run, to: w, length: run.length + 1 } : { from: w, to: w, length: 1 };
        if (!best || run.length > best.length) best = { ...run, active: false };
      } else {
        run = null;
      }
    }
    if (best) out.set(playerId, { ...best, active: last !== undefined && key(best.to) === key(last) });
  }
  return out;
}
```

- [ ] **Step 4: Run the ironman test**

Run: `cd packages/web && npx vitest run src/lib/ironman.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing extras board tests**

`packages/web/src/lib/boards/extras.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { flattenLines } from '../playerLines';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import { BOARDS, benchWarmers, championsOf, lastPlacesOf, loyalty, ironman, type BoardContext } from '../playerBoards';

const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40), line('r1', 20)]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
    week(2, [game(2024, 2, 1, side('a', 25, [line('q1', 25)], [line('w1', 44, { rec: 9 })]), side('b', 12, [line('r1', 12)]))]),
    week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
  ], 'a'),
  season(2025, [
    week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35), line('t1', 0, {})]), side('a', 9, [line('r1', 9)]))]),
    week(2, [game(2025, 2, 1, side('b', 18, [line('q1', 18)]), side('a', 11, [line('r1', 11)]))]),
    week(3, [game(2025, 3, 1, side('b', 22, [line('r1', 22)], [line('q1', 50)]), side('a', 4, [line('w1', 4)]), 'Final')], true),
  ], 'b'),
];
export const ctx: BoardContext = {
  lines: flattenLines(seasons, players), players, champions: championsOf(seasons), lastPlaces: lastPlacesOf(seasons), year: null, currentYear: 2025, pos: 'All',
  picks: [], xfp: null, transactions: [], playerSeasons: {}, drafts: {},
};

describe('bench warmers', () => {
  it('sums points while benched', () => {
    expect(benchWarmers(ctx).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail])).toEqual([['q1', 50, '50.00', '1 season', '1 week benched'], ['w1', 44, '44.00', '1 season', '1 week benched'], ['t1', 3, '3.00', '1 season', '1 week benched']]);
  });
});

describe('loyalty', () => {
  it('is the most starts for one manager, with that manager; a tie goes to the manager with the newer start', () => {
    const rows = loyalty(ctx);
    // r1: a started him 2024 wk1, 2025 wk1, wk2 (3); b 2024 wk2, wk3, 2025 wk3 (3) → b, newest start
    expect(rows[0]).toMatchObject({ playerId: 'r1', value: 3, userId: 'b', detail: 'of 6 starts' });
    // q1: a 3 (2024), b 2 (2025)
    expect(rows[1]).toMatchObject({ playerId: 'q1', value: 3, userId: 'a', detail: 'of 5 starts' });
    expect(rows.some((r) => r.playerId === 'KC' || r.playerId === 'k1')).toBe(false);
  });
});

describe('ironman', () => {
  it('ranks the longest start runs with their span', () => {
    const rows = ironman(ctx);
    expect(rows[0]).toMatchObject({ playerId: 'r1', value: 6, valueLabel: '6', meta: '2024 Wk 1 – 2025 Wk 3', detail: 'active' });
    expect(rows[1]).toMatchObject({ playerId: 'q1', value: 5, meta: '2024 Wk 1 – 2025 Wk 2', detail: null });
  });
});

describe('registry', () => {
  it('lays out Extras in grid order', () => {
    expect(BOARDS.filter((b) => b.section === 'extras').map((b) => b.id)).toEqual(['boomStarts', 'dudStarts', 'benchBlunder', 'benchWarmers', 'journeyman', 'loyalty', 'ironman', 'fodder', 'tradeBait', 'waiverHeroes', 'waiverVillains', 'draftValue', 'mrIrrelevant', 'breakout', 'fallOff']);
    expect(BOARDS.filter((b) => b.section === 'career').map((b) => b.id)).toEqual(['bestWeek', 'bestSeason', 'careerPoints', 'weeksStarted']);
  });
});
```

The registry assertion above lists ids from Tasks 9 and 10 too. For this task assert the prefix only: `expect(BOARDS.filter((b) => b.section === 'extras').map((b) => b.id).slice(0, 7)).toEqual(['boomStarts', 'dudStarts', 'benchBlunder', 'benchWarmers', 'journeyman', 'loyalty', 'ironman'])`; Task 9 extends the prefix to 11 ids and Task 10 switches to full equality.

- [ ] **Step 6: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/boards/extras.test.ts`
Expected: FAIL: exports missing.

- [ ] **Step 7: Implement in `extras.ts`**

Move `benchBlunder` from `career.ts` to `extras.ts` unchanged. Add:

```ts
import { longestStartRun } from '../ironman';

export const benchWarmers = (ctx: BoardContext): BoardRow[] =>
  careerBoard(ctx.lines.filter((l) => !l.started), (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => `${plural(ls.length, 'week')} benched`, metaOf(ctx));

export const loyalty = (ctx: BoardContext): BoardRow[] => {
  const meta = metaOf(ctx);
  const items: { playerId: string; value: number; userId: UserId; total: number; lines: PlayerLine[]; latestYear: number; latestWeek: number }[] = [];
  for (const [playerId, g] of groupBy(skillOnly(started(ctx)), (l) => l.playerId)) {
    let best: { userId: UserId; starts: number; latest: number } | null = null;
    for (const [userId, m] of groupBy(g.lines, (l) => l.userId)) {
      const latest = m.latestYear * 100 + m.latestWeek;
      if (!best || m.lines.length > best.starts || (m.lines.length === best.starts && latest > best.latest)) best = { userId, starts: m.lines.length, latest };
    }
    if (best) items.push({ playerId, value: best.starts, userId: best.userId, total: g.lines.length, lines: g.lines, latestYear: g.latestYear, latestWeek: g.latestWeek });
  }
  return rank(items).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: meta(i.lines), detail: `of ${plural(i.total, 'start')}`, userId: i.userId, to: null }));
};

export const ironman = (ctx: BoardContext): BoardRow[] => {
  const runs = longestStartRun(skillOnly(ctx.lines));
  const items = [...runs.entries()].map(([playerId, r]) => ({ playerId, value: r.length, run: r, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value),
    meta: `${i.run.from.year} Wk ${i.run.from.week} – ${i.run.to.year} Wk ${i.run.to.week}`, detail: i.run.active ? 'active' : null, userId: null, to: null,
  }));
};
```

Registry: remove `benchBlunder` from the career block; Extras block in order:

```ts
{ id: 'boomStarts', ... }, { id: 'dudStarts', ... },
{ id: 'benchBlunder', section: 'extras', title: 'Biggest bench blunder', definition: 'Most points by a player left on the bench in one week.', valueHeader: 'Pts', compute: benchBlunder },
{ id: 'benchWarmers', section: 'extras', title: 'Bench warmers', definition: 'Points scored while sitting on a bench, every season and manager.', valueHeader: 'Pts', compute: benchWarmers },
{ id: 'journeyman', ... },
{ id: 'loyalty', section: 'extras', title: 'Loyalty', definition: 'Most starts for a single manager. Kickers and defenses excluded.', valueHeader: 'Starts', compute: loyalty },
{ id: 'ironman', section: 'extras', title: 'Ironman', definition: 'Longest run of consecutive league weeks in a starting lineup, any manager, carrying across seasons. Kickers and defenses excluded.', valueHeader: 'Weeks', compute: ironman },
{ id: 'draftValue', ... },
```

Update the career registry assertion in `playerBoards.test.ts` and the `PlayersView.test.tsx` heading list (add `'Loyalty', 'Ironman', 'Bench warmers'`; assert `within(region('Extras')).getByText('Biggest bench blunder')`).

- [ ] **Step 8: Run tests**

Run: `cd packages/web && npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): Extras gains bench warmers, loyalty and ironman; bench blunder moves there" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Extras: trade bait, fodder, waiver heroes, waiver villains

**Files:**
- Create: `packages/web/src/lib/waivers.ts`, `packages/web/src/lib/waivers.test.ts`
- Modify: `packages/web/src/lib/boards/extras.ts`, `extras.test.ts`, `playerBoards.ts` (registry), `PlayersView.test.tsx`

**Interfaces:**
- Produces: `WaiverClaim { year; week; playerId; userId; bid; points; starts }`, `waiverClaims(transactions: SeasonTransactions[], lines: PlayerLine[]): WaiverClaim[]`; boards `tradeBait`, `fodder`, `waiverHeroes`, `waiverVillains`.

- [ ] **Step 1: Write the failing waivers test**

`packages/web/src/lib/waivers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Transaction } from '@fantasy-dash/core';
import { flattenLines } from './playerLines';
import { waiverClaims } from './waivers';
import { game, line, players, season, side, week } from '../test/playerFixtures';

const t = (over: Partial<Transaction>): Transaction => ({ id: 'x', type: 'waiver', week: 1, created: 1, adds: [], drops: [], bid: 5, ...over });
const s = season(2025, [
  week(1, [game(2025, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 1, [line('r1', 1)]))]),
  week(2, [game(2025, 2, 1, side('a', 20, [line('w1', 20)], [line('q1', 7)]), side('b', 1, [line('r1', 1)]))]),
  week(3, [game(2025, 3, 1, side('a', 15, [line('w1', 15)]), side('b', 9, [line('r1', 9)]))]),
  week(4, [game(2025, 4, 1, side('b', 30, [line('w1', 30)]), side('a', 2, [line('q1', 2)]))]),
]);
const lines = flattenLines([s], players);

describe('waiverClaims', () => {
  it('sums started points for the claimer from the claim week until that manager drops the player', () => {
    const claims = waiverClaims([{ year: 2025, transactions: [
      t({ id: 'c1', week: 2, created: 2, adds: [{ playerId: 'w1', userId: 'a' }], bid: 12 }),
      t({ id: 'd1', week: 4, created: 4, type: 'free_agent', adds: [{ playerId: 'w1', userId: 'b' }], drops: [{ playerId: 'w1', userId: 'a' }], bid: null }),
    ] }], lines);
    expect(claims).toEqual([{ year: 2025, week: 2, playerId: 'w1', userId: 'a', bid: 12, points: 35, starts: 2 }]);
  });
  it('runs to season end without a drop, ignores non-waiver adds, and gives a claim dropped the same week zero starts', () => {
    const claims = waiverClaims([{ year: 2025, transactions: [
      t({ id: 'c1', week: 3, created: 3, adds: [{ playerId: 'r1', userId: 'b' }], bid: 1 }),
      t({ id: 'c2', week: 2, created: 2, adds: [{ playerId: 'q1', userId: 'a' }], bid: 40 }),
      t({ id: 'd2', week: 2, created: 3, type: 'commissioner', drops: [{ playerId: 'q1', userId: 'a' }], bid: null }),
      t({ id: 'f1', week: 1, created: 0, type: 'free_agent', adds: [{ playerId: 'q1', userId: 'a' }], bid: null }),
    ] }], lines);
    expect(claims).toEqual([
      { year: 2025, week: 2, playerId: 'q1', userId: 'a', bid: 40, points: 0, starts: 0 },
      { year: 2025, week: 3, playerId: 'r1', userId: 'b', bid: 1, points: 9, starts: 1 },
    ]);
  });
});
```

(The `d2` drop at week 2 closes the q1 window before week 2's games; q1 was benched in week 2 anyway. Order is by created.)

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/waivers.test.ts`
Expected: FAIL: module not found.

- [ ] **Step 3: Implement `lib/waivers.ts`**

```ts
import type { PlayerId, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from './playerLines';
import type { SeasonTransactions } from './boards/shared';

export interface WaiverClaim { year: number; week: number; playerId: PlayerId; userId: UserId; bid: number; points: number; starts: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One entry per waiver claim with a bid. The claim's window runs from the claim week until the week
 * before the claiming manager next drops the player (any transaction type), or to season end.
 * Points and starts count that manager's started lines inside the window.
 */
export function waiverClaims(seasons: SeasonTransactions[], lines: PlayerLine[]): WaiverClaim[] {
  const out: WaiverClaim[] = [];
  for (const { year, transactions } of seasons) {
    const sorted = [...transactions].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
    const yearLines = lines.filter((l) => l.year === year && l.started);
    for (const tx of sorted) {
      if (tx.type !== 'waiver' || tx.bid === null) continue;
      for (const add of tx.adds) {
        const drop = sorted.find((o) => o.created > tx.created && o.drops.some((d) => d.playerId === add.playerId && d.userId === add.userId));
        const end = drop ? drop.week - 1 : Infinity;
        const mine = yearLines.filter((l) => l.playerId === add.playerId && l.userId === add.userId && l.week >= tx.week && l.week <= end);
        out.push({ year, week: tx.week, playerId: add.playerId, userId: add.userId, bid: tx.bid, points: round2(mine.reduce((s, l) => s + l.points, 0)), starts: mine.length });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the waivers test**

Run: `cd packages/web && npx vitest run src/lib/waivers.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing board tests**

Append to `extras.test.ts`:

```ts
import type { Transaction } from '@fantasy-dash/core';
import { tradeBait, fodder, waiverHeroes, waiverVillains } from '../playerBoards';

const t = (over: Partial<Transaction>): Transaction => ({ id: 'x', type: 'trade', week: 1, created: 1, adds: [], drops: [], bid: null, ...over });
const txCtx: BoardContext = { ...ctx, transactions: [
  { year: 2024, transactions: [
    t({ id: 'a', adds: [{ playerId: 'q1', userId: 'b' }, { playerId: 'r1', userId: 'a' }], drops: [{ playerId: 'q1', userId: 'a' }, { playerId: 'r1', userId: 'b' }] }),
    t({ id: 'b', created: 2, type: 'free_agent', drops: [{ playerId: 'w1', userId: 'a' }] }),
    t({ id: 'c', created: 3, type: 'waiver', week: 2, adds: [{ playerId: 'w1', userId: 'b' }], bid: 30 }),
  ] },
  { year: 2025, transactions: [
    t({ id: 'd', adds: [{ playerId: 'q1', userId: 'a' }], drops: [{ playerId: 'q1', userId: 'b' }] }),
    t({ id: 'e', created: 2, type: 'waiver', week: 1, adds: [{ playerId: 'q1', userId: 'b' }], drops: [{ playerId: 'w1', userId: 'b' }], bid: 9 }),
    t({ id: 'f', created: 3, type: 'commissioner', drops: [{ playerId: 'w1', userId: 'a' }] }),
  ] },
] };

describe('trade bait and fodder', () => {
  it('count trades moving the player and drops of the player', () => {
    expect(tradeBait(txCtx).map((r) => [r.playerId, r.value, r.meta, r.detail])).toEqual([['q1', 2, '2 seasons', '2 managers'], ['r1', 1, '1 season', '1 manager']]);
    // drops: w1 by a (2024 free agent), by b and by a (2025) = 3 ; q1 in both trades = 2 ; r1 in the 2024 trade = 1
    expect(fodder(txCtx).map((r) => [r.playerId, r.value, r.detail])).toEqual([['w1', 3, 'picked up 1 time'], ['q1', 2, 'picked up 1 time'], ['r1', 1, 'picked up 0 times']]);
    expect(tradeBait({ ...txCtx, year: 2025 }).map((r) => [r.playerId, r.value, r.meta])).toEqual([['q1', 1, '2025']]);
  });
});

describe('waiver heroes and villains', () => {
  // w1 claimed by b for $30 in 2024 wk2: b started w1 in 2024 wk1 only (before the claim) → 0 starts.
  // q1 claimed by b for $9 in 2025 wk1: b started q1 wk1 35, wk2 18; benched wk3 → 53 pts, 2 starts.
  it('heroes rank started points per claim; villains rank dollars per point for claims of $10 or more', () => {
    expect(waiverHeroes(txCtx).map((r) => [r.playerId, r.value, r.meta, r.detail, r.userId])).toEqual([['q1', 53, '2025 · Wk 1', '$9 · 2 starts', 'b'], ['w1', 0, '2024 · Wk 2', '$30 · 0 starts', 'b']]);
    expect(waiverVillains(txCtx).map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['w1', 30, '$30.0/pt', '$30 · 0.00 pts · 0 starts']]);
  });
});
```

Heroes keep zero-point claims (a $30 bust is worth seeing); the row's `key` is `${year}-${week}-${playerId}-${userId}`.

- [ ] **Step 6: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/boards/extras.test.ts`
Expected: FAIL: exports missing.

- [ ] **Step 7: Implement in `extras.ts`**

```ts
import { waiverClaims } from '../waivers';
import type { Transaction } from '@fantasy-dash/core';

const txInScope = (ctx: BoardContext): { year: number; tx: Transaction }[] =>
  ctx.transactions.filter((s) => inYear(ctx, s.year)).flatMap((s) => s.transactions.map((tx) => ({ year: s.year, tx })));
const posOk = (ctx: BoardContext, playerId: string) => matchesPos(ctx.players[playerId]?.position ?? '?', ctx.pos);
const seasonsMeta = (ctx: BoardContext, years: Set<number>) => (ctx.year === null ? plural(years.size, 'season') : String(ctx.year));

/** Rows from per-player event counts. `events` yields (playerId, year, created, extra) tuples. */
function countBoard(ctx: BoardContext, events: { playerId: string; year: number; created: number; group: string }[], detail: (groups: Set<string>, n: number) => string): BoardRow[] {
  const by = new Map<string, { n: number; years: Set<number>; groups: Set<string>; latest: number }>();
  for (const e of events) {
    if (!posOk(ctx, e.playerId)) continue;
    const g = by.get(e.playerId) ?? { n: 0, years: new Set(), groups: new Set(), latest: 0 };
    g.n += 1; g.years.add(e.year); g.groups.add(e.group); g.latest = Math.max(g.latest, e.created);
    by.set(e.playerId, g);
  }
  const items = [...by.entries()].map(([playerId, g]) => ({ playerId, value: g.n, g, latestYear: Math.max(...g.years), latestWeek: 0, secondary: g.latest }));
  return rank(items).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: seasonsMeta(ctx, i.g.years), detail: detail(i.g.groups, i.g.n), userId: null, to: null }));
}

export const tradeBait = (ctx: BoardContext): BoardRow[] => countBoard(ctx,
  txInScope(ctx).filter(({ tx }) => tx.type === 'trade').flatMap(({ year, tx }) => tx.adds.map((a) => ({ playerId: a.playerId, year, created: tx.created, group: a.userId }))),
  (managers) => plural(managers.size, 'manager'));

export const fodder = (ctx: BoardContext): BoardRow[] => {
  const scoped = txInScope(ctx);
  const pickups = new Map<string, number>();
  for (const { tx } of scoped) if (tx.type !== 'trade') for (const a of tx.adds) pickups.set(a.playerId, (pickups.get(a.playerId) ?? 0) + 1);
  const rows = countBoard(ctx, scoped.flatMap(({ year, tx }) => tx.drops.map((d) => ({ playerId: d.playerId, year, created: tx.created, group: d.userId }))), () => '');
  return rows.map((r) => ({ ...r, detail: `picked up ${plural(pickups.get(r.playerId) ?? 0, 'time')}` }));
};

const claims = (ctx: BoardContext) => waiverClaims(ctx.transactions.filter((s) => inYear(ctx, s.year)), ctx.lines).filter((c) => posOk(ctx, c.playerId));
const claimRow = (c: ReturnType<typeof claims>[number], value: number, label: string, detail: string): BoardRow =>
  ({ key: `${c.year}-${c.week}-${c.playerId}-${c.userId}`, playerId: c.playerId, value, valueLabel: label, meta: `${c.year} · Wk ${c.week}`, detail, userId: c.userId, to: null });

export const waiverHeroes = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).filter((c) => c.bid >= 1).map((c) => ({ c, playerId: c.playerId, value: c.points, latestYear: c.year, latestWeek: c.week })))
    .map(({ c }) => claimRow(c, c.points, fmtPts(c.points), `$${c.bid} · ${plural(c.starts, 'start')}`));

export const waiverVillains = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).filter((c) => c.bid >= 10).map((c) => ({ c, playerId: c.playerId, value: round1(c.bid / Math.max(c.points, 1)), latestYear: c.year, latestWeek: c.week })))
    .map(({ c, value }) => claimRow(c, value, `$${value.toFixed(1)}/pt`, `$${c.bid} · ${fmtPts(c.points)} pts · ${plural(c.starts, 'start')}`));
```

Note: `ctx.lines` is already narrowed to the section's year and position, so `claims` only sees lines in scope; `waiverClaims` receives transactions narrowed the same way. For `tradeBait` the `secondary` recency makes "latest trade first" break ties before `latestYear`; that is consistent with the spec's "newest first" intent.

Registry entries (after `ironman`, before `draftValue`):

```ts
{ id: 'fodder', section: 'extras', title: 'Fodder', definition: 'Times the player was dropped, any manager. Pickups underneath count waiver and free-agent adds.', valueHeader: 'Drops', compute: fodder },
{ id: 'tradeBait', section: 'extras', title: 'Trade bait', definition: 'Completed trades that moved the player, with the number of managers who received him.', valueHeader: 'Trades', compute: tradeBait },
{ id: 'waiverHeroes', section: 'extras', title: 'Waiver heroes', definition: 'Points a waiver claim returned: starts for the claiming manager from the claim until that manager dropped the player. FAAB bid underneath.', valueHeader: 'Pts', compute: waiverHeroes },
{ id: 'waiverVillains', section: 'extras', title: 'Waiver villains', definition: 'FAAB dollars per started point for claims of $10 or more, worst first. A claim that never started counts as one point.', valueHeader: '$/pt', compute: waiverVillains },
```

Add the four titles to the `PlayersView.test.tsx` heading list.

- [ ] **Step 8: Run tests**

Run: `cd packages/web && npx vitest run`
Expected: PASS (the Extras registry prefix assertion from Task 8 updated to the first 11 ids).

- [ ] **Step 9: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): Extras gains trade bait, fodder, waiver heroes and waiver villains from league transactions" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Extras: draft value by season, Mr. Irrelevant, breakout, fall-off

**Files:**
- Modify: `packages/web/src/lib/boards/extras.ts`, `extras.test.ts`, `playerBoards.ts` (registry), `playerBoards.test.ts` (old draft value test), `PlayersView.test.tsx`

**Interfaces:**
- Produces: `draftValue(ctx, direction?)` (year → that season; All-time → best season), `mrIrrelevant(ctx)`, `breakout(ctx)`, `fallOff(ctx)`, `seasonPairs(ctx)` helper.

- [ ] **Step 1: Write the failing tests**

Replace the "cumulative draft value" describe in `playerBoards.test.ts` with one in `extras.test.ts`:

```ts
import { draftValue, draftValuesOf, mrIrrelevant, breakout, fallOff } from '../playerBoards';
import type { Draft, Season } from '@fantasy-dash/core';

const pick = (over: Partial<Draft['picks'][number]>): Draft['picks'][number] => ({
  round: 1, pickNo: 1, slot: 1, userId: 'a', playerId: 'q1', isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null,
  healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null, tradedTo: null, ...over,
});
const withDraft = (year: number, picks: Draft['picks']): Season => ({ ...season(year, []), draft: { draftId: 'd', type: 'snake', rounds: 2, slotOrder: [], expectedCurve: null, baselines: {}, picks } });
const drafts = [
  withDraft(2024, [pick({ playerId: 'q1', value: 38.2 }), pick({ pickNo: 2, playerId: 'r1', value: -5, round: 1 }), pick({ pickNo: 3, playerId: 'k1', value: null, round: 2 }), pick({ pickNo: 4, playerId: 'KC', value: null, round: 2, userId: 'b' })]),
  withDraft(2025, [pick({ playerId: 'q1', value: -12 }), pick({ pickNo: 2, playerId: 'r1', value: 20.5 }), pick({ pickNo: 5, round: 2, playerId: 'w1', value: 1, userId: 'b' })]),
];
const dCtx: BoardContext = { ...ctx, picks: draftValuesOf(drafts), drafts: { 2024: drafts[0].draft, 2025: drafts[1].draft },
  playerSeasons: {
    2024: { q1: { points: 300, games: 17, posRank: 2 }, r1: { points: 100, games: 12, posRank: 20 }, w1: { points: 50, games: 10, posRank: 60 }, t1: { points: 90, games: 9, posRank: 8 } },
    2025: { q1: { points: 200, games: 10, posRank: 9 }, r1: { points: 250, games: 15, posRank: 3 }, w1: { points: 40, games: 4, posRank: 70 }, t1: { points: 150, games: 16, posRank: 2 } },
  } };

describe('draft value by season', () => {
  it('shows the chosen season, or each player’s best season under All-time, with the slot and a tone', () => {
    expect(draftValue({ ...dCtx, year: 2025 }).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail, r.tone ?? null])).toEqual([
      ['r1', 20.5, '+20.5', '2025', 'Rd 1, pick 2', 'win'], ['w1', 1, '+1.0', '2025', 'Rd 2, pick 5', 'win'], ['q1', -12, '-12.0', '2025', 'Rd 1, pick 1', 'loss'],
    ]);
    expect(draftValue(dCtx).map((r) => [r.playerId, r.value, r.meta])).toEqual([['q1', 38.2, '2024'], ['r1', 20.5, '2025'], ['w1', 1, '2025']]);
    expect(draftValue(dCtx, 'asc').map((r) => r.playerId)).toEqual(['w1', 'r1', 'q1']);
    expect(draftValue({ ...dCtx, pos: 'K' })).toEqual([]);
  });
});

describe('Mr. Irrelevant', () => {
  it('takes the last positional pick of each draft with that season’s finish', () => {
    // 2024: last pick overall is KC (DEF) → last positional pick is r1 (pick 2). 2025: w1 (pick 5).
    expect(mrIrrelevant(dCtx).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail, r.userId])).toEqual([
      ['r1', 100, '100.00', '2024', 'RB20 · 8.3 ppg · Rd 1, pick 2', 'a'],
      ['w1', 40, '40.00', '2025', 'WR70 · 10.0 ppg · Rd 2, pick 5', 'b'],
    ]);
    expect(mrIrrelevant({ ...dCtx, year: 2025 }).map((r) => r.playerId)).toEqual(['w1']);
  });
  it('last pick with no games shows zero and a dash', () => {
    const c = { ...dCtx, playerSeasons: { 2024: {}, 2025: {} } };
    expect(mrIrrelevant({ ...c, year: 2024 })[0]).toMatchObject({ playerId: 'r1', value: 0, valueLabel: '0.00', detail: '— · Rd 1, pick 2' });
  });
});

describe('breakout and fall-off', () => {
  it('compare consecutive seasons with ten games in both, ranked by PPG change', () => {
    // q1 17.65 → 20.0 (+2.4) ; r1 8.33 → 16.67 (+8.3) ; w1 only 4 games in 2025 ; t1 only 9 games in 2024
    expect(breakout(dCtx).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail])).toEqual([
      ['r1', 8.3, '+8.3', '2024 → 2025', 'RB20 · 8.3 ppg → RB3 · 16.7 ppg · 250.00 pts'],
      ['q1', 2.4, '+2.4', '2024 → 2025', 'QB2 · 17.6 ppg → QB9 · 20.0 ppg · 200.00 pts'],
    ]);
    expect(fallOff(dCtx)).toEqual([]);
    const fall = { ...dCtx, playerSeasons: { ...dCtx.playerSeasons, 2025: { ...dCtx.playerSeasons[2025], q1: { points: 100, games: 10, posRank: 9 } } } };
    expect(fallOff(fall).map((r) => [r.playerId, r.value, r.tone])).toEqual([['q1', -7.6, 'loss']]);
    expect(breakout({ ...dCtx, year: 2024 })).toEqual([]); // first season has no pair
  });
});
```

Round PPG with 1 dp in details; `q1` 2024 PPG is 300/17 = 17.647 → "17.6"; delta = round1(20 − 17.647) = 2.4. Values use `fmtSigned(v, 1)` with `tone`.

Update the Extras registry assertion in `extras.test.ts` to the full fifteen-id list.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/web && npx vitest run src/lib/boards/extras.test.ts`
Expected: FAIL: exports missing / draft value shape differs.

- [ ] **Step 3: Implement in `extras.ts`**

```ts
const SKILL = new Set(['QB', 'RB', 'WR', 'TE']);
const slot = (p: { round: number; pickNo: number }) => `Rd ${p.round}, pick ${p.pickNo}`;

export const draftValue = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => {
  const scoped = ctx.picks.filter((p) => inYear(ctx, p.year) && posOk(ctx, p.playerId));
  const best = new Map<string, DraftValue>();
  for (const p of scoped) {
    const cur = best.get(p.playerId);
    if (!cur || p.value > cur.value || (p.value === cur.value && p.year > cur.year)) best.set(p.playerId, p);
  }
  const items = [...best.values()].map((p) => ({ p, playerId: p.playerId, value: round1(p.value), latestYear: p.year, latestWeek: 0 }));
  return rank(items, direction).map(({ p, value }) => ({ key: `${p.year}-${p.playerId}`, playerId: p.playerId, value, valueLabel: fmtSigned(value, 1), meta: String(p.year), detail: slot(p), userId: null, to: null, tone: toneOf(value) }));
};

export const mrIrrelevant = (ctx: BoardContext): BoardRow[] => {
  const items: { playerId: string; value: number; year: number; detail: string; userId: UserId; latestYear: number; latestWeek: number }[] = [];
  for (const [y, draft] of Object.entries(ctx.drafts)) {
    const year = Number(y);
    if (!draft || !inYear(ctx, year)) continue;
    const last = [...draft.picks].filter((p) => SKILL.has(ctx.players[p.playerId]?.position ?? '')).sort((a, b) => b.pickNo - a.pickNo)[0];
    if (!last || !posOk(ctx, last.playerId)) continue;
    const line = ctx.playerSeasons[year]?.[last.playerId];
    const pos = ctx.players[last.playerId]?.position ?? '?';
    const finish = line && line.games > 0 ? `${pos}${line.posRank ?? '?'} · ${fmt1(line.points / line.games)} ppg` : '—';
    items.push({ playerId: last.playerId, value: line?.points ?? 0, year, detail: `${finish} · ${slot(last)}`, userId: last.userId, latestYear: year, latestWeek: 0 });
  }
  return rank(items).map((i) => ({ key: `${i.year}-${i.playerId}`, playerId: i.playerId, value: i.value, valueLabel: fmtPts(i.value), meta: String(i.year), detail: i.detail, userId: i.userId, to: `/draft/${i.year}` }));
};

const MIN_PAIR_GAMES = 10;
interface Pair { playerId: string; from: number; to: number; prev: PlayerSeasonLine; next: PlayerSeasonLine; delta: number }
/** Consecutive-season pairs for skill players with enough games in both; a chosen year is the later season. */
function seasonPairs(ctx: BoardContext): Pair[] {
  const years = Object.keys(ctx.playerSeasons).map(Number).sort((a, b) => a - b);
  const out: Pair[] = [];
  for (const to of years) {
    if (!inYear(ctx, to) || !ctx.playerSeasons[to - 1]) continue;
    const prevSeason = ctx.playerSeasons[to - 1];
    for (const [playerId, next] of Object.entries(ctx.playerSeasons[to])) {
      const prev = prevSeason[playerId];
      if (!prev || prev.games < MIN_PAIR_GAMES || next.games < MIN_PAIR_GAMES) continue;
      const pos = ctx.players[playerId]?.position ?? '';
      if (!SKILL.has(pos) || !posOk(ctx, playerId)) continue;
      out.push({ playerId, from: to - 1, to, prev, next, delta: round1(next.points / next.games - prev.points / prev.games) });
    }
  }
  return out;
}
const pairRow = (ctx: BoardContext) => (p: Pair): BoardRow => {
  const pos = ctx.players[p.playerId]?.position ?? '?';
  const fin = (l: PlayerSeasonLine) => `${pos}${l.posRank ?? '?'} · ${fmt1(l.points / l.games)} ppg`;
  return { key: `${p.to}-${p.playerId}`, playerId: p.playerId, value: p.delta, valueLabel: fmtSigned(p.delta, 1), meta: `${p.from} → ${p.to}`, detail: `${fin(p.prev)} → ${fin(p.next)} · ${fmtPts(p.next.points)} pts`, userId: null, to: null, tone: toneOf(p.delta) };
};
export const breakout = (ctx: BoardContext): BoardRow[] =>
  rank(seasonPairs(ctx).filter((p) => p.delta > 0).map((p) => ({ p, playerId: p.playerId, value: p.delta, latestYear: p.to, latestWeek: 0 }))).map(({ p }) => pairRow(ctx)(p));
export const fallOff = (ctx: BoardContext): BoardRow[] =>
  rank(seasonPairs(ctx).filter((p) => p.delta < 0).map((p) => ({ p, playerId: p.playerId, value: p.delta, latestYear: p.to, latestWeek: 0 })), 'asc').map(({ p }) => pairRow(ctx)(p));
```

Import `PlayerSeasonLine` from core and `DraftValue` from `./shared`. Registry (after `waiverVillains`):

```ts
{ id: 'draftValue', section: 'extras', title: 'Draft value', definition: "Draft value from the draft board for the chosen season; under All-time, each player's best single season. The current season's value moves weekly.", valueHeader: 'Value', sortable: true, directionLabels: ['+', '−'], compute: draftValue },
{ id: 'mrIrrelevant', section: 'extras', title: 'Mr. Irrelevant', definition: "The last quarterback, running back, receiver or tight end taken in each draft, and what he went on to score that season, with his positional finish.", valueHeader: 'Pts', compute: mrIrrelevant },
{ id: 'breakout', section: 'extras', title: 'Biggest breakout', definition: 'Largest rise in points per game between two consecutive seasons with at least 10 games in each, league scoring, every NFL game counted. QB, RB, WR and TE.', valueHeader: 'PPG', compute: breakout },
{ id: 'fallOff', section: 'extras', title: 'Biggest fall-off', definition: 'Largest drop in points per game between two consecutive seasons with at least 10 games in each, league scoring, every NFL game counted. QB, RB, WR and TE.', valueHeader: 'PPG', compute: fallOff },
```

Add `'Draft value', 'Mr. Irrelevant', 'Biggest breakout', 'Biggest fall-off'` to the `PlayersView.test.tsx` heading list and remove `'Average draft value'`.

- [ ] **Step 4: Run tests and build**

Run: `cd packages/web && npx vitest run && cd ../.. && pnpm build 2>&1 | grep -E "error|built in"`
Expected: PASS; build green.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): draft value by season, Mr. Irrelevant, biggest breakout and fall-off" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Real-data probe and copy pass

**Files:**
- Create (scratchpad, not committed): `peek-v3b.ts` modelled on the earlier probe, building `ctx` with `year: null`, `transactions`, `playerSeasons`, `drafts`, and printing the top 5 of every board for every mode pair (`modes × modes2`).

- [ ] **Step 1: Run the probe**

Run: `cd packages/web && npx tsx <scratchpad>/peek-v3b.ts 2>&1 | head -400`
Expected: every board prints rows; no `NaN`, `undefined` or `?` positions in Extras rows; waiver villains show bids ≥ 10; breakout and fall-off show real names with finishes like `WR6`.

- [ ] **Step 2: Fix anything the probe exposes** with a failing test first in the owning file (Tasks 8–10), then commit as `fix(web): …`.

- [ ] **Step 3: Full suite and build at the branch tip**

Run: `pnpm test 2>&1 | grep -E "Tests |FAIL" && pnpm build 2>&1 | grep -E "error|built in"`
Expected: all green.
