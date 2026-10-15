# Player Stats v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Player stats tab: per-section position filters and a season picker in the URL, a 4x3 League leaders grid with yardage/TD splits plus PPG, FPOE and xFP, a toilet bowl board, cumulative draft value, K/DEF exclusions, section-wide expand, and position pills before names.

**Architecture:** `playerLines.ts` grows raw opportunity and split fields. A new `xfp.ts` fits one least-squares line per position on all played lines and exposes `predict`. `playerBoards.ts` gains the new boards, a `pos`/`picks`/`xfp` context and a sort direction on `compute`. A new `Section` component owns the per-section filter, optional season picker and the shared expand state; `Board` becomes controlled. `PlayersView` holds URL state for every section.

**Tech Stack:** TypeScript, React 18, react-router v7, Vitest + Testing Library, Tailwind v4 with the project's `card`, `section-label`, `num`, `pos-pill` classes.

**Spec:** `docs/superpowers/specs/2026-10-14-player-stats-v2-design.md` (amends `2026-10-14-player-stats-design.md`).

## Global Constraints

- `packages/web` only. No core, schema, sync or data change.
- Position from `players.json`; `?` when unknown; FLEX = {RB, WR, TE}.
- Postseason tags {QF, SF, Final, 3rd, 5th}; consolation tags {Cons-R1, Toilet Bowl, Cons-7th}.
- `played` = line has at least one stat key.
- Ties: value desc (or asc when direction is `asc`), newest (year, week) desc, playerId asc. 25-row cap.
- Points 2 decimals (`fmtPts`), PPG/FPOE/xFP/draft value 1 decimal (`fmtPpg` for positive-only, `fmtSigned(v, 1)` for signed), counts and yards as integers.
- xFP positions {QB, RB, WR, TE}; a position needs ≥ 20 played lines; predictors with zero variance are dropped before solving; a system still singular after that yields no model for that position.
- Leaders thresholds: PPG ≥ 3 played games; FPOE and xFP ≥ 3 modelled lines.
- URL params `lead`, `all`, `post`, `extra` (PosFilter, absent = All, junk = All), `season` (leaders year, absent or unknown = current). `setParams(next, { replace: true })`.
- Run tests from `packages/web` with `npx vitest run <file>`; whole repo `pnpm test`; `pnpm build` typechecks and builds.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A position whose opportunity column is all zeros (RB pass attempts in a small fixture, TE in a short season): the fit must drop that predictor rather than return no model. Pinned in Task 2.
2. A season picked in the URL that has no lines yet (preseason, or `season=1999`): leaders must show "Season has not started." for an existing empty season and fall back to the current season for an unknown year. Pinned in Task 5.
3. A player drafted in a season whose draft has `value: null` for every pick (K, DEF, or a season before week 1): they must not appear on Cumulative draft value and must not produce a `NaN`. Pinned in Task 3.
4. FPOE "Under" with a position filter that leaves only unmodelled players (K): the board must show its empty state, not a crash or a list of zeros. Pinned in Task 3.
5. Expanding a section that contains boards with 5 or fewer rows: those boards must stay intact (no toggle, same rows) while their siblings expand. Pinned in Task 5.

---

### Task 1: Line fields and consolation flag

**Files:**
- Modify: `packages/web/src/lib/playerLines.ts`
- Test: `packages/web/src/lib/playerLines.test.ts`

**Interfaces:**
- Produces, added to `PlayerLine`: `targets`, `carries`, `passAttempts`, `rushYards`, `recYards`, `passYards`, `rushTd`, `recTd`, `passTd` (all `number`), `consolation: boolean`. Exports `CONSOLATION_TAGS: ReadonlySet<string>`.

- [ ] **Step 1: Write the failing test**

Append inside the top-level `describe('flattenLines', …)` block of `playerLines.test.ts`, after the `'does not count defensive touchdowns as touchdowns'` test:

```ts
  it('carries raw opportunity and split fields, zero when absent', () => {
    const q1 = lines.find((l) => l.playerId === 'q1' && l.week === 1)!;
    expect(q1).toMatchObject({ targets: 0, carries: 0, passAttempts: 0, rushYards: 10, recYards: 0, passYards: 300, rushTd: 0, recTd: 0, passTd: 2 });
    const rich = flattenLines([season(2025, [week(1, [game(2025, 1, 1,
      side('a', 30, [line('r1', 30, { rec_tgt: 7, rec: 5, rush_att: 12, rush_yd: 70, rec_yd: 40, rush_td: 1, rec_td: 1, pass_att: 1 })]),
      side('b', 0, [line('t1', 0, {})]))])])], players);
    expect(rich.find((l) => l.playerId === 'r1')).toMatchObject({ targets: 7, carries: 12, passAttempts: 1, rushYards: 70, recYards: 40, passYards: 0, rushTd: 1, recTd: 1, passTd: 0, yards: 110, touchdowns: 2 });
  });

  it('flags consolation games and not championship-bracket ones', () => {
    expect(lines.find((l) => l.week === 4 && l.playerId === 't1')!.consolation).toBe(true);   // Toilet Bowl
    expect(lines.find((l) => l.week === 3 && l.playerId === 'q1')!.consolation).toBe(false);  // Final
    const cons = flattenLines([season(2025, [
      week(3, [game(2025, 3, 1, side('a', 1, [line('q1', 1)]), side('b', 0, [line('r1', 0)]), 'Cons-R1')], true),
      week(4, [game(2025, 4, 1, side('a', 1, [line('w1', 1)]), side('b', 0, [line('t1', 0)]), 'Cons-7th')], true),
    ])], players);
    expect(cons.every((l) => l.consolation)).toBe(true);
    expect(cons.every((l) => !l.postseason)).toBe(true);
  });
```

Also update the first test's `toEqual` for `q1` so the exact-shape assertion includes the new fields:

```ts
    expect(q1).toEqual({
      playerId: 'q1', userId: 'a', year: 2025, week: 1, gameId: '2025-1-1', matchupId: 1, tag: null, started: true,
      points: 30, yards: 310, touchdowns: 2, receptions: 0, played: true, postseason: false, consolation: false, position: 'QB',
      targets: 0, carries: 0, passAttempts: 0, rushYards: 10, recYards: 0, passYards: 300, rushTd: 0, recTd: 0, passTd: 2,
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/lib/playerLines.test.ts`
Expected: FAIL on the `toEqual` (missing keys) and on `consolation` being `undefined`.

- [ ] **Step 3: Write the implementation**

In `playerLines.ts`, extend the interface and the push:

```ts
export interface PlayerLine {
  // … existing fields …
  /** consolation bracket: Cons-R1, Toilet Bowl, Cons-7th */
  consolation: boolean;
  targets: number;
  carries: number;
  passAttempts: number;
  rushYards: number;
  recYards: number;
  passYards: number;
  rushTd: number;
  recTd: number;
  passTd: number;
}

export const CONSOLATION_TAGS: ReadonlySet<string> = new Set(['Cons-R1', 'Toilet Bowl', 'Cons-7th']);
```

Inside `flattenLines`, next to `postseason`:

```ts
        const consolation = g.tag !== null && CONSOLATION_TAGS.has(g.tag);
```

and in the pushed object replace the `yards`/`touchdowns`/`receptions` lines with:

```ts
              yards: n(st, 'pass_yd') + n(st, 'rush_yd') + n(st, 'rec_yd'),
              touchdowns: n(st, 'pass_td') + n(st, 'rush_td') + n(st, 'rec_td'),
              receptions: n(st, 'rec'),
              targets: n(st, 'rec_tgt'), carries: n(st, 'rush_att'), passAttempts: n(st, 'pass_att'),
              rushYards: n(st, 'rush_yd'), recYards: n(st, 'rec_yd'), passYards: n(st, 'pass_yd'),
              rushTd: n(st, 'rush_td'), recTd: n(st, 'rec_td'), passTd: n(st, 'pass_td'),
              played: Object.keys(st).length > 0,
              postseason,
              consolation,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/lib/playerLines.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/playerLines.ts packages/web/src/lib/playerLines.test.ts
git commit -m "feat(web): opportunity, split and consolation fields on player lines

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: xFP model

**Files:**
- Create: `packages/web/src/lib/xfp.ts`
- Test: `packages/web/src/lib/xfp.test.ts`

**Interfaces:**
- Consumes: `PlayerLine` (Task 1 fields `targets`, `carries`, `passAttempts`, `points`, `played`, `position`).
- Produces:
  ```ts
  export const XFP_POSITIONS: readonly string[] = ['QB', 'RB', 'WR', 'TE'];
  export const MIN_FIT_LINES = 20;
  export interface XfpModel { coef: Record<string, number[] | null>; predict(line: PlayerLine): number | null }
  export function fitXfp(lines: PlayerLine[]): XfpModel;
  ```
  `coef[pos]` is `[a, b1, b2, b3]` for intercept, targets, carries, passAttempts (dropped predictors have coefficient 0), or `null` when no model.

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/lib/xfp.test.ts
import { describe, it, expect } from 'vitest';
import type { PlayerLine } from './playerLines';
import { fitXfp, MIN_FIT_LINES } from './xfp';

const base: PlayerLine = {
  playerId: 'p', userId: 'a', year: 2025, week: 1, gameId: '2025-1-1', matchupId: 1, tag: null, started: true,
  points: 0, yards: 0, touchdowns: 0, receptions: 0, played: true, postseason: false, consolation: false, position: 'RB',
  targets: 0, carries: 0, passAttempts: 0, rushYards: 0, recYards: 0, passYards: 0, rushTd: 0, recTd: 0, passTd: 0,
};
const rb = (i: number): PlayerLine => {
  const targets = i % 7; const carries = (i * 3) % 11;
  return { ...base, playerId: `rb${i}`, week: (i % 17) + 1, targets, carries, points: 2 + 1.5 * targets + 0.6 * carries };
};
const qb = (i: number): PlayerLine => {
  const passAttempts = 20 + (i % 13); const carries = i % 5;
  return { ...base, playerId: `qb${i}`, position: 'QB', passAttempts, carries, points: 1 + 0.5 * passAttempts + 0.8 * carries };
};

describe('fitXfp', () => {
  const lines = [...Array.from({ length: 30 }, rb), ...Array.from({ length: 30 }, qb)];
  const model = fitXfp(lines);

  it('recovers an exact linear relationship per position, dropping all-zero predictors', () => {
    expect(model.coef.RB!.map((c) => +c.toFixed(6))).toEqual([2, 1.5, 0.6, 0]);      // RB pass attempts all zero → coefficient 0
    expect(model.coef.QB!.map((c) => +c.toFixed(6))).toEqual([1, 0, 0.8, 0.5]);      // QB targets all zero → coefficient 0
    expect(model.predict({ ...base, targets: 4, carries: 10 })).toBeCloseTo(2 + 6 + 6, 6);
    expect(model.predict({ ...base, position: 'QB', passAttempts: 30, carries: 2 })).toBeCloseTo(1 + 15 + 1.6, 6);
  });

  it('ignores unplayed lines when fitting', () => {
    const noisy = [...lines, { ...base, playerId: 'ghost', played: false, points: 999 }];
    expect(fitXfp(noisy).coef.RB!.map((c) => +c.toFixed(6))).toEqual([2, 1.5, 0.6, 0]);
  });

  it('has no model for a position with too few lines, or for K, DEF and unknown positions', () => {
    const few = fitXfp(Array.from({ length: MIN_FIT_LINES - 1 }, rb));
    expect(few.coef.RB).toBeNull();
    expect(few.predict(rb(1))).toBeNull();
    expect(model.coef.WR).toBeNull();
    expect(model.predict({ ...base, position: 'K' })).toBeNull();
    expect(model.predict({ ...base, position: 'DEF' })).toBeNull();
    expect(model.predict({ ...base, position: '?' })).toBeNull();
  });

  it('rounds predictions to two decimals', () => {
    expect(model.predict({ ...base, targets: 1, carries: 1 })).toBe(4.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/lib/xfp.test.ts`
Expected: FAIL, "Failed to resolve import ./xfp".

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/src/lib/xfp.ts
import type { PlayerLine } from './playerLines';

export const XFP_POSITIONS: readonly string[] = ['QB', 'RB', 'WR', 'TE'];
export const MIN_FIT_LINES = 20;

/** Expected fantasy points from volume: points = a + b1·targets + b2·carries + b3·passAttempts, one fit per position. */
export interface XfpModel {
  /** [a, b1, b2, b3] per position; null when that position has no model */
  coef: Record<string, number[] | null>;
  predict(line: PlayerLine): number | null;
}

const features = (l: PlayerLine) => [1, l.targets, l.carries, l.passAttempts];

/** Solve A·x = b by Gaussian elimination with partial pivoting; null when singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-9) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Ordinary least squares on the active columns (those with any variance); dropped columns get coefficient 0. */
function fitPosition(rows: PlayerLine[]): number[] | null {
  if (rows.length < MIN_FIT_LINES) return null;
  const X = rows.map(features);
  const y = rows.map((l) => l.points);
  const k = X[0].length;
  const active = [0, ...[1, 2, 3].filter((j) => X.some((row) => row[j] !== X[0][j]))];
  const m = active.length;
  const XtX = Array.from({ length: m }, () => Array(m).fill(0) as number[]);
  const Xty = Array(m).fill(0) as number[];
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < m; a++) {
      Xty[a] += X[i][active[a]] * y[i];
      for (let b = 0; b < m; b++) XtX[a][b] += X[i][active[a]] * X[i][active[b]];
    }
  }
  const beta = solve(XtX, Xty);
  if (!beta) return null;
  const full = Array(k).fill(0) as number[];
  active.forEach((j, idx) => { full[j] = beta[idx]; });
  return full;
}

export function fitXfp(lines: PlayerLine[]): XfpModel {
  const coef: Record<string, number[] | null> = {};
  for (const pos of XFP_POSITIONS) {
    coef[pos] = fitPosition(lines.filter((l) => l.played && l.position === pos));
  }
  return {
    coef,
    predict(line) {
      const c = coef[line.position];
      if (!c) return null;
      const f = features(line);
      return Math.round(c.reduce((s, b, j) => s + b * f[j], 0) * 100) / 100;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/lib/xfp.test.ts`
Expected: PASS, 4 tests. The RB fixture has `week` varying but the fit ignores it; the `rounds` test: 2 + 1.5 + 0.6 = 4.1.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/xfp.ts packages/web/src/lib/xfp.test.ts
git commit -m "feat(web): expected fantasy points model from targets, carries and pass attempts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Boards: context, leaders grid, toilet bowl, exclusions, draft value, direction

**Files:**
- Modify: `packages/web/src/lib/playerBoards.ts`
- Test: `packages/web/src/lib/playerBoards.test.ts`

**Interfaces:**
- Consumes: Task 1 fields; `XfpModel` from Task 2; `fmtSigned` from `./format`; `PosFilter` from `./playerLines`.
- Produces:
  ```ts
  export type Direction = 'desc' | 'asc';
  export interface DraftValue { year: number; playerId: PlayerId; value: number }
  export interface BoardContext { lines; players; champions; currentYear; pos: PosFilter; picks: DraftValue[]; xfp: XfpModel | null }
  export interface BoardDef { id; section; title; definition; valueHeader; sortable?: boolean; compute: (ctx: BoardContext, direction?: Direction) => BoardRow[] }
  export function draftValuesOf(seasons: Season[]): DraftValue[];
  // new boards:
  export const leadRushYards, leadRecYards, leadPassYards, leadRushTd, leadRecTd, leadPassTd, leadPpg, leadFpoe, leadXfp, postToiletBowl, draftValue;
  ```
  `BOARDS` order: leaders (12, grid order), allTime (6, no championshipRosters), postseason (7, ending championshipRosters, postToiletBowl), extras (4, ending draftValue).

- [ ] **Step 1: Write the failing tests**

In `playerBoards.test.ts`, change the `ctx` definition and the imports:

```ts
import {
  BOARDS, bestSeason, bestWeek, benchBlunder, careerPoints, careerPpg, championshipRosters, championsOf, weeksStarted,
  boomStarts, dudStarts, journeyman, leadPoints, leadTouchdowns, leadYards, postPoints, postReceptions, postStarts, postTouchdowns, postYards,
  draftValue, draftValuesOf, leadFpoe, leadPassTd, leadPassYards, leadPpg, leadRecTd, leadRecYards, leadRushTd, leadRushYards, leadXfp, postToiletBowl,
  type BoardContext,
} from './playerBoards';
import type { XfpModel } from './xfp';

const ctx: BoardContext = { lines: flattenLines(seasons, players), players, champions: championsOf(seasons), currentYear: 2025, pos: 'All', picks: [], xfp: null };
```

Then append these describes at the end of the file:

```ts
describe('leaders splits', () => {
  const split = season(2025, [
    week(1, [game(2025, 1, 1,
      side('a', 50, [line('q1', 30, { pass_yd: 300, pass_td: 3, rush_yd: 12, rush_td: 1 }), line('r1', 20, { rush_yd: 90, rush_td: 1, rec_yd: 15, rec: 2, rec_td: 0 })]),
      side('b', 15, [line('w1', 15, { rec_yd: 110, rec_td: 1, rec: 7 }), line('k1', 9, { fgm: 3 })]))]),
  ]);
  const c = { ...ctx, lines: flattenLines([split], players) };
  it('rank rushing, receiving and passing yards and touchdowns separately', () => {
    expect(leadRushYards(c).map((r) => [r.playerId, r.value])).toEqual([['r1', 90], ['q1', 12]]);
    expect(leadRecYards(c).map((r) => [r.playerId, r.value])).toEqual([['w1', 110], ['r1', 15]]);
    expect(leadPassYards(c).map((r) => [r.playerId, r.value])).toEqual([['q1', 300]]);
    expect(leadRushTd(c).map((r) => [r.playerId, r.value])).toEqual([['q1', 1], ['r1', 1]]); // tie in the same week → playerId asc
    expect(leadRecTd(c).map((r) => [r.playerId, r.value])).toEqual([['w1', 1]]);
    expect(leadPassTd(c).map((r) => [r.playerId, r.value])).toEqual([['q1', 3]]);
  });
});

describe('leaders PPG, FPOE and xFP', () => {
  // 2025 lines: q1 35 (wk1), 18 (wk2), 50 bench (wk3) all played; t1 wk1 unplayed; r1 9, 11, 22; w1 4.
  const flat: XfpModel = { coef: {}, predict: (l) => (l.position === 'QB' ? 30 : l.position === 'RB' ? 10 : null) };
  const c = { ...ctx, xfp: flat };
  it('PPG needs three played games', () => {
    const rows = leadPpg(c);
    expect(rows.map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([[ 'q1', 34.33, '34.3', '3 games'], ['r1', 14, '14.0', '3 games']]);
  });
  it('FPOE is actual minus predicted over modelled lines, sortable both ways', () => {
    // q1: (35-30)+(18-30)+(50-30) = 13 ; r1: (9-10)+(11-10)+(22-10) = 12 ; w1 has 1 line (<3) → out ; t1 TE → no model
    expect(leadFpoe(c).map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 13, '+13.0', 'xFP 90.0'], ['r1', 12, '+12.0', 'xFP 30.0']]);
    expect(leadFpoe(c, 'asc').map((r) => r.playerId)).toEqual(['r1', 'q1']);
  });
  it('xFP sums predictions', () => {
    expect(leadXfp(c).map((r) => [r.playerId, r.value, r.valueLabel, r.detail])).toEqual([['q1', 90, '90.0', 'actual 103.0'], ['r1', 30, '30.0', 'actual 42.0']]);
  });
  it('FPOE and xFP are empty without a model, or when the filter leaves only unmodelled players', () => {
    expect(leadFpoe(ctx)).toEqual([]);
    expect(leadXfp(ctx)).toEqual([]);
    const kOnly = { ...c, lines: c.lines.filter((l) => l.position === 'K') };
    expect(leadFpoe(kOnly, 'asc')).toEqual([]);
  });
});

describe('toilet bowl and exclusions', () => {
  const cons = season(2023, [
    week(3, [game(2023, 3, 1, side('a', 20, [line('q1', 20)]), side('b', 10, [line('KC', 10)]), 'Cons-R1')], true),
    week(4, [game(2023, 4, 1, side('a', 5, [line('q1', 5)]), side('b', 1, [line('k1', 1)]), 'Toilet Bowl')], true),
    week(4, [game(2023, 4, 2, side('c', 7, [line('r1', 7)]), side('d', 2, [line('w1', 2)]), 'Cons-7th')], true),
  ]);
  const c = { ...ctx, lines: flattenLines([cons, ...seasons], players) };
  it('toilet bowl starts count consolation games only', () => {
    // ties at 1 break by newest week (wk 4 before wk 3), then playerId asc
    expect(postToiletBowl(c).map((r) => [r.playerId, r.value, r.detail])).toEqual([['q1', 2, '25.00 pts'], ['k1', 1, '1.00 pts'], ['r1', 1, '7.00 pts'], ['w1', 1, '2.00 pts'], ['KC', 1, '10.00 pts']]);
    expect(postPoints(c).some((r) => r.playerId === 'KC')).toBe(false);
  });
  it('dud starts and journeyman drop kickers and defenses', () => {
    expect(dudStarts(c).some((r) => r.playerId === 'KC' || r.playerId === 'k1')).toBe(false);
    expect(journeyman(c).some((r) => r.playerId === 'KC' || r.playerId === 'k1')).toBe(false);
    expect(dudStarts(c).find((r) => r.playerId === 'w1')).toMatchObject({ value: 2 }); // 2 (2023 wk4) and 4 (2025 wk3)
  });
});

describe('cumulative draft value', () => {
  const withDraft = (year: number, picks: { playerId: string; value: number | null }[]) => ({
    ...season(year, []),
    draft: { draftId: 'd', type: 'snake', rounds: 1, slotOrder: [], expectedCurve: null, picks: picks.map((p, i) => ({
      round: 1, pickNo: i + 1, slot: i + 1, userId: 'a', playerId: p.playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null,
      healthy: false, pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: p.value, tradedTo: null,
    })) },
  });
  const drafts = [withDraft(2024, [{ playerId: 'q1', value: 38.2 }, { playerId: 'r1', value: -5 }, { playerId: 'k1', value: null }]), withDraft(2025, [{ playerId: 'q1', value: -12 }, { playerId: 'r1', value: 20.5 }])];
  it('collects picks with a value', () => {
    expect(draftValuesOf(drafts)).toEqual([
      { year: 2024, playerId: 'q1', value: 38.2 }, { year: 2024, playerId: 'r1', value: -5 },
      { year: 2025, playerId: 'q1', value: -12 }, { year: 2025, playerId: 'r1', value: 20.5 },
    ]);
  });
  it('sums per player, lists each year, respects the position filter, and never yields NaN', () => {
    const c = { ...ctx, picks: draftValuesOf(drafts) };
    expect(draftValue(c).map((r) => [r.playerId, r.value, r.valueLabel, r.meta, r.detail])).toEqual([
      ['q1', 26.2, '+26.2', '2024, 2025', '2024 +38.2 · 2025 -12.0'],
      ['r1', 15.5, '+15.5', '2024, 2025', '2024 -5.0 · 2025 +20.5'],
    ]);
    expect(draftValue({ ...c, pos: 'RB' }).map((r) => r.playerId)).toEqual(['r1']);
    expect(draftValue({ ...c, pos: 'K' })).toEqual([]);
    expect(draftValue(c).every((r) => Number.isFinite(r.value))).toBe(true);
  });
});

describe('BOARDS registry v2 order', () => {
  const ids = (s: string) => BOARDS.filter((b) => b.section === s).map((b) => b.id);
  it('lays out leaders in grid order and moves championship rosters to postseason', () => {
    expect(ids('leaders')).toEqual(['leadPoints', 'leadYards', 'leadTouchdowns', 'leadRushYards', 'leadRecYards', 'leadPassYards', 'leadRushTd', 'leadRecTd', 'leadPassTd', 'leadPpg', 'leadFpoe', 'leadXfp']);
    expect(ids('allTime')).toEqual(['bestWeek', 'bestSeason', 'careerPoints', 'weeksStarted', 'benchBlunder', 'careerPpg']);
    expect(ids('postseason')).toEqual(['postPoints', 'postStarts', 'postTouchdowns', 'postYards', 'postReceptions', 'championshipRosters', 'postToiletBowl']);
    expect(ids('extras')).toEqual(['boomStarts', 'dudStarts', 'journeyman', 'draftValue']);
    expect(BOARDS.find((b) => b.id === 'leadFpoe')!.sortable).toBe(true);
    expect(BOARDS.filter((b) => b.sortable)).toHaveLength(1);
  });
});
```

Also delete the old `'BOARDS registry'` and `'BOARDS registry sections'` describes (their order assertions are superseded) and update the `'journeyman counts distinct managers'` test's slice assertion: with K/DEF excluded nothing changes in that fixture (no K/DEF started), so leave it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: FAIL at compile/import: `draftValue is not a function` and TypeScript complaints about `pos`, `picks`, `xfp` on `BoardContext`.

- [ ] **Step 3: Write the implementation**

In `playerBoards.ts`:

Imports:

```ts
import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtSigned, fmtTag } from './format';
import type { PlayerLine, PosFilter } from './playerLines';
import type { XfpModel } from './xfp';
```

Types:

```ts
export type Direction = 'desc' | 'asc';
export interface DraftValue { year: number; playerId: PlayerId; value: number }

export interface BoardContext {
  lines: PlayerLine[];
  players: PlayerDirectory;
  champions: Record<number, UserId | null>;
  currentYear: number;
  /** the section's position filter; lines are already narrowed, picks are not */
  pos: PosFilter;
  picks: DraftValue[];
  xfp: XfpModel | null;
}

export interface BoardDef {
  id: string;
  section: Section;
  title: string;
  definition: string;
  valueHeader: string;
  /** offers an Over/Under direction toggle */
  sortable?: boolean;
  compute: (ctx: BoardContext, direction?: Direction) => BoardRow[];
}

export function draftValuesOf(seasons: Season[]): DraftValue[] {
  const out: DraftValue[] = [];
  for (const s of seasons) {
    for (const p of s.draft?.picks ?? []) if (p.value !== null) out.push({ year: s.year, playerId: p.playerId, value: p.value });
  }
  return out;
}
```

Make `rank` take a direction instead of the unused `asc` boolean:

```ts
function rank<T extends { value: number; latestYear: number; latestWeek: number; playerId: string }>(items: T[], direction: Direction = 'desc'): T[] {
  const sign = direction === 'asc' ? -1 : 1;
  return [...items]
    .sort((x, y) => sign * (y.value - x.value) || y.latestYear - x.latestYear || y.latestWeek - x.latestWeek || (x.playerId < y.playerId ? -1 : x.playerId > y.playerId ? 1 : 0))
    .slice(0, MAX_ROWS);
}
```

Helpers and new boards (place after the existing extras, before `leaderBoard`):

```ts
const KICKING_DEF = new Set(['K', 'DEF']);
const skillOnly = (ls: PlayerLine[]) => ls.filter((l) => !KICKING_DEF.has(l.position));
const matchesPos = (position: string, pos: PosFilter) =>
  pos === 'All' ? true : pos === 'FLEX' ? ['RB', 'WR', 'TE'].includes(position) : position === pos;
const fmt1 = (v: number) => v.toFixed(1);
const MIN_LEADER_GAMES = 3;
```

Change `dudStarts` and `journeyman` to use `skillOnly(started(ctx))` instead of `started(ctx)`.

Add after `postReceptions`:

```ts
export const postToiletBowl = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx).filter((l) => l.consolation), (ls) => ls.length, intLabel, (ls) => `${fmtPts(sum(ls, (l) => l.points))} pts`);
```

Generalise `leaderBoard` to accept a per-player item builder so PPG/FPOE/xFP can add details and thresholds:

```ts
interface LeaderItem { value: number; detail: string | null }

/** Current season, every rostered line, manager = whoever rostered the player most recently. `build` returns null to drop a player. */
function leaderBoard(ctx: BoardContext, build: (ls: PlayerLine[]) => LeaderItem | null, label: (v: number) => string, direction: Direction = 'desc'): BoardRow[] {
  const current = ctx.lines.filter((l) => l.year === ctx.currentYear);
  const items: { playerId: string; value: number; detail: string | null; userId: UserId; latestYear: number; latestWeek: number }[] = [];
  for (const [playerId, g] of groupBy(current, (l) => l.playerId)) {
    const built = build(g.lines);
    if (!built) continue;
    const latest = g.lines.reduce((a, b) => (b.week > a.week ? b : a));
    items.push({ playerId, value: built.value, detail: built.detail, userId: latest.userId, latestYear: g.latestYear, latestWeek: g.latestWeek });
  }
  return rank(items, direction).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value),
    meta: String(ctx.currentYear), detail: i.detail, userId: i.userId, to: null,
  }));
}
const positive = (f: (ls: PlayerLine[]) => number) => (ls: PlayerLine[]): LeaderItem | null => { const v = f(ls); return v > 0 ? { value: v, detail: null } : null; };

export const leadPoints = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.points)), fmtPts);
export const leadYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.yards)), intLabel);
export const leadTouchdowns = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.touchdowns)), intLabel);
export const leadRushYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.rushYards)), intLabel);
export const leadRecYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.recYards)), intLabel);
export const leadPassYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.passYards)), intLabel);
export const leadRushTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.rushTd)), intLabel);
export const leadRecTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.recTd)), intLabel);
export const leadPassTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.passTd)), intLabel);

export const leadPpg = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, (ls) => {
  const played = ls.filter((l) => l.played);
  if (played.length < MIN_LEADER_GAMES) return null;
  return { value: round2(sum(played, (l) => l.points) / played.length), detail: plural(played.length, 'game') };
}, fmtPpg);

/** Lines with a prediction, paired with it. */
function modelled(ctx: BoardContext, ls: PlayerLine[]): { line: PlayerLine; xfp: number }[] {
  if (!ctx.xfp) return [];
  const out: { line: PlayerLine; xfp: number }[] = [];
  for (const line of ls) {
    if (!line.played) continue;
    const xfp = ctx.xfp.predict(line);
    if (xfp !== null) out.push({ line, xfp });
  }
  return out;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

export const leadFpoe = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => leaderBoard(ctx, (ls) => {
  const m = modelled(ctx, ls);
  if (m.length < MIN_LEADER_GAMES) return null;
  const expected = m.reduce((s, x) => s + x.xfp, 0);
  const actual = m.reduce((s, x) => s + x.line.points, 0);
  return { value: round1(actual - expected), detail: `xFP ${fmt1(expected)}` };
}, (v) => fmtSigned(v, 1), direction);

export const leadXfp = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, (ls) => {
  const m = modelled(ctx, ls);
  if (m.length < MIN_LEADER_GAMES) return null;
  const expected = m.reduce((s, x) => s + x.xfp, 0);
  const actual = m.reduce((s, x) => s + x.line.points, 0);
  return { value: round1(expected), detail: `actual ${fmt1(actual)}` };
}, fmt1);

export const draftValue = (ctx: BoardContext): BoardRow[] => {
  const byPlayer = new Map<string, DraftValue[]>();
  for (const p of ctx.picks) {
    if (!matchesPos(ctx.players[p.playerId]?.position ?? '?', ctx.pos)) continue;
    byPlayer.set(p.playerId, [...(byPlayer.get(p.playerId) ?? []), p]);
  }
  const items = [...byPlayer.entries()].map(([playerId, picks]) => {
    const sorted = [...picks].sort((a, b) => a.year - b.year);
    return {
      playerId, value: round1(sorted.reduce((s, p) => s + p.value, 0)), picks: sorted,
      latestYear: sorted[sorted.length - 1].year, latestWeek: 0,
    };
  });
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: fmtSigned(i.value, 1),
    meta: i.picks.map((p) => p.year).join(', '), detail: i.picks.map((p) => `${p.year} ${fmtSigned(p.value, 1)}`).join(' · '), userId: null, to: null,
  }));
};
```

Remove the old `leadPoints`/`leadYards`/`leadTouchdowns` definitions and the old `leaderBoard` (replaced above). Replace the whole `BOARDS` array:

```ts
export const BOARDS: BoardDef[] = [
  // League leaders, grid order (3 per row)
  { id: 'leadPoints', section: 'leaders', title: 'Most points', definition: 'Fantasy points this season on any roster, started or benched.', valueHeader: 'Pts', compute: leadPoints },
  { id: 'leadYards', section: 'leaders', title: 'Most yards', definition: 'Passing, rushing and receiving yards this season on any roster.', valueHeader: 'Yds', compute: leadYards },
  { id: 'leadTouchdowns', section: 'leaders', title: 'Most touchdowns', definition: 'Passing, rushing and receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadTouchdowns },
  { id: 'leadRushYards', section: 'leaders', title: 'Rushing yards', definition: 'Rushing yards this season on any roster.', valueHeader: 'Yds', compute: leadRushYards },
  { id: 'leadRecYards', section: 'leaders', title: 'Receiving yards', definition: 'Receiving yards this season on any roster.', valueHeader: 'Yds', compute: leadRecYards },
  { id: 'leadPassYards', section: 'leaders', title: 'Passing yards', definition: 'Passing yards this season on any roster.', valueHeader: 'Yds', compute: leadPassYards },
  { id: 'leadRushTd', section: 'leaders', title: 'Rushing TDs', definition: 'Rushing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRushTd },
  { id: 'leadRecTd', section: 'leaders', title: 'Receiving TDs', definition: 'Receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRecTd },
  { id: 'leadPassTd', section: 'leaders', title: 'Passing TDs', definition: 'Passing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadPassTd },
  { id: 'leadPpg', section: 'leaders', title: 'PPG', definition: `Points per game over weeks the player actually played this season. At least ${MIN_LEADER_GAMES} games.`, valueHeader: 'PPG', compute: leadPpg },
  { id: 'leadFpoe', section: 'leaders', title: 'FPOE', definition: `Fantasy points over expected: actual minus xFP, summed over the season. Over shows the luckiest or most efficient, Under the least. At least ${MIN_LEADER_GAMES} modelled games.`, valueHeader: 'FPOE', sortable: true, compute: leadFpoe },
  { id: 'leadXfp', section: 'leaders', title: 'xFP', definition: 'Expected fantasy points from volume: a per-position fit of points on targets, carries and pass attempts across league history. No field position or air yards, so an approximation. QB, RB, WR and TE only.', valueHeader: 'xFP', compute: leadXfp },
  // All-time
  { id: 'bestWeek', section: 'allTime', title: 'Best week by a starter', definition: 'Most points by a player in one week while in a starting lineup.', valueHeader: 'Pts', compute: bestWeek },
  { id: 'bestSeason', section: 'allTime', title: 'Best season by a starter', definition: 'Most points a player scored for one manager in one season while started.', valueHeader: 'Pts', compute: bestSeason },
  { id: 'careerPoints', section: 'allTime', title: 'Most career points started', definition: 'Total points scored while in a starting lineup, every season and manager.', valueHeader: 'Pts', compute: careerPoints },
  { id: 'weeksStarted', section: 'allTime', title: 'Most weeks started', definition: 'Weeks in a starting lineup across every season.', valueHeader: 'Starts', compute: weeksStarted },
  { id: 'benchBlunder', section: 'allTime', title: 'Biggest bench blunder', definition: 'Most points by a player left on the bench in one week.', valueHeader: 'Pts', compute: benchBlunder },
  { id: 'careerPpg', section: 'allTime', title: 'Career PPG', definition: `Points per game over weeks the player actually played, started or benched. At least ${MIN_PPG_GAMES} games.`, valueHeader: 'PPG', compute: careerPpg },
  // Postseason
  { id: 'postPoints', section: 'postseason', title: 'Most postseason points started', definition: 'Points while started in championship-bracket games.', valueHeader: 'Pts', compute: postPoints },
  { id: 'postStarts', section: 'postseason', title: 'Most postseason starts', definition: 'Starts in championship-bracket games.', valueHeader: 'Starts', compute: postStarts },
  { id: 'postTouchdowns', section: 'postseason', title: 'Most postseason touchdowns', definition: 'Passing, rushing and receiving touchdowns while started in the championship bracket.', valueHeader: 'TD', compute: postTouchdowns },
  { id: 'postYards', section: 'postseason', title: 'Most postseason yards', definition: 'Passing, rushing and receiving yards while started in the championship bracket.', valueHeader: 'Yds', compute: postYards },
  { id: 'postReceptions', section: 'postseason', title: 'Most postseason receptions', definition: 'Receptions while started in the championship bracket.', valueHeader: 'Rec', compute: postReceptions },
  { id: 'championshipRosters', section: 'postseason', title: 'Most championship rosters', definition: "Seasons on the champion's roster, starters and bench, in the championship game.", valueHeader: 'Titles', compute: championshipRosters },
  { id: 'postToiletBowl', section: 'postseason', title: 'Most toilet bowl starts', definition: 'Starts in consolation games: the first round, the toilet bowl and the 7th place game.', valueHeader: 'Starts', compute: postToiletBowl },
  // Extras
  { id: 'boomStarts', section: 'extras', title: 'Most 30-point starts', definition: 'Weeks a player scored 30 or more while started.', valueHeader: 'Weeks', compute: boomStarts },
  { id: 'dudStarts', section: 'extras', title: 'Most dud starts', definition: 'Weeks a player played and scored under 5 while started. Unplayed weeks do not count. Kickers and defenses excluded.', valueHeader: 'Weeks', compute: dudStarts },
  { id: 'journeyman', section: 'extras', title: 'Journeyman', definition: 'Different managers who have started the player. Kickers and defenses excluded.', valueHeader: 'Mgrs', compute: journeyman },
  { id: 'draftValue', section: 'extras', title: 'Cumulative draft value', definition: "Sum of the player's draft value across every season they were drafted, from the draft board. The current season's value moves weekly.", valueHeader: 'Value', compute: draftValue },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: PASS, 24 tests. Hand checks: q1 PPG = (35+18+50)/3 = 34.33; r1 PPG = (9+11+22)/3 = 14; FPOE q1 = 13, r1 = 12; w1 dud starts in the exclusions fixture: 2023 wk4 (2 pts, `rec: 1` default → played) and 2025 wk3 (4 pts) = 2.

- [ ] **Step 5: Fix other call sites so the package typechecks**

`PlayersView.tsx` builds a `BoardContext`; add `pos, picks: [], xfp: null` there for now (Task 5 replaces it) and run `pnpm build`. Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/playerBoards.ts packages/web/src/lib/playerBoards.test.ts packages/web/src/components/players/PlayersView.tsx
git commit -m "feat(web): leaders grid splits, PPG, FPOE and xFP; toilet bowl; draft value; K/DEF exclusions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Board component: pill first, controlled expand, direction toggle

**Files:**
- Modify: `packages/web/src/components/players/Board.tsx`
- Test: `packages/web/src/components/players/Board.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  interface Props {
    def: BoardDef; rows: BoardRow[]; players: PlayerDirectory; managers: History['managers'];
    expanded: boolean; onToggle: () => void;
    direction?: Direction; onDirection?: (d: Direction) => void;
  }
  ```

- [ ] **Step 1: Rewrite the tests**

Replace the `describe('Board', …)` block in `Board.test.tsx`:

```tsx
import type { BoardDef, BoardRow, Direction } from '../../lib/playerBoards';

const wrapB = (props: Partial<React.ComponentProps<typeof Board>> = {}) => {
  const onToggle = vi.fn();
  const utils = render(<MemoryRouter><Board def={def} rows={[]} players={players} managers={managers} expanded={false} onToggle={onToggle} {...props} /></MemoryRouter>);
  return { ...utils, onToggle };
};

describe('Board', () => {
  const eight = Array.from({ length: 8 }, (_, i) => row(i));

  it('shows five rows when collapsed and asks the section to expand', () => {
    const { onToggle } = wrapB({ rows: eight });
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /show all/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(5); // controlled: nothing changes until the parent flips expanded
  });

  it('shows every row when expanded and offers Show less', () => {
    const { onToggle } = wrapB({ rows: eight, expanded: true });
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('puts the position pill before the name and shows the definition', () => {
    wrapB({ rows: [row(0, { userId: 'a', to: '/scores/2025/1/3', detail: '3 starts' }), row(1)] });
    expect(screen.getByText('Most points in a week.')).toBeInTheDocument();
    const first = screen.getAllByRole('listitem')[0];
    expect(first.textContent).toMatch(/^1QBQuincy One/);
    expect(within(first).getByText('100.00')).toBeInTheDocument();
    expect(within(first).getByText('3 starts')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/h2h?a=a');
    expect(within(first).getByRole('link', { name: /2025 · Wk 1/ })).toHaveAttribute('href', '/scores/2025/1/3');
    const second = screen.getAllByRole('listitem')[1];
    expect(second.textContent).toMatch(/^2\?p1/); // unknown player: '?' pill then id
    expect(within(second).queryByRole('link')).toBeNull();
  });

  it('shows an empty state and no buttons with no rows', () => {
    wrapB();
    expect(screen.getByText('No players at this position.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the toggle with five or fewer rows, even when expanded', () => {
    wrapB({ rows: [row(0)], expanded: true });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('offers an Over/Under toggle only for sortable boards', () => {
    const onDirection = vi.fn();
    wrapB({ def: { ...def, sortable: true }, rows: [row(0)], direction: 'desc', onDirection });
    expect(screen.getByRole('button', { name: 'Over' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Under' }));
    expect(onDirection).toHaveBeenCalledWith('asc');
    cleanup();
    wrapB({ rows: [row(0)], direction: 'desc', onDirection });
    expect(screen.queryByRole('button', { name: 'Over' })).toBeNull();
  });
});
```

Add `cleanup` to the testing-library import: `import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';`. Keep the `PositionFilter` describe unchanged. Note the unused `Direction` import is fine to drop if TS complains; it is there for the `direction` prop literal.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/components/players/Board.test.tsx`
Expected: FAIL: the controlled-expand test sees 8 rows after the click (internal state), the pill-order regex fails (`^1Quincy OneQB`), and the Over/Under buttons are missing.

- [ ] **Step 3: Write the implementation**

Replace `Board.tsx`:

```tsx
import { Link } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow, Direction } from '../../lib/playerBoards';
import { playerName, playerPos } from '../../lib/players';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import PosPill from '../PosPill';

interface Props {
  def: BoardDef;
  rows: BoardRow[];
  players: PlayerDirectory;
  managers: History['managers'];
  /** section-wide: every board in the section expands together */
  expanded: boolean;
  onToggle: () => void;
  direction?: Direction;
  onDirection?: (d: Direction) => void;
}

const PREVIEW = 5;

export default function Board({ def, rows, players, managers, expanded, onToggle, direction = 'desc', onDirection }: Props) {
  const shown = expanded ? rows : rows.slice(0, PREVIEW);
  return (
    <section className="card overflow-hidden" aria-labelledby={`board-${def.id}`}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-3 py-2" title={def.definition}>
        <div className="min-w-0">
          <h3 id={`board-${def.id}`} className="section-label text-ink">{def.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{def.definition}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="section-label">{def.valueHeader}</span>
          {def.sortable && onDirection && (
            <span role="group" aria-label="Direction" className="flex gap-0.5">
              {(['desc', 'asc'] as Direction[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={direction === d}
                  onClick={() => onDirection(d)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${direction === d ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}
                >
                  {d === 'desc' ? 'Over' : 'Under'}
                </button>
              ))}
            </span>
          )}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">No players at this position.</p>
      ) : (
        <ol className="divide-y divide-line">
          {shown.map((r, i) => {
            const m = r.userId ? managers[r.userId] : undefined;
            const metaNode = r.to
              ? <Link to={r.to} className="num hover:text-accent">{r.meta}</Link>
              : <span className="num">{r.meta}</span>;
            return (
              <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                <span className="num w-4 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <Headshot players={players} id={r.playerId} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <PosPill pos={playerPos(players, r.playerId)} />
                    <span className="truncate text-sm font-medium">{playerName(players, r.playerId)}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    {metaNode}
                    {r.detail && <><span aria-hidden>·</span><span>{r.detail}</span></>}
                    {r.userId && (
                      <>
                        <span aria-hidden>·</span>
                        <Link to={`/h2h?a=${r.userId}`} className="flex items-center gap-1 hover:text-accent">
                          <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={14} />
                          <span>{m?.displayName ?? r.userId}</span>
                        </Link>
                      </>
                    )}
                  </span>
                </span>
                <span className="num shrink-0 text-base font-semibold">{r.valueLabel}</span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > PREVIEW && (
        <button type="button" onClick={onToggle} className="w-full border-t border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/components/players/Board.test.tsx`
Expected: PASS, 7 tests. `PlayersView.tsx` will now fail to typecheck (missing `expanded`/`onToggle`); Task 5 fixes it, so do not run `pnpm build` here.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/players/Board.tsx packages/web/src/components/players/Board.test.tsx
git commit -m "feat(web): board rows lead with the position pill; controlled expand; Over/Under toggle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Section component and per-section URL state in PlayersView

**Files:**
- Create: `packages/web/src/components/players/Section.tsx`
- Modify: `packages/web/src/components/players/PlayersView.tsx`
- Test: `packages/web/src/components/players/Section.test.tsx`
- Test: `packages/web/src/components/players/PlayersView.test.tsx`

**Interfaces:**
- Consumes: `Board` (Task 4), `PositionFilter`, `SeasonPicker` (`components/SeasonPicker.tsx`, props `{ years: number[]; value: number; onChange: (year: number) => void }`), `BOARDS`, `draftValuesOf`, `fitXfp`.
- Produces:
  ```tsx
  export default function Section({ id, title, note, boards, ctx, players, managers, pos, onPos, columns, seasonPicker, emptyMessage }: {
    id: string; title: string; note: string; boards: BoardDef[]; ctx: BoardContext; players: PlayerDirectory; managers: History['managers'];
    pos: PosFilter; onPos: (p: PosFilter) => void; columns: 2 | 3;
    seasonPicker?: { years: number[]; value: number; onChange: (y: number) => void };
    emptyMessage?: string | null;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/components/players/Section.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import type { BoardContext, BoardDef, BoardRow } from '../../lib/playerBoards';
import { players } from '../../test/playerFixtures';
import Section from './Section';

const managers: History['managers'] = { a: { displayName: 'alice', avatar: null, seasons: [2025] } };
const rows = (n: number, prefix: string): BoardRow[] => Array.from({ length: n }, (_, i) => ({
  key: `${prefix}${i}`, playerId: i === 0 ? 'q1' : `${prefix}${i}`, value: n - i, valueLabel: String(n - i), meta: '2025', detail: null, userId: null, to: null,
}));
const big: BoardDef = { id: 'big', section: 'extras', title: 'Big board', definition: 'Eight rows.', valueHeader: 'N', compute: () => rows(8, 'b') };
const small: BoardDef = { id: 'small', section: 'extras', title: 'Small board', definition: 'Two rows.', valueHeader: 'N', compute: () => rows(2, 's') };
const sortable: BoardDef = { id: 'sortable', section: 'extras', title: 'Sortable board', definition: 'Direction aware.', valueHeader: 'N', sortable: true,
  compute: (_ctx, direction) => (direction === 'asc' ? rows(6, 'u') : rows(6, 'o')) };
const ctx: BoardContext = { lines: [], players, champions: {}, currentYear: 2025, pos: 'All', picks: [], xfp: null };
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Section', () => {
  it('expands every board together and leaves short boards alone', () => {
    wrap(<Section id="extras" title="Extras" note="Every season" boards={[big, small, sortable]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const bigBoard = screen.getByRole('region', { name: 'Big board' });
    const sortBoard = screen.getByRole('region', { name: 'Sortable board' });
    const smallBoard = screen.getByRole('region', { name: 'Small board' });
    expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(sortBoard).getAllByRole('listitem')).toHaveLength(5);
    expect(within(smallBoard).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(within(bigBoard).getByRole('button', { name: /show all/i }));
    expect(within(bigBoard).getAllByRole('listitem')).toHaveLength(8);
    expect(within(sortBoard).getAllByRole('listitem')).toHaveLength(6);
    expect(within(smallBoard).getAllByRole('listitem')).toHaveLength(2);
    expect(within(smallBoard).queryByRole('button')).toBeNull();
    expect(within(sortBoard).getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  it('passes the direction to a sortable board', () => {
    wrap(<Section id="extras" title="Extras" note="" boards={[sortable]} ctx={ctx} players={players} managers={managers} pos="All" onPos={() => {}} columns={2} />);
    const board = screen.getByRole('region', { name: 'Sortable board' });
    expect(within(board).getAllByRole('listitem')[0]).toHaveTextContent('o');
    fireEvent.click(within(board).getByRole('button', { name: 'Under' }));
    expect(within(board).getAllByRole('listitem')[0]).toHaveTextContent('u');
  });

  it('renders its own position filter and optional season picker, and an empty message instead of boards', () => {
    const onPos = vi.fn();
    const onChange = vi.fn();
    wrap(<Section id="leaders" title="League leaders" note="" boards={[big]} ctx={ctx} players={players} managers={managers} pos="RB" onPos={onPos} columns={3}
      seasonPicker={{ years: [2024, 2025], value: 2025, onChange }} emptyMessage="Season has not started." />);
    expect(screen.getByRole('heading', { name: 'League leaders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'TE' }));
    expect(onPos).toHaveBeenCalledWith('TE');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } });
    expect(onChange).toHaveBeenCalledWith(2024);
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Big board' })).toBeNull();
  });
});
```

Replace `PlayersView.test.tsx` entirely:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { History } from '@fantasy-dash/core';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import PlayersView from './PlayersView';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] },
};
const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40, { pass_yd: 250 }), line('r1', 20, { rush_yd: 80 })]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
    week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
  ], 'a'),
  season(2025, [
    week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35, { pass_yd: 300, pass_td: 3 })]), side('a', 9, [line('r1', 9, { rush_yd: 40 })]))]),
  ], null, 1),
];
const years = [2024, 2025];

function LocationProbe() { const loc = useLocation(); return <output data-testid="loc">{loc.search}</output>; }
const mount = (initial = '/players', currentYear = 2025, lastScoredWeek = 1) => render(
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route path="/players" element={<><PlayersView seasons={seasons} players={players} managers={managers} years={years} currentYear={currentYear} lastScoredWeek={lastScoredWeek} /><LocationProbe /></>} />
    </Routes>
  </MemoryRouter>,
);
const region = (name: string) => screen.getByRole('region', { name });
const firstRow = (boardTitle: string) => within(region(boardTitle)).getAllByRole('listitem')[0];

describe('PlayersView', () => {
  it('renders the four sections, every board, and the through-week line', () => {
    mount();
    expect(screen.getByText(/through 2025 week 1/i)).toBeInTheDocument();
    for (const h of ['League leaders', 'All-time', 'Postseason', 'Extras']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    // board titles are h3 headings; plain getByText would collide with value headers like "PPG"
    for (const t of ['Rushing yards', 'Passing TDs', 'PPG', 'FPOE', 'xFP', 'Most toilet bowl starts', 'Cumulative draft value']) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    expect(within(region('Postseason')).getByText('Most championship rosters')).toBeInTheDocument();
    expect(within(region('All-time')).queryByText('Most championship rosters')).toBeNull();
  });

  it('filters one section at a time and writes each to its own URL parameter', () => {
    mount();
    expect(firstRow('Best week by a starter')).toHaveTextContent('Quincy One');
    fireEvent.click(within(region('All-time')).getByRole('button', { name: 'RB' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('?all=RB');
    expect(firstRow('Best week by a starter')).toHaveTextContent('Ricky One');
    expect(firstRow('Most points')).toHaveTextContent('Quincy One'); // leaders untouched
    fireEvent.click(within(region('League leaders')).getByRole('button', { name: 'RB' }));
    expect(screen.getByTestId('loc').textContent).toContain('lead=RB');
    expect(screen.getByTestId('loc').textContent).toContain('all=RB');
    expect(firstRow('Most points')).toHaveTextContent('Ricky One');
    fireEvent.click(within(region('All-time')).getByRole('button', { name: 'All' }));
    expect(screen.getByTestId('loc').textContent).not.toContain('all=');
  });

  it('switches the leaders season from the picker and the URL', () => {
    mount();
    expect(firstRow('Most points')).toHaveTextContent('35.00');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } });
    expect(screen.getByTestId('loc')).toHaveTextContent('season=2024');
    expect(firstRow('Most points')).toHaveTextContent('71.00'); // q1 40 + 31 in 2024
    expect(firstRow('Best week by a starter')).toHaveTextContent('40.00'); // all-time unaffected by the season picker
  });

  it('falls back for junk parameters', () => {
    mount('/players?all=XYZ&season=1999&lead=rb');
    expect(within(region('All-time')).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(region('League leaders')).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox')).toHaveValue('2025');
  });

  it('shows the not-started message for a season with no lines and keeps the other sections', () => {
    mount('/players', 2026, 0);
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByText('Most yards')).toBeNull();
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
  });
});
```

Note `PlayersView` gains a `years: number[]` prop (every season year, for the picker); `PlayersPage` passes `history.seasons.map((s) => s.year)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/web && npx vitest run src/components/players/Section.test.tsx src/components/players/PlayersView.test.tsx`
Expected: Section FAIL "Failed to resolve import ./Section"; PlayersView FAIL (no region named 'All-time', no combobox).

- [ ] **Step 3: Write the Section component**

```tsx
// packages/web/src/components/players/Section.tsx
import { useState } from 'react';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardContext, BoardDef, Direction } from '../../lib/playerBoards';
import type { PosFilter } from '../../lib/playerLines';
import SeasonPicker from '../SeasonPicker';
import Board from './Board';
import PositionFilter from './PositionFilter';

interface Props {
  id: string;
  title: string;
  note: string;
  boards: BoardDef[];
  /** lines already narrowed to this section's position */
  ctx: BoardContext;
  players: PlayerDirectory;
  managers: History['managers'];
  pos: PosFilter;
  onPos: (p: PosFilter) => void;
  columns: 2 | 3;
  seasonPicker?: { years: number[]; value: number; onChange: (y: number) => void };
  /** when set, shown in place of the boards */
  emptyMessage?: string | null;
}

/** One titled block of boards with its own position filter, optional season picker and a shared expand state. */
export default function Section({ id, title, note, boards, ctx, players, managers, pos, onPos, columns, seasonPicker, emptyMessage }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [directions, setDirections] = useState<Record<string, Direction>>({});
  return (
    <section id={id} aria-labelledby={`section-${id}`} className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`section-${id}`} className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-muted">{note}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PositionFilter value={pos} onChange={onPos} />
        {seasonPicker && <SeasonPicker years={seasonPicker.years} value={seasonPicker.value} onChange={seasonPicker.onChange} />}
      </div>
      {emptyMessage ? (
        <p className="card p-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className={`grid gap-4 ${columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {boards.map((b) => {
            const direction = directions[b.id] ?? 'desc';
            return (
              <Board
                key={b.id}
                def={b}
                rows={b.compute(ctx, direction)}
                players={players}
                managers={managers}
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
                direction={direction}
                onDirection={b.sortable ? (d) => setDirections((m) => ({ ...m, [b.id]: d })) : undefined}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Rewrite PlayersView and update PlayersPage**

```tsx
// packages/web/src/components/players/PlayersView.tsx
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import { BOARDS, championsOf, draftValuesOf, type BoardContext, type Section as SectionId } from '../../lib/playerBoards';
import { filterLines, flattenLines, isPosFilter, type PosFilter } from '../../lib/playerLines';
import { fitXfp } from '../../lib/xfp';
import Section from './Section';

interface Props { seasons: Season[]; players: PlayerDirectory; managers: History['managers']; years: number[]; currentYear: number; lastScoredWeek: number }

const SECTIONS: { id: SectionId; param: string; title: string; note: string; columns: 2 | 3 }[] = [
  { id: 'leaders', param: 'lead', title: 'League leaders', note: 'Any roster, started or benched', columns: 3 },
  { id: 'allTime', param: 'all', title: 'All-time', note: 'Every season', columns: 2 },
  { id: 'postseason', param: 'post', title: 'Postseason', note: 'Championship bracket unless the board says otherwise', columns: 2 },
  { id: 'extras', param: 'extra', title: 'Extras', note: 'Every season', columns: 2 },
];

export default function PlayersView({ seasons, players, managers, years, currentYear, lastScoredWeek }: Props) {
  const [params, setParams] = useSearchParams();
  const update = (mutate: (next: URLSearchParams) => void) => { const next = new URLSearchParams(params); mutate(next); setParams(next, { replace: true }); };
  const posOf = (param: string): PosFilter => { const raw = params.get(param); return isPosFilter(raw) ? raw : 'All'; };
  const setPos = (param: string) => (p: PosFilter) => update((next) => { if (p === 'All') next.delete(param); else next.set(param, p); });
  const seasonParam = Number(params.get('season'));
  const leadersYear = years.includes(seasonParam) ? seasonParam : currentYear;
  const setSeason = (y: number) => update((next) => { if (y === currentYear) next.delete('season'); else next.set('season', String(y)); });

  const allLines = useMemo(() => flattenLines(seasons, players), [seasons, players]);
  const champions = useMemo(() => championsOf(seasons), [seasons]);
  const picks = useMemo(() => draftValuesOf(seasons), [seasons]);
  const xfp = useMemo(() => fitXfp(allLines), [allLines]);
  const leadersHasLines = allLines.some((l) => l.year === leadersYear);

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
        const ctx: BoardContext = { lines: filterLines(allLines, pos), players, champions, currentYear: s.id === 'leaders' ? leadersYear : currentYear, pos, picks, xfp };
        return (
          <Section
            key={s.id}
            id={s.id}
            title={s.title}
            note={s.note}
            boards={BOARDS.filter((b) => b.section === s.id)}
            ctx={ctx}
            players={players}
            managers={managers}
            pos={pos}
            onPos={setPos(s.param)}
            columns={s.columns}
            seasonPicker={s.id === 'leaders' ? { years, value: leadersYear, onChange: setSeason } : undefined}
            emptyMessage={s.id === 'leaders' && !leadersHasLines ? 'Season has not started.' : null}
          />
        );
      })}
    </section>
  );
}
```

In `PlayersPage.tsx` pass `years={history.seasons.map((s) => s.year)}`.

- [ ] **Step 5: Run tests and build**

Run: `cd packages/web && npx vitest run src/components/players`
Expected: PASS, Section 3, PlayersView 5, Board 7, plus PositionFilter 1.

Run: `pnpm build` from the root. Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/players packages/web/src/pages/PlayersPage.tsx
git commit -m "feat(web): per-section position filters, leaders season picker and section-wide expand

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Verify on real data and finish

- [ ] **Step 1: Full suite and build**

Run from the root: `pnpm test` then `pnpm build`. Expected: all pass; `✓ built`.

- [ ] **Step 2: Real-data probe**

Write to the scratchpad (not the repo) and run with `npx tsx <path>` from the repo root, adjusting the import root to the current checkout:

```ts
import { readFileSync } from 'node:fs';
import { flattenLines } from '<repo>/packages/web/src/lib/playerLines';
import { BOARDS, championsOf, draftValuesOf } from '<repo>/packages/web/src/lib/playerBoards';
import { fitXfp } from '<repo>/packages/web/src/lib/xfp';

const root = '<repo>/data';
const players = JSON.parse(readFileSync(`${root}/players.json`, 'utf8'));
const history = JSON.parse(readFileSync(`${root}/history.json`, 'utf8'));
const seasons = history.seasons.map((s: { year: number }) => JSON.parse(readFileSync(`${root}/seasons/${s.year}.json`, 'utf8')));
const lines = flattenLines(seasons, players);
const xfp = fitXfp(lines);
console.log('coef', xfp.coef);
const ctx = { lines, players, champions: championsOf(seasons), currentYear: seasons[seasons.length - 1].year, pos: 'All' as const, picks: draftValuesOf(seasons), xfp };
const name = (id: string) => players[id]?.name ?? id;
for (const b of BOARDS) {
  for (const dir of b.sortable ? (['desc', 'asc'] as const) : (['desc'] as const)) {
    console.log(`\n== ${b.title}${b.sortable ? ` (${dir})` : ''}`);
    for (const r of b.compute(ctx, dir).slice(0, 5)) console.log(`  ${name(r.playerId).padEnd(24)} ${r.valueLabel.padStart(8)}  ${r.meta}${r.detail ? ` · ${r.detail}` : ''}`);
  }
}
```

Expected: coefficients positive for targets, carries and pass attempts at every position (roughly 1 to 2 points per target, 0.5 to 1 per carry, 0.4 to 0.7 per pass attempt under this league's scoring); FPOE Over and Under lists are different players; Cumulative draft value lists QB/RB/WR/TE only; toilet bowl board non-empty; dud starts and Journeyman contain no team defenses or kickers.

- [ ] **Step 3: Finish**

Use `superpowers:finishing-a-development-branch`.
