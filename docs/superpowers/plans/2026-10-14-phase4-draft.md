# Phase 4: Draft Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add draft value to every pick (position-normalized: draft rank at position minus finish rank at position, plus points over baseline) and the `/draft/:season` page: a snake draft board with Position and Value color modes, cell details, manager-column highlighting, and an analysis panel (per-manager totals with best and worst pick; league top five steals and busts).

**Architecture:** `scripts/sync.ts` computes season points for every NFL player under the league's scoring from the full weekly stat maps (before trimming to rostered players) and passes them into `buildSeason`. `buildDraft` in core gains the value math. The web app derives per-manager and league summaries from `season.draft.picks` with a tested pure helper, renders the board as a CSS grid, and links it from the season review and nav.

**Tech Stack:** unchanged.

**Spec:** `docs/superpowers/specs/2026-10-14-fantasy-dashboard-design.md`, "Metric definitions" (Draft value), "Views" Phase 4.

## Global Constraints

- `posDraftRank` = order among same-position picks in that draft by `pickNo` (keepers included).
- `posFinishRank` = rank among all NFL players at that position by season points under league scoring over weeks 1 to `lastScoredWeek` (players with no stats rank last, after everyone with points; ties broken by player id for determinism).
- `value = posDraftRank - posFinishRank` (positive = steal).
- `pointsOverBaseline = seasonPoints - baselinePoints(pos)` where baseline rank per position is QB 10, RB 24, WR 24, TE 12, K 10, DEF 10; baseline points = the season points of the player at that rank (0 if fewer players exist).
- Players whose position is unknown get `posDraftRank`, `posFinishRank`, `value` and `pointsOverBaseline` all `null`.
- In-season seasons label all draft figures "to date".
- Value color scale: diverging, centered at 0, clipped at ±12 ranks; positive uses `--win`, negative `--loss`, translucent fills like the efficiency bars.
- Points rounded to 2 decimals.
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work on branch `phase-4`; do not push during tasks.

## File Structure

```
packages/core/src/types.ts           # DraftPick value fields; RawSeasonInput.playerSeasonPoints
packages/core/src/draft.ts           # BASELINE_RANKS, computeDraftValues(), buildDraft(..., valueInput)
packages/core/src/season.ts          # passes playerSeasonPoints + players into buildDraft
packages/core/src/schema.ts          # nullable value fields
packages/core/test/draft.test.ts, test/fixtures/mini.ts (adds playerSeasonPoints)
scripts/sync.ts                      # playerSeasonPoints from full weekly stats
data/                                # regenerated
packages/web/src/lib/draft.ts (+ .test.ts)          # managerDraftSummaries, leagueExtremes, valueColor
packages/web/src/components/draft/DraftBoard.tsx (+ .test.tsx)
packages/web/src/components/draft/DraftAnalysis.tsx
packages/web/src/pages/DraftPage.tsx
packages/web/src/App.tsx, Nav.tsx, components/history/DraftRoundOne.tsx (link)
docs/superpowers/specs/...design.md
```

---

### Task 1: Draft value in core

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/draft.ts`, `packages/core/src/season.ts`, `packages/core/src/schema.ts`, `packages/core/test/fixtures/mini.ts`
- Test: `packages/core/test/draft.test.ts`, `packages/core/test/season.test.ts`

**Interfaces:**
```ts
// types.ts: DraftPick gains
  posDraftRank: number | null; seasonPoints: number; posFinishRank: number | null; value: number | null; pointsOverBaseline: number | null;
// season.ts: RawSeasonInput gains
  /** season points under league scoring for every NFL player with stats, weeks 1..lastScoredWeek */
  playerSeasonPoints: Record<PlayerId, number>;
// draft.ts
export const BASELINE_RANKS: Record<string, number> = { QB: 10, RB: 24, WR: 24, TE: 12, K: 10, DEF: 10 };
export interface DraftValueInput { seasonPoints: Record<PlayerId, number>; players: PlayerDirectory }
export function buildDraft(draft: SleeperDraft, picks: SleeperDraftPick[], rosterToUser: Record<number, UserId>, value: DraftValueInput): Draft
export function computeDraftValues(picks: DraftPick[], value: DraftValueInput): DraftPick[]   // pure; fills the five fields
```

- [ ] **Step 1: Failing tests**

Replace the `pick` helper's draft in `packages/core/test/draft.test.ts` usage: every existing `buildDraft(...)` call gets a fourth argument `{ seasonPoints: {}, players: {} }` (value fields then come out null/0). Add:
```ts
import { computeDraftValues, BASELINE_RANKS } from '../src/draft';
import type { DraftPick, PlayerDirectory } from '../src/types';

const info = (id: string, position: string | null): PlayerDirectory[string] => ({ id, name: id, firstName: id, lastName: '', position, team: null, yearsExp: null });

describe('computeDraftValues', () => {
  // Three RBs and two QBs drafted; league-wide RB pool has 5 players, QB pool has 3.
  const players: PlayerDirectory = {
    rbA: info('rbA', 'RB'), rbB: info('rbB', 'RB'), rbC: info('rbC', 'RB'), rbX: info('rbX', 'RB'), rbY: info('rbY', 'RB'),
    qbA: info('qbA', 'QB'), qbB: info('qbB', 'QB'), qbX: info('qbX', 'QB'),
    mys: info('mys', null),
  };
  const seasonPoints = { rbA: 100, rbB: 250, rbC: 50, rbX: 300, rbY: 10, qbA: 400, qbB: 380, qbX: 390, mys: 999 };
  const pick = (pickNo: number, playerId: string): DraftPick => ({ round: 1, pickNo, slot: pickNo, userId: `u${pickNo}`, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, posFinishRank: null, value: null, pointsOverBaseline: null });
  const picks = computeDraftValues([pick(1, 'rbA'), pick(2, 'qbA'), pick(3, 'rbB'), pick(4, 'mys'), pick(5, 'qbB'), pick(6, 'rbC')], { seasonPoints, players });
  const by = Object.fromEntries(picks.map((p) => [p.playerId, p]));

  it('ranks picks within their position by pick order', () => {
    expect([by.rbA.posDraftRank, by.rbB.posDraftRank, by.rbC.posDraftRank]).toEqual([1, 2, 3]);
    expect([by.qbA.posDraftRank, by.qbB.posDraftRank]).toEqual([1, 2]);
  });

  it('ranks finish among all players at the position, league-wide', () => {
    // RB finish order: rbX 300, rbB 250, rbA 100, rbC 50, rbY 10
    expect([by.rbA.posFinishRank, by.rbB.posFinishRank, by.rbC.posFinishRank]).toEqual([3, 2, 4]);
    // QB finish: qbA 400, qbX 390, qbB 380
    expect([by.qbA.posFinishRank, by.qbB.posFinishRank]).toEqual([1, 3]);
  });

  it('computes value as draft rank minus finish rank', () => {
    expect(by.rbA.value).toBe(-2);
    expect(by.rbB.value).toBe(0);
    expect(by.rbC.value).toBe(-1);
    expect(by.qbA.value).toBe(0);
    expect(by.qbB.value).toBe(-1);
  });

  it('computes points over the positional baseline', () => {
    // RB baseline rank 24 > pool size 5 -> baseline 0; QB baseline rank 10 > 3 -> 0
    expect(by.rbA.pointsOverBaseline).toBe(100);
    expect(by.qbB.pointsOverBaseline).toBe(380);
    const small = computeDraftValues([pick(1, 'rbA')], { seasonPoints, players: { ...players } });
    expect(small[0].seasonPoints).toBe(100);
  });

  it('uses the baseline player\'s points when the pool is deep enough', () => {
    const deepPlayers: PlayerDirectory = {};
    const deepPoints: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) { deepPlayers[`k${i}`] = info(`k${i}`, 'K'); deepPoints[`k${i}`] = 200 - i * 10; } // k1 190 ... k12 80
    const [p] = computeDraftValues([pick(1, 'k3')], { seasonPoints: deepPoints, players: deepPlayers });
    expect(BASELINE_RANKS.K).toBe(10);
    expect(p.pointsOverBaseline).toBe(170 - 100); // k3 170 minus k10 100
  });

  it('leaves value fields null for players with an unknown position', () => {
    expect(by.mys).toMatchObject({ posDraftRank: null, posFinishRank: null, value: null, pointsOverBaseline: null, seasonPoints: 999 });
  });

  it('places players without stats after everyone with points', () => {
    const [p] = computeDraftValues([pick(1, 'rbY')], { seasonPoints: { rbA: 100, rbB: 250, rbC: 50, rbX: 300 }, players });
    expect(p.seasonPoints).toBe(0);
    expect(p.posFinishRank).toBe(5);
  });
});
```

`packages/core/test/fixtures/mini.ts`: add `playerSeasonPoints: { q1: 80, q2: 70, q3: 90, q4: 50, r1: 10, r2: 10, r3: 10, r4: 10, w1: 30, w2: 30, w3: 30, w4: 30, b1: 30, b2: 0, b3: 0, b4: 0 }` to the returned input. In `packages/core/test/season.test.ts` extend the draft test:
```ts
    const q3 = season.draft?.picks.find((p) => p.playerId === 'q3');
    expect(q3).toMatchObject({ posDraftRank: 3, posFinishRank: 1, value: 2, seasonPoints: 90 });
```
(q3 is the third QB taken and has the most QB points.) Update `test/oracle.test.ts` `load()` to add `playerSeasonPoints: {}`.

- [ ] **Step 2: Run, expect failures**

```bash
pnpm --filter @fantasy-dash/core test
```
Expected: FAIL on the new tests and typecheck errors until `RawSeasonInput` and `DraftPick` change.

- [ ] **Step 3: Implement**

`types.ts`: add the five fields to `DraftPick` (order: after `isKeeper`).

`draft.ts`:
```ts
import type { Draft, DraftPick, PlayerDirectory, PlayerId, UserId } from './types';
import type { SleeperDraft, SleeperDraftPick } from './sleeper/types';
import { round2 } from './scoring';

/** Last startable rank per position in a 10-team league with 2 RB, 2 WR, 1 TE, 2 FLEX, 1 QB, 1 K, 1 DEF. */
export const BASELINE_RANKS: Record<string, number> = { QB: 10, RB: 24, WR: 24, TE: 12, K: 10, DEF: 10 };

export interface DraftValueInput { seasonPoints: Record<PlayerId, number>; players: PlayerDirectory }

/** Fill posDraftRank, seasonPoints, posFinishRank, value and pointsOverBaseline. Pure. */
export function computeDraftValues(picks: DraftPick[], input: DraftValueInput): DraftPick[] {
  const posOf = (id: PlayerId) => input.players[id]?.position ?? null;
  const pts = (id: PlayerId) => input.seasonPoints[id] ?? 0;

  // Finish rank: every player in the directory at the position, sorted by points desc, id asc.
  const finishRank = new Map<PlayerId, number>();
  const baselinePoints = new Map<string, number>();
  const byPos = new Map<string, PlayerId[]>();
  for (const id of Object.keys(input.players)) {
    const pos = posOf(id);
    if (!pos) continue;
    const list = byPos.get(pos) ?? [];
    list.push(id);
    byPos.set(pos, list);
  }
  for (const [pos, ids] of byPos) {
    ids.sort((a, b) => pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
    ids.forEach((id, i) => finishRank.set(id, i + 1));
    const baseRank = BASELINE_RANKS[pos];
    const baseId = baseRank ? ids[baseRank - 1] : undefined;
    baselinePoints.set(pos, baseId ? pts(baseId) : 0);
  }

  // Draft rank: order within position by pickNo.
  const seen = new Map<string, number>();
  return [...picks]
    .sort((a, b) => a.pickNo - b.pickNo)
    .map((p) => {
      const pos = posOf(p.playerId);
      const seasonPoints = round2(pts(p.playerId));
      if (!pos) return { ...p, posDraftRank: null, seasonPoints, posFinishRank: null, value: null, pointsOverBaseline: null };
      const posDraftRank = (seen.get(pos) ?? 0) + 1;
      seen.set(pos, posDraftRank);
      const posFinishRank = finishRank.get(p.playerId) ?? null;
      return {
        ...p,
        posDraftRank,
        seasonPoints,
        posFinishRank,
        value: posFinishRank === null ? null : posDraftRank - posFinishRank,
        pointsOverBaseline: round2(seasonPoints - (baselinePoints.get(pos) ?? 0)),
      };
    });
}

export function buildDraft(draft: SleeperDraft, rawPicks: SleeperDraftPick[], rosterToUser: Record<number, UserId>, value: DraftValueInput): Draft {
  // (existing body, producing `picks` with the five value fields initialised to null/0, then:)
  const picks = computeDraftValues(basePicks, value);
  // slotOrder as before; return { draftId, type, rounds, slotOrder, picks };
}
```
Keep the existing picker and slotOrder logic; `basePicks` is the previously built array with `posDraftRank: null, seasonPoints: 0, posFinishRank: null, value: null, pointsOverBaseline: null` added to each element.

`season.ts`: add `playerSeasonPoints: Record<PlayerId, number>;` to `RawSeasonInput` and pass `{ seasonPoints: input.playerSeasonPoints, players }` as the fourth `buildDraft` argument.

`schema.ts`: add the five fields to the `DraftPick` schema (`posDraftRank: z.number().nullable()`, `seasonPoints: z.number()`, `posFinishRank: z.number().nullable()`, `value: z.number().nullable()`, `pointsOverBaseline: z.number().nullable()`).

- [ ] **Step 4: Run, expect pass; commit**

```bash
pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/core typecheck
git add packages/core && git commit -m "feat(core): position-normalized draft value and points over baseline

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Expected: 82 + 7 = 89 tests.

---

### Task 2: Sync computes season points for every player; regenerate data

**Files:**
- Modify: `scripts/sync.ts`
- Generate: `data/`

- [ ] **Step 1: Compute `playerSeasonPoints`**

In `fetchSeason`, keep the full weekly stats before trimming. Inside the week loop, after fetching `st`:
```ts
    if (st && week <= lastScoredLeg) {
      for (const [pid, line] of Object.entries(st)) {
        const pts = scoreStats(line, league.scoring_settings);
        if (pts !== 0) playerSeasonPoints[pid] = round2((playerSeasonPoints[pid] ?? 0) + pts);
      }
    }
```
where `const playerSeasonPoints: Record<string, number> = {};` is declared before the loop, `lastScoredLeg` is the variable `fetchSeason` already computes (`Infinity` for complete seasons, else `last_scored_leg`), and `scoreStats`, `round2` are imported from `@fantasy-dash/core`. Pass `playerSeasonPoints` in the `RawSeasonInput`. Log `  ${season}: season points for ${Object.keys(playerSeasonPoints).length} players`.

- [ ] **Step 2: Typecheck, sync, inspect**

```bash
pnpm typecheck:scripts && pnpm sync && node -e '
const p=require("./data/players.json");
for (const y of [2023,2024,2025,2026]) { const s=require(`./data/seasons/${y}.json`); const picks=s.draft.picks; const n=id=>s.managers[id].displayName;
  const withVal=picks.filter(x=>x.value!==null).length;
  const top=[...picks].filter(x=>x.value!==null).sort((a,b)=>b.value-a.value).slice(0,3).map(x=>`${p[x.playerId]?.name} (${p[x.playerId]?.position}${x.posDraftRank}->${x.posFinishRank}, ${x.value>0?"+":""}${x.value}, ${x.pointsOverBaseline} PoB) by ${n(x.userId)}`);
  const worst=[...picks].filter(x=>x.value!==null).sort((a,b)=>a.value-b.value).slice(0,2).map(x=>`${p[x.playerId]?.name} (${x.value})`);
  console.log(y, "picks", picks.length, "valued", withVal, "| steals:", top.join(" ; "), "| busts:", worst.join(" ; ")); }'
```
Expected: every season has 150 or 160 picks with most valued (a handful may be null for position-less ids); steals and busts read sensibly (for 2025, a top RB finishing as RB1 drafted late should appear as a steal; an early-round injury as a bust). `pointsOverBaseline` for a known RB1 should be clearly positive.

- [ ] **Step 3: Commit**

```bash
git add scripts data && git commit -m "feat(sync): season points for all players; regenerate data with draft values

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Draft analysis helpers (web)

**Files:**
- Create: `packages/web/src/lib/draft.ts`
- Test: `packages/web/src/lib/draft.test.ts`

**Interfaces:**
```ts
export interface ManagerDraftSummary { userId: UserId; picks: number; totalValue: number; totalPoB: number; best: DraftPick | null; worst: DraftPick | null }
export function managerDraftSummaries(draft: Draft): ManagerDraftSummary[]   // sorted by totalValue desc, then totalPoB desc
export function leagueExtremes(draft: Draft, n = 5): { steals: DraftPick[]; busts: DraftPick[] }   // by value desc / asc, PoB as tiebreak
export function valueColor(value: number | null): string   // CSS color string: translucent win/loss scaled by |value| clipped at 12; 'transparent' for null/0
export function posLabel(pos: string, rank: number | null): string   // 'RB7' or 'RB'
```

- [ ] **Step 1: Failing test**

`packages/web/src/lib/draft.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Draft, DraftPick } from '@fantasy-dash/core';
import { managerDraftSummaries, leagueExtremes, valueColor, posLabel } from './draft';

const pick = (pickNo: number, userId: string, value: number | null, pob: number): DraftPick => ({
  round: 1, pickNo, slot: pickNo, userId, playerId: `p${pickNo}`, isKeeper: false,
  posDraftRank: 1, seasonPoints: 100, posFinishRank: 1, value, pointsOverBaseline: pob,
});
const draft: Draft = { draftId: 'D', type: 'snake', rounds: 1, slotOrder: ['a', 'b'],
  picks: [pick(1, 'a', 5, 40), pick(2, 'b', -8, -20), pick(3, 'a', -2, 10), pick(4, 'b', 12, 60), pick(5, 'a', null, 5)] };

describe('managerDraftSummaries', () => {
  it('sums value and points over baseline per manager and finds best and worst picks', () => {
    const [first, second] = managerDraftSummaries(draft);
    expect(first).toMatchObject({ userId: 'b', picks: 2, totalValue: 4, totalPoB: 40 });
    expect(first.best?.pickNo).toBe(4);
    expect(first.worst?.pickNo).toBe(2);
    expect(second).toMatchObject({ userId: 'a', picks: 3, totalValue: 3, totalPoB: 55 });
    expect(second.best?.pickNo).toBe(1);
    expect(second.worst?.pickNo).toBe(3);
  });
});

describe('leagueExtremes', () => {
  it('returns the top steals and busts by value, ignoring unvalued picks', () => {
    const { steals, busts } = leagueExtremes(draft, 2);
    expect(steals.map((p) => p.pickNo)).toEqual([4, 1]);
    expect(busts.map((p) => p.pickNo)).toEqual([2, 3]);
  });
});

describe('valueColor and posLabel', () => {
  it('maps value to translucent win/loss colors clipped at 12', () => {
    expect(valueColor(null)).toBe('transparent');
    expect(valueColor(0)).toBe('transparent');
    expect(valueColor(6)).toBe('color-mix(in srgb, var(--win) 40%, transparent)');
    expect(valueColor(30)).toBe('color-mix(in srgb, var(--win) 70%, transparent)');
    expect(valueColor(-12)).toBe('color-mix(in srgb, var(--loss) 70%, transparent)');
  });
  it('formats positional draft rank', () => {
    expect(posLabel('RB', 7)).toBe('RB7');
    expect(posLabel('RB', null)).toBe('RB');
  });
});
```

- [ ] **Step 2: Run, expect failure; Step 3: Implement**

`packages/web/src/lib/draft.ts`:
```ts
import type { Draft, DraftPick, UserId } from '@fantasy-dash/core';

export interface ManagerDraftSummary { userId: UserId; picks: number; totalValue: number; totalPoB: number; best: DraftPick | null; worst: DraftPick | null }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function managerDraftSummaries(draft: Draft): ManagerDraftSummary[] {
  const map = new Map<UserId, ManagerDraftSummary>();
  for (const p of draft.picks) {
    const s = map.get(p.userId) ?? { userId: p.userId, picks: 0, totalValue: 0, totalPoB: 0, best: null, worst: null };
    s.picks += 1;
    if (p.value !== null) {
      s.totalValue += p.value;
      if (!s.best || p.value > (s.best.value ?? -Infinity)) s.best = p;
      if (!s.worst || p.value < (s.worst.value ?? Infinity)) s.worst = p;
    }
    if (p.pointsOverBaseline !== null) s.totalPoB += p.pointsOverBaseline;
    map.set(p.userId, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, totalPoB: r2(s.totalPoB) }))
    .sort((a, b) => b.totalValue - a.totalValue || b.totalPoB - a.totalPoB);
}

export function leagueExtremes(draft: Draft, n = 5): { steals: DraftPick[]; busts: DraftPick[] } {
  const valued = draft.picks.filter((p) => p.value !== null);
  const byValueDesc = [...valued].sort((a, b) => (b.value! - a.value!) || ((b.pointsOverBaseline ?? 0) - (a.pointsOverBaseline ?? 0)));
  const byValueAsc = [...valued].sort((a, b) => (a.value! - b.value!) || ((a.pointsOverBaseline ?? 0) - (b.pointsOverBaseline ?? 0)));
  return { steals: byValueDesc.slice(0, n), busts: byValueAsc.slice(0, n) };
}

/** Diverging fill for a value cell: 0 is transparent, |12| and beyond is the strongest tint. */
export function valueColor(value: number | null): string {
  if (value === null || value === 0) return 'transparent';
  const magnitude = Math.min(Math.abs(value), 12) / 12;        // 0..1
  const pct = Math.round(10 + magnitude * 60);                  // 10%..70%
  return `color-mix(in srgb, var(--${value > 0 ? 'win' : 'loss'}) ${pct}%, transparent)`;
}

export function posLabel(pos: string, rank: number | null): string {
  return rank === null ? pos : `${pos}${rank}`;
}
```
(Check: value 6 gives magnitude 0.5, pct 40; value 30 clips to 12, pct 70.)

- [ ] **Step 4: Run, expect pass; commit**

```bash
pnpm --filter @fantasy-dash/web test && git add packages/web/src/lib/draft.ts packages/web/src/lib/draft.test.ts && git commit -m "feat(web): draft analysis helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Draft board page

**Files:**
- Create: `packages/web/src/components/draft/DraftBoard.tsx`, `packages/web/src/components/draft/DraftAnalysis.tsx`, `packages/web/src/pages/DraftPage.tsx`
- Modify: `packages/web/src/App.tsx`, `packages/web/src/components/Nav.tsx`, `packages/web/src/components/history/DraftRoundOne.tsx`
- Test: `packages/web/src/components/draft/DraftBoard.test.tsx`

**Interfaces:**
- `<DraftBoard draft managers players mode highlight onHighlight inSeason />` where `mode: 'position' | 'value'`, `highlight: UserId | null`, `onHighlight(userId | null)`.
- `<DraftAnalysis draft managers players inSeason />`.
- Route `/draft/:season` (loader `seasonLoader`), `/draft` redirects to the current season; nav entry "Draft".

- [ ] **Step 1: Failing test**

`packages/web/src/components/draft/DraftBoard.test.tsx`:
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
  p4: { id: 'p4', name: 'Player Four', firstName: 'Player', lastName: 'Four', position: 'RB', team: 'DET', yearsExp: 1 },
};
const pick = (round: number, pickNo: number, slot: number, userId: string, playerId: string, value: number | null, extra: Partial<DraftPick> = {}): DraftPick => ({
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: 1, seasonPoints: 120.5, posFinishRank: 2, value, pointsOverBaseline: 15.25, ...extra,
});
const draft: Draft = {
  draftId: 'D', type: 'snake', rounds: 2, slotOrder: ['a', 'b'],
  picks: [pick(1, 1, 1, 'a', 'p1', 4), pick(1, 2, 2, 'b', 'p2', -6, { isKeeper: true }), pick(2, 3, 2, 'b', 'p3', 0), pick(2, 4, 1, 'a', 'p4', null)],
};

describe('DraftBoard', () => {
  it('lays picks out by round and slot with position labels and keeper tags', () => {
    render(<DraftBoard draft={draft} managers={managers} players={players} mode="position" highlight={null} onHighlight={() => {}} inSeason={false} />);
    const cells = screen.getAllByTestId('draft-cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('Player One');
    expect(cells[0]).toHaveTextContent('RB1');
    expect(cells[1]).toHaveTextContent('Keeper');
    expect(cells[0]).toHaveAttribute('title', expect.stringContaining('120.50'));
    expect(cells[0]).toHaveAttribute('title', expect.stringContaining('+15.25'));
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

- [ ] **Step 2: Run, expect failure; Step 3: Implement**

`packages/web/src/components/draft/DraftBoard.tsx`:
```tsx
import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import { fmtPts, fmtSigned } from '../../lib/format';
import { playerName, playerPos, playerTeam, posColor } from '../../lib/players';
import { posLabel, valueColor } from '../../lib/draft';

export type BoardMode = 'position' | 'value';

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory;
  mode: BoardMode; highlight: UserId | null; onHighlight: (userId: UserId | null) => void; inSeason: boolean;
}

function cellTitle(p: DraftPick, players: PlayerDirectory, inSeason: boolean): string {
  const pos = playerPos(players, p.playerId);
  const suffix = inSeason ? ' to date' : '';
  const lines = [`${playerName(players, p.playerId)} · ${pos} · ${playerTeam(players, p.playerId)}`, `Pick ${p.pickNo} (round ${p.round})`,
    `Season points${suffix}: ${fmtPts(p.seasonPoints)}`];
  if (p.posFinishRank !== null) lines.push(`Finished ${pos}${p.posFinishRank}${suffix} · drafted ${posLabel(pos, p.posDraftRank)}`);
  if (p.value !== null) lines.push(`Value: ${fmtSigned(p.value, 0)} ranks`);
  if (p.pointsOverBaseline !== null) lines.push(`Points over baseline: ${fmtSigned(p.pointsOverBaseline, 2)}`);
  if (p.isKeeper) lines.push('Keeper');
  return lines.join('\n');
}

export default function DraftBoard({ draft, managers, players, mode, highlight, onHighlight, inSeason }: Props) {
  const slots = draft.slotOrder.length;
  const bySlot = new Map<string, DraftPick>();
  for (const p of draft.picks) bySlot.set(`${p.round}-${p.slot}`, p);
  const rounds = Array.from({ length: draft.rounds }, (_, i) => i + 1);

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[960px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `3rem repeat(${slots}, minmax(0, 1fr))` }}>
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
          <div key={round} className="grid border-t border-line" style={{ gridTemplateColumns: `3rem repeat(${slots}, minmax(0, 1fr))` }}>
            <div className="num flex items-center justify-center text-xs text-muted">{round}</div>
            {draft.slotOrder.map((_, i) => {
              const slot = i + 1;
              const p = bySlot.get(`${round}-${slot}`);
              if (!p) return <div key={slot} className="h-14 border-l border-line" />;
              const pos = playerPos(players, p.playerId);
              const isHl = highlight !== null && p.userId === highlight;
              const dim = highlight !== null && !isHl;
              const background = mode === 'position' ? `color-mix(in srgb, ${posColor(pos)} 16%, transparent)` : valueColor(p.value);
              return (
                <div
                  key={slot}
                  data-testid="draft-cell"
                  data-highlight={isHl ? 'true' : 'false'}
                  title={cellTitle(p, players, inSeason)}
                  style={{ background }}
                  className={`flex h-14 flex-col justify-center border-l border-line px-2 text-xs transition-opacity ${dim ? 'opacity-35' : ''} ${isHl ? 'ring-1 ring-inset ring-accent' : ''}`}
                >
                  <div className="truncate font-medium">{playerName(players, p.playerId)}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="font-semibold" style={{ color: posColor(pos) }}>{posLabel(pos, p.posDraftRank)}</span>
                    <span>{playerTeam(players, p.playerId)}</span>
                    {mode === 'value' && p.value !== null && <span className="num ml-auto">{fmtSigned(p.value, 0)}</span>}
                    {p.isKeeper && <span className="ml-auto rounded bg-surface-2 px-1 text-[10px] uppercase tracking-wide">Keeper</span>}
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
Note: when both the value and the keeper badge would use `ml-auto`, keep the value `ml-auto` and the keeper badge without it (adjust so only one carries `ml-auto`).

`packages/web/src/components/draft/DraftAnalysis.tsx`:
```tsx
import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import { fmtPts, fmtSigned } from '../../lib/format';
import { playerName, playerPos } from '../../lib/players';
import { leagueExtremes, managerDraftSummaries, posLabel } from '../../lib/draft';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean }

function PickLine({ p, players, managers }: { p: DraftPick; players: PlayerDirectory; managers: Record<UserId, Manager> }) {
  const pos = playerPos(players, p.playerId);
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <Headshot players={players} id={p.playerId} size={24} />
      <span className="min-w-0 flex-1 truncate">{playerName(players, p.playerId)} <span className="text-xs text-muted">{posLabel(pos, p.posDraftRank)} → {pos}{p.posFinishRank ?? '?'} · pick {p.pickNo} · {managers[p.userId]?.displayName}</span></span>
      <span className={`num ${(p.value ?? 0) > 0 ? 'text-win' : (p.value ?? 0) < 0 ? 'text-loss' : 'text-muted'}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
      <span className="num w-16 text-right text-xs text-muted">{p.pointsOverBaseline === null ? '' : fmtSigned(p.pointsOverBaseline, 1)}</span>
    </li>
  );
}

export default function DraftAnalysis({ draft, managers, players, inSeason }: Props) {
  const summaries = managerDraftSummaries(draft);
  const { steals, busts } = leagueExtremes(draft, 5);
  const note = inSeason ? ' (to date)' : '';
  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="card overflow-x-auto">
        <div className="section-label px-4 pt-3">Draft grades{note}</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left">
            {['Manager', 'Value', 'Pts over baseline', 'Best pick', 'Worst pick'].map((h, i) => <th key={h} className={`section-label px-4 py-2 ${i === 1 || i === 2 ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {summaries.map((s) => {
              const m = managers[s.userId];
              return (
                <tr key={s.userId} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={22} />{m?.displayName ?? s.userId}</span></td>
                  <td className={`num px-4 py-2 text-right ${s.totalValue > 0 ? 'text-win' : s.totalValue < 0 ? 'text-loss' : ''}`}>{fmtSigned(s.totalValue, 0)}</td>
                  <td className="num px-4 py-2 text-right">{fmtSigned(s.totalPoB, 1)}</td>
                  <td className="px-4 py-2 text-xs">{s.best ? `${playerName(players, s.best.playerId)} (${fmtSigned(s.best.value ?? 0, 0)})` : '—'}</td>
                  <td className="px-4 py-2 text-xs">{s.worst ? `${playerName(players, s.worst.playerId)} (${fmtSigned(s.worst.value ?? 0, 0)})` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-muted">Value = positional draft rank minus positional finish rank (positive is a steal). Points over baseline compares season points to the last startable player at the position.</p>
      </div>
      <div className="space-y-4">
        <div className="card px-4 py-3"><div className="section-label">Top steals{note}</div><ul className="divide-y divide-line">{steals.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
        <div className="card px-4 py-3"><div className="section-label">Top busts{note}</div><ul className="divide-y divide-line">{busts.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} />)}</ul></div>
      </div>
    </div>
  );
}
```
`fmtPts` may be unused in this file; remove the import if so.

`packages/web/src/pages/DraftPage.tsx`:
```tsx
import { useState } from 'react';
import { Link, useLoaderData, useNavigate } from 'react-router';
import type { Season, UserId } from '@fantasy-dash/core';
import SeasonPicker from '../components/SeasonPicker';
import DraftBoard, { type BoardMode } from '../components/draft/DraftBoard';
import DraftAnalysis from '../components/draft/DraftAnalysis';
import { history, players } from '../data/load';

export default function DraftPage() {
  const season = useLoaderData() as Season;
  const navigate = useNavigate();
  const [mode, setMode] = useState<BoardMode>('position');
  const [highlight, setHighlight] = useState<UserId | null>(null);
  const years = history.seasons.map((s) => s.year);
  const inSeason = season.status === 'in_season';
  if (!season.draft) return <p className="text-sm text-muted">No draft recorded for {season.year}.</p>;
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Draft <span className="num font-normal text-muted">{season.year}</span></h1>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Color by" className="flex overflow-hidden rounded border border-line text-xs">
            {(['position', 'value'] as BoardMode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`px-3 py-1.5 capitalize ${mode === m ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}>{m}</button>
            ))}
          </div>
          <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/draft/${y}`)} />
        </div>
      </header>
      <p className="text-xs text-muted">
        {season.draft.rounds} rounds · {season.draft.type} · click a manager to highlight their picks · hover a pick for details{inSeason ? ' · values are to date' : ''} · <Link to={`/history/${season.year}`} className="text-accent hover:underline">season review</Link>
      </p>
      <DraftBoard draft={season.draft} managers={season.managers} players={players} mode={mode} highlight={highlight} onHighlight={setHighlight} inSeason={inSeason} />
      <DraftAnalysis draft={season.draft} managers={season.managers} players={players} inSeason={inSeason} />
    </section>
  );
}
```

`App.tsx`: add `{ path: 'draft', loader: () => redirect(`/draft/${currentSeason.year}`) }` and `{ path: 'draft/:season', loader: seasonLoader, element: <DraftPage /> }`. `Nav.tsx`: append `{ to: '/draft', label: 'Draft' }`. `DraftRoundOne.tsx`: replace the footer note with a `Link` to `/draft/${year}` labeled "Full draft board and analysis →" (add a `year` prop and pass `season.year` from `SeasonReviewPage`).

- [ ] **Step 4: Verify, screenshots, commit**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck && pnpm build
```
Screenshot `/draft/2025` at 1440 in both modes (toggle requires a click; capture the default position mode, then verify value mode via the test), `/draft/2026` at 1440 (to-date labels, keepers), `/draft/2025` at 400 (board scrolls inside its card; analysis stacks). `scrollWidth` must equal `vw`.

```bash
git add packages/web && git commit -m "feat(web): draft board with position and value modes, manager highlight, analysis panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Spec update

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-fantasy-dashboard-design.md`

- [ ] **Step 1: Spec**

In "Data model", replace the Phase 3 note on `Draft`/`DraftPick` with the final shape including the five value fields, and add `RawSeasonInput.playerSeasonPoints` under "Sync script" step 2 ("compute season points for every player with stats from the full weekly stat maps before trimming"). In "Views" Phase 4, note the Value mode tint scale (±12 ranks) and that in-season values are labeled "to date". Mark the record book link as still future.

```bash
git add docs && git commit -m "docs: phase 4 draft value data model

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 4 exit criteria

- `pnpm test` green in both packages; typechecks clean.
- Every season's `draft.picks` carry value fields; the regenerated data's steals and busts read sensibly on real players.
- `/draft/:season` deployed with both color modes, highlighting, cell details, and the analysis panel; the season review and nav link to it.
