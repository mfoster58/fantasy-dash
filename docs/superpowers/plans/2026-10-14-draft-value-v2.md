# Draft Value v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the draft board's rank-difference value with a two-part value (draft-capital slot value + production value over a fitted expectation), add trade and keeper markers, a healthy-PPG list, and a red→yellow→green board scale.

**Architecture:** All math stays in `packages/core/src/draft.ts` as pure functions fed by the sync (`scripts/sync.ts`) through `RawSeasonInput`. The sync gains per-player games played, per-team games, and completed trades. The web package reads the new `DraftPick` fields; derived lists (summaries, extremes, top PPG) live in `packages/web/src/lib/draft.ts`.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, React 19, Tailwind 4, zod. Node 26.

Spec: `docs/superpowers/specs/2026-10-14-draft-value-v2-design.md`. Read it once before starting; it holds the reasoning.

## Global Constraints

- Defenses are excluded from all value math: DEF picks have `posDraftRank`, `pointsOverBaseline`, `redraftPos`, `slotValue`, `productionValue`, `value` all `null`; they still carry `seasonPoints`, `gamesPlayed`, `ppg`, `healthy`, `tradedTo`.
- `BASELINE_RANKS = { QB: 10, RB: 24, WR: 24, TE: 12, K: 10 }` (DEF removed).
- `capital(pick) = 100 · exp(−(pick − 1) / 45)`.
- Expected curve: `a · exp(−(pick − 1) / k)`, `k` integer 10..120, `a` closed-form least squares at each `k`, fit on `contribution = max(PoB, 0)`.
- `productionValue = (contribution − expected(pickNo)) · pace`, `pace = totalWeeks / lastScoredWeek`.
- `slotValue`, `productionValue`, `value` rounded to 1 decimal. `value = slotValue + productionValue`.
- If `lastScoredWeek === 0`, every value field (including `pointsOverBaseline` and `redraftPos`) is null and `expectedCurve` is null.
- Redraft rank ties: PoB desc, then season points desc, then id asc. Zero-point players tie at N + 1.
- `healthy = gamesPlayed > 0 && gamesPlayed >= teamGames[team]`; false when the player has no team.
- `tradedTo` comes from the latest completed trade by `created`; waiver moves are not trades.
- Value mode colors: yellow `#e6c229` at 0, red `#d64545` at ≤ −60, green `#2f9e5f` at ≥ +60, linear, `color-mix(in oklch, …)`. Value-mode cell text `#1a1a1a`. Null value → `transparent`.
- Keeper marker: inset accent ring + lock SVG with `aria-label="Keeper"`, no "Keeper"/"K" text on the board.
- Trade marker: swap SVG with `aria-label="Traded"` + receiving manager display name.
- Steals and busts lists: 10 each. Top PPG (healthy): 10.
- Grades table columns, in order: Manager, Value, Slot, Production, Pts over baseline, Best pick, Worst pick; sorted by Value desc, tiebreak Pts over baseline desc.
- All commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run tests with `pnpm --filter @fantasy-dash/core test` and `pnpm --filter @fantasy-dash/web test`; typecheck with `pnpm typecheck && pnpm typecheck:scripts` from the repo root.

---

## File map

| File | Responsibility |
|---|---|
| `packages/core/src/types.ts` | `DraftPick` / `Draft` shapes |
| `packages/core/src/schema.ts` | zod mirrors of the above |
| `packages/core/src/sleeper/types.ts` | `SleeperTransaction` |
| `packages/core/src/sleeper/client.ts` | `getTransactions` |
| `packages/core/src/draft.ts` | `capital`, `fitExpectedCurve`, `expectedAt`, `tradesFromTransactions`, `computeDraftValues`, `buildDraft` |
| `packages/core/src/season.ts` | `RawSeasonInput` extra inputs, wiring into `buildDraft` |
| `packages/core/test/draft.test.ts` | core tests |
| `scripts/sync.ts` | collect games played, team games, trades |
| `packages/web/src/lib/draft.ts` (+ test) | `valueColor`, `managerDraftSummaries`, `leagueExtremes`, `topHealthyPpg`, `posLabel` |
| `packages/web/src/components/draft/DraftBoard.tsx` (+ test) | board cells, markers, tooltip |
| `packages/web/src/components/draft/DraftAnalysis.tsx` | grades table, steals/busts |
| `packages/web/src/components/draft/TopPpg.tsx` | healthy PPG card |
| `packages/web/src/components/history/DraftRoundOne.tsx` | show total value |

---

### Task 1: Types, schema, Sleeper transaction type, capital and curve fit

**Files:**
- Modify: `packages/core/src/types.ts:131-151`
- Modify: `packages/core/src/schema.ts:92-112`
- Modify: `packages/core/src/sleeper/types.ts` (append)
- Modify: `packages/core/src/sleeper/client.ts:58-59`
- Modify: `packages/core/src/draft.ts`
- Modify: `packages/core/test/draft.test.ts`

**Interfaces:**
- Produces `DraftPick` (new shape), `Draft.expectedCurve`, `ExpectedCurve`, `capital(pick: number): number`, `fitExpectedCurve(points: { pick: number; contribution: number }[]): ExpectedCurve | null`, `expectedAt(curve: ExpectedCurve, pick: number): number`, `SleeperTransaction`, `SleeperClient.getTransactions(leagueId: string, week: number)`.
- This task leaves `computeDraftValues` producing the OLD logic but the NEW field names, so the package compiles. Task 2 replaces the logic.

- [ ] **Step 1: Change the types**

In `packages/core/src/types.ts` replace the `DraftPick` and `Draft` interfaces with:

```ts
export interface DraftPick {
  round: number;
  pickNo: number;
  slot: number;
  userId: UserId;
  playerId: PlayerId;
  isKeeper: boolean;
  /** order taken within the position; null for DEF and unknown positions */
  posDraftRank: number | null;
  seasonPoints: number;
  gamesPlayed: number;
  /** seasonPoints / gamesPlayed; null when no games */
  ppg: number | null;
  /** played every game their NFL team has played */
  healthy: boolean;
  /** season points minus the last startable player at the position; null for DEF, unknown, or before week 1 */
  pointsOverBaseline: number | null;
  /** where the player would go if the league redrafted on production today */
  redraftPos: number | null;
  /** draft capital at redraftPos minus capital at pickNo */
  slotValue: number | null;
  /** (max(PoB, 0) − expected contribution at pickNo) · pace */
  productionValue: number | null;
  /** slotValue + productionValue */
  value: number | null;
  tradedTo: { userId: UserId; week: number } | null;
}

export interface ExpectedCurve { a: number; k: number }

export interface Draft {
  draftId: string;
  type: string;
  rounds: number;
  slotOrder: UserId[];
  picks: DraftPick[];
  /** fitted a·exp(−(pick−1)/k) of contribution vs pick; null before week 1 */
  expectedCurve: ExpectedCurve | null;
}
```

- [ ] **Step 2: Mirror in zod**

In `packages/core/src/schema.ts` replace the `DraftPick` and `Draft` schemas with:

```ts
const DraftPick = z.object({
  round: z.number(),
  pickNo: z.number(),
  slot: z.number(),
  userId: z.string(),
  playerId: z.string(),
  isKeeper: z.boolean(),
  posDraftRank: z.number().nullable(),
  seasonPoints: z.number(),
  gamesPlayed: z.number(),
  ppg: z.number().nullable(),
  healthy: z.boolean(),
  pointsOverBaseline: z.number().nullable(),
  redraftPos: z.number().nullable(),
  slotValue: z.number().nullable(),
  productionValue: z.number().nullable(),
  value: z.number().nullable(),
  tradedTo: z.object({ userId: z.string(), week: z.number() }).nullable(),
});

const Draft = z.object({
  draftId: z.string(),
  type: z.string(),
  rounds: z.number(),
  slotOrder: z.array(z.string()),
  picks: z.array(DraftPick),
  expectedCurve: z.object({ a: z.number(), k: z.number() }).nullable(),
});
```

The `satisfies z.ZodType<Season>` guard at the bottom of the file will fail typecheck if the two drift.

- [ ] **Step 3: Sleeper transaction type and client method**

Append to `packages/core/src/sleeper/types.ts`:

```ts
/** GET /league/{id}/transactions/{week}. Only trades are read. */
export interface SleeperTransaction {
  transaction_id: string;
  type: string;   // 'trade' | 'waiver' | 'free_agent' | ...
  status: string; // 'complete' | 'failed' | ...
  /** week the transaction applied to */
  leg: number;
  /** epoch ms */
  created: number;
  /** player_id -> receiving roster_id */
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  roster_ids: number[];
}
```

In `packages/core/src/sleeper/client.ts`, import `SleeperTransaction` and add after `getDraftPicks`:

```ts
  getTransactions(leagueId: string, week: number) { return this.get<SleeperTransaction[]>(`/league/${leagueId}/transactions/${week}`); }
```

- [ ] **Step 4: Write failing tests for capital and the curve fit**

Replace the import line at the top of `packages/core/test/draft.test.ts` with:

```ts
import { buildDraft, computeDraftValues, capital, fitExpectedCurve, expectedAt, BASELINE_RANKS } from '../src/draft';
```

Append to the file:

```ts
describe('capital', () => {
  it('is 100 at pick 1 and decays with e-folding of 45 picks', () => {
    expect(capital(1)).toBe(100);
    expect(capital(46)).toBeCloseTo(100 / Math.E, 6);
    expect(capital(160)).toBeCloseTo(2.92, 2);
  });
});

describe('fitExpectedCurve', () => {
  it('recovers a and k from clean exponential data', () => {
    const pts = [];
    for (let pick = 1; pick <= 160; pick += 3) pts.push({ pick, contribution: 50 * Math.exp(-(pick - 1) / 40) });
    const c = fitExpectedCurve(pts);
    expect(c).not.toBeNull();
    expect(c!.k).toBe(40);
    expect(c!.a).toBeCloseTo(50, 3);
    expect(expectedAt(c!, 1)).toBeCloseTo(50, 3);
    expect(expectedAt(c!, 41)).toBeCloseTo(50 / Math.E, 3);
  });
  it('returns null when there is nothing to fit', () => {
    expect(fitExpectedCurve([])).toBeNull();
    expect(fitExpectedCurve([{ pick: 1, contribution: 0 }, { pick: 2, contribution: 0 }])).toBeNull();
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `pnpm --filter @fantasy-dash/core test -- draft`
Expected: FAIL, `capital` is not exported (and typecheck errors on the old `DraftPick` fixture shape).

- [ ] **Step 6: Implement capital, curve fit, and rename fields in draft.ts**

Replace the top of `packages/core/src/draft.ts` (through `DraftValueInput`) with:

```ts
import type { Draft, DraftPick, ExpectedCurve, PlayerDirectory, PlayerId, UserId } from './types';
import type { SleeperDraft, SleeperDraftPick } from './sleeper/types';
import { round2, round4 } from './scoring';

/** Last startable rank per position in a 10-team league with 2 RB, 2 WR, 1 TE, 2 FLEX, 1 QB, 1 K. Defenses are excluded from value math. */
export const BASELINE_RANKS: Record<string, number> = { QB: 10, RB: 24, WR: 24, TE: 12, K: 10 };

/** e-folding length of the draft capital curve, in picks. */
export const CAPITAL_DECAY = 45;

/** Draft capital of a pick slot: 100 at pick 1, ~27 at pick 60, ~3 at pick 160. */
export function capital(pick: number): number {
  return 100 * Math.exp(-(pick - 1) / CAPITAL_DECAY);
}

export function expectedAt(curve: ExpectedCurve, pick: number): number {
  return curve.a * Math.exp(-(pick - 1) / curve.k);
}

/**
 * Least-squares fit of a·exp(−(pick−1)/k) to (pick, contribution). k is searched over the integers
 * 10..120; a is closed-form at each k. Null when there are fewer than 2 points or every contribution is 0.
 */
export function fitExpectedCurve(points: { pick: number; contribution: number }[]): ExpectedCurve | null {
  if (points.length < 2 || points.every((p) => p.contribution === 0)) return null;
  let best: { a: number; k: number; err: number } | null = null;
  for (let k = 10; k <= 120; k++) {
    let num = 0;
    let den = 0;
    for (const p of points) {
      const x = Math.exp(-(p.pick - 1) / k);
      num += x * p.contribution;
      den += x * x;
    }
    const a = num / den;
    let err = 0;
    for (const p of points) err += (p.contribution - a * Math.exp(-(p.pick - 1) / k)) ** 2;
    if (!best || err < best.err) best = { a, k, err };
  }
  return best ? { a: round4(best.a), k: best.k } : null;
}

export interface DraftValueInput { seasonPoints: Record<PlayerId, number>; players: PlayerDirectory }
```

Then, so the package compiles with the new field names until Task 2 rewrites the logic, make these mechanical edits in the rest of `draft.ts`:

- In `computeDraftValues`, the early-return object becomes `{ ...p, posDraftRank: null, seasonPoints, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null }` and the full return object replaces `posFinishRank` with `redraftPos: posFinishRank`, keeps `value: posFinishRank === null ? null : posDraftRank - posFinishRank`, and adds `slotValue: null, productionValue: null`.
- In `buildDraft`, the `basePicks` object literal becomes `{ round: p.round, pickNo: p.pick_no, slot: p.draft_slot, userId: pickerOf(p), playerId: p.player_id, isKeeper: p.is_keeper === true, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null }` and the returned `Draft` gains `expectedCurve: null`.

- [ ] **Step 7: Update existing test fixtures to the new shape**

In `packages/core/test/draft.test.ts`:

- In the `buildDraft` describe, the `toEqual` for `d.picks[2]` becomes:
  ```ts
  expect(d.picks[2]).toEqual({ round: 1, pickNo: 3, slot: 3, userId: 'ua', playerId: 'p3', isKeeper: true, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null });
  ```
- The `pick` helper inside `describe('computeDraftValues')` becomes:
  ```ts
  const pick = (pickNo: number, playerId: string): DraftPick => ({ round: 1, pickNo, slot: pickNo, userId: `u${pickNo}`, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null });
  ```
- Delete these `it` blocks entirely (Task 2 replaces them): `ranks finish among all players at the position, league-wide`, `ties zero-point players just behind the scorers…`, `computes value as draft rank minus finish rank`, `places players without stats after everyone with points`.
- In `leaves value fields null for positions without a baseline` and `leaves value fields null for players with an unknown position`, replace `posFinishRank: null` with `redraftPos: null`.

- [ ] **Step 8: Run tests and typecheck**

Run: `pnpm --filter @fantasy-dash/core test && pnpm typecheck`
Expected: core tests PASS. `pnpm typecheck` will FAIL in `packages/web` (old field names in web fixtures and components). That is expected until Tasks 4–6; confirm the only errors are in `packages/web`.

- [ ] **Step 9: Commit**

```bash
git add packages/core
git commit -m "feat(core): draft pick v2 shape, capital curve, expected-curve fit, Sleeper transactions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: computeDraftValues v2 and season wiring

**Files:**
- Modify: `packages/core/src/draft.ts` (`DraftValueInput`, `computeDraftValues`, `buildDraft`, new `tradesFromTransactions`, `PlayerTrade`)
- Modify: `packages/core/src/season.ts:14-30` (`RawSeasonInput`) and `:147` (buildDraft call)
- Modify: `packages/core/test/draft.test.ts`

**Interfaces:**
- Consumes: `capital`, `fitExpectedCurve`, `expectedAt`, `SleeperTransaction` from Task 1.
- Produces:
  ```ts
  export interface PlayerTrade { playerId: PlayerId; toUserId: UserId; week: number; created: number }
  export interface DraftValueInput {
    seasonPoints: Record<PlayerId, number>;
    players: PlayerDirectory;
    gamesPlayed: Record<PlayerId, number>;
    teamGames: Record<string, number>;
    lastScoredWeek: number;
    totalWeeks: number;
    trades: PlayerTrade[];
  }
  export function tradesFromTransactions(transactions: SleeperTransaction[], rosterToUser: Record<number, UserId>): PlayerTrade[]
  export function computeDraftValues(picks: DraftPick[], input: DraftValueInput): { picks: DraftPick[]; expectedCurve: ExpectedCurve | null }
  export function buildDraft(draft: SleeperDraft, rawPicks: SleeperDraftPick[], rosterToUser: Record<number, UserId>, value: DraftValueInput): Draft
  ```
  `RawSeasonInput` gains `playerGames: Record<PlayerId, number>; teamGames: Record<string, number>; trades: SleeperTransaction[]`.

- [ ] **Step 1: Write the failing tests**

In `packages/core/test/draft.test.ts`, change the imports to:

```ts
import { buildDraft, computeDraftValues, tradesFromTransactions, capital, fitExpectedCurve, expectedAt, BASELINE_RANKS, type DraftValueInput } from '../src/draft';
import type { DraftPick, PlayerDirectory } from '../src/types';
import type { SleeperDraft, SleeperDraftPick, SleeperTransaction } from '../src/sleeper/types';
```

Replace `const noValue = { seasonPoints: {}, players: {} };` with:

```ts
const noValue: DraftValueInput = { seasonPoints: {}, players: {}, gamesPlayed: {}, teamGames: {}, lastScoredWeek: 0, totalWeeks: 17, trades: [] };
```

Replace the whole `describe('computeDraftValues', …)` block with:

```ts
describe('computeDraftValues', () => {
  // Four scoring RBs + one zero RB, three QBs, a DEF, and an unknown-position player.
  const players: PlayerDirectory = {
    rbA: info('rbA', 'RB'), rbB: info('rbB', 'RB'), rbC: info('rbC', 'RB'), rbX: info('rbX', 'RB'), rbY: { ...info('rbY', 'RB'), team: 'SF' },
    qbA: info('qbA', 'QB'), qbB: info('qbB', 'QB'), qbX: info('qbX', 'QB'),
    def1: info('def1', 'DEF'), mys: info('mys', null),
  };
  players.rbA.team = 'DET'; players.qbA.team = 'KC';
  const seasonPoints = { rbA: 100, rbB: 250, rbC: 50, rbX: 300, qbA: 400, qbB: 380, qbX: 390, def1: 90, mys: 999 };
  const pick = (pickNo: number, playerId: string): DraftPick => ({ round: 1, pickNo, slot: pickNo, userId: `u${pickNo}`, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null });
  const input: DraftValueInput = {
    seasonPoints, players,
    gamesPlayed: { rbA: 5, qbA: 4, rbB: 5, def1: 5 },
    teamGames: { DET: 5, KC: 5, SF: 4 },
    lastScoredWeek: 5, totalWeeks: 17,
    trades: [
      { playerId: 'rbB', toUserId: 'u9', week: 2, created: 200 },
      { playerId: 'rbB', toUserId: 'u8', week: 4, created: 400 },
    ],
  };
  const drafted = [pick(1, 'rbA'), pick(2, 'qbA'), pick(3, 'rbB'), pick(4, 'mys'), pick(5, 'qbB'), pick(6, 'rbC'), pick(7, 'def1'), pick(8, 'rbY')];
  const { picks, expectedCurve } = computeDraftValues(drafted, input);
  const by = Object.fromEntries(picks.map((p) => [p.playerId, p]));

  it('leaves value fields null for defenses but keeps points, games and ppg', () => {
    expect(by.def1).toMatchObject({ seasonPoints: 90, gamesPlayed: 5, ppg: 18, healthy: false, posDraftRank: null, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null });
  });

  it('leaves value fields null for players with an unknown position', () => {
    expect(by.mys).toMatchObject({ posDraftRank: null, pointsOverBaseline: null, redraftPos: null, value: null, seasonPoints: 999 });
  });

  it('ranks picks within their position by pick order', () => {
    expect([by.rbA.posDraftRank, by.rbB.posDraftRank, by.rbC.posDraftRank, by.rbY.posDraftRank]).toEqual([1, 2, 3, 4]);
    expect([by.qbA.posDraftRank, by.qbB.posDraftRank]).toEqual([1, 2]);
  });

  it('computes points over the positional baseline (baseline 0 when the pool is shallow)', () => {
    expect(by.rbA.pointsOverBaseline).toBe(100);
    expect(by.qbB.pointsOverBaseline).toBe(380);
    expect(by.rbY.pointsOverBaseline).toBe(0);
  });

  it('uses the baseline player\'s points when the pool is deep enough', () => {
    const deepPlayers: PlayerDirectory = {};
    const deepPoints: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) { deepPlayers[`k${i}`] = info(`k${i}`, 'K'); deepPoints[`k${i}`] = 200 - i * 10; } // k1 190 ... k12 80
    const { picks: [p] } = computeDraftValues([pick(1, 'k3')], { ...input, seasonPoints: deepPoints, players: deepPlayers });
    expect(BASELINE_RANKS.K).toBe(10);
    expect(p.pointsOverBaseline).toBe(170 - 100); // k3 170 minus k10 100
  });

  it('ranks the redraft order across positions by points over baseline, zero scorers tied last', () => {
    // qbA 400, qbX 390, qbB 380, rbX 300, rbB 250, rbA 100, rbC 50 -> 7 scorers; rbY ties at 8
    expect(by.qbA.redraftPos).toBe(1);
    expect(by.qbB.redraftPos).toBe(3);
    expect(by.rbB.redraftPos).toBe(5);
    expect(by.rbA.redraftPos).toBe(6);
    expect(by.rbC.redraftPos).toBe(7);
    expect(by.rbY.redraftPos).toBe(8);
  });

  it('computes slot value as capital gained between the pick and the redraft position', () => {
    expect(by.rbA.slotValue).toBeCloseTo(capital(6) - capital(1), 1);   // -10.5
    expect(by.qbA.slotValue).toBeCloseTo(capital(1) - capital(2), 1);   // +2.2
    expect(by.qbB.slotValue).toBeCloseTo(capital(3) - capital(5), 1);   // +4.2
    expect(by.rbY.slotValue).toBe(0);
  });

  it('fits the expected curve on valued picks and scales production to a full-season pace', () => {
    expect(expectedCurve).not.toBeNull();
    const pace = 17 / 5;
    for (const id of ['rbA', 'qbA', 'rbB', 'qbB', 'rbC', 'rbY']) {
      const p = by[id];
      const contribution = Math.max(p.pointsOverBaseline!, 0);
      const expected = Math.round((contribution - expectedAt(expectedCurve!, p.pickNo)) * pace * 10) / 10;
      expect(p.productionValue).toBeCloseTo(expected, 1);
      expect(p.value).toBeCloseTo(p.slotValue! + p.productionValue!, 1);
    }
  });

  it('fills games played, ppg and healthy from the inputs', () => {
    expect(by.rbA).toMatchObject({ gamesPlayed: 5, ppg: 20, healthy: true });      // DET played 5, rbA 5
    expect(by.qbA).toMatchObject({ gamesPlayed: 4, ppg: 100, healthy: false });    // KC played 5, qbA 4
    expect(by.rbY).toMatchObject({ gamesPlayed: 0, ppg: null, healthy: false });   // no games
    expect(by.rbB.healthy).toBe(false);                                            // no team
  });

  it('marks the latest completed trade per player', () => {
    expect(by.rbB.tradedTo).toEqual({ userId: 'u8', week: 4 });
    expect(by.rbA.tradedTo).toBeNull();
  });

  it('nulls every value field before the first scored week', () => {
    const res = computeDraftValues(drafted, { ...input, lastScoredWeek: 0 });
    expect(res.expectedCurve).toBeNull();
    for (const p of res.picks) expect(p).toMatchObject({ pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null });
    expect(res.picks[0].posDraftRank).toBe(1);
  });
});

describe('tradesFromTransactions', () => {
  const tx = (over: Partial<SleeperTransaction>): SleeperTransaction => ({ transaction_id: 't', type: 'trade', status: 'complete', leg: 3, created: 100, adds: null, drops: null, roster_ids: [], ...over });
  it('keeps completed trades only and maps rosters to users', () => {
    const out = tradesFromTransactions([
      tx({ adds: { p1: 2, p2: 1 }, drops: { p1: 1, p2: 2 }, roster_ids: [1, 2] }),
      tx({ type: 'waiver', adds: { p3: 1 } }),
      tx({ status: 'failed', adds: { p4: 1 } }),
      tx({ adds: { p5: 9 }, leg: 6, created: 600 }),
    ], { 1: 'ua', 2: 'ub' });
    expect(out).toEqual([
      { playerId: 'p1', toUserId: 'ub', week: 3, created: 100 },
      { playerId: 'p2', toUserId: 'ua', week: 3, created: 100 },
      { playerId: 'p5', toUserId: 'roster-9', week: 6, created: 600 },
    ]);
  });
});
```

Also update the `buildDraft` describe's `toEqual` for `d.picks[2]` (from Task 1) — it stays valid because `noValue` has `lastScoredWeek: 0`, which nulls every value field. Add one assertion to `normalizes picks in pick order with keeper flags`:

```ts
    expect(d.expectedCurve).toBeNull();
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @fantasy-dash/core test -- draft`
Expected: FAIL (`tradesFromTransactions` not exported, `computeDraftValues` returns an array).

- [ ] **Step 3: Rewrite the value computation**

Replace everything in `packages/core/src/draft.ts` from `export interface DraftValueInput` to the end of the file with:

```ts
export interface PlayerTrade { playerId: PlayerId; toUserId: UserId; week: number; created: number }

export interface DraftValueInput {
  /** season points under league scoring for every NFL player with stats */
  seasonPoints: Record<PlayerId, number>;
  players: PlayerDirectory;
  /** scored weeks in which the player had gp >= 1 */
  gamesPlayed: Record<PlayerId, number>;
  /** scored weeks in which any player on the NFL team had gp >= 1 */
  teamGames: Record<string, number>;
  lastScoredWeek: number;
  /** regular season + playoff weeks */
  totalWeeks: number;
  trades: PlayerTrade[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Completed trades, one entry per player moved, with the receiving roster resolved to a user. */
export function tradesFromTransactions(transactions: SleeperTransaction[], rosterToUser: Record<number, UserId>): PlayerTrade[] {
  const out: PlayerTrade[] = [];
  for (const t of transactions) {
    if (t.type !== 'trade' || t.status !== 'complete' || !t.adds) continue;
    for (const [playerId, rosterId] of Object.entries(t.adds)) {
      out.push({ playerId, toUserId: rosterToUser[rosterId] ?? `roster-${rosterId}`, week: t.leg, created: t.created });
    }
  }
  return out;
}

/**
 * Fill every derived field on the picks. Pure.
 *
 * Points over baseline: per valued position (BASELINE_RANKS keys), the pool is every directory
 * player at that position with points > 0, sorted desc; the baseline is the pool entry at
 * BASELINE_RANKS[pos] (0 if the pool is shorter). Redraft position ranks all valued-position
 * players with points > 0 by PoB desc (ties: points desc, id asc); zero scorers tie at N + 1.
 * Slot value is draft capital gained; production value is contribution over the fitted expected
 * curve, on a full-season pace. DEF and unknown positions get null for every value field.
 * Before the first scored week every value field is null.
 */
export function computeDraftValues(picks: DraftPick[], input: DraftValueInput): { picks: DraftPick[]; expectedCurve: ExpectedCurve | null } {
  const posOf = (id: PlayerId) => input.players[id]?.position ?? null;
  const valued = (pos: string | null): pos is string => pos !== null && BASELINE_RANKS[pos] !== undefined;
  const pts = (id: PlayerId) => input.seasonPoints[id] ?? 0;
  const scored = input.lastScoredWeek > 0;

  // Baseline points per valued position.
  const byPos = new Map<string, PlayerId[]>();
  for (const id of Object.keys(input.players)) {
    const pos = posOf(id);
    if (!valued(pos)) continue;
    const list = byPos.get(pos) ?? [];
    list.push(id);
    byPos.set(pos, list);
  }
  const baselinePoints = new Map<string, number>();
  for (const [pos, all] of byPos) {
    const scorers = all.filter((id) => pts(id) > 0).sort((a, b) => pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
    const baseId = scorers[BASELINE_RANKS[pos] - 1];
    baselinePoints.set(pos, baseId ? pts(baseId) : 0);
  }
  const pobOf = (id: PlayerId): number => round2(pts(id) - (baselinePoints.get(posOf(id) ?? '') ?? 0));

  // Redraft order across positions.
  const redraft = new Map<PlayerId, number>();
  const scorers = [...byPos.values()].flat().filter((id) => pts(id) > 0)
    .sort((a, b) => pobOf(b) - pobOf(a) || pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
  scorers.forEach((id, i) => redraft.set(id, i + 1));
  const lastPos = scorers.length + 1;

  // Latest trade per player.
  const tradedTo = new Map<PlayerId, { userId: UserId; week: number; created: number }>();
  for (const t of input.trades) {
    const cur = tradedTo.get(t.playerId);
    if (!cur || t.created > cur.created) tradedTo.set(t.playerId, { userId: t.toUserId, week: t.week, created: t.created });
  }

  const ordered = [...picks].sort((a, b) => a.pickNo - b.pickNo);
  const seen = new Map<string, number>();
  const base = ordered.map((p) => {
    const pos = posOf(p.playerId);
    const seasonPoints = round2(pts(p.playerId));
    const gamesPlayed = input.gamesPlayed[p.playerId] ?? 0;
    const team = input.players[p.playerId]?.team ?? null;
    const teamGames = team ? input.teamGames[team] ?? 0 : 0;
    const traded = tradedTo.get(p.playerId);
    const common = {
      ...p,
      seasonPoints,
      gamesPlayed,
      ppg: gamesPlayed > 0 ? round2(seasonPoints / gamesPlayed) : null,
      healthy: gamesPlayed > 0 && team !== null && gamesPlayed >= teamGames,
      tradedTo: traded ? { userId: traded.userId, week: traded.week } : null,
      pointsOverBaseline: null as number | null,
      redraftPos: null as number | null,
      slotValue: null as number | null,
      productionValue: null as number | null,
      value: null as number | null,
    };
    if (!valued(pos)) return { ...common, posDraftRank: null };
    const posDraftRank = (seen.get(pos) ?? 0) + 1;
    seen.set(pos, posDraftRank);
    if (!scored) return { ...common, posDraftRank };
    const redraftPos = redraft.get(p.playerId) ?? lastPos;
    return {
      ...common,
      posDraftRank,
      pointsOverBaseline: pobOf(p.playerId),
      redraftPos,
      slotValue: round1(capital(redraftPos) - capital(p.pickNo)),
    };
  });

  if (!scored) return { picks: base, expectedCurve: null };

  const contribution = (p: DraftPick) => Math.max(p.pointsOverBaseline ?? 0, 0);
  const curve = fitExpectedCurve(base.filter((p) => p.pointsOverBaseline !== null).map((p) => ({ pick: p.pickNo, contribution: contribution(p) })));
  const pace = input.totalWeeks / input.lastScoredWeek;
  const finished = base.map((p) => {
    if (p.pointsOverBaseline === null) return p;
    const expected = curve ? expectedAt(curve, p.pickNo) : 0;
    const productionValue = round1((contribution(p) - expected) * pace);
    return { ...p, productionValue, value: round1((p.slotValue ?? 0) + productionValue) };
  });
  return { picks: finished, expectedCurve: curve };
}

/** Normalize a Sleeper draft. Pickers come from `picked_by`, else the roster owner. */
export function buildDraft(draft: SleeperDraft, rawPicks: SleeperDraftPick[], rosterToUser: Record<number, UserId>, value: DraftValueInput): Draft {
  const pickerOf = (p: SleeperDraftPick): UserId =>
    p.picked_by ?? (p.roster_id != null ? rosterToUser[p.roster_id] ?? `roster-${p.roster_id}` : 'unknown');

  const basePicks: DraftPick[] = [...rawPicks]
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((p) => ({
      round: p.round, pickNo: p.pick_no, slot: p.draft_slot, userId: pickerOf(p), playerId: p.player_id, isKeeper: p.is_keeper === true,
      posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false,
      pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null,
    }));
  const { picks, expectedCurve } = computeDraftValues(basePicks, value);

  let slotOrder: UserId[];
  if (draft.draft_order && Object.keys(draft.draft_order).length > 0) {
    slotOrder = Object.entries(draft.draft_order).sort((a, b) => a[1] - b[1]).map(([userId]) => userId);
  } else {
    slotOrder = picks.filter((p) => p.round === 1).sort((a, b) => a.slot - b.slot).map((p) => p.userId);
  }

  return { draftId: draft.draft_id, type: draft.type, rounds: draft.settings.rounds, slotOrder, picks, expectedCurve };
}
```

Add `SleeperTransaction` to the `./sleeper/types` import at the top of the file.

- [ ] **Step 4: Wire the season builder**

In `packages/core/src/season.ts`:

- Add to the `./sleeper/types` import: `SleeperTransaction`.
- Change the `./draft` import to `import { buildDraft, tradesFromTransactions } from './draft';`
- Extend `RawSeasonInput` after `playerSeasonPoints`:
  ```ts
  /** scored weeks in which the player had gp >= 1 */
  playerGames: Record<PlayerId, number>;
  /** scored weeks in which any player on the NFL team had gp >= 1 */
  teamGames: Record<string, number>;
  /** every transaction for weeks 1..maxWeek; only completed trades are used */
  trades: SleeperTransaction[];
  ```
- Replace the `const draft = …` line with:
  ```ts
  const draft = input.draft
    ? buildDraft(input.draft.draft, input.draft.picks, rosterToUser, {
        seasonPoints: input.playerSeasonPoints,
        players,
        gamesPlayed: input.playerGames,
        teamGames: input.teamGames,
        lastScoredWeek,
        totalWeeks: maxWeek,
        trades: tradesFromTransactions(input.trades, rosterToUser),
      })
    : null;
  ```

Find any other `RawSeasonInput` literals in `packages/core/test` (`grep -rn "playerSeasonPoints" packages/core/test`) and add `playerGames: {}, teamGames: {}, trades: []` to each.

- [ ] **Step 5: Run tests and typecheck core**

Run: `pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/core exec tsc --noEmit -p .`
Expected: all core tests PASS, no type errors in core.

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): redraft position, slot and production value, trades, ppg and healthy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Sync collects games, team games and trades; regenerate data

**Files:**
- Modify: `scripts/sync.ts:70-112`

**Interfaces:**
- Consumes `RawSeasonInput.playerGames / teamGames / trades`, `SleeperClient.getTransactions`.

- [ ] **Step 1: Collect the new inputs in the week loop**

In `scripts/sync.ts`, add `type SleeperTransaction` to the `@fantasy-dash/core` import. Then replace the block from `const playerSeasonPoints: Record<string, number> = {};` through the end of the `for (let week …)` loop with:

```ts
  const playerSeasonPoints: Record<string, number> = {};
  const playerGames: Record<string, number> = {};
  const teamGames: Record<string, number> = {};
  const trades: SleeperTransaction[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const weekMatchups = (await client.getMatchups(id, week)) ?? [];
    matchups[week] = weekMatchups;
    const rostered = new Set(weekMatchups.flatMap((m) => m.players ?? []));
    const [proj, st, tx] = await Promise.all([
      client.getProjections(league.season, week),
      client.getStats(league.season, week),
      client.getTransactions(id, week),
    ]);
    if (week <= lastScoredLeg) {
      if (!proj) log(`WARNING: ${season} week ${week}: projections response was missing`);
      if (!st) log(`WARNING: ${season} week ${week}: stats response was missing`);
    }
    if (st && week <= lastScoredLeg) {
      const teamsThisWeek = new Set<string>();
      for (const [pid, line] of Object.entries(st)) {
        const pts = scoreStats(line, league.scoring_settings);
        if (pts !== 0) playerSeasonPoints[pid] = round2((playerSeasonPoints[pid] ?? 0) + pts);
        if ((line.gp ?? 0) >= 1) {
          playerGames[pid] = (playerGames[pid] ?? 0) + 1;
          const team = players[pid]?.team;
          if (team) teamsThisWeek.add(team);
        }
      }
      for (const team of teamsThisWeek) teamGames[team] = (teamGames[team] ?? 0) + 1;
    }
    for (const t of tx ?? []) if (t.type === 'trade' && t.status === 'complete') trades.push(t);
    projections[week] = pickIds(proj ?? {}, rostered);
    stats[week] = pickIds(st ?? {}, rostered);
    log(`  ${league.season} week ${week}: ${weekMatchups.length} roster entries, ${rostered.size} players`);
  }
```

Add `playerGames, teamGames, trades,` to the `RawSeasonInput` literal after `playerSeasonPoints,`, and change the log line after it to:

```ts
  log(`  ${season}: season points for ${Object.keys(playerSeasonPoints).length} players, ${trades.length} trades`);
```

- [ ] **Step 2: Typecheck scripts and dry-run the sync**

Run: `pnpm typecheck:scripts && pnpm sync -- --dry-run`
Expected: typecheck clean; sync log shows `N trades` per season (2023 should show 3, 2026 at least 1) and "Dry run complete".

- [ ] **Step 3: Regenerate data and sanity-check**

Run: `pnpm sync`
Then:

```bash
node -e "
const P=require('./data/players.json'); const s=require('./data/seasons/2026.json');
console.log('curve', s.draft.expectedCurve);
for (const p of s.draft.picks) { const n=P[p.playerId]?.name; if (['Jahmyr Gibbs','Matthew Golden','Parker Washington','Omarion Hampton','De\'Von Achane','Saquon Barkley'].includes(n)) console.log(n, p.pickNo, '->', p.redraftPos, 'slot', p.slotValue, 'prod', p.productionValue, 'value', p.value, 'ppg', p.ppg, p.healthy, p.tradedTo); }
console.log('DEF nulls ok:', s.draft.picks.filter(p=>P[p.playerId]?.position==='DEF').every(p=>p.value===null));
console.log('traded picks:', s.draft.picks.filter(p=>p.tradedTo).map(p=>P[p.playerId]?.name+'->'+s.managers[p.tradedTo.userId]?.displayName).join(', '));
"
```

Expected: Gibbs value > 0 (production dominated), Golden and Washington positive, Hampton/Saquon/Achane strongly negative with Achane ≤ Saquon ≤ Hampton; DEF nulls true; Charbonnet and Addison appear as traded. Signs and ordering must match the spec's reference table; magnitudes may differ slightly.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync.ts data
git commit -m "feat(sync): collect games played, team games and trades; regenerate data

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Web draft lib — colors, summaries, extremes, top PPG

**Files:**
- Modify: `packages/web/src/lib/draft.ts`
- Modify: `packages/web/src/lib/draft.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ManagerDraftSummary { userId: UserId; picks: number; totalValue: number; totalSlot: number; totalProduction: number; totalPoB: number; best: DraftPick | null; worst: DraftPick | null }
  export function managerDraftSummaries(draft: Draft): ManagerDraftSummary[]           // sorted by totalValue desc, then totalPoB desc
  export function leagueExtremes(draft: Draft, n = 10): { steals: DraftPick[]; busts: DraftPick[] }
  export function topHealthyPpg(draft: Draft, n = 10): DraftPick[]                      // healthy && value !== null && ppg !== null, by ppg desc then seasonPoints desc
  export const VALUE_SATURATION = 60;
  export function valueColor(value: number | null): string
  export function posLabel(pos: string, rank: number | null): string                   // unchanged
  ```

- [ ] **Step 1: Write the failing tests**

Replace `packages/web/src/lib/draft.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import type { Draft, DraftPick } from '@fantasy-dash/core';
import { managerDraftSummaries, leagueExtremes, topHealthyPpg, valueColor, posLabel } from './draft';

const pick = (pickNo: number, userId: string, value: number | null, pob: number, extra: Partial<DraftPick> = {}): DraftPick => ({
  round: 1, pickNo, slot: pickNo, userId, playerId: `p${pickNo}`, isKeeper: false,
  posDraftRank: 1, seasonPoints: 100, gamesPlayed: 5, ppg: 20, healthy: true,
  pointsOverBaseline: pob, redraftPos: 1, slotValue: value === null ? null : value / 2, productionValue: value === null ? null : value / 2, value, tradedTo: null, ...extra,
});
const draft: Draft = { draftId: 'D', type: 'snake', rounds: 1, slotOrder: ['a', 'b'], expectedCurve: { a: 40, k: 36 },
  picks: [pick(1, 'a', 5, 40), pick(2, 'b', -8, -20), pick(3, 'a', -2, 10), pick(4, 'b', 12, 60), pick(5, 'a', null, 5)] };

describe('managerDraftSummaries', () => {
  it('sums value parts and points over baseline per manager, finds best and worst, sorts by value', () => {
    const [first, second] = managerDraftSummaries(draft);
    expect(first).toMatchObject({ userId: 'b', picks: 2, totalValue: 4, totalSlot: 2, totalProduction: 2, totalPoB: 40 });
    expect(first.best?.pickNo).toBe(4);
    expect(first.worst?.pickNo).toBe(2);
    expect(second).toMatchObject({ userId: 'a', picks: 3, totalValue: 3, totalPoB: 55 });
    expect(second.best?.pickNo).toBe(1);
    expect(second.worst?.pickNo).toBe(3);
  });
});

describe('leagueExtremes', () => {
  it('returns the top steals and busts by value, ignoring unvalued picks, 10 by default', () => {
    const { steals, busts } = leagueExtremes(draft, 2);
    expect(steals.map((p) => p.pickNo)).toEqual([4, 1]);
    expect(busts.map((p) => p.pickNo)).toEqual([2, 3]);
    expect(leagueExtremes(draft).steals).toHaveLength(4);
  });
});

describe('topHealthyPpg', () => {
  it('keeps healthy, valued picks with games, sorted by ppg then points', () => {
    const d: Draft = { ...draft, picks: [
      pick(1, 'a', 5, 40, { ppg: 18 }),
      pick(2, 'b', -8, -20, { ppg: 25, healthy: false }),
      pick(3, 'a', -2, 10, { ppg: 22 }),
      pick(4, 'b', null, 60, { ppg: 30 }),               // DEF-like: no value
      pick(5, 'a', 1, 5, { ppg: 22, seasonPoints: 120 }),
      pick(6, 'b', 1, 5, { ppg: null, gamesPlayed: 0 }),
    ] };
    expect(topHealthyPpg(d).map((p) => p.pickNo)).toEqual([5, 3, 1]);
    expect(topHealthyPpg(d, 1).map((p) => p.pickNo)).toEqual([5]);
  });
});

describe('valueColor and posLabel', () => {
  it('maps value onto a red-yellow-green scale saturating at 60', () => {
    expect(valueColor(null)).toBe('transparent');
    expect(valueColor(0)).toBe('#e6c229');
    expect(valueColor(30)).toBe('color-mix(in oklch, #2f9e5f 50%, #e6c229)');
    expect(valueColor(90)).toBe('color-mix(in oklch, #2f9e5f 100%, #e6c229)');
    expect(valueColor(-15)).toBe('color-mix(in oklch, #d64545 25%, #e6c229)');
  });
  it('formats positional draft rank', () => {
    expect(posLabel('RB', 7)).toBe('RB7');
    expect(posLabel('RB', null)).toBe('RB');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @fantasy-dash/web test -- lib/draft`
Expected: FAIL (`topHealthyPpg` missing, old colors, old sort).

- [ ] **Step 3: Implement**

Replace `packages/web/src/lib/draft.ts` with:

```ts
import type { Draft, DraftPick, UserId } from '@fantasy-dash/core';

export interface ManagerDraftSummary {
  userId: UserId; picks: number; totalValue: number; totalSlot: number; totalProduction: number; totalPoB: number; best: DraftPick | null; worst: DraftPick | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function managerDraftSummaries(draft: Draft): ManagerDraftSummary[] {
  const map = new Map<UserId, ManagerDraftSummary>();
  for (const p of draft.picks) {
    const s = map.get(p.userId) ?? { userId: p.userId, picks: 0, totalValue: 0, totalSlot: 0, totalProduction: 0, totalPoB: 0, best: null, worst: null };
    s.picks += 1;
    if (p.value !== null) {
      s.totalValue += p.value;
      s.totalSlot += p.slotValue ?? 0;
      s.totalProduction += p.productionValue ?? 0;
      if (!s.best || p.value > (s.best.value ?? -Infinity)) s.best = p;
      if (!s.worst || p.value < (s.worst.value ?? Infinity)) s.worst = p;
    }
    if (p.pointsOverBaseline !== null) s.totalPoB += p.pointsOverBaseline;
    map.set(p.userId, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, totalValue: r1(s.totalValue), totalSlot: r1(s.totalSlot), totalProduction: r1(s.totalProduction), totalPoB: r1(s.totalPoB) }))
    .sort((a, b) => b.totalValue - a.totalValue || b.totalPoB - a.totalPoB);
}

export function leagueExtremes(draft: Draft, n = 10): { steals: DraftPick[]; busts: DraftPick[] } {
  const valued = draft.picks.filter((p) => p.value !== null);
  const tie = (a: DraftPick, b: DraftPick) => (b.pointsOverBaseline ?? 0) - (a.pointsOverBaseline ?? 0);
  const byValueDesc = [...valued].sort((a, b) => (b.value! - a.value!) || tie(a, b));
  const byValueAsc = [...valued].sort((a, b) => (a.value! - b.value!) || tie(a, b));
  return { steals: byValueDesc.slice(0, n), busts: byValueAsc.slice(0, n) };
}

/** Highest PPG among valued picks who have played every game their team has played. */
export function topHealthyPpg(draft: Draft, n = 10): DraftPick[] {
  return draft.picks
    .filter((p) => p.healthy && p.value !== null && p.ppg !== null)
    .sort((a, b) => b.ppg! - a.ppg! || b.seasonPoints - a.seasonPoints)
    .slice(0, n);
}

export const VALUE_SATURATION = 60;
const RED = '#d64545';
const YELLOW = '#e6c229';
const GREEN = '#2f9e5f';

/** Red → yellow → green fill for a value cell. Yellow at 0, fully red/green at ±VALUE_SATURATION. */
export function valueColor(value: number | null): string {
  if (value === null) return 'transparent';
  const pct = Math.round(Math.min(Math.abs(value), VALUE_SATURATION) / VALUE_SATURATION * 100);
  if (pct === 0) return YELLOW;
  return `color-mix(in oklch, ${value > 0 ? GREEN : RED} ${pct}%, ${YELLOW})`;
}

export function posLabel(pos: string, rank: number | null): string {
  return rank === null ? pos : `${pos}${rank}`;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @fantasy-dash/web test -- lib/draft`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/draft.ts packages/web/src/lib/draft.test.ts
git commit -m "feat(web): draft lib for value v2 (red-yellow-green scale, slot/production sums, top healthy ppg)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Draft board cells — scale, tooltip, keeper lock, trade marker

**Files:**
- Modify: `packages/web/src/components/draft/DraftBoard.tsx`
- Modify: `packages/web/src/components/draft/DraftBoard.test.tsx`

**Interfaces:**
- Consumes `valueColor`, `posLabel` from Task 4; `DraftPick` v2.
- Props are unchanged: `{ draft, managers, players, mode, highlight, onHighlight, inSeason }`.

- [ ] **Step 1: Write the failing tests**

Replace `packages/web/src/components/draft/DraftBoard.test.tsx` with:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import type { Draft, DraftPick, Manager, PlayerDirectory } from '@fantasy-dash/core';
import DraftBoard from './DraftBoard';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
};
const players: PlayerDirectory = {
  p1: { id: 'p1', name: 'Player One', firstName: 'Player', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 1 },
  p2: { id: 'p2', name: 'Player Two', firstName: 'Player', lastName: 'Two', position: 'WR', team: 'DAL', yearsExp: 1 },
  p3: { id: 'p3', name: 'Player Three', firstName: 'Player', lastName: 'Three', position: 'QB', team: 'KC', yearsExp: 1 },
  p4: { id: 'p4', name: 'Player Four', firstName: 'Player', lastName: 'Four', position: 'DEF', team: 'DET', yearsExp: 1 },
};
const pick = (round: number, pickNo: number, slot: number, userId: string, playerId: string, value: number | null, extra: Partial<DraftPick> = {}): DraftPick => ({
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: 1, seasonPoints: 120.5, gamesPlayed: 5, ppg: 24.1, healthy: true,
  pointsOverBaseline: 15.25, redraftPos: 2, slotValue: value === null ? null : 4, productionValue: value === null ? null : value - 4, value, tradedTo: null, ...extra,
});
const draft: Draft = {
  draftId: 'D', type: 'snake', rounds: 2, slotOrder: ['a', 'b'], expectedCurve: { a: 40, k: 36 },
  picks: [
    pick(1, 1, 1, 'a', 'p1', 6.5, { tradedTo: { userId: 'b', week: 3 } }),
    pick(1, 2, 2, 'b', 'p2', -30, { isKeeper: true }),
    pick(2, 3, 2, 'b', 'p3', 0),
    pick(2, 4, 1, 'a', 'p4', null, { posDraftRank: null, pointsOverBaseline: null, redraftPos: null }),
  ],
};

describe('DraftBoard', () => {
  it('lays picks out by round and slot with position labels and a detailed tooltip', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('Player One');
    expect(cells[0]).toHaveTextContent('RB1');
    expect(cells[3]).toHaveTextContent('DEF');
    const title = cells[0].getAttribute('title') ?? '';
    expect(title).toContain('Season points: 120.50');
    expect(title).toContain('Redraft position: 2 (drafted RB1)');
    expect(title).toContain('Slot value: +4.0 · Production value: +2.5');
    expect(title).toContain('Points over baseline: +15.25');
    expect(title).toContain('PPG: 24.1 over 5 games');
    expect(title).toContain('Traded to bob in week 3');
    expect(cells[1].getAttribute('title')).toContain('Keeper');
  });

  it('marks keepers with a lock and traded players with a swap icon and the new owner', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[1].querySelector('[aria-label="Keeper"]')).not.toBeNull();
    expect(cells[1]).not.toHaveTextContent(/keeper/i);
    expect(cells[0].querySelector('[aria-label="Traded"]')).not.toBeNull();
    expect(cells[0]).toHaveTextContent('bob');
    expect(cells[2].querySelector('[aria-label]')).toBeNull();
  });

  it('colors value mode on a red-yellow-green scale and shows the total value', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} mode="value" highlight={null} onHighlight={() => {}} inSeason={true} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[0].style.background).toContain('#2f9e5f');
    expect(cells[1].style.background).toContain('#d64545 50%');
    expect(cells[2].style.background).toBe('rgb(230, 194, 41)');
    expect(cells[3].style.background).toBe('transparent');
    expect(cells[0]).toHaveTextContent('+7');
    expect(cells[1]).toHaveTextContent('-30');
    expect(cells[0].getAttribute('title')).toContain('Season points to date');
    expect(cells[0].getAttribute('title')).toContain('Redraft position today');
  });

  it('highlights one manager\'s picks when the column header is clicked', () => {
    const onHighlight = vi.fn();
    render(<DraftBoard draft={draft} managers={managers} players={players} mode="value" highlight="a" onHighlight={onHighlight} inSeason={false} />);
    fireEvent.click(screen.getByRole('button', { name: /alice/ }));
    expect(onHighlight).toHaveBeenCalledWith(null);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells[0]).toHaveAttribute('data-highlight', 'true');
    expect(cells[1]).toHaveAttribute('data-highlight', 'false');
  });
});
```

Note: jsdom normalizes a hex `background` to `rgb(...)` but leaves `color-mix(...)` strings as written; the assertions above rely on that.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @fantasy-dash/web test -- DraftBoard`
Expected: FAIL on tooltip text and markers.

- [ ] **Step 3: Implement the board**

Replace `packages/web/src/components/draft/DraftBoard.tsx` with:

```tsx
import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtSigned } from '../../lib/format';
import { playerName, playerPos, playerTeam, posColor } from '../../lib/players';
import { posLabel, valueColor } from '../../lib/draft';

export type BoardMode = 'position' | 'value';

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory;
  mode: BoardMode; highlight: UserId | null; onHighlight: (userId: UserId | null) => void; inSeason: boolean;
}

function cellTitle(p: DraftPick, players: PlayerDirectory, managers: Record<UserId, Manager>, inSeason: boolean): string {
  const pos = playerPos(players, p.playerId);
  const suffix = inSeason ? ' to date' : '';
  const lines = [
    `${playerName(players, p.playerId)} · ${pos} · ${playerTeam(players, p.playerId)}`,
    `Pick ${p.pickNo} (round ${p.round})`,
    `Season points${suffix}: ${fmtPts(p.seasonPoints)}`,
  ];
  if (p.redraftPos !== null) lines.push(`Redraft position${inSeason ? ' today' : ''}: ${p.redraftPos} (drafted ${posLabel(pos, p.posDraftRank)})`);
  if (p.slotValue !== null && p.productionValue !== null) lines.push(`Slot value: ${fmtSigned(p.slotValue, 1)} · Production value: ${fmtSigned(p.productionValue, 1)}`);
  if (p.pointsOverBaseline !== null) lines.push(`Points over baseline: ${fmtSigned(p.pointsOverBaseline, 2)}`);
  if (p.ppg !== null) lines.push(`PPG: ${fmtPpg(p.ppg)} over ${p.gamesPlayed} game${p.gamesPlayed === 1 ? '' : 's'}`);
  if (p.isKeeper) lines.push('Keeper');
  if (p.tradedTo) lines.push(`Traded to ${managers[p.tradedTo.userId]?.displayName ?? p.tradedTo.userId} in week ${p.tradedTo.week}`);
  return lines.join('\n');
}

const LockIcon = () => (
  <svg aria-label="Keeper" role="img" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-1 top-1 text-accent">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const SwapIcon = () => (
  <svg aria-label="Traded" role="img" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M4 7h13l-3-3" />
    <path d="M20 17H7l3 3" />
  </svg>
);

export default function DraftBoard({ draft, managers, players, mode, highlight, onHighlight, inSeason }: Props) {
  const slots = draft.slotOrder.length;
  const cols = `3rem repeat(${slots}, minmax(0, 1fr))`;
  const bySlot = new Map<string, DraftPick>();
  for (const p of draft.picks) bySlot.set(`${p.round}-${p.slot}`, p);
  const rounds = Array.from({ length: draft.rounds }, (_, i) => i + 1);

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[960px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div />
          {draft.slotOrder.map((userId, i) => {
            const m = managers[userId];
            const active = highlight === userId;
            return (
              <button
                key={userId}
                type="button"
                onClick={() => onHighlight(active ? null : userId)}
                aria-pressed={active}
                className={`truncate px-2 py-2 text-left text-xs transition-colors ${active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
                title={`${m?.teamName ?? ''} · slot ${i + 1}`}
              >
                {m?.displayName ?? userId}
              </button>
            );
          })}
        </div>
        {rounds.map((round) => (
          <div key={round} className="grid border-t border-line" style={{ gridTemplateColumns: cols }}>
            <div className="num flex items-center justify-center text-xs text-muted">{round}</div>
            {draft.slotOrder.map((_, i) => {
              const slot = i + 1;
              const p = bySlot.get(`${round}-${slot}`);
              if (!p) return <div key={slot} className="h-14 border-l border-line" />;
              const pos = playerPos(players, p.playerId);
              const isHl = highlight !== null && p.userId === highlight;
              const dim = highlight !== null && !isHl;
              const colored = mode === 'value' && p.value !== null;
              const background = mode === 'position' ? `color-mix(in srgb, ${posColor(pos)} 16%, transparent)` : valueColor(p.value);
              const ring = isHl ? 'ring-1 ring-inset ring-accent' : p.isKeeper ? 'ring-1 ring-inset ring-accent/60' : '';
              return (
                <div
                  key={slot}
                  data-testid="draft-cell"
                  data-highlight={isHl ? 'true' : 'false'}
                  title={cellTitle(p, players, managers, inSeason)}
                  style={{ background, color: colored ? '#1a1a1a' : undefined }}
                  className={`relative flex h-14 flex-col justify-center border-l border-line px-2 text-xs transition-opacity ${dim ? 'opacity-35' : ''} ${ring}`}
                >
                  {p.isKeeper && <LockIcon />}
                  <div className="truncate pr-3 font-medium">{playerName(players, p.playerId)}</div>
                  <div className={`flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] ${colored ? '' : 'text-muted'}`}>
                    <span className="font-semibold" style={mode === 'position' ? { color: posColor(pos) } : undefined}>{posLabel(pos, p.posDraftRank)}</span>
                    <span className={colored ? 'opacity-75' : ''}>{playerTeam(players, p.playerId)}</span>
                    {p.tradedTo && (
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <SwapIcon />
                        <span className="truncate">{managers[p.tradedTo.userId]?.displayName ?? p.tradedTo.userId}</span>
                      </span>
                    )}
                    {mode === 'value' && p.value !== null && <span className="num ml-auto font-semibold">{fmtSigned(p.value, 0)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @fantasy-dash/web test -- DraftBoard`
Expected: PASS. If the `rgb(230, 194, 41)` assertion fails because jsdom kept the hex, change that one assertion to `toMatch(/#e6c229|rgb\(230, 194, 41\)/)`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/draft/DraftBoard.tsx packages/web/src/components/draft/DraftBoard.test.tsx
git commit -m "feat(web): draft board red-yellow-green scale, lock and trade markers, v2 tooltip

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Analysis panel, Top PPG card, season review value; full verification

**Files:**
- Modify: `packages/web/src/components/draft/DraftAnalysis.tsx`
- Create: `packages/web/src/components/draft/TopPpg.tsx`
- Modify: `packages/web/src/components/history/DraftRoundOne.tsx`
- Modify: `packages/web/src/pages/DraftPage.tsx:33`

**Interfaces:**
- Consumes `managerDraftSummaries`, `leagueExtremes`, `topHealthyPpg`, `posLabel` from Task 4.
- Produces `TopPpg` component: `{ draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }`.

- [ ] **Step 1: Rewrite DraftAnalysis**

Replace `packages/web/src/components/draft/DraftAnalysis.tsx` with:

```tsx
import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import { fmtSigned } from '../../lib/format';
import { playerName, playerPos } from '../../lib/players';
import { leagueExtremes, managerDraftSummaries, posLabel } from '../../lib/draft';

const signClass = (n: number, fallback = 'text-muted') => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : fallback);

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

function PickLine({ p, players, managers }: { p: DraftPick; players: PlayerDirectory; managers: Record<UserId, Manager> }) {
  const pos = playerPos(players, p.playerId);
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <Headshot players={players} id={p.playerId} size={24} />
      <span className="min-w-0 flex-1 truncate">
        {playerName(players, p.playerId)}{' '}
        <span className="text-xs text-muted">{posLabel(pos, p.posDraftRank)} · pick {p.pickNo} → redraft {p.redraftPos ?? '?'} · {managers[p.userId]?.displayName}</span>
      </span>
      <span className={`num ${signClass(p.value ?? 0)}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
      <span className="num w-16 text-right text-xs text-muted">{p.pointsOverBaseline === null ? '' : fmtSigned(p.pointsOverBaseline, 1)}</span>
    </li>
  );
}

const HEADERS = ['Manager', 'Value', 'Slot', 'Production', 'Pts over baseline', 'Best pick', 'Worst pick'];
const NUMERIC = new Set([1, 2, 3, 4]);

export default function DraftAnalysis({ draft, managers, players, inSeason }: Props) {
  const summaries = managerDraftSummaries(draft);
  const { steals, busts } = leagueExtremes(draft, 10);
  const note = inSeason ? ' (to date)' : '';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="card overflow-x-auto">
        <div className="section-label px-4 pt-3">Draft grades{note}</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left">
            {HEADERS.map((h, i) => <th key={h} className={`section-label px-4 py-2 ${NUMERIC.has(i) ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {summaries.map((s) => {
              const m = managers[s.userId];
              return (
                <tr key={s.userId} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={22} />{m?.displayName ?? s.userId}</span></td>
                  <td className={`num px-4 py-2 text-right font-semibold ${signClass(s.totalValue, '')}`}>{fmtSigned(s.totalValue, 0)}</td>
                  <td className="num px-4 py-2 text-right text-muted">{fmtSigned(s.totalSlot, 0)}</td>
                  <td className="num px-4 py-2 text-right text-muted">{fmtSigned(s.totalProduction, 0)}</td>
                  <td className="num px-4 py-2 text-right text-muted">{fmtSigned(s.totalPoB, 1)}</td>
                  <td className="px-4 py-2 text-xs">{s.best ? `${playerName(players, s.best.playerId)} (${fmtSigned(s.best.value ?? 0, 0)})` : '—'}</td>
                  <td className="px-4 py-2 text-xs">{s.worst ? `${playerName(players, s.worst.playerId)} (${fmtSigned(s.worst.value ?? 0, 0)})` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-muted">
          Value has two parts. Slot value converts the pick taken and the player's redraft position (where they would go if the league redrafted on this season's production) into draft capital on a trade-value curve, so a late dart that misses costs almost nothing and an early whiff costs most of what was spent. Production value is points over the positional baseline minus what a pick in that slot typically returns this season{inSeason ? ', on a 17-week pace' : ''}. Defenses are excluded.
        </p>
      </div>
      <div className="space-y-4">
        <div className="card px-4 py-3"><div className="section-label">Top steals{note}</div><ul className="divide-y divide-line">{steals.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
        <div className="card px-4 py-3"><div className="section-label">Top busts{note}</div><ul className="divide-y divide-line">{busts.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the Top PPG card**

Create `packages/web/src/components/draft/TopPpg.tsx`:

```tsx
import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtPpg } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import { topHealthyPpg } from '../../lib/draft';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

export default function TopPpg({ draft, managers, players, inSeason }: Props) {
  const rows = topHealthyPpg(draft, 10);
  if (rows.length === 0) return null;
  return (
    <div className="card overflow-x-auto">
      <div className="section-label px-4 pt-3">Top PPG (healthy){inSeason ? ' (to date)' : ''}</div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left">
          {['Player', 'Pick', 'Manager', 'G', 'PPG'].map((h, i) => <th key={h} className={`section-label px-4 py-2 ${i >= 3 ? 'text-right' : ''}`}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.pickNo} className="border-t border-line hover:bg-surface-2">
              <td className="px-4 py-2">
                <span className="flex items-center gap-2">
                  <Headshot players={players} id={p.playerId} size={24} />
                  <span className="truncate font-medium">{playerName(players, p.playerId)}</span>
                  <PosPill pos={playerPos(players, p.playerId)} />
                  <span className="text-xs text-muted">{playerTeam(players, p.playerId)}</span>
                </span>
              </td>
              <td className="num px-4 py-2">{p.pickNo}</td>
              <td className="px-4 py-2 text-xs">{managers[p.userId]?.displayName ?? p.userId}</td>
              <td className="num px-4 py-2 text-right">{p.gamesPlayed}</td>
              <td className="num px-4 py-2 text-right font-semibold">{p.ppg === null ? '—' : fmtPpg(p.ppg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted">Healthy means the player has played every game their team has played. Defenses are excluded.</p>
    </div>
  );
}
```

In `packages/web/src/pages/DraftPage.tsx`, import `TopPpg from '../components/draft/TopPpg'` and add after the `<DraftAnalysis … />` line:

```tsx
      <TopPpg draft={season.draft} managers={season.managers} players={players} inSeason={inSeason} />
```

- [ ] **Step 3: Show total value on the season review's round 1**

In `packages/web/src/components/history/DraftRoundOne.tsx`, add `import { fmtSigned } from '../../lib/format';` and replace the trailing `<span className="flex items-center gap-2">…</span>` with:

```tsx
              <span className="flex items-center gap-2">
                <PosPill pos={pos} />
                <span className="w-8 text-xs text-muted">{playerTeam(players, p.playerId)}</span>
                <span className={`num w-10 text-right text-xs ${p.value === null ? 'text-muted' : p.value > 0 ? 'text-win' : p.value < 0 ? 'text-loss' : 'text-muted'}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
              </span>
```

(The "Keeper" pill is removed from this list; the keeper marker lives on the board.)

- [ ] **Step 4: Full verification**

Run from the repo root:

```bash
pnpm typecheck && pnpm typecheck:scripts && pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/web test && pnpm build
```

Expected: all clean. Then screenshot `/draft/2026` and `/draft/2025` in both modes at 1280 and 390 px wide using the CDP script described in the ledger (`pnpm --filter @fantasy-dash/web preview` then headless Chrome). Confirm: red→yellow→green cells with dark text in value mode, lock icons on keepers, swap icon + name on Charbonnet/Addison (2026), Top PPG card renders, grades table has 7 columns, steals/busts show 10 rows.

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web): v2 draft grades, 10 steals and busts, top healthy ppg, round-1 value

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** contribution/redraft/slot/production/total → Task 2; DEF exclusion → Tasks 1–2 (BASELINE_RANKS) and 4 (filters on `value !== null`); zero-week nulls → Task 2; games/PPG/healthy → Tasks 2–3; trades → Tasks 1–3, 5; colors/tooltip/lock/swap → Tasks 4–5; grades columns/sort/note, 10 steals/busts, Top PPG → Tasks 4, 6; season review value → Task 6; schema/satisfies → Task 1; data regeneration → Task 3.
- **Type consistency:** `DraftValueInput` fields (`gamesPlayed`, `teamGames`, `lastScoredWeek`, `totalWeeks`, `trades`) match between Task 2's interface, tests, and season.ts wiring; `RawSeasonInput.playerGames` maps to `DraftValueInput.gamesPlayed` explicitly. `computeDraftValues` returns `{ picks, expectedCurve }` everywhere after Task 2 (Task 1 keeps the array return and Task 2's tests destructure, matching Task 2's implementation).
- **Known limitation carried forward:** `teamGames` and `healthy` use the player's current NFL team from the directory, so historical seasons can misclassify players who changed teams. Acceptable; the PPG list is primarily an in-season view.
