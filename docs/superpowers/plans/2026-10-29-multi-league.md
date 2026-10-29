# Multiple Leagues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve any number of Sleeper leagues from one site. Each league lives at its own hidden address `…/<slug>/`, and its points, projections and xFP use its own scoring, over NFL data that is synced once and shared.

**Architecture:** The shared player DB loses `pts`/`proj`/`xfp`, and those move into a small per-league points file. On load, core helpers split them off and join them back on. The web picks the league from the first URL segment at boot and mounts the existing router under `BASE_URL + slug`, so every existing absolute link works unchanged. `data/load.ts` exposes the league's history through live bindings that `initLeague` fills. Both sync scripts loop over the leagues in `league.config.ts`.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, zod, React 19, react-router v7 (data router), Vite, tsx scripts, GitHub Actions and Pages.

**Spec:** `docs/superpowers/specs/2026-10-29-multi-league-design.md`

## Global Constraints

- Slugs match `/^[a-z0-9]+(-[a-z0-9]+)*$/`, are unique, and never equal a top-level route name.
- **Hidden leagues:** no page, the root page, or `index.html` may render or contain another league's name or slug. `index.html` `<title>` is `Fantasy`.
- Root page copy, exactly: "This site hosts private league pages. Use the link your commissioner sent you."
- Points file path: `data/leagues/<slug>/points/{year}.json`. League history and seasons: `data/leagues/<slug>/history.json` and `data/leagues/<slug>/seasons/{year}.json`.
- Points tuple: `[week, pts, proj | null, xfp | null]`.
- `ppr` and `posRankPpr` stay in the shared player DB.
- `VITE_BASE`, the workflow crons and `404.html` handling stay as they are.
- **Repo conventions:**
  - Core tests go in `packages/core/test/**`, web tests are colocated as `*.test.ts(x)`.
  - Run tests with `pnpm --filter @fantasy-dash/core test` or `pnpm --filter @fantasy-dash/web test`, typecheck with `pnpm typecheck` and `pnpm typecheck:scripts`.
  - Commit messages are one plain descriptive sentence, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Worktree:** work in a git worktree on branch `multi-league`. From the worktree, never `cd` into the main checkout or use `git -C` on it. When finished, exit the worktree with "keep" and merge from main.

## Review Focus

1. **A configured league with no synced data yet** (just added, before its first sync): the visitor sees the "League not found" page, not a blank screen or a crash. Pinned in Task 4 (`initLeague` rejects) and Task 5 (`start` renders `LeagueNotFound` on rejection).
2. **An old shared link with a query and hash** (`/players/2025?pos=WR#top`): it lands on the same page in Husky with the query and hash intact. Pinned in Task 5.
3. **`pnpm sync` rewriting a league folder:** it must keep that league's `points/` directory, which `sync:players` owns. Losing it would blank every fantasy number until the next player sync. Pinned in Task 6 (`moveKeep` test).
4. **One league failing in `pnpm sync`:** its players must stay in `players.json`, or another page's names go missing. Pinned in Task 6 (ids read back from disk for failed leagues, with a unit test on `idsFromSeasonFiles`).
5. **Loader redirects under a basename**, e.g. `/husky/standings` → `/husky/standings/2026`: they must stay inside the league and not escape to `/standings/2026`. Pinned in Task 5 (memory router with basename).

---

### Task 1: Core league helpers

**Files:**
- Create: `packages/core/src/leagues.ts`
- Modify: `packages/core/src/index.ts` (add `export * from './leagues';`)
- Test: `packages/core/test/leagues.test.ts`

**Interfaces:**
- Produces:
  - `interface LeagueConfig { slug: string; leagueId: string; name: string; managerNames: Record<string, string> }`
  - `validateLeagues(leagues: readonly LeagueConfig[], defaultLeague: string, reserved: Iterable<string>): string[]` returns the problems found, and an empty array means valid.
  - `interface NflYear { year: number; season: string; complete: boolean; throughWeek: number }`
  - `nflYears(chains: SleeperLeague[][]): NflYear[]`, newest first.
  - `runPerLeague<T>(leagues: readonly LeagueConfig[], fn: (l: LeagueConfig) => Promise<T>, log: (m: string) => void): Promise<{ results: Map<string, T>; failed: string[] }>`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/test/leagues.test.ts
import { describe, it, expect } from 'vitest';
import { nflYears, runPerLeague, validateLeagues, type LeagueConfig } from '../src/leagues';
import type { SleeperLeague } from '../src/sleeper/types';

const L = (slug: string, leagueId = '1'): LeagueConfig => ({ slug, leagueId, name: slug.toUpperCase(), managerNames: {} });
const sl = (season: string, status: string, leg?: number) => ({ season, status, settings: { last_scored_leg: leg } }) as unknown as SleeperLeague;

describe('validateLeagues', () => {
  it('accepts a valid list', () => {
    expect(validateLeagues([L('husky'), L('dynasty-2')], 'husky', ['standings'])).toEqual([]);
  });
  it('flags bad and duplicate slugs, reserved route names and a missing default', () => {
    const errs = validateLeagues([L('Husky'), L('a'), L('a'), L('standings')], 'nope', ['standings']);
    expect(errs).toEqual(expect.arrayContaining([
      expect.stringContaining('"Husky"'), expect.stringContaining('duplicate slug "a"'),
      expect.stringContaining('"standings" is a route name'), expect.stringContaining('defaultLeague "nope"'),
    ]));
  });
  it('rejects an empty list', () => {
    expect(validateLeagues([], 'husky', [])).toEqual(expect.arrayContaining([expect.stringContaining('no leagues')]));
  });
});

describe('nflYears', () => {
  it('unions years across leagues, complete if any league is, max scored week otherwise, newest first', () => {
    const years = nflYears([
      [sl('2026', 'in_season', 7), sl('2025', 'complete')],
      [sl('2026', 'in_season', 8), sl('2025', 'post_season', 17), sl('2024', 'complete')],
    ]);
    expect(years).toEqual([
      { year: 2026, season: '2026', complete: false, throughWeek: 8 },
      { year: 2025, season: '2025', complete: true, throughWeek: 18 },
      { year: 2024, season: '2024', complete: true, throughWeek: 18 },
    ]);
  });
  it('caps an unfinished season at week 18 and treats a missing leg as 0', () => {
    expect(nflYears([[sl('2026', 'in_season', 22)], [sl('2027', 'pre_draft')]]).map((y) => y.throughWeek)).toEqual([0, 18]);
  });
});

describe('runPerLeague', () => {
  it('runs every league, keeps going past a failure, and reports the failures', async () => {
    const logs: string[] = [];
    const { results, failed } = await runPerLeague([L('a'), L('b'), L('c')], async (l) => {
      if (l.slug === 'b') throw new Error('boom');
      return l.slug.length;
    }, (m) => logs.push(m));
    expect([...results.keys()]).toEqual(['a', 'c']);
    expect(failed).toEqual(['b']);
    expect(logs.some((m) => m.includes('✗ b') && m.includes('boom'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @fantasy-dash/core test -- leagues`
Expected: FAIL, "Cannot find module '../src/leagues'".

- [ ] **Step 3: Implement**

```ts
// packages/core/src/leagues.ts
import type { SleeperLeague } from './sleeper/types';

/** One league the site serves; see league.config.ts. */
export interface LeagueConfig {
  /** URL segment: lowercase letters, digits and hyphens; unique */
  slug: string;
  /** the current season's Sleeper league id; earlier seasons come from the previous_league_id chain */
  leagueId: string;
  name: string;
  /** Optional display-name overrides keyed by Sleeper user_id. */
  managerNames: Record<string, string>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Problems with the league list; empty when it is valid. `reserved` are the app's top-level route names. */
export function validateLeagues(leagues: readonly LeagueConfig[], defaultLeague: string, reserved: Iterable<string>): string[] {
  const errs: string[] = [];
  if (leagues.length === 0) errs.push('no leagues configured');
  const routes = new Set(reserved);
  const seen = new Set<string>();
  for (const l of leagues) {
    if (!SLUG.test(l.slug)) errs.push(`slug "${l.slug}" must be lowercase letters, digits and hyphens`);
    if (seen.has(l.slug)) errs.push(`duplicate slug "${l.slug}"`);
    if (routes.has(l.slug)) errs.push(`slug "${l.slug}" is a route name`);
    seen.add(l.slug);
  }
  if (!seen.has(defaultLeague)) errs.push(`defaultLeague "${defaultLeague}" is not a configured slug`);
  return errs;
}

/** One NFL season the shared data covers. */
export interface NflYear { year: number; season: string; complete: boolean; throughWeek: number }

/** Every season any league played, newest first: complete when any league that year is, else scored through the furthest league's week. */
export function nflYears(chains: SleeperLeague[][]): NflYear[] {
  const by = new Map<number, NflYear>();
  for (const l of chains.flat()) {
    const year = Number(l.season);
    const complete = l.status === 'complete';
    const through = complete ? 18 : Math.min(18, l.settings.last_scored_leg ?? 0);
    const prev = by.get(year);
    by.set(year, prev
      ? { ...prev, complete: prev.complete || complete, throughWeek: prev.complete || complete ? 18 : Math.max(prev.throughWeek, through) }
      : { year, season: l.season, complete, throughWeek: through });
  }
  return [...by.values()].sort((a, b) => b.year - a.year);
}

/** Run fn for each league in turn; a league that throws is logged and skipped. */
export async function runPerLeague<T>(leagues: readonly LeagueConfig[], fn: (l: LeagueConfig) => Promise<T>, log: (m: string) => void): Promise<{ results: Map<string, T>; failed: string[] }> {
  const results = new Map<string, T>();
  const failed: string[] = [];
  for (const l of leagues) {
    try { results.set(l.slug, await fn(l)); } catch (err) { failed.push(l.slug); log(`✗ ${l.slug}: ${err instanceof Error ? err.message : String(err)}`); }
  }
  return { results, failed };
}
```

Add `export * from './leagues';` to `packages/core/src/index.ts`, after `export * from './history';`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @fantasy-dash/core test -- leagues`, then `pnpm --filter @fantasy-dash/core typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/leagues.ts packages/core/src/index.ts packages/core/test/leagues.test.ts
git commit -m "Core: league config validation, NFL years across every league's history, and a per-league runner that survives one league failing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Core points files

**Files:**
- Create: `packages/core/src/playerdb/points.ts`
- Modify: `packages/core/src/playerdb/schema.ts` (add `SharedPlayerDbSchema`, `LeaguePointsSchema`)
- Modify: `packages/core/src/playerdb/types.ts` (add `SharedPlayerDb`, `LeaguePoints`, `PointsRow`)
- Modify: `packages/core/src/playerdb/index.ts` (add `export * from './points';`)
- Test: `packages/core/test/playerdb/points.test.ts`

**Interfaces:**
- Consumes: `scoreStats` (`packages/core/src/scoring.ts`), `fitXfpCoefficients`, `predictXfp` (`playerdb/xfp.ts`), `PlayerDb`, `PlayerWeek`, `XfpCoefficients`, `SleeperWeekStat`, `StatMap`.
- Produces:
  - `type SharedPlayerDb = Omit<PlayerDb, 'xfp'>`
  - `type PointsRow = [week: number, pts: number, proj: number | null, xfp: number | null]`
  - `interface LeaguePoints { year: number; leagueId: string; builtAt: string; dbBuiltAt: string; xfp: XfpCoefficients; players: Record<PlayerId, PointsRow[]> }`
  - `SharedPlayerDbSchema`, `LeaguePointsSchema`
  - `NO_XFP: XfpCoefficients` (all null)
  - `splitLeaguePoints(db: PlayerDb, leagueId: string, builtAt: string): { shared: SharedPlayerDb; points: LeaguePoints }`
  - `applyLeaguePoints(shared: SharedPlayerDb, points: LeaguePoints | null): PlayerDb`
  - `buildLeaguePoints(input: { shared: SharedPlayerDb; leagueId: string; builtAt: string; scoring: Record<string, number>; sleeperWeeks: Map<number, SleeperWeekStat[]>; projections: Map<number, StatMap> }): LeaguePoints`
  - `pointsUpToDate(existing: unknown, want: { leagueId: string; dbBuiltAt: string }): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/test/playerdb/points.test.ts
import { describe, it, expect } from 'vitest';
import { applyLeaguePoints, buildLeaguePoints, NO_XFP, pointsUpToDate, splitLeaguePoints } from '../../src/playerdb/points';
import { LeaguePointsSchema, SharedPlayerDbSchema } from '../../src/playerdb/schema';
import type { PlayerDb, PlayerWeek, SharedPlayerDb } from '../../src/playerdb/types';
import type { SleeperWeekStat } from '../../src/sleeper/types';

const player = (id: string) => ({ id, gsisId: null, pfrId: null, name: id, pos: 'WR' as const, teams: ['TB'], birthDate: null, yearsExp: null, draft: null, college: null, height: null, weight: null });
const row = (id: string, week: number, extra: Partial<PlayerWeek> = {}): PlayerWeek => ({ id, week, team: 'TB', gp: 1, re_tgt: 5 + week, ...extra });

const db: PlayerDb = {
  year: 2025, throughWeek: 2, routesReal: true, builtAt: 'B1',
  players: { a: player('a'), b: player('b') }, teamWeeks: [],
  xfp: { QB: null, RB: null, WR: [1, 2, 0, 0, 0, 0], TE: null },
  rows: [row('a', 1, { pts: 10.5, proj: 9, xfp: 13 }), row('a', 2, { pts: 3, xfp: 15 }), row('b', 1, { pts: 7.25, proj: 8 }), row('b', 2)],
};

describe('splitLeaguePoints / applyLeaguePoints', () => {
  it('round-trips a playerdb exactly', () => {
    const { shared, points } = splitLeaguePoints(db, 'L1', 'P1');
    expect(shared.rows.every((r) => !('pts' in r) && !('proj' in r) && !('xfp' in r))).toBe(true);
    expect(shared).not.toHaveProperty('xfp');
    expect(points).toEqual({
      year: 2025, leagueId: 'L1', builtAt: 'P1', dbBuiltAt: 'B1', xfp: db.xfp,
      players: { a: [[1, 10.5, 9, 13], [2, 3, null, 15]], b: [[1, 7.25, 8, null]] },
    });
    expect(LeaguePointsSchema.parse(points)).toEqual(points);
    expect(applyLeaguePoints(SharedPlayerDbSchema.parse(shared) as SharedPlayerDb, points)).toEqual(db);
  });
  it('leaves rows without an entry unscored, and has no xFP model without a points file', () => {
    const { shared } = splitLeaguePoints(db, 'L1', 'P1');
    const joined = applyLeaguePoints(shared, null);
    expect(joined.xfp).toEqual(NO_XFP);
    expect(joined.rows.every((r) => r.pts === undefined)).toBe(true);
  });
});

describe('buildLeaguePoints', () => {
  const wk = (week: number): SleeperWeekStat[] => ['a', 'b'].map((id, i) => ({ player_id: id, team: 'TB', stats: { gp: 1, rec: 3 + i + week, rec_yd: 40 + 10 * i + week, rec_td: i } }));
  const shared: SharedPlayerDb = {
    year: 2025, throughWeek: 2, routesReal: true, builtAt: 'B1', players: { a: player('a'), b: player('b') }, teamWeeks: [],
    rows: [row('a', 1), row('a', 2), row('b', 1), row('b', 2), row('c', 1)],
  };
  const input = (scoring: Record<string, number>) => ({
    shared, leagueId: 'L1', builtAt: 'P1', scoring,
    sleeperWeeks: new Map([[1, wk(1)], [2, wk(2)]]),
    projections: new Map([[1, { a: { rec: 4, rec_yd: 50 } }]]),
  });
  it('scores each row with the league scoring and its projection', () => {
    const p = buildLeaguePoints(input({ rec: 1, rec_yd: 0.1, rec_td: 6 }));
    expect(p.players.a[0]).toEqual([1, 8.1, 9, null]);
    expect(p.players.b[1][1]).toBeCloseTo(17.2, 2); // week 2: 6 rec + 52 yds · 0.1 + 1 TD · 6
    expect(p.players.c).toBeUndefined();
    expect(p.dbBuiltAt).toBe('B1');
  });
  it('gives different points under different scoring', () => {
    const ppr = buildLeaguePoints(input({ rec: 1, rec_yd: 0.1 }));
    const std = buildLeaguePoints(input({ rec_yd: 0.1 }));
    expect(ppr.players.a[0][1]).not.toBe(std.players.a[0][1]);
  });
});

describe('pointsUpToDate', () => {
  const good = splitLeaguePoints(db, 'L1', 'P1').points;
  it('is true only for a parsing file built for this league against this playerdb', () => {
    expect(pointsUpToDate(good, { leagueId: 'L1', dbBuiltAt: 'B1' })).toBe(true);
    expect(pointsUpToDate(good, { leagueId: 'L2', dbBuiltAt: 'B1' })).toBe(false);
    expect(pointsUpToDate(good, { leagueId: 'L1', dbBuiltAt: 'B2' })).toBe(false);
    expect(pointsUpToDate({ nope: 1 }, { leagueId: 'L1', dbBuiltAt: 'B1' })).toBe(false);
    expect(pointsUpToDate(undefined, { leagueId: 'L1', dbBuiltAt: 'B1' })).toBe(false);
  });
});
```

`buildLeaguePoints` only produces xFP when there are at least `XFP_MIN_ROWS` rows, so this small fixture gets `null` xFP. That's deliberate: xFP fitting is already covered by `xfp.test.ts`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @fantasy-dash/core test -- points`
Expected: FAIL, "Cannot find module '../../src/playerdb/points'".

- [ ] **Step 3: Add the types**

Append to `packages/core/src/playerdb/types.ts`:

```ts
/** The player database as stored and shared by every league: no league points, projections or xFP. */
export type SharedPlayerDb = Omit<PlayerDb, 'xfp'>;

/** [week, league points, league projection, xFP] for one player-week. */
export type PointsRow = [week: number, pts: number, proj: number | null, xfp: number | null];

/** One league's fantasy numbers for one season, joined onto the shared player database at load time. */
export interface LeaguePoints {
  year: number;
  leagueId: string;
  builtAt: string;
  /** builtAt of the shared playerdb file these points were built against */
  dbBuiltAt: string;
  /** this league's xFP model, fitted on its own points */
  xfp: XfpCoefficients;
  players: Record<PlayerId, PointsRow[]>;
}
```

- [ ] **Step 4: Add the schemas**

Append to `packages/core/src/playerdb/schema.ts`:

```ts
/** The stored, league-neutral player database; old files that still carry xfp coefficients parse too (zod drops the key). */
export const SharedPlayerDbSchema = PlayerDbSchema.omit({ xfp: true });

export const LeaguePointsSchema = z.object({
  year: z.number(), leagueId: z.string(), builtAt: z.string(), dbBuiltAt: z.string(),
  xfp: z.object({ QB: Coef, RB: Coef, WR: Coef, TE: Coef }),
  players: z.record(z.array(z.tuple([z.number(), z.number(), z.number().nullable(), z.number().nullable()]))),
});
```

- [ ] **Step 5: Implement `points.ts`**

```ts
// packages/core/src/playerdb/points.ts
import { scoreStats } from '../scoring';
import type { SleeperWeekStat, StatMap } from '../sleeper/types';
import { LeaguePointsSchema } from './schema';
import { fitXfpCoefficients, predictXfp } from './xfp';
import type { DbPos, LeaguePoints, PlayerDb, PlayerWeek, PointsRow, SharedPlayerDb, XfpCoefficients } from './types';

export const NO_XFP: XfpCoefficients = { QB: null, RB: null, WR: null, TE: null };

/** Take a league's pts / proj / xfp off a playerdb: the shared file plus the league's points file. applyLeaguePoints undoes it exactly. */
export function splitLeaguePoints(db: PlayerDb, leagueId: string, builtAt: string): { shared: SharedPlayerDb; points: LeaguePoints } {
  const players: Record<string, PointsRow[]> = {};
  const rows = db.rows.map((r) => {
    const { pts, proj, xfp, ...rest } = r;
    if (pts !== undefined) (players[r.id] ??= []).push([r.week, pts, proj ?? null, xfp ?? null]);
    return rest as PlayerWeek;
  });
  const { xfp, ...meta } = db;
  return { shared: { ...meta, rows }, points: { year: db.year, leagueId, builtAt, dbBuiltAt: db.builtAt, xfp, players } };
}

/** The shared playerdb with one league's numbers joined on; rows the league has no entry for stay unscored. */
export function applyLeaguePoints(shared: SharedPlayerDb, points: LeaguePoints | null): PlayerDb {
  const at = new Map<string, PointsRow>();
  if (points) for (const [id, list] of Object.entries(points.players)) for (const t of list) at.set(`${id}|${t[0]}`, t);
  const rows = shared.rows.map((r) => {
    const t = at.get(`${r.id}|${r.week}`);
    if (!t) return r;
    const out: PlayerWeek = { ...r, pts: t[1] };
    if (t[2] !== null) out.proj = t[2];
    if (t[3] !== null) out.xfp = t[3];
    return out;
  });
  return { ...shared, xfp: points?.xfp ?? NO_XFP, rows };
}

/** Score every shared row with one league's scoring, fit that league's xFP on it, and keep only the league's numbers. */
export function buildLeaguePoints(input: {
  shared: SharedPlayerDb; leagueId: string; builtAt: string; scoring: Record<string, number>;
  sleeperWeeks: Map<number, SleeperWeekStat[]>; projections: Map<number, StatMap>;
}): LeaguePoints {
  const { shared, scoring } = input;
  const stats = new Map<string, Record<string, number>>();
  for (const [week, raws] of input.sleeperWeeks) for (const raw of raws) if (raw.stats) stats.set(`${raw.player_id}|${week}`, raw.stats);
  const rows = shared.rows.map((r) => {
    const st = stats.get(`${r.id}|${r.week}`);
    if (!st) return r;
    const out: PlayerWeek = { ...r, pts: scoreStats(st, scoring) };
    const proj = input.projections.get(r.week)?.[r.id];
    if (proj) out.proj = scoreStats(proj, scoring);
    return out;
  });
  const posOf = (id: string): DbPos | null => shared.players[id]?.pos ?? null;
  const xfp = fitXfpCoefficients(rows, posOf);
  for (const r of rows) {
    const pos = posOf(r.id);
    if (!pos || r.pts === undefined) continue;
    const v = predictXfp(xfp[pos], pos, r);
    if (v !== null) r.xfp = v;
  }
  return splitLeaguePoints({ ...shared, xfp, rows }, input.leagueId, input.builtAt).points;
}

/** Whether an existing points file was built for this league against this exact shared playerdb file. */
export function pointsUpToDate(existing: unknown, want: { leagueId: string; dbBuiltAt: string }): boolean {
  const parsed = LeaguePointsSchema.safeParse(existing);
  return parsed.success && parsed.data.leagueId === want.leagueId && parsed.data.dbBuiltAt === want.dbBuiltAt;
}
```

`rows` from `shared.rows.map` are fresh objects only where scored. The xFP loop only mutates rows with `pts`, which are always the fresh copies, so `shared` is never mutated.

Add `export * from './points';` to `packages/core/src/playerdb/index.ts` after `export * from './build';`.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @fantasy-dash/core test -- points`, then `pnpm --filter @fantasy-dash/core typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb/points.test.ts
git commit -m "Core: league points files hold each league's points, projections and xFP apart from the shared player database, with an exact split and join

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The shared player DB stops scoring

**Files:**
- Modify: `packages/core/src/playerdb/sources/sleeper.ts` (`sleeperRow` loses `scoring` and `projection`)
- Modify: `packages/core/src/playerdb/build.ts` (input loses `scoring` and `projections`; returns `SharedPlayerDb`; no xFP fit)
- Modify: `packages/core/test/playerdb/sleeper.test.ts`, `packages/core/test/playerdb/build.test.ts`
- Modify: `scripts/syncPlayers.ts:157-162` (call site only, so the scripts still typecheck)

**Interfaces:**
- Produces:
  - `sleeperRow(raw: SleeperWeekStat, week: number): PlayerWeek | null`
  - `buildPlayerDb(input: PlayerDbInput): SharedPlayerDb`, where `PlayerDbInput` no longer has `scoring` or `projections`.

- [ ] **Step 1: Update the tests first**

In `packages/core/test/playerdb/sleeper.test.ts`:
- Change every `sleeperRow(x, w, scoring, proj)` call to `sleeperRow(x, w)`.
- Rename the first test to `'maps the counting stats and buckets 20+ catches, and leaves league points to the points file'`.
- Replace its `pts`/`proj` expectations with:

```ts
    expect(row).not.toHaveProperty('pts');
    expect(row).not.toHaveProperty('proj');
    expect(row.ppr).toBe(17.2);
```

- Delete the now-unused `scoring` const.

In `packages/core/test/playerdb/build.test.ts`:
- Remove `scoring` and `projections` from `input()`.
- Delete any assertion on `pts`, `proj`, `xfp` or `db.xfp`.
- Add:

```ts
  it('stores no league points, projections or xFP: those live in each league\'s points file', () => {
    const db = buildPlayerDb(input());
    expect(db.rows.some((r) => 'pts' in r || 'proj' in r || 'xfp' in r)).toBe(false);
    expect(db).not.toHaveProperty('xfp');
    expect(SharedPlayerDbSchema.parse(db)).toBeTruthy();
  });
```

Import `SharedPlayerDbSchema` from `'../../src/playerdb/schema'`. Where an existing test parses with `PlayerDbSchema`, switch it to `SharedPlayerDbSchema`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @fantasy-dash/core test -- playerdb`
Expected: FAIL on the new assertions (pts still present, `xfp` still on the db).

- [ ] **Step 3: Implement**

`sources/sleeper.ts`:
- Remove the `scoreStats` import.
- Change the signature to `export function sleeperRow(raw: SleeperWeekStat, week: number): PlayerWeek | null`.
- Delete the two lines `row.pts = …` and `if (projection) row.proj = …`.

`build.ts`:
- Delete `scoring` and `projections` from `PlayerDbInput`, along with their doc comments.
- Delete `const proj = input.projections.get(week) ?? {};` and call `sleeperRow(raw, week)`.
- Delete the xFP block (`const xfp = fitXfpCoefficients(...)` and the predict loop), and remove the `fitXfpCoefficients, predictXfp` import and the `posOf` map if nothing else uses it.
- Change the return type to `SharedPlayerDb` and the return to `{ year: input.year, throughWeek: input.throughWeek, routesReal: participation !== null, builtAt: input.builtAt, players, teamWeeks, rows }`.
- Update the imports: `SharedPlayerDb` in, `PlayerDb` out if unused, and `StatMap` out of the sleeper import if unused.

`scripts/syncPlayers.ts`, in `buildSeason`'s `buildPlayerDb({...})` call:
- Delete `scoring: league.scoring_settings,` and `projections,`.
- Change `PlayerDbSchema.parse(db)` to `SharedPlayerDbSchema.parse(db)`, importing `SharedPlayerDbSchema` and dropping `PlayerDbSchema` from the import if unused.
- Replace the log line's xFP part: `log(\`  ${db.rows.length} rows, ${Object.keys(db.players).length} players (${unmapped} without a gsis id)\`);`
- `finishedFileProblem` and `positionsFor` parse with `PlayerDbSchema`; switch both to `SharedPlayerDbSchema`.
- Leave the projections fetch in place for now. Task 7 moves it.

Under `noUnusedLocals`, the projections fetch in `buildSeason` may now leave `projections` unused. If typecheck complains, prefix it as `void projections;` with a `// used by the points phase (Task 7)` comment. Task 7 removes both.

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/core typecheck && pnpm typecheck:scripts`
Expected: PASS. The web package still typechecks too, because the files it reads still carry `pts` (`pnpm --filter @fantasy-dash/web typecheck`).

- [ ] **Step 5: Commit**

```bash
git add packages/core scripts/syncPlayers.ts
git commit -m "Core: the shared player database no longer scores rows or fits xFP; that moves to each league's points file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Config list, Husky's data migrated, per-league loading

This task changes the data layout and the web loader together, so the site works at every commit.

**Files:**
- Modify: `league.config.ts`
- Move: `data/history.json` → `data/leagues/husky/history.json`; `data/seasons/` → `data/leagues/husky/seasons/`
- Create, run, then delete in this task: `scripts/migrate-points.ts`
- Create (generated): `data/leagues/husky/points/{2023,2024,2025,2026}.json`. Modify (stripped): `data/playerdb/*.json`
- Modify: `packages/web/src/data/load.ts`
- Modify: `packages/web/src/test/setup.ts`
- Modify: `packages/web/src/components/Nav.tsx:3,50`
- Create: `packages/web/src/data/load.test.ts`

**Interfaces:**
- Consumes: `LeagueConfig` (Task 1), `applyLeaguePoints`, `splitLeaguePoints`, `LeaguePoints`, `SharedPlayerDb`, `PlayerDbSchema`, `LeaguePointsSchema` (Task 2).
- Produces:
  - `league.config.ts` exports `leagues: LeagueConfig[]`, `positionOverrides: Record<string, string>`, `defaultLeague: string`, plus a temporary `leagueConfig` (removed in Task 7).
  - `data/load.ts` exports `initLeague(l: LeagueConfig): Promise<void>` and the live bindings `league`, `history` and `currentSeason`, with `loadSeason`, `loadAllSeasons`, `loadPlayerDb`, `hasPlayerDb`, `loadCharts`, `hasCharts`, `loadSchedule`, `hasSchedule` and `players` keeping their signatures.

- [ ] **Step 1: Rewrite `league.config.ts`**

```ts
import type { LeagueConfig } from '@fantasy-dash/core';

/** Every league the site serves, each at …/<slug>/. Leagues never link to each other. */
export const leagues: LeagueConfig[] = [
  { slug: 'husky', leagueId: '1388299227519537152', name: 'Husky Fantasy', managerNames: {} },
];

/** Position overrides keyed by Sleeper player_id, for players Sleeper files under the wrong fantasy position: an NFL fact, shared by every league. */
export const positionOverrides: Record<string, string> = {
  '12530': 'WR', // Travis Hunter (Sleeper lists him as DB)
};

/** Where old single-league URLs (before leagues had their own address) redirect to. */
export const defaultLeague = 'husky';

/** @deprecated single-league shape kept until both sync scripts loop over `leagues` (removed with that change). */
export const leagueConfig = { ...leagues[0], positionOverrides };
```

- [ ] **Step 2: Move Husky's league files**

```bash
mkdir -p data/leagues/husky
git mv data/history.json data/leagues/husky/history.json
git mv data/seasons data/leagues/husky/seasons
```

- [ ] **Step 3: Write the migration script**

```ts
// scripts/migrate-points.ts — one-time: move Husky's pts / proj / xfp out of the shared playerdb files. Deleted after it runs.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { HistorySchema, LeaguePointsSchema, PlayerDbSchema, SharedPlayerDbSchema, applyLeaguePoints, splitLeaguePoints } from '@fantasy-dash/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = path.join(ROOT, 'data', 'playerdb');
const LEAGUE = path.join(ROOT, 'data', 'leagues', 'husky');
const history = HistorySchema.parse(JSON.parse(readFileSync(path.join(LEAGUE, 'history.json'), 'utf8')));
mkdirSync(path.join(LEAGUE, 'points'), { recursive: true });

for (const file of readdirSync(DB).filter((f) => f.endsWith('.json')).sort()) {
  const year = Number(file.slice(0, 4));
  const leagueId = history.seasons.find((s) => s.year === year)?.leagueId;
  if (!leagueId) throw new Error(`${file}: Husky has no season ${year}`);
  const db = PlayerDbSchema.parse(JSON.parse(readFileSync(path.join(DB, file), 'utf8')));
  const { shared, points } = splitLeaguePoints(db, leagueId, new Date().toISOString());
  const sharedBack = SharedPlayerDbSchema.parse(JSON.parse(JSON.stringify(shared)));
  const pointsBack = LeaguePointsSchema.parse(JSON.parse(JSON.stringify(points)));
  if (!isDeepStrictEqual(applyLeaguePoints(sharedBack, pointsBack), db)) throw new Error(`${file}: split + join does not give back the original; nothing written`);
  writeFileSync(path.join(LEAGUE, 'points', file), JSON.stringify(points));
  writeFileSync(path.join(DB, file), JSON.stringify(shared));
  console.log(`${file}: ${Object.keys(points.players).length} players' points moved to leagues/husky/points; round trip identical`);
}
```

The check runs on the parsed-back JSON, so a field zod would strip or reorder can't slip through. `isDeepStrictEqual` ignores key order. Before writing anything, it checks every file in turn and throws on the first mismatch. Files earlier in the loop are already written by then, so if it throws, restore them with `git checkout data/playerdb` and investigate before rerunning.

- [ ] **Step 4: Run it, confirm, and delete it**

```bash
pnpm tsx scripts/migrate-points.ts
ls -la data/leagues/husky/points && du -sh data/playerdb data/leagues/husky/points
rm scripts/migrate-points.ts   # never committed: it only ever runs once
```

Expected: four lines ending "round trip identical". The playerdb shrinks, and the points files total a few hundred KB to about 1 MB. Check: `node -e "const d=require('./data/playerdb/2025.json');console.log('xfp' in d, d.rows.some(r=>'pts' in r))"` prints `false false`.

- [ ] **Step 5: Write the failing loader test**

```ts
// packages/web/src/data/load.test.ts
import { initLeague, history, currentSeason, league, loadPlayerDb, hasPlayerDb, loadSeason } from './load';
import { leagues } from '../../../../league.config';

describe('per-league loading', () => {
  it('exposes the league, its history and its current season after initLeague', () => {
    expect(league.slug).toBe('husky');
    expect(history.seasons.length).toBeGreaterThan(0);
    expect(currentSeason).toBe(history.seasons.at(-1));
  });
  it('joins the league\'s points onto the shared player database', async () => {
    const year = history.seasons.map((s) => s.year).filter(hasPlayerDb).at(-1)!;
    const db = await loadPlayerDb(year);
    expect(db.rows.some((r) => typeof r.pts === 'number')).toBe(true);
    expect(db.xfp).toBeTruthy();
  });
  it('loads the league\'s own season files', async () => {
    const s = await loadSeason(currentSeason.year);
    expect(s.leagueId).toBe(currentSeason.leagueId);
  });
  it('rejects a configured league that has not been synced yet, leaving the current league in place', async () => {
    await expect(initLeague({ slug: 'not-synced', leagueId: '0', name: 'X', managerNames: {} })).rejects.toThrow(/not-synced/);
    expect(league.slug).toBe('husky');
  });
  it('the real config has a league with data', () => {
    expect(leagues.some((l) => l.slug === 'husky')).toBe(true);
  });
});
```

Run: `pnpm --filter @fantasy-dash/web test -- data/load`
Expected: FAIL. `initLeague` doesn't exist, and the old globs point at moved files.

- [ ] **Step 6: Rewrite the top of `data/load.ts`**

Replace lines 1–39 (the imports, globs, `history`, `currentSeason`, `loadSeason`, `loadAllSeasons`) and `loadPlayerDb` with:

```ts
import { applyLeaguePoints, type ChartDb, type History, type HistorySeason, type LeagueConfig, type LeaguePoints, type PlayerDb, type PlayerDirectory, type Schedule, type Season, type SharedPlayerDb } from '@fantasy-dash/core';

// import.meta.glob keeps tsc from type-inferring multi-megabyte JSON literals. League files are lazy: a visitor downloads only their league.
const playersMod = import.meta.glob<{ default: PlayerDirectory }>('../../../../data/players.json', { eager: true });
const historyMods = import.meta.glob<{ default: History }>('../../../../data/leagues/*/history.json');
const seasonMods = import.meta.glob<{ default: Season }>('../../../../data/leagues/*/seasons/*.json');
const pointsMods = import.meta.glob<{ default: LeaguePoints }>('../../../../data/leagues/*/points/*.json');
const playerDbMods = import.meta.glob<{ default: SharedPlayerDb }>('../../../../data/playerdb/*.json');
const chartMods = import.meta.glob<{ default: ChartDb }>('../../../../data/charts/*.json');
const scheduleMods = import.meta.glob<{ default: Schedule }>('../../../../data/schedule/*.json');

export const players: PlayerDirectory = Object.values(playersMod)[0].default;

/** The league this page load serves, set once by initLeague before the app renders. Live bindings: read them at render or load time, never at module scope. */
export let league: LeagueConfig;
export let history: History;
export let currentSeason: HistorySeason;

const leagueKey = (mods: Record<string, unknown>, file: string) => Object.keys(mods).find((k) => k.endsWith(`/leagues/${league.slug}/${file}`));

const cache = new Map<number, Promise<Season>>();
let allSeasons: Promise<Season[]> | null = null;
const playerDbCache = new Map<number, Promise<PlayerDb>>();

/** Load a league's history and make it the current league; rejects (changing nothing) when the league has no synced data. */
export async function initLeague(l: LeagueConfig): Promise<void> {
  const key = Object.keys(historyMods).find((k) => k.endsWith(`/leagues/${l.slug}/history.json`));
  if (!key) throw new Error(`No data for league ${l.slug}`);
  const h = (await historyMods[key]()).default;
  league = l;
  history = h;
  currentSeason = h.seasons[h.seasons.length - 1];
  cache.clear();
  allSeasons = null;
  playerDbCache.clear();
}

export function loadSeason(year: number): Promise<Season> {
  let pending = cache.get(year);
  if (!pending) {
    const key = leagueKey(seasonMods, `seasons/${year}.json`);
    if (!key) return Promise.reject(new Response(`No data for season ${year}`, { status: 404 }));
    pending = seasonMods[key]().then((m) => m.default).catch((err) => { cache.delete(year); throw err; });
    cache.set(year, pending);
  }
  return pending;
}

/** Every season, oldest first. Used by pages that span seasons (head-to-head). */
export function loadAllSeasons(): Promise<Season[]> {
  if (!allSeasons) {
    allSeasons = Promise.all(history.seasons.map((s) => loadSeason(s.year))).catch((err) => { allSeasons = null; throw err; });
  }
  return allSeasons;
}

const playerDbKey = (year: number) => Object.keys(playerDbMods).find((k) => k.endsWith(`/${year}.json`));

/** Whether a player database file exists for the season (a new year has none until its first sync). */
export const hasPlayerDb = (year: number): boolean => playerDbKey(year) !== undefined;

/** The shared player database with this league's points, projections and xFP joined on (unscored when the league has no points file for the year). */
export function loadPlayerDb(year: number): Promise<PlayerDb> {
  let pending = playerDbCache.get(year);
  if (!pending) {
    const key = playerDbKey(year);
    if (!key) return Promise.reject(new Response(`No player data for ${year}`, { status: 404 }));
    const pk = leagueKey(pointsMods, `points/${year}.json`);
    pending = Promise.all([playerDbMods[key](), pk ? pointsMods[pk]() : Promise.resolve(null)])
      .then(([db, pts]) => applyLeaguePoints(db.default, pts?.default ?? null))
      .catch((err) => { playerDbCache.delete(year); throw err; });
    playerDbCache.set(year, pending);
  }
  return pending;
}
```

Keep the existing `chartCache`/`loadCharts`/`hasCharts` and `scheduleCache`/`loadSchedule`/`hasSchedule` blocks unchanged below.

- [ ] **Step 7: Initialise Husky in the test setup and update Nav**

Append to `packages/web/src/test/setup.ts`:

```ts
// One page load serves one league: tests run as Husky, the league whose data is in the repo.
import { initLeague } from '../data/load';
import { leagues } from '../../../../league.config';
await initLeague(leagues.find((l) => l.slug === 'husky')!);
```

If ESM import hoisting puts these imports above the polyfills and something breaks, move the three lines into a second setup file, `src/test/league.ts`, and list it after `./src/test/setup.ts` in `setupFiles` in `packages/web/vite.config.ts`.

`components/Nav.tsx`:
- Delete `import { leagueConfig } from '../../../../league.config';`.
- Add `league` to the existing `../data/load` import, or add `import { league } from '../data/load';`.
- Change `{leagueConfig.name}` to `{league.name}`.

- [ ] **Step 8: Run all web tests, typecheck and build**

Run: `pnpm --filter @fantasy-dash/web test && pnpm typecheck && pnpm typecheck:scripts && pnpm build`
Expected: everything passes, including every pre-existing page test on the migrated data. A pre-existing test that fails here means the join changed behaviour, so stop and investigate. Don't edit the test to match.

If a test mocks `../data/load` with a factory that spreads `orig` and then reads `history` before setup ran, use `vi.mock(..., async (orig) => ({ ...(await orig()) }))` as the existing ones do. The spread happens at mock time, after setup.

- [ ] **Step 9: Commit**

```bash
git add league.config.ts data packages/web/src/data packages/web/src/test/setup.ts packages/web/src/components/Nav.tsx packages/web/vite.config.ts
git commit -m "Leagues: config lists leagues; Husky's history and seasons move under data/leagues/husky with its points, projections and xFP split off the shared player database (round trip checked); the site loads the current league's files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Each league at its own address

**Files:**
- Create: `packages/web/src/lib/league.ts`, `packages/web/src/lib/league.test.ts`
- Create: `packages/web/src/pages/RootPage.tsx`, `packages/web/src/pages/LeagueNotFound.tsx`, `packages/web/src/pages/RootPage.test.tsx`
- Create: `packages/web/src/boot.tsx`, `packages/web/src/boot.test.tsx`
- Modify: `packages/web/src/main.tsx`
- Delete: `packages/web/src/App.tsx` (only `main.tsx` imports it)
- Modify: `packages/web/index.html` (`<title>Fantasy</title>`)
- Create: `packages/web/src/routes.basename.test.tsx`
- Create: `packages/web/src/leagueConfig.test.ts`

**Interfaces:**
- Consumes: `routes` (`routes.tsx`), `initLeague` (Task 4), `leagues`, `defaultLeague` (Task 4 config), `validateLeagues` (Task 1).
- Produces:
  - `type Where = { kind: 'league'; league: LeagueConfig } | { kind: 'root' } | { kind: 'redirect'; to: string } | { kind: 'unknown' }`
  - `resolveLeague(o: { pathname: string; rest: string; base: string; leagues: readonly LeagueConfig[]; legacy: ReadonlySet<string>; defaultSlug: string }): Where`
  - `legacyHeads(routes: RouteObject[]): Set<string>`
  - `start(o: { where: Where; base: string; render: (el: React.ReactNode) => void; replace: (to: string) => void; init?: (l: LeagueConfig) => Promise<void> }): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/src/lib/league.test.ts
import { legacyHeads, resolveLeague } from './league';
import { routes } from '../routes';

const leagues = [{ slug: 'husky', leagueId: '1', name: 'Husky Fantasy', managerNames: {} }, { slug: 'dyn', leagueId: '2', name: 'Dynasty', managerNames: {} }];
const legacy = new Set(['standings', 'player', 'players']);
const at = (pathname: string, rest = '', base = '/fantasy-dash') => resolveLeague({ pathname, rest, base, leagues, legacy, defaultSlug: 'husky' });

describe('resolveLeague', () => {
  it('finds the league in the first segment after the base', () => {
    expect(at('/fantasy-dash/dyn/standings/2026')).toEqual({ kind: 'league', league: leagues[1] });
    expect(at('/husky', '', '')).toEqual({ kind: 'league', league: leagues[0] });
  });
  it('is the root page with nothing after the base', () => {
    expect(at('/fantasy-dash/')).toEqual({ kind: 'root' });
    expect(at('/fantasy-dash')).toEqual({ kind: 'root' });
  });
  it('sends an old single-league link to the default league with its path, query and hash', () => {
    expect(at('/fantasy-dash/players/2025', '?pos=WR#top')).toEqual({ kind: 'redirect', to: '/fantasy-dash/husky/players/2025?pos=WR#top' });
  });
  it('is unknown for anything else, without guessing a league', () => {
    expect(at('/fantasy-dash/huskyy/standings')).toEqual({ kind: 'unknown' });
  });
});

describe('legacyHeads', () => {
  it('lists the first segment of every top-level route', () => {
    const heads = legacyHeads(routes);
    for (const h of ['standings', 'player', 'players', 'records', 'all-time', 'draft', 'stats', 'scores', 'teams', 'managers', 'h2h', 'history']) expect(heads.has(h), h).toBe(true);
    expect(heads.has('')).toBe(false);
  });
});
```

```tsx
// packages/web/src/pages/RootPage.test.tsx
import { render } from '@testing-library/react';
import RootPage from './RootPage';
import LeagueNotFound from './LeagueNotFound';
import { leagues } from '../../../../league.config';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('pages outside a league', () => {
  it('the root page explains itself and names no league', () => {
    const { container } = render(<RootPage />);
    expect(container.textContent).toContain('This site hosts private league pages. Use the link your commissioner sent you.');
    for (const l of leagues) { expect(container.textContent).not.toContain(l.name); expect(container.innerHTML).not.toContain(`/${l.slug}`); }
    expect(container.querySelector('a')).toBeNull();
  });
  it('the not-found page names no league', () => {
    const { container } = render(<LeagueNotFound />);
    expect(container.textContent).toMatch(/league not found/i);
    for (const l of leagues) expect(container.textContent).not.toContain(l.name);
  });
  it('the HTML shell names no league', () => {
    const html = readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    expect(html).toContain('<title>Fantasy</title>');
    for (const l of leagues) expect(html).not.toContain(l.name);
  });
});
```

```tsx
// packages/web/src/boot.test.tsx
import { start } from './boot';

const husky = { slug: 'husky', leagueId: '1', name: 'Husky Fantasy', managerNames: {} };

describe('start', () => {
  it('redirects legacy links without rendering', async () => {
    const render = vi.fn(), replace = vi.fn();
    await start({ where: { kind: 'redirect', to: '/x/husky/players' }, base: '/x', render, replace });
    expect(replace).toHaveBeenCalledWith('/x/husky/players');
    expect(render).not.toHaveBeenCalled();
  });
  it('shows league-not-found for a configured league with no data yet', async () => {
    const render = vi.fn();
    await start({ where: { kind: 'league', league: husky }, base: '', render, replace: vi.fn(), init: () => Promise.reject(new Error('No data')) });
    expect(render).toHaveBeenCalledTimes(1);
    expect((render.mock.calls[0][0] as { type: { name: string } }).type.name).toBe('LeagueNotFound');
  });
  it('mounts the app for a league and titles the tab with its name', async () => {
    const render = vi.fn();
    await start({ where: { kind: 'league', league: husky }, base: '', render, replace: vi.fn(), init: () => Promise.resolve() });
    expect(document.title).toBe('Husky Fantasy');
    expect(render).toHaveBeenCalledTimes(1);
  });
});
```

```tsx
// packages/web/src/routes.basename.test.tsx
import { createMemoryRouter } from 'react-router';
import { waitFor } from '@testing-library/react';
import { routes } from './routes';
import { currentSeason } from './data/load';

describe('routes under a league basename', () => {
  it('keeps loader redirects inside the league', async () => {
    const router = createMemoryRouter(routes, { basename: '/husky', initialEntries: ['/husky/standings'] });
    await waitFor(() => expect(router.state.navigation.state).toBe('idle'));
    await waitFor(() => expect(router.state.location.pathname).toMatch(new RegExp(`standings/${currentSeason.year}$`)));
    expect(router.state.errors).toBeNull();
  });
});
```

```ts
// packages/web/src/leagueConfig.test.ts
import { validateLeagues } from '@fantasy-dash/core';
import { defaultLeague, leagues } from '../../../league.config';
import { routes } from './routes';
import { legacyHeads } from './lib/league';

it('the league config is valid', () => {
  expect(validateLeagues(leagues, defaultLeague, legacyHeads(routes))).toEqual([]);
});
```

Run: `pnpm --filter @fantasy-dash/web test -- league RootPage boot basename`
Expected: FAIL (modules missing). The basename test might already pass. If it does, it's still kept as a guard.

- [ ] **Step 2: Implement `lib/league.ts`**

```ts
// packages/web/src/lib/league.ts
import type { RouteObject } from 'react-router';
import type { LeagueConfig } from '@fantasy-dash/core';

export type Where = { kind: 'league'; league: LeagueConfig } | { kind: 'root' } | { kind: 'redirect'; to: string } | { kind: 'unknown' };

/** Which league a URL is for. `base` is BASE_URL without its trailing slash; `rest` is search + hash. */
export function resolveLeague(o: { pathname: string; rest: string; base: string; leagues: readonly LeagueConfig[]; legacy: ReadonlySet<string>; defaultSlug: string }): Where {
  const path = o.base && o.pathname.startsWith(o.base) ? o.pathname.slice(o.base.length) : o.pathname;
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return { kind: 'root' };
  const league = o.leagues.find((l) => l.slug === segs[0]);
  if (league) return { kind: 'league', league };
  if (o.legacy.has(segs[0])) return { kind: 'redirect', to: `${o.base}/${o.defaultSlug}/${segs.join('/')}${o.rest}` };
  return { kind: 'unknown' };
}

/** The first path segment of every top-level route: links from before leagues had their own address. */
export function legacyHeads(routes: RouteObject[]): Set<string> {
  const out = new Set<string>();
  for (const r of routes) for (const c of r.children ?? []) { const head = c.path?.split('/')[0]; if (head) out.add(head); }
  return out;
}
```

- [ ] **Step 3: The two pages outside a league**

Both are full-screen pages using the theme tokens, with no links and no league names.

```tsx
// packages/web/src/pages/RootPage.tsx
export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <p className="max-w-md text-center text-muted">This site hosts private league pages. Use the link your commissioner sent you.</p>
    </div>
  );
}
```

```tsx
// packages/web/src/pages/LeagueNotFound.tsx
export default function LeagueNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg px-6 text-ink">
      <h1 className="text-xl font-semibold">League not found</h1>
      <p className="max-w-md text-center text-muted">Check the link your commissioner sent you.</p>
    </div>
  );
}
```

- [ ] **Step 4: `boot.tsx`, `main.tsx`, and remove `App.tsx`**

```tsx
// packages/web/src/boot.tsx
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { LeagueConfig } from '@fantasy-dash/core';
import { routes } from './routes';
import { initLeague } from './data/load';
import type { Where } from './lib/league';
import RootPage from './pages/RootPage';
import LeagueNotFound from './pages/LeagueNotFound';

/** Render what a URL calls for: a league's app under its own basename, the root page, not-found, or a redirect for an old link. */
export async function start(o: { where: Where; base: string; render: (el: React.ReactNode) => void; replace: (to: string) => void; init?: (l: LeagueConfig) => Promise<void> }): Promise<void> {
  const { where } = o;
  if (where.kind === 'redirect') { o.replace(where.to); return; }
  if (where.kind === 'root') { o.render(<RootPage />); return; }
  if (where.kind === 'unknown') { o.render(<LeagueNotFound />); return; }
  try { await (o.init ?? initLeague)(where.league); } catch { o.render(<LeagueNotFound />); return; }
  document.title = where.league.name;
  const router = createBrowserRouter(routes, { basename: `${o.base}/${where.league.slug}` });
  o.render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>);
}
```

```tsx
// packages/web/src/main.tsx
import ReactDOM from 'react-dom/client';
import { initTheme } from './lib/theme';
import { routes } from './routes';
import { legacyHeads, resolveLeague } from './lib/league';
import { start } from './boot';
import { defaultLeague, leagues } from '../../../league.config';
import './index.css';

initTheme();
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const root = ReactDOM.createRoot(document.getElementById('root')!);
const where = resolveLeague({ pathname: location.pathname, rest: location.search + location.hash, base, leagues, legacy: legacyHeads(routes), defaultSlug: defaultLeague });
void start({ where, base, render: (el) => root.render(el), replace: (to) => location.replace(to) });
```

Then:
- Delete `packages/web/src/App.tsx`.
- `grep -rn "from './App'\|seasonLoader } from './App'" packages/web/src` should return nothing.
- In `packages/web/index.html`, change `<title>Husky Fantasy</title>` to `<title>Fantasy</title>`.

- [ ] **Step 5: Run the tests, typecheck and build**

Run: `pnpm --filter @fantasy-dash/web test && pnpm typecheck && VITE_BASE=/fantasy-dash/ pnpm build`
Expected: PASS. Then check the build output with `grep -c "Husky Fantasy" packages/web/dist/index.html`, which should print `0`.

If the basename test shows a redirect escaping the basename (pathname `/standings/2026` with errors set), change the loader redirects in `routes.tsx` to relative ones. That's unlikely: react-router applies the basename to loader redirects.

- [ ] **Step 6: Try it in the browser**

Run `VITE_BASE=/fantasy-dash/ pnpm build && cp packages/web/dist/index.html packages/web/dist/404.html && pnpm --filter @fantasy-dash/web exec vite preview --base /fantasy-dash/`, then check each URL:
- `/fantasy-dash/` shows the root text.
- `/fantasy-dash/husky/` shows the home page, with the tab titled "Husky Fantasy".
- `/fantasy-dash/standings` lands on `/fantasy-dash/husky/standings/<year>`.
- `/fantasy-dash/nope/` shows "League not found".
- Clicking a nav link stays under `/fantasy-dash/husky/`.

Use a normal browser user agent (ESPN blocks headless Chrome's live calls) or the `run` skill. Note: `vite preview` serves index.html for unknown paths itself; the 404.html copy matters on Pages.

- [ ] **Step 7: Commit**

```bash
git add -A packages/web
git commit -m "Each league at its own address: the league in the URL becomes the router basename so every link stays inside it; a plain root page and league-not-found page name no league; old links go to Husky with their query intact

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `pnpm sync` over every league

**Files:**
- Modify: `scripts/sync.ts` (`fetchSeason` takes `managerNames`; `main`, `writeAll` replaced)
- Create: `scripts/lib/leagueFiles.ts` (pure file helpers)
- Create: `packages/core/test/leagueFiles.test.ts`, which tests the script helper. Scripts have no runner of their own, and core's Vitest can import `../../../scripts/lib/leagueFiles` because the root tsconfig includes scripts. If core's tsconfig `include` rejects it, put the test at `packages/web/src/leagueFiles.test.ts` instead.

**Interfaces:**
- Consumes: `leagues`, `positionOverrides` (config), `runPerLeague` (Task 1), `collectPlayerIds`, `trimPlayers`, `SeasonSchema` (core).
- Produces:
  - `moveKeep(from: string, to: string, keep: string[]): Promise<void>` replaces directory `to` with `from`, carrying over the listed subfolders of the old `to`.
  - `idsFromSeasonFiles(dir: string): Set<string>` returns the player ids in a league's existing `seasons/*.json` (empty if there are none).

- [ ] **Step 1: Write the failing helper tests**

```ts
// packages/core/test/leagueFiles.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { idsFromSeasonFiles, moveKeep } from '../../../scripts/lib/leagueFiles';

const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'lf-'));

describe('moveKeep', () => {
  it('replaces the league folder but carries its points over', async () => {
    const root = tmp();
    const dest = path.join(root, 'husky'), staging = path.join(root, 'staging');
    mkdirSync(path.join(dest, 'points'), { recursive: true }); writeFileSync(path.join(dest, 'points', '2025.json'), 'P');
    writeFileSync(path.join(dest, 'history.json'), 'old');
    mkdirSync(staging); writeFileSync(path.join(staging, 'history.json'), 'new');
    await moveKeep(staging, dest, ['points']);
    expect(readFileSync(path.join(dest, 'history.json'), 'utf8')).toBe('new');
    expect(readFileSync(path.join(dest, 'points', '2025.json'), 'utf8')).toBe('P');
    expect(existsSync(staging)).toBe(false);
    expect(existsSync(`${dest}.old`)).toBe(false);
  });
  it('works for a brand-new league with no folder yet', async () => {
    const root = tmp();
    const staging = path.join(root, 's'); mkdirSync(staging); writeFileSync(path.join(staging, 'history.json'), 'h');
    await moveKeep(staging, path.join(root, 'new'), ['points']);
    expect(existsSync(path.join(root, 'new', 'history.json'))).toBe(true);
  });
});

describe('idsFromSeasonFiles', () => {
  it('is empty without files', () => { expect(idsFromSeasonFiles(path.join(tmp(), 'missing')).size).toBe(0); });
  it('reads player ids from existing season files', () => {
    const dir = tmp();
    const src = path.resolve(__dirname, '../../../data/leagues/husky/seasons');
    const year = readFileSync(path.join(src, '2025.json'), 'utf8');
    writeFileSync(path.join(dir, '2025.json'), year);
    expect(idsFromSeasonFiles(dir).size).toBeGreaterThan(50);
  });
});
```

Run: `pnpm --filter @fantasy-dash/core test -- leagueFiles`
Expected: FAIL (module missing).

- [ ] **Step 2: Implement `scripts/lib/leagueFiles.ts`**

```ts
// scripts/lib/leagueFiles.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { SeasonSchema, collectPlayerIds } from '@fantasy-dash/core';

/** Swap directory `to` for `from`, carrying `keep` subfolders of the old `to` across (they belong to another sync). */
export async function moveKeep(from: string, to: string, keep: string[]): Promise<void> {
  for (const k of keep) {
    const old = path.join(to, k);
    if (existsSync(old)) { await rm(path.join(from, k), { recursive: true, force: true }); await rename(old, path.join(from, k)); }
  }
  const backup = `${to}.old`;
  await rm(backup, { recursive: true, force: true });
  if (existsSync(to)) await rename(to, backup);
  await rename(from, to);
  await rm(backup, { recursive: true, force: true });
}

/** Player ids in a league's existing season files: keeps a league that failed this sync from losing its names in players.json. */
export function idsFromSeasonFiles(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  const seasons = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => SeasonSchema.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8'))));
  return collectPlayerIds(seasons);
}
```

Run the tests again. Expected: PASS.

- [ ] **Step 3: Loop over the leagues in `scripts/sync.ts`**

- Change the import to `import { leagues as configured, positionOverrides } from '../league.config';`, and add `import { moveKeep, idsFromSeasonFiles } from './lib/leagueFiles';` and `runPerLeague` (plus `type LeagueConfig` if needed) from core.
- Change `fetchSeason(client, league, players)` to `fetchSeason(client, league, players, managerNames: Record<string, string>)`, with `buildSeason(input, managerNames)` inside.
- Delete `writeAll`, and replace `main` with:

```ts
async function main() {
  const client = new SleeperClient();

  log('Fetching player directory');
  const rawPlayers = await client.getPlayers();
  if (!rawPlayers) throw new Error('Player directory unavailable');
  const fullPlayers = toPlayerDirectory(rawPlayers);
  for (const [id, position] of Object.entries(positionOverrides)) {
    if (fullPlayers[id]) fullPlayers[id] = { ...fullPlayers[id], position };
    else log(`WARNING: position override for unknown player ${id}`);
  }

  const out = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-')) : DATA_DIR;
  const { results, failed } = await runPerLeague(configured, async (cfg) => {
    const chain = await walkLeagueChain(client, cfg.leagueId);
    log(`${cfg.slug}: ${chain.length} seasons: ${chain.map((l) => l.season).join(', ')}`);
    const seasons: Season[] = [];
    for (const league of chain) {
      log(`${cfg.slug} ${league.season} (${league.league_id}, ${league.status})`);
      seasons.push(await fetchSeason(client, await withFinishedWeek(league), fullPlayers, cfg.managerNames));
    }
    seasons.sort((a, b) => a.year - b.year);
    return seasons;
  }, log);
  if (results.size === 0) throw new Error(`every league failed: ${failed.join(', ')}`);

  // players.json covers every league; a league that failed keeps the ids from its existing files
  const ids = new Set<string>();
  for (const seasons of results.values()) for (const id of collectPlayerIds(seasons)) ids.add(id);
  for (const slug of failed) for (const id of idsFromSeasonFiles(path.join(DATA_DIR, 'leagues', slug, 'seasons'))) ids.add(id);
  const players = trimPlayers(fullPlayers, ids);
  const kept = new Set(Object.keys(players));
  PlayerDirectorySchema.parse(players);

  await mkdir(path.join(out, 'leagues'), { recursive: true });
  for (const [slug, raw] of results) {
    const seasons = raw.map((s) => trimPlayerSeasons(s, kept));
    const history = buildHistory(seasons);
    for (const s of seasons) SeasonSchema.parse(s);
    HistorySchema.parse(history);
    const missing = [...collectPlayerIds(seasons)].filter((id) => !players[id]);
    if (missing.length) log(`WARNING: ${slug}: ${missing.length} player ids missing from directory: ${missing.slice(0, 10).join(', ')}`);
    const staging = path.join(ROOT, '.tmp', 'leagues', slug);
    await rm(staging, { recursive: true, force: true });
    await mkdir(path.join(staging, 'seasons'), { recursive: true });
    await writeFile(path.join(staging, 'history.json'), JSON.stringify(history, null, 1));
    for (const s of seasons) await writeFile(path.join(staging, 'seasons', `${s.year}.json`), JSON.stringify(s));
    await moveKeep(staging, path.join(out, 'leagues', slug), ['points']);
    log(`${slug}: wrote ${seasons.length} seasons`);
  }
  await writeFile(path.join(out, 'players.json'), JSON.stringify(players));
  log(`${dryRun ? 'Dry run complete. Output in' : 'Wrote'} ${out}${failed.length ? ` (failed: ${failed.join(', ')})` : ''}`);
}
```

Remove imports that are now unused: `rename` if unused, and `existsSync` if unused. `trimPlayerSeasons` runs per league after the union directory is known, which preserves the old behaviour for Husky.

- [ ] **Step 4: Typecheck and do a dry run**

Run: `pnpm typecheck:scripts && pnpm sync:dry`
Expected: it finishes with "Dry run complete. Output in /tmp/…". Then `diff <(jq -S . data/leagues/husky/history.json) <(jq -S . <tmpdir>/leagues/husky/history.json)` shows no change, or only changes from new Sleeper data since the last sync. `players.json` has the same keys: `node -e "…"` comparing `Object.keys` lengths should match within normal churn.

Then the failure path: temporarily add `{ slug: 'broken', leagueId: '1', name: 'B', managerNames: {} }` to `leagues`, run `pnpm sync:dry`, check the log shows `✗ broken: League 1 not found` and Husky still written, and revert the config.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.ts scripts/lib/leagueFiles.ts packages/core/test/leagueFiles.test.ts
git commit -m "Sync: every configured league syncs into its own folder, keeping its points; one league failing leaves its files and its players' names alone; the shared NFL folders are no longer rewritten

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `pnpm sync:players` over every league's years, plus points files

**Files:**
- Modify: `scripts/syncPlayers.ts`
- Modify: `league.config.ts` (delete the deprecated `leagueConfig` export)

**Interfaces:**
- Consumes: `nflYears`, `NflYear`, `runPerLeague` (Task 1), `buildLeaguePoints`, `pointsUpToDate`, `LeaguePointsSchema`, `SharedPlayerDbSchema` (Task 2), `leagues`, `positionOverrides`.

- [ ] **Step 1: Switch from league seasons to NFL years**

In `scripts/syncPlayers.ts`:
- Change the config import to `import { leagues as configured, positionOverrides } from '../league.config';`.
- Delete `throughWeekOf`.
- Add a memoised Sleeper fetch that the playerdb and points phases share:

```ts
type SleeperYear = { sleeperWeeks: Map<number, SleeperWeekStat[]>; projections: Map<number, StatMap> };
const sleeperCache = new Map<number, Promise<SleeperYear>>();

/** One season's Sleeper weekly stat rows and projections, fetched once per run. */
function sleeperYear(client: SleeperClient, y: NflYear): Promise<SleeperYear> {
  let p = sleeperCache.get(y.year);
  if (!p) {
    p = (async () => {
      const sleeperWeeks = new Map<number, SleeperWeekStat[]>();
      const projections = new Map<number, StatMap>();
      for (let week = 1; week <= y.throughWeek; week++) {
        const [rows, proj] = await Promise.all([client.getWeekStats(y.season, week), client.getProjections(y.season, week)]);
        if (!rows || rows.length === 0) {
          if (y.complete) throw new Error(`${y.year} week ${week}: Sleeper weekly rows ${rows ? 'empty' : 'missing'} for a finished season`);
          log(`WARNING: ${y.year} week ${week}: Sleeper weekly rows missing`);
          continue;
        }
        sleeperWeeks.set(week, rows);
        if (proj) projections.set(week, proj);
      }
      return { sleeperWeeks, projections };
    })();
    sleeperCache.set(y.year, p);
  }
  return p;
}
```

- `buildSeason(client, league, directory, shared)` becomes `buildSeason(client, y: NflYear, directory, shared)`:
  - Use `y.year`, `y.complete` and `y.throughWeek`, replacing the in-function week loop with `const { sleeperWeeks } = await sleeperYear(client, y);`.
  - Pass `positionOverrides` (the import) in the `buildPlayerDb` call, and remove any leftover `void projections`.
- `playerDbPhase(client, leagues)` becomes `playerDbPhase(client, years: NflYear[])`:
  - The filter uses `!y.complete` / `y.year`.
  - `throughWeekOf(league) < 1` becomes `y.throughWeek < 1`.
  - Messages use `y.year`.
- `chartsPhase(leagues)` and `schedulePhase(leagues)` become `(years: NflYear[])`:
  - `l.status !== 'complete'` becomes `!y.complete`.
  - `l.season` / `Number(league.season)` becomes `y.year`.

- [ ] **Step 2: Add the points phase and rewrite `main`**

```ts
const LEAGUES_DIR = path.join(ROOT, 'data', 'leagues');

/** Phase 4: each league's points, projections and xFP for every season it played that has a shared playerdb file. */
async function pointsPhase(client: SleeperClient, chains: Map<string, SleeperLeague[]>, years: NflYear[]) {
  const outRoot = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-points-')) : LEAGUES_DIR;
  const { failed } = await runPerLeague(configured.filter((c) => chains.has(c.slug)), async (cfg) => {
    for (const league of chains.get(cfg.slug)!) {
      const y = years.find((x) => x.year === Number(league.season));
      if (!y || (onlySeason !== null && y.year !== onlySeason)) continue;
      const dbFile = path.join(OUT_DIR, `${y.year}.json`);
      if (!existsSync(dbFile)) { log(`${cfg.slug} ${y.year}: no shared playerdb yet; no points`); continue; }
      const shared = SharedPlayerDbSchema.parse(JSON.parse(readFileSync(dbFile, 'utf8')));
      const file = path.join(LEAGUES_DIR, cfg.slug, 'points', `${y.year}.json`);
      const existing = existsSync(file) ? (() => { try { return JSON.parse(readFileSync(file, 'utf8')) as unknown; } catch { return undefined; } })() : undefined;
      if (y.complete && !full && pointsUpToDate(existing, { leagueId: league.league_id, dbBuiltAt: shared.builtAt })) { log(`${cfg.slug} ${y.year}: points up to date`); continue; }
      const { sleeperWeeks, projections } = await sleeperYear(client, y);
      const points = LeaguePointsSchema.parse(buildLeaguePoints({ shared, leagueId: league.league_id, builtAt: new Date().toISOString(), scoring: league.scoring_settings, sleeperWeeks, projections }));
      const dir = path.join(outRoot, cfg.slug, 'points');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${y.year}.json`), JSON.stringify(points));
      log(`${cfg.slug} ${y.year}: points for ${Object.keys(points.players).length} players`);
    }
  }, log);
  if (dryRun) log(`Dry run: points in ${outRoot}`);
  if (failed.length) log(`points failed for: ${failed.join(', ')}`);
}

async function main() {
  const client = new SleeperClient();
  const chains = new Map<string, SleeperLeague[]>();
  const { failed } = await runPerLeague(configured, async (cfg) => { chains.set(cfg.slug, await walkLeagueChain(client, cfg.leagueId)); }, log);
  if (chains.size === 0) throw new Error(`no league could be read: ${failed.join(', ')}`);
  const all = nflYears([...chains.values()]);
  if (onlySeason !== null && !(Number.isInteger(onlySeason) && all.some((y) => y.year === onlySeason))) {
    throw new Error(`--season must name a league season (have: ${all.map((y) => y.year).join(', ')})`);
  }
  const years = all.filter((y) => onlySeason === null || y.year === onlySeason);
  log(`Seasons: ${years.map((y) => y.year).join(', ')}`);

  if (!chartsOnly) await playerDbPhase(client, years);
  await chartsPhase(years);
  await schedulePhase(years);
  if (!chartsOnly) await pointsPhase(client, chains, years);
}
```

In a dry run the playerdb phase writes to a temp dir, so `pointsPhase` reads the existing on-disk shared files. That's fine for a dry run.

Import `nflYears`, `runPerLeague`, `buildLeaguePoints`, `pointsUpToDate`, `LeaguePointsSchema`, `SharedPlayerDbSchema` and `type NflYear` from core. Drop `PlayerDbSchema` if unused.

- [ ] **Step 3: Remove the temporary config export**

Delete the `leagueConfig` export and its comment from `league.config.ts`. `grep -rn "leagueConfig" scripts packages league.config.ts` should return nothing.

- [ ] **Step 4: Typecheck, then check the points rebuild exactly**

Run: `pnpm typecheck:scripts && pnpm typecheck`

Then prove that a fresh points build reproduces the migrated files for a finished season:

```bash
cp data/leagues/husky/points/2024.json /tmp/pts-2024-before.json
pnpm sync:players --season 2024 --full --dry-run
```

`--full` forces the rebuild, and the dry-run output dir is printed. Compare `pts`/`proj` per row:

```bash
node -e "
const a=require('/tmp/pts-2024-before.json'), b=require(process.argv[1]);
let diff=0; for (const [id, rows] of Object.entries(a.players)) for (const r of rows) { const o=(b.players[id]||[]).find(x=>x[0]===r[0]); if(!o||o[1]!==r[1]||o[2]!==r[2]) diff++; }
console.log('rows differing in pts/proj:', diff);" <dry-run-dir>/husky/points/2024.json
```

Expected: `rows differing in pts/proj: 0`. A non-zero count means Sleeper restated stats since the last build (rare for 2024). Look at a few before accepting it. The `--full` playerdb dry run doesn't touch the real files. The xFP coefficients may differ in the last floating-point digits because of row order. That's expected, and rounded xFP values should match.

- [ ] **Step 5: Commit**

```bash
git add scripts/syncPlayers.ts league.config.ts
git commit -m "Player sync covers every league's seasons and writes each league's points, projections and xFP, fetching Sleeper's weekly stats once per season for all of them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs and full verification

**Files:**
- Modify: `README.md` (the Deploy section and a new "Leagues" section)

- [ ] **Step 1: README**

Add a `## Leagues` section after the intro:

```markdown
## Leagues

Every Sleeper league in `league.config.ts` gets its own address: `https://mfoster58.github.io/fantasy-dash/<slug>/`. Leagues never link to each other, and the site's root page lists none of them. To add one, add `{ slug, leagueId, name, managerNames: {} }` to `leagues` (the slug is lowercase letters, digits and hyphens) and run `pnpm sync && pnpm sync:players`, or wait for the next scheduled run. Its old seasons are scored from Sleeper on that first player sync.

Data: `data/leagues/<slug>/` holds each league's history, seasons and points (its scoring, projections and xFP). `data/players.json`, `schedule/`, `playerdb/` and `charts/` are NFL data shared by every league.
```

In `## Deploy`, replace "runs every Tuesday morning" with "runs daily and after each NFL game block".

- [ ] **Step 2: Full verification**

Run: `pnpm test && pnpm typecheck && pnpm typecheck:scripts && VITE_BASE=/fantasy-dash/ pnpm build`
Expected: everything passes. Confirm with `grep -rl "Husky Fantasy" packages/web/dist/index.html packages/web/dist/404.html 2>/dev/null`, which should print nothing. (`404.html` is created by the workflow, not by the build.)

Repeat the preview pass from Task 5 Step 6 on the final build. Also open `/fantasy-dash/husky/players/2025` and a player page, and check that points, PPG, FPOE and the grade cards show the same numbers as the live site does now.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "README: how leagues work and how to add one; the sync runs daily

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand off**

Use superpowers:finishing-a-development-branch. After merging, the first push to main deploys the new layout, and old links redirect to `/husky/`. Tell Mathias his league's link is now `…/fantasy-dash/husky/`, and ask for the other leagues' Sleeper IDs and slugs.
