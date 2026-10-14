# Phase 2: Head-to-Head and All-Time Standings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Head-to-Head page (any two managers, series summary, every meeting as score cards) and the All-Time standings page (career regular-season columns plus titles, podiums, playoff appearances and wins, toilet bowls), fed by new aggregates in `history.json`.

**Architecture:** `packages/core` gains two pure computations inside `buildHistory`: a per-pair series summary (streak, totals, biggest win, closest game, average margin) and per-manager all-time rows. `scripts/sync.ts` is unchanged; `pnpm sync` regenerates `data/history.json`. The web app adds `/all-time` and `/h2h` routes. The H2H page loads every season chunk so it can render full `ScoreCard`s for each meeting.

**Tech Stack:** unchanged from Phase 1 (TypeScript strict, Vitest, zod 3, Vite 6, React 19, react-router 7, Tailwind 4).

**Spec:** `docs/superpowers/specs/2026-10-14-fantasy-dashboard-design.md`, sections "Metric definitions" (Head-to-head, All-time standings) and "Views" Phase 2.

## Global Constraints

- Managers keyed by Sleeper `user_id`.
- Regular season = weeks `1` to `playoffWeekStart - 1`; all-time standings columns use regular season only; the all-time streak continues across season boundaries.
- Head-to-head uses every played meeting including playoffs, with the game's tag carried. Streak = consecutive wins by the same manager at the end of the series. Biggest win = largest margin by either side. Closest = smallest non-zero margin, or a tie if one exists. Ties count 0.5 in Win%.
- Honors come from each season's `honors`; playoff appearance = seeded into the winners bracket; playoff wins = winners-bracket games won (including placement games); toilet bowls = seasons finished last.
- Points rounded to 2 decimals; ratios stored 0 to 1 with 4 decimals.
- Sort all-time rows by wins desc, then PF desc (same as season standings).
- UI tokens and shared components from Phase 1 stay: `.card`, `.section-label`, `.num`, `.pos-pill`, `Avatar`, `ScoreCard` (props `game`, `played`, `managers`, `players`, `to`), `fmt*` helpers.
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work on branch `phase-2`; do not push during tasks.

## File Structure

```
packages/core/src/types.ts          # H2HSeries gains summary fields; new AllTimeRow; History gains allTime
packages/core/src/history.ts        # summarizeSeries(), buildAllTime() used by buildHistory()
packages/core/src/schema.ts         # schemas updated, linked to types with `satisfies`
packages/core/test/history.test.ts  # extended
packages/core/test/fixtures/mini.ts # unchanged (reused)
data/history.json                   # regenerated
packages/web/src/pages/AllTimePage.tsx
packages/web/src/components/AllTimeTable.tsx (+ .test.tsx)
packages/web/src/pages/H2HPage.tsx
packages/web/src/components/h2h/ManagerPicker.tsx
packages/web/src/components/h2h/SeriesSummary.tsx (+ .test.tsx)
packages/web/src/components/h2h/OpponentList.tsx
packages/web/src/data/load.ts        # loadAllSeasons()
packages/web/src/App.tsx             # routes
packages/web/src/components/Nav.tsx  # links
packages/web/src/components/boxscore/HeadToHead.tsx  # "Full series" link
docs/superpowers/specs/...design.md  # data model section updated
README.md                            # off-season cron note
```

---

### Task 1: Series summary stats in core

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/history.ts`, `packages/core/src/schema.ts`
- Test: `packages/core/test/history.test.ts`

**Interfaces:**
- Produces (added to `H2HSeries`):
```ts
  streak: { holder: UserId | null; length: number };
  totalPoints: { a: number; b: number };
  /** null when the series has no decided game */
  biggestWin: { gameId: string; winner: UserId; margin: number } | null;
  /** null when the series is empty; a tie counts as margin 0 */
  closest: { gameId: string; margin: number } | null;
  avgMargin: number;
```
- `summarizeSeries(series: H2HSeries): H2HSeries` (pure; fills the fields above from `games`, which must be newest first)

- [ ] **Step 1: Failing test**

Append to `packages/core/test/history.test.ts` (inside the file, after the existing `describe`):
```ts
import { summarizeSeries } from '../src/history';
import type { H2HSeries } from '../src/types';

function seriesWith(games: [number, number, number, number][]): H2HSeries {
  // [year, week, aPoints, bPoints], any order; summarizeSeries expects newest first
  const sorted = [...games].sort((p, q) => q[0] - p[0] || q[1] - p[1]);
  return {
    a: 'ua', b: 'ub', aWins: 0, bWins: 0, ties: 0,
    streak: { holder: null, length: 0 }, totalPoints: { a: 0, b: 0 }, biggestWin: null, closest: null, avgMargin: 0,
    games: sorted.map(([year, week, aPoints, bPoints]) => ({ gameId: `${year}-${week}-1`, year, week, tag: null, aPoints, bPoints })),
  };
}

describe('summarizeSeries', () => {
  it('computes streak, totals, biggest win, closest and average margin', () => {
    const s = summarizeSeries(seriesWith([
      [2024, 1, 100, 90],   // a by 10
      [2024, 5, 80, 120],   // b by 40
      [2025, 2, 110, 100],  // a by 10
      [2025, 9, 131.5, 130], // a by 1.5  (newest)
    ]));
    expect(s.streak).toEqual({ holder: 'ua', length: 2 });
    expect(s.totalPoints).toEqual({ a: 421.5, b: 440 });
    expect(s.biggestWin).toEqual({ gameId: '2024-5-1', winner: 'ub', margin: 40 });
    expect(s.closest).toEqual({ gameId: '2025-9-1', margin: 1.5 });
    expect(s.avgMargin).toBe(15.38);
  });

  it('treats a tie as the closest game and breaks the streak', () => {
    const s = summarizeSeries(seriesWith([[2024, 1, 100, 90], [2024, 3, 100, 100]]));
    expect(s.streak).toEqual({ holder: null, length: 0 });
    expect(s.closest).toEqual({ gameId: '2024-3-1', margin: 0 });
    expect(s.biggestWin).toEqual({ gameId: '2024-1-1', winner: 'ua', margin: 10 });
  });

  it('handles an empty series', () => {
    const s = summarizeSeries(seriesWith([]));
    expect(s.streak).toEqual({ holder: null, length: 0 });
    expect(s.biggestWin).toBeNull();
    expect(s.closest).toBeNull();
    expect(s.avgMargin).toBe(0);
  });

  it('is applied by buildHistory', () => {
    const h = buildHistory([buildSeason(miniInput())]);
    expect(h.h2h['ua|ub'].streak).toEqual({ holder: 'ua', length: 1 });
    expect(h.h2h['ua|ub'].totalPoints).toEqual({ a: 100, b: 90 });
    expect(h.h2h['ub|ud'].closest).toEqual({ gameId: '2024-2-2', margin: 0 });
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- history
```
Expected: FAIL, `summarizeSeries` is not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/types.ts`, replace the `H2HSeries` interface with:
```ts
export interface H2HSeries {
  a: UserId;
  b: UserId;
  aWins: number;
  bWins: number;
  ties: number;
  /** consecutive wins by the same manager at the end of the series */
  streak: { holder: UserId | null; length: number };
  totalPoints: { a: number; b: number };
  /** null when no game has been decided */
  biggestWin: { gameId: string; winner: UserId; margin: number } | null;
  /** null when the series is empty; a tie is margin 0 */
  closest: { gameId: string; margin: number } | null;
  avgMargin: number;
  /** newest first */
  games: H2HGame[];
}
```

In `packages/core/src/history.ts`, add the import `import { round2 } from './scoring';` and this function; then, in `buildHistory`, create series with the new fields zeroed (`streak: { holder: null, length: 0 }, totalPoints: { a: 0, b: 0 }, biggestWin: null, closest: null, avgMargin: 0`) and after the games sort loop call `h2h[key] = summarizeSeries(series)` for every series:
```ts
/** Fill streak, totals, biggest win, closest game and average margin from `games` (newest first). */
export function summarizeSeries(series: H2HSeries): H2HSeries {
  const games = series.games;
  let holder: UserId | null = null;
  let length = 0;
  for (const g of games) {
    const winner = g.aPoints > g.bPoints ? series.a : g.bPoints > g.aPoints ? series.b : null;
    if (length === 0) {
      if (!winner) break;
      holder = winner;
      length = 1;
    } else if (winner === holder) {
      length += 1;
    } else {
      break;
    }
  }

  let totalA = 0;
  let totalB = 0;
  let biggestWin: H2HSeries['biggestWin'] = null;
  let closest: H2HSeries['closest'] = null;
  let marginSum = 0;
  for (const g of games) {
    totalA += g.aPoints;
    totalB += g.bPoints;
    const margin = round2(Math.abs(g.aPoints - g.bPoints));
    marginSum += margin;
    if (margin > 0 && (!biggestWin || margin > biggestWin.margin)) {
      biggestWin = { gameId: g.gameId, winner: g.aPoints > g.bPoints ? series.a : series.b, margin };
    }
    if (!closest || margin < closest.margin) closest = { gameId: g.gameId, margin };
  }

  return {
    ...series,
    streak: { holder, length },
    totalPoints: { a: round2(totalA), b: round2(totalB) },
    biggestWin,
    closest,
    avgMargin: games.length ? round2(marginSum / games.length) : 0,
  };
}
```

In `packages/core/src/schema.ts`, extend the h2h record's object with:
```ts
    streak: z.object({ holder: z.string().nullable(), length: z.number() }),
    totalPoints: z.object({ a: z.number(), b: z.number() }),
    biggestWin: z.object({ gameId: z.string(), winner: z.string(), margin: z.number() }).nullable(),
    closest: z.object({ gameId: z.string(), margin: z.number() }).nullable(),
    avgMargin: z.number(),
```
and add compile-time links at the bottom of the file (import the types from `./types`):
```ts
import type { History, PlayerDirectory, Season } from './types';
// Compile-time drift guards: a field added to a type without a schema update fails typecheck.
export const _seasonSchemaCheck = SeasonSchema satisfies z.ZodType<Season>;
export const _historySchemaCheck = HistorySchema satisfies z.ZodType<History>;
export const _playersSchemaCheck = PlayerDirectorySchema satisfies z.ZodType<PlayerDirectory>;
```
If `satisfies` fails on the `sides` tuple or another field, align the schema to the type (not the reverse) and note it in the report.

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/core typecheck
```
Expected: all pass (previous 64 plus 4), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): head-to-head series summary stats and schema type guards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: All-time rows in core

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/history.ts`, `packages/core/src/schema.ts`
- Test: `packages/core/test/history.test.ts`

**Interfaces:**
- Produces:
```ts
export interface AllTimeRow {
  userId: UserId;
  rank: number;
  seasons: number;
  w: number; l: number; t: number; winPct: number;
  pf: number; pa: number; ppg: number; maxPoints: number; efficiency: number;
  streak: string;
  allPlay: AllPlay;
  weeklyHighs: number;
  titles: number; runnerUps: number; thirds: number;
  playoffApps: number; playoffWins: number; toiletBowls: number;
}
```
  and `History.allTime: AllTimeRow[]`, plus `buildAllTime(seasons: Season[]): AllTimeRow[]` (seasons any order).

- [ ] **Step 1: Failing test**

Append to `packages/core/test/history.test.ts`:
```ts
import { buildAllTime } from '../src/history';
import type { Season } from '../src/types';

describe('buildAllTime', () => {
  // Two mini seasons; 2025 gets a bracket so honors and playoff counts are exercised.
  const s2024 = buildSeason(miniInput());
  const later = miniInput();
  later.league.season = '2025';
  later.league.league_id = 'L2025';
  later.league.settings.playoff_week_start = 3;
  later.league.settings.playoff_teams = 2;
  // week 3 becomes the Final: ua vs ub (ua wins 120-70? pairings are (ua,ud),(ub,uc); use ua vs ud as Final)
  later.winnersBracket = [{ r: 1, m: 1, t1: 1, t2: 4, p: 1 }];
  later.losersBracket = [{ r: 1, m: 1, t1: 2, t2: 3, p: 1 }];
  const s2025 = buildSeason(later);
  const rows = buildAllTime([s2025, s2024]);
  const by = Object.fromEntries(rows.map((r) => [r.userId, r]));

  it('sums regular-season columns across seasons', () => {
    // 2024 regular season: 3 weeks; 2025 regular season: weeks 1-2 only
    expect(by.uc).toMatchObject({ seasons: 2, w: 5, l: 0, t: 0, winPct: 1, pf: 510, weeklyHighs: 3 });
    expect(by.ua).toMatchObject({ w: 3, l: 2, t: 0, pf: 440, pa: 450 });
    expect(by.ua.ppg).toBe(88);
    expect(by.ua.maxPoints).toBe(484);
    expect(by.ua.efficiency).toBe(0.9091);
  });

  it('carries the streak across seasons', () => {
    // ua: 2024 W L W, 2025 W L -> L1 ; uc: 2024 WWW, 2025 WW -> W5
    expect(by.ua.streak).toBe('L1');
    expect(by.uc.streak).toBe('W5');
  });

  it('counts honors, playoff appearances and wins, toilet bowls', () => {
    // Final: ua 120 vs ud 50. Toilet bowl: ub 70 vs uc 130, lower scorer advances, so ub is last.
    expect(s2025.honors).toMatchObject({ champion: 'ua', runnerUp: 'ud', third: null, lastPlace: 'ub' });
    expect(by.ua).toMatchObject({ titles: 1, runnerUps: 0, playoffApps: 1, playoffWins: 1, toiletBowls: 0 });
    expect(by.ud).toMatchObject({ titles: 0, runnerUps: 1, playoffApps: 1, playoffWins: 0 });
    expect(by.ub).toMatchObject({ playoffApps: 0, toiletBowls: 1 });
    expect(by.uc).toMatchObject({ playoffApps: 0, toiletBowls: 0 });
  });

  it('ranks by wins then points for', () => {
    expect(rows.map((r) => r.userId)).toEqual(['uc', 'ua', 'ub', 'ud']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('is included in buildHistory output', () => {
    const h = buildHistory([s2024]);
    expect(h.allTime).toHaveLength(4);
    expect(h.allTime[0].userId).toBe('uc');
  });
});
```
Hand-check of the expectations (mini fixture): 2024 regular season is weeks 1 to 3 with totals A 100/60/120, B 90/95/70, C 80/110/130, D 70/95/50. In the 2025 variant `playoff_week_start` is 3, so only weeks 1 and 2 are regular season: A 100, 60; B 90, 95; C 80, 110; D 70, 95. uc: 2024 3-0 (pf 320) plus 2025 2-0 (pf 190) = 5-0, pf 510, highs 2+1 = 3 (2024 wk2, wk3; 2025 wk2). ua: 2024 2-1 (pf 280, pa 250) plus 2025 1-1 (pf 160, pa 200) = 3-2, pf 440, pa 450, games 5, ppg 88, max 302 + (100+82) = 484, eff 440/484 = 0.9091. Week 3 of 2025 is the Final between ua (120) and ud (50): ua champion, ud runner-up. The consolation final is ub (70) vs uc (130); the lower scorer advances in a toilet bowl, so ub is last place. The consolation bracket is not the winners bracket, so ub and uc have no playoff appearance. Ranking: ub and ud are both 0-3-2 across the two seasons; ub has more PF (440 vs 380).

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/core test -- history
```
Expected: FAIL, `buildAllTime` is not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/types.ts` add `AllTimeRow` (as in Interfaces) and `allTime: AllTimeRow[]` to `History`.

In `packages/core/src/history.ts` add imports `import { computeStreak, isRegularSeason, type Result } from './standings'; import { round2, round4 } from './scoring';` and:
```ts
interface AllTimeAcc {
  seasons: Set<number>;
  w: number; l: number; t: number; pf: number; pa: number; max: number; games: number;
  ap: { w: number; l: number; t: number };
  highs: number;
  results: Result[];
  titles: number; runnerUps: number; thirds: number; playoffApps: number; playoffWins: number; toiletBowls: number;
}

export function buildAllTime(seasons: Season[]): AllTimeRow[] {
  const sorted = [...seasons].sort((a, b) => a.year - b.year);
  const acc = new Map<UserId, AllTimeAcc>();
  const get = (u: UserId): AllTimeAcc => {
    let a = acc.get(u);
    if (!a) {
      a = { seasons: new Set(), w: 0, l: 0, t: 0, pf: 0, pa: 0, max: 0, games: 0, ap: { w: 0, l: 0, t: 0 }, highs: 0, results: [],
        titles: 0, runnerUps: 0, thirds: 0, playoffApps: 0, playoffWins: 0, toiletBowls: 0 };
      acc.set(u, a);
    }
    return a;
  };

  for (const s of sorted) {
    for (const m of Object.values(s.managers)) get(m.userId).seasons.add(s.year);

    for (const row of s.standings) {
      const a = get(row.userId);
      a.w += row.w; a.l += row.l; a.t += row.t;
      a.pf += row.pf; a.pa += row.pa; a.max += row.maxPoints;
      a.games += row.w + row.l + row.t;
      a.ap.w += row.allPlay.w; a.ap.l += row.allPlay.l; a.ap.t += row.allPlay.t;
      a.highs += row.weeklyHighs;
    }

    for (const wk of s.weeks) {
      if (!wk.played || !isRegularSeason(wk.week, s.playoffWeekStart)) continue;
      for (const g of wk.games) {
        g.sides.forEach((side, i) => {
          const opp = g.sides[1 - i];
          get(side.userId).results.push(side.points > opp.points ? 'W' : side.points < opp.points ? 'L' : 'T');
        });
      }
    }

    const seeded = new Set<UserId>();
    for (const bg of s.brackets.winners) {
      if (bg.home) seeded.add(bg.home);
      if (bg.away) seeded.add(bg.away);
      if (bg.advanced) get(bg.advanced).playoffWins += 1;
    }
    for (const u of seeded) get(u).playoffApps += 1;

    if (s.honors.champion) get(s.honors.champion).titles += 1;
    if (s.honors.runnerUp) get(s.honors.runnerUp).runnerUps += 1;
    if (s.honors.third) get(s.honors.third).thirds += 1;
    if (s.honors.lastPlace) get(s.honors.lastPlace).toiletBowls += 1;
  }

  const rows: AllTimeRow[] = [...acc.entries()].map(([userId, a]) => {
    const apTotal = a.ap.w + a.ap.l + a.ap.t;
    return {
      userId, rank: 0, seasons: a.seasons.size,
      w: a.w, l: a.l, t: a.t,
      winPct: a.games ? round4((a.w + a.t / 2) / a.games) : 0,
      pf: round2(a.pf), pa: round2(a.pa),
      ppg: a.games ? round2(a.pf / a.games) : 0,
      maxPoints: round2(a.max),
      efficiency: a.max ? round4(a.pf / a.max) : 0,
      streak: computeStreak(a.results),
      allPlay: { ...a.ap, pct: apTotal ? round4((a.ap.w + a.ap.t / 2) / apTotal) : 0 },
      weeklyHighs: a.highs,
      titles: a.titles, runnerUps: a.runnerUps, thirds: a.thirds,
      playoffApps: a.playoffApps, playoffWins: a.playoffWins, toiletBowls: a.toiletBowls,
    };
  });
  rows.sort((x, y) => y.w - x.w || y.pf - x.pf);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
```
In `buildHistory`, add `allTime: buildAllTime(sorted)` to the returned object.

In `packages/core/src/schema.ts` add an `AllTimeRow` schema mirroring the interface (reuse `WLT.extend({ pct })` for `allPlay`) and `allTime: z.array(AllTimeRow)` to `HistorySchema`. The `satisfies` guard from Task 1 will fail until this is done.

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/core typecheck
```
Expected: all pass (64 + 4 + 5), typecheck clean. If `playoffWins` for `ua` is 0, check that `resolveBracket` resolved the Final (week 3 must be `<= lastScoredWeek`, which is 3 for a complete season).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): all-time rows with honors and playoff counts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Regenerate data

**Files:**
- Generate: `data/history.json` (and season files, unchanged in content)

- [ ] **Step 1: Sync and inspect**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && pnpm sync && node -e '
const h=require("./data/history.json");
const n=id=>h.managers[id].displayName;
console.log("allTime:"); for (const r of h.allTime) console.log(` ${r.rank} ${n(r.userId).padEnd(14)} ${r.w}-${r.l}-${r.t} pf ${r.pf} eff ${r.efficiency} strk ${r.streak} AP ${r.allPlay.w}-${r.allPlay.l} T${r.titles} R${r.runnerUps} 3rd${r.thirds} PO${r.playoffApps}/${r.playoffWins} TB${r.toiletBowls}`);
const s=Object.values(h.h2h).sort((a,b)=>b.games.length-a.games.length)[0];
console.log("longest series:", n(s.a), "vs", n(s.b), s.aWins+"-"+s.bWins+"-"+s.ties, "streak", s.streak, "biggest", s.biggestWin, "closest", s.closest, "avg", s.avgMargin);'
```
Expected: 11 all-time rows; titles sum to 3, runnerUps 3, thirds 3, toiletBowls 3 (the three complete seasons); playoffApps sum to 18 (6 teams × 3 seasons); every series has a streak, totals, biggestWin, closest and avgMargin. If any sum is off, the bracket or honors mapping in `buildAllTime` is wrong; fix core, not data.

- [ ] **Step 2: Commit**

```bash
git add data && git commit -m "chore(data): regenerate history with series summaries and all-time rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: All-Time page

**Files:**
- Create: `packages/web/src/components/AllTimeTable.tsx`, `packages/web/src/pages/AllTimePage.tsx`
- Modify: `packages/web/src/App.tsx`, `packages/web/src/components/Nav.tsx`, `packages/web/src/lib/metrics.ts`
- Test: `packages/web/src/components/AllTimeTable.test.tsx`

**Interfaces:**
- Consumes: `history.allTime`, `history.managers`, `Avatar`, `fmt*`, `METRIC_DEFS`
- Produces: route `/all-time`; `<AllTimeTable rows managers />` where `managers` is `History['managers']`; manager cell links to `/h2h?a=<userId>`

- [ ] **Step 1: Failing test**

`packages/web/src/components/AllTimeTable.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { AllTimeRow, History } from '@fantasy-dash/core';
import AllTimeTable from './AllTimeTable';

const row = (userId: string, rank: number, extra: Partial<AllTimeRow> = {}): AllTimeRow => ({
  userId, rank, seasons: 3, w: 20, l: 10, t: 0, winPct: 0.6667, pf: 4000.5, pa: 3800, ppg: 133.4, maxPoints: 4400,
  efficiency: 0.9092, streak: 'W2', allPlay: { w: 180, l: 90, t: 0, pct: 0.6667 }, weeklyHighs: 5,
  titles: 1, runnerUps: 0, thirds: 2, playoffApps: 3, playoffWins: 4, toiletBowls: 0, ...extra,
});
const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2023, 2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024] },
};

describe('AllTimeTable', () => {
  it('renders career columns, honors and links each manager to head-to-head', () => {
    render(<MemoryRouter><AllTimeTable rows={[row('a', 1), row('b', 2, { seasons: 1, titles: 0, toiletBowls: 1, streak: 'L3' })]} managers={managers} /></MemoryRouter>);
    const rows = screen.getAllByTestId('alltime-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('alice');
    expect(rows[0]).toHaveTextContent('.667');
    expect(rows[0]).toHaveTextContent('90.9%');
    expect(rows[0]).toHaveTextContent('180-90');
    expect(rows[1]).toHaveTextContent('L3');
    expect(screen.getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/h2h?a=a');
    expect(screen.getByText('Titles')).toHaveAttribute('title', expect.stringContaining('Championships'));
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- AllTimeTable
```
Expected: FAIL, cannot resolve `./AllTimeTable`.

- [ ] **Step 3: Implement**

Add to `METRIC_DEFS` in `packages/web/src/lib/metrics.ts`:
```ts
  titles: 'Championships won.',
  runnerUps: 'Championship game losses.',
  thirds: 'Third-place game wins.',
  playoffApps: 'Seasons seeded into the playoff bracket.',
  playoffWins: 'Playoff bracket games won, including placement games.',
  toiletBowls: 'Seasons finished in last place.',
  seasons: 'Seasons played in the league.',
```

`packages/web/src/components/AllTimeTable.tsx`:
```tsx
import { Link } from 'react-router';
import type { AllTimeRow, History } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { fmtPct, fmtPpg, fmtPts, fmtWinPct } from '../lib/format';
import { METRIC_DEFS } from '../lib/metrics';

interface Props { rows: AllTimeRow[]; managers: History['managers'] }

const headers: { key: string; label: string; title?: string; left?: boolean }[] = [
  { key: 'rank', label: '#', left: true },
  { key: 'mgr', label: 'Manager', left: true },
  { key: 'seasons', label: 'Yrs', title: METRIC_DEFS.seasons },
  { key: 'w', label: 'W' }, { key: 'l', label: 'L' }, { key: 't', label: 'T' },
  { key: 'pct', label: 'Win%', title: METRIC_DEFS.winPct },
  { key: 'pf', label: 'PF', title: METRIC_DEFS.pf },
  { key: 'pa', label: 'PA', title: METRIC_DEFS.pa },
  { key: 'ppg', label: 'PPG', title: METRIC_DEFS.ppg },
  { key: 'max', label: 'Max', title: METRIC_DEFS.max },
  { key: 'eff', label: 'Eff', title: METRIC_DEFS.eff },
  { key: 'strk', label: 'Strk', title: METRIC_DEFS.strk },
  { key: 'ap', label: 'All-Play', title: METRIC_DEFS.allPlay },
  { key: 'titles', label: 'Titles', title: METRIC_DEFS.titles },
  { key: 'second', label: '2nd', title: METRIC_DEFS.runnerUps },
  { key: 'third', label: '3rd', title: METRIC_DEFS.thirds },
  { key: 'apps', label: 'PO Apps', title: METRIC_DEFS.playoffApps },
  { key: 'powins', label: 'PO Wins', title: METRIC_DEFS.playoffWins },
  { key: 'tb', label: 'Toilet', title: METRIC_DEFS.toiletBowls },
];

const cell = 'num px-3 py-2 text-right whitespace-nowrap';
const honor = (n: number) => (n > 0 ? <span className="text-ink">{n}</span> : <span className="text-muted/60">0</span>);

export default function AllTimeTable({ rows, managers }: Props) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {headers.map((h) => (
              <th key={h.key} scope="col" title={h.title} className={`section-label px-3 py-2 ${h.left ? 'text-left' : 'text-right'}`}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = managers[r.userId];
            const name = m?.displayName ?? r.userId;
            const tone = r.streak.startsWith('W') ? 'text-win' : r.streak.startsWith('L') ? 'text-loss' : 'text-muted';
            return (
              <tr key={r.userId} data-testid="alltime-row" className="border-t border-line transition-colors hover:bg-surface-2">
                <td className="num w-10 px-3 py-2 text-muted">{r.rank}</td>
                <td className="px-3 py-2">
                  <Link to={`/h2h?a=${r.userId}`} className="flex items-center gap-2 hover:text-accent">
                    <Avatar avatar={m?.avatar ?? null} name={name} size={24} />
                    <span className="font-medium">{name}</span>
                  </Link>
                </td>
                <td className={cell}>{r.seasons}</td>
                <td className={cell}>{r.w}</td>
                <td className={cell}>{r.l}</td>
                <td className={`${cell} text-muted`}>{r.t}</td>
                <td className={cell}>{fmtWinPct(r.winPct)}</td>
                <td className={cell}>{fmtPts(r.pf)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.pa)}</td>
                <td className={cell}>{fmtPpg(r.ppg)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.maxPoints)}</td>
                <td className={cell}>{fmtPct(r.efficiency)}</td>
                <td className={`${cell} ${tone}`}>{r.streak}</td>
                <td className={cell}>{r.allPlay.w}-{r.allPlay.l}{r.allPlay.t ? `-${r.allPlay.t}` : ''} <span className="text-muted">({fmtWinPct(r.allPlay.pct)})</span></td>
                <td className={cell}>{honor(r.titles)}</td>
                <td className={cell}>{honor(r.runnerUps)}</td>
                <td className={cell}>{honor(r.thirds)}</td>
                <td className={cell}>{honor(r.playoffApps)}</td>
                <td className={cell}>{honor(r.playoffWins)}</td>
                <td className={cell}>{honor(r.toiletBowls)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`packages/web/src/pages/AllTimePage.tsx`:
```tsx
import AllTimeTable from '../components/AllTimeTable';
import { history } from '../data/load';

export default function AllTimePage() {
  const first = history.seasons[0]?.year;
  const last = history.seasons[history.seasons.length - 1]?.year;
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">All-Time <span className="num font-normal text-muted">{first} to {last}</span></h1>
      </header>
      <AllTimeTable rows={history.allTime} managers={history.managers} />
      <p className="text-xs text-muted">Regular season records across every season. Streak carries across seasons. Click a manager to open their head-to-head history.</p>
    </section>
  );
}
```

`App.tsx`: import `AllTimePage` and add `{ path: 'all-time', element: <AllTimePage /> }` after the standings routes. `Nav.tsx`: add `{ to: '/all-time', label: 'All-Time' }` after Standings.

- [ ] **Step 4: Run, expect pass; browser check**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck
```
Expected: 28 passed, typecheck clean. Start the dev server and screenshot `/all-time` at 1440 and 400 with the controller's script (see Task 7 for the commands); the table must scroll horizontally inside its card at 400 with no page overflow.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): all-time standings page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Head-to-Head page

**Files:**
- Create: `packages/web/src/components/h2h/ManagerPicker.tsx`, `SeriesSummary.tsx`, `OpponentList.tsx`, `packages/web/src/pages/H2HPage.tsx`
- Modify: `packages/web/src/data/load.ts` (`loadAllSeasons`), `packages/web/src/App.tsx`, `packages/web/src/components/Nav.tsx`
- Test: `packages/web/src/components/h2h/SeriesSummary.test.tsx`

**Interfaces:**
- `loadAllSeasons(): Promise<Season[]>` (oldest first, cached)
- `<ManagerPicker label value onChange exclude? />` renders a `<select>` of `history.managers` sorted by display name
- `<SeriesSummary series a b managers games />` where `a`/`b` are the selected ids (series may be oriented either way), `games` is a map `gameId -> { year, week, matchupId }` for links
- `<OpponentList a managers />` lists every opponent of `a` with the record, each linking to `/h2h?a=<a>&b=<opp>`
- Route `/h2h` with search params `a` and `b`

- [ ] **Step 1: Failing test**

`packages/web/src/components/h2h/SeriesSummary.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { H2HSeries, History } from '@fantasy-dash/core';
import SeriesSummary from './SeriesSummary';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] },
};
const series: H2HSeries = {
  a: 'a', b: 'b', aWins: 3, bWins: 1, ties: 0,
  streak: { holder: 'a', length: 2 },
  totalPoints: { a: 500.5, b: 450.25 },
  biggestWin: { gameId: '2024-5-2', winner: 'b', margin: 40 },
  closest: { gameId: '2025-9-1', margin: 1.5 },
  avgMargin: 15.38,
  games: [],
};

describe('SeriesSummary', () => {
  it('orients the record to the selected pair and links the notable games', () => {
    render(<MemoryRouter><SeriesSummary series={series} a="b" b="a" managers={managers} /></MemoryRouter>);
    expect(screen.getByTestId('series-record')).toHaveTextContent('1 – 3');
    expect(screen.getByText(/alice has won 2 straight/)).toBeInTheDocument();
    expect(screen.getByText('450.25')).toBeInTheDocument();
    expect(screen.getByText('500.50')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bob by 40\.00/ })).toHaveAttribute('href', '/scores/2024/5/2');
    expect(screen.getByRole('link', { name: /1\.50/ })).toHaveAttribute('href', '/scores/2025/9/1');
    expect(screen.getByText('15.38')).toBeInTheDocument();
  });

  it('handles a series with no games', () => {
    render(<MemoryRouter><SeriesSummary series={undefined} a="a" b="b" managers={managers} /></MemoryRouter>);
    expect(screen.getByText(/never met/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- SeriesSummary
```
Expected: FAIL, cannot resolve `./SeriesSummary`.

- [ ] **Step 3: Implement**

`packages/web/src/data/load.ts`, add:
```ts
let allSeasons: Promise<Season[]> | null = null;
/** Every season, oldest first. Used by pages that span seasons (head-to-head). */
export function loadAllSeasons(): Promise<Season[]> {
  if (!allSeasons) allSeasons = Promise.all(history.seasons.map((s) => loadSeason(s.year)));
  return allSeasons;
}
```

`packages/web/src/components/h2h/ManagerPicker.tsx`:
```tsx
import type { History } from '@fantasy-dash/core';

interface Props { label: string; value: string; onChange: (id: string) => void; managers: History['managers']; exclude?: string }

export default function ManagerPicker({ label, value, onChange, managers, exclude }: Props) {
  const options = Object.entries(managers)
    .filter(([id]) => id !== exclude)
    .sort(([, x], [, y]) => x.displayName.localeCompare(y.displayName));
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-line bg-surface px-2 py-1 text-ink">
        <option value="">Choose a manager</option>
        {options.map(([id, m]) => <option key={id} value={id}>{m.displayName}</option>)}
      </select>
    </label>
  );
}
```

`packages/web/src/components/h2h/SeriesSummary.tsx`:
```tsx
import { Link } from 'react-router';
import type { H2HSeries, History } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { fmtPts } from '../../lib/format';

interface Props { series: H2HSeries | undefined; a: string; b: string; managers: History['managers'] }

const linkFor = (gameId: string) => {
  const [year, week, matchupId] = gameId.split('-');
  return `/scores/${year}/${week}/${matchupId}`;
};

export default function SeriesSummary({ series, a, b, managers }: Props) {
  const nameOf = (id: string | null) => (id ? managers[id]?.displayName ?? id : '');
  if (!series || series.games.length === 0) {
    return <div className="card p-6 text-sm text-muted">{nameOf(a)} and {nameOf(b)} have never met.</div>;
  }
  const flipped = series.a !== a;
  const aWins = flipped ? series.bWins : series.aWins;
  const bWins = flipped ? series.aWins : series.bWins;
  const aPts = flipped ? series.totalPoints.b : series.totalPoints.a;
  const bPts = flipped ? series.totalPoints.a : series.totalPoints.b;
  const streak = series.streak.holder
    ? `${nameOf(series.streak.holder)} has won ${series.streak.length} straight`
    : 'No active streak';

  return (
    <div className="card p-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar avatar={managers[a]?.avatar ?? null} name={nameOf(a)} size={44} />
          <div><div className="text-lg font-semibold">{nameOf(a)}</div><div className="num text-xs text-muted">{fmtPts(aPts)} total</div></div>
        </div>
        <div className="text-center">
          <div data-testid="series-record" className="num text-4xl font-semibold">{aWins} – {bWins}</div>
          <div className="section-label mt-1">{series.ties ? `${series.games.length} meetings · ${series.ties} tie${series.ties > 1 ? 's' : ''}` : `${series.games.length} meetings`}</div>
        </div>
        <div className="flex items-center justify-end gap-3 text-right">
          <div><div className="text-lg font-semibold">{nameOf(b)}</div><div className="num text-xs text-muted">{fmtPts(bPts)} total</div></div>
          <Avatar avatar={managers[b]?.avatar ?? null} name={nameOf(b)} size={44} />
        </div>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-4">
        <div><dt className="section-label">Streak</dt><dd className="mt-1 text-sm">{streak}</dd></div>
        <div><dt className="section-label">Biggest win</dt><dd className="mt-1 text-sm">
          {series.biggestWin ? <Link to={linkFor(series.biggestWin.gameId)} className="hover:text-accent">{nameOf(series.biggestWin.winner)} by <span className="num">{fmtPts(series.biggestWin.margin)}</span></Link> : '—'}
        </dd></div>
        <div><dt className="section-label">Closest</dt><dd className="mt-1 text-sm">
          {series.closest ? <Link to={linkFor(series.closest.gameId)} className="hover:text-accent">{series.closest.margin === 0 ? 'Tie' : <>by <span className="num">{fmtPts(series.closest.margin)}</span></>}</Link> : '—'}
        </dd></div>
        <div><dt className="section-label">Avg margin</dt><dd className="num mt-1 text-sm">{fmtPts(series.avgMargin)}</dd></div>
      </dl>
    </div>
  );
}
```
Note: the "Closest" link's accessible name must contain the margin ("1.50"); the test queries `getByRole('link', { name: /1\.50/ })`. Keep "by" plus the number inside the link.

`packages/web/src/components/h2h/OpponentList.tsx`:
```tsx
import { Link } from 'react-router';
import { h2hKey, type History } from '@fantasy-dash/core';
import Avatar from '../Avatar';

interface Props { a: string; managers: History['managers']; h2h: History['h2h'] }

export default function OpponentList({ a, managers, h2h }: Props) {
  const rows = Object.entries(managers)
    .filter(([id]) => id !== a)
    .map(([id, m]) => {
      const s = h2h[h2hKey(a, id)];
      const w = s ? (s.a === a ? s.aWins : s.bWins) : 0;
      const l = s ? (s.a === a ? s.bWins : s.aWins) : 0;
      const t = s?.ties ?? 0;
      return { id, name: m.displayName, avatar: m.avatar, w, l, t, games: s?.games.length ?? 0 };
    })
    .sort((x, y) => y.games - x.games || x.name.localeCompare(y.name));
  return (
    <div className="card">
      <div className="section-label px-4 pt-3">Pick an opponent</div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/h2h?a=${a}&b=${r.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-2">
              <Avatar avatar={r.avatar} name={r.name} size={24} />
              <span className="flex-1 font-medium">{r.name}</span>
              <span className={`num ${r.w > r.l ? 'text-win' : r.l > r.w ? 'text-loss' : 'text-muted'}`}>{r.w}-{r.l}{r.t ? `-${r.t}` : ''}</span>
              <span className="num w-20 text-right text-xs text-muted">{r.games ? `${r.games} games` : 'never met'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`packages/web/src/pages/H2HPage.tsx`:
```tsx
import { useLoaderData, useSearchParams } from 'react-router';
import { h2hKey, type Season } from '@fantasy-dash/core';
import ScoreCard from '../components/ScoreCard';
import ManagerPicker from '../components/h2h/ManagerPicker';
import OpponentList from '../components/h2h/OpponentList';
import SeriesSummary from '../components/h2h/SeriesSummary';
import { history, players } from '../data/load';

export default function H2HPage() {
  const seasons = useLoaderData() as Season[];
  const [params, setParams] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const set = (key: 'a' | 'b', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'a' && value === next.get('b')) next.delete('b');
    setParams(next);
  };
  const byYear = new Map(seasons.map((s) => [s.year, s]));
  const series = a && b ? history.h2h[h2hKey(a, b)] : undefined;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Head to Head</h1>
        <div className="flex flex-wrap gap-3">
          <ManagerPicker label="Manager" value={a} onChange={(v) => set('a', v)} managers={history.managers} />
          <ManagerPicker label="Opponent" value={b} onChange={(v) => set('b', v)} managers={history.managers} exclude={a || undefined} />
        </div>
      </header>

      {!a && <p className="text-sm text-muted">Choose a manager to see their history against the league.</p>}
      {a && !b && <OpponentList a={a} managers={history.managers} h2h={history.h2h} />}
      {a && b && (
        <>
          <SeriesSummary series={series} a={a} b={b} managers={history.managers} />
          {series && series.games.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {series.games.map((g) => {
                const season = byYear.get(g.year);
                const game = season?.weeks[g.week - 1]?.games.find((x) => x.id === g.gameId);
                if (!season || !game) return null;
                return <ScoreCard key={g.gameId} game={game} played managers={season.managers} players={players} to={`/scores/${g.year}/${g.week}/${game.matchupId}`} />;
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
```
Each `ScoreCard` already shows the playoff round tag when the game has one, which satisfies "playoff games tagged with the round". Add a small year/week caption above each card: wrap the card in a `div` with a `section-label` line `{g.year} · Week {g.week}` so meetings are dated (the card header no longer shows the week).

`App.tsx`: import `H2HPage` and `loadAllSeasons`; add `{ path: 'h2h', loader: () => loadAllSeasons(), element: <H2HPage /> }`. `Nav.tsx`: add `{ to: '/h2h', label: 'Head to Head' }` after Standings (before All-Time).

- [ ] **Step 4: Run, expect pass; browser check**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck && pnpm build
```
Expected: 30 passed, typecheck clean, build succeeds. Screenshot `/h2h`, `/h2h?a=<some id>` and `/h2h?a=<id>&b=<id>` for the longest series (take ids from `data/history.json`) at 1440 and 400.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): head-to-head page with series summary and meeting cards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Links from existing pages

**Files:**
- Modify: `packages/web/src/components/boxscore/HeadToHead.tsx`, `packages/web/src/components/StandingsTable.tsx`

- [ ] **Step 1: Box score card links to the full series**

In `HeadToHead.tsx`, add a `Link` labeled "Full series →" in the card header (right-aligned, `text-xs text-accent`) to `/h2h?a=${left.userId}&b=${right.userId}`. Render it even when the managers have never met.

- [ ] **Step 2: Standings manager cell links to H2H**

In `StandingsTable.tsx`, wrap the manager cell contents (avatar plus names) in a `Link` to `/h2h?a=${r.userId}` with `hover:text-accent`. Update `StandingsTable.test.tsx` to wrap renders in `MemoryRouter` (the existing assertions stay).

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck
git add -A && git commit -m "feat(web): link standings and box score to head-to-head

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Spec and README updates, visual check

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-fantasy-dashboard-design.md`, `README.md`

- [ ] **Step 1: Spec data model**

In the spec's "Data model" section, replace the `history.json` block with the shipped shapes: `HistorySeason` (year, leagueId, status, lastScoredWeek, playoffWeekStart), `managers`, `h2h` as `H2HSeries` (fields from Task 1), and `allTime: AllTimeRow[]` (fields from Task 2). In the `Season` block, remove `top3` (derived in the web app), and note that `draft` and `records` arrive in Phases 4 and 3. Keep the rest of the spec untouched.

- [ ] **Step 2: README**

Under "Deploy", add: "GitHub disables scheduled workflows after 60 days without repository activity. In the off-season, run the workflow manually once in a while or push a commit to keep the Tuesday sync alive."

- [ ] **Step 3: Visual pass**

Start the dev server and capture with the controller's script:
```bash
S=/private/tmp/claude-501/-Users-mathiasfoster-repos/090316a8-80bd-4357-b073-d52a4c961e78/scratchpad
for p in "all-time:alltime" "h2h:h2h-empty"; do rm -rf /tmp/fd-chrome-profile; node $S/measure.mjs "http://127.0.0.1:5173/${p%%:*}" 1440 "$S/shots/p2-${p##*:}-1440.png"; done
```
plus `/h2h?a=<id>&b=<id>` for the longest series at 1440 and 400. `scrollWidth` must equal `vw` everywhere. Review each image; fix anything unbalanced.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: phase 2 data model and off-season cron note

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 2 exit criteria

- `pnpm test` green in both packages; `pnpm typecheck` and `pnpm typecheck:scripts` clean; schema `satisfies` guards compile.
- `data/history.json` carries series summaries and 11 all-time rows with honors sums matching the three complete seasons.
- `/all-time` and `/h2h` deployed; manager names on standings and all-time link into head-to-head; the box score's head-to-head card links to the full series.
