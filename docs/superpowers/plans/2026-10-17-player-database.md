# Player database — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Players** tab showing one sortable, colour-coded table of every NFL QB/RB/WR/TE for a season and week range, with basic and advanced metrics (snap/route/target share, YPRR, EPA, CPOE, separation, RYOE, xFP, FPOE), backed by a new per-player-week data set built from Sleeper plus nflverse files.

**Architecture:** A pure core module `packages/core/src/playerdb/` turns raw Sleeper weekly rows and nflverse CSV rows into one validated `data/playerdb/{year}.json` per season (`buildPlayerDb`). A separate script `scripts/syncPlayers.ts` downloads the files and runs it, after the Sleeper sync in the same workflow. The web page lazy-loads one season's file, aggregates the weekly rows over the chosen week range in `lib/playerdb/`, and renders a sticky-lead-block table with percentile tints.

**Tech Stack:** TypeScript, Node 22 (`fetch`, `node:zlib`), zod, React 19, react-router v7 (`useSearchParams`, loaders), Tailwind v4 with the site's CSS tokens, Vitest + Testing Library (jsdom), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-17-player-database-design.md`

## Global Constraints

- Data files: `data/playerdb/{year}.json`, zod-validated by `PlayerDbSchema`; nulls omitted from rows; rows sorted by week then id.
- Positions covered: `QB RB WR TE` only (`DB_POSITIONS`), Sleeper position with `league.config.ts` `positionOverrides` applied.
- Weeks: 1..`lastScoredWeek` in season, 1..18 for finished seasons; NFL postseason excluded everywhere.
- Rates over a range are summed numerators over summed denominators; NGS per-game averages are weighted by that week's targets / carries / attempts; per game divides by weeks with `gp = 1`.
- Sample minimums per week in range: targets 3, carries 5, routes 10, dropbacks 12, snaps 10.
- Estimated routes (`routesReal = false`): `routesEst = round(snaps / teamSnaps × dropbacks)`; the UI shows ° after estimated values.
- xFP: OLS per position per season, features `[1, pa_att, pa_air, pa_rz, ru_att, ru_rz]` for QB and `[1, re_tgt, re_air, re_rz, ru_att, ru_rz]` for RB/WR/TE, minimum 50 rows else `null`.
- Tints: percentile among visible rows, `--loss` → transparent → `--win` at 45 % over the surface, reversed for lower-is-better columns; Pts, PPG, Pos rank, G and # never tinted; below-minimum cells untinted and `text-muted`.
- Nav: **Players** between Managers and Head to Head; `/players` → `/players/{current year}`; `/players/:season`; `RETIRED_PATHS` loses `players`.
- Tests: `pnpm test` from the repo root must stay green; `npx tsc --noEmit` in `packages/web`, `packages/core` and the root (`pnpm typecheck:scripts`) must be clean. Gate on exit codes written to a log file, never on grep output.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work in a worktree (`EnterWorktree`, name `player-db`), run `pnpm install --frozen-lockfile` there first. Network access is needed in Task 9 only.
- Downloaded CSVs are untrusted data: the script writes them nowhere; they are parsed in memory only.

## Review Focus

1. **A Sleeper id with no crosswalk hit** (practice-squad player): the row keeps its Sleeper fields, every nflverse field is absent, nothing throws, and the player still appears. Pinned to Task 3 (crosswalk miss returns null) and Task 8 (build with an unmapped player).
2. **A week where a player has no NGS row**: weighted NGS averages must use only the weeks that have the field, and a player with none shows `null`, never `NaN`. Pinned to Task 10 (`aggregate` weighted test with a missing week).
3. **Estimated routes**: when `routesReal` is false the aggregate must use `routesEst`, the column must flag estimated, and a row with no snaps must get no estimate. Pinned to Task 6 (`routesEstimate` with zero team snaps) and Task 10.
4. **Base wins on merge**: Sleeper's `re_yac`, `ru_bt`, `pa_sack`, `re_fd` must not be overwritten by nflverse or PFR values. Pinned to Task 8 (`mergeInto` test).
5. **Team totals follow the player's team-weeks**: a player traded mid-range must have team totals summed from his own rows' teams, not one team. Pinned to Task 10 (`aggregate` with a traded player).

## File structure

**Core, `packages/core/src/playerdb/`** (pure; tests in `packages/core/test/playerdb/`):
- `types.ts` — `DbPos`, `DB_POSITIONS`, `isDbPos`, `PLAYER_WEEK_KEYS`, `PlayerWeekKey`, `PlayerWeek`, `DbPlayer`, `TeamWeek`, `XfpCoefficients`, `PlayerDb`.
- `schema.ts` — `PlayerDbSchema`.
- `csv.ts` — `parseCsv`.
- `fields.ts` — `numberOf`, `round3`, `mapFields`, `indexWeekly`.
- `crosswalk.ts` — `normalizeName`, `normalizeTeam`, `buildCrosswalk`, `Crosswalk`, `NameHint`.
- `sources/sleeper.ts` — `SLEEPER_FIELDS`, `sleeperRow`, `positionOf`.
- `sources/nflverse.ts` — `NFLVERSE_FIELDS`, `nflverseWeekly`.
- `sources/ngs.ts` — `NGS_RECEIVING_FIELDS`, `NGS_RUSHING_FIELDS`, `NGS_PASSING_FIELDS`, `ngsWeekly`.
- `sources/pfr.ts` — `PFR_REC_FIELDS`, `PFR_RUSH_FIELDS`, `PFR_PASS_FIELDS`, `SNAP_FIELDS`, `pfrWeekly`.
- `sources/players.ts` — `nflPlayerMeta`.
- `sources/participation.ts` — `weekOfGame`, `countRoutes`, `Participation`.
- `teamWeeks.ts` — `teamWeeksOf`, `teamWeekKey`.
- `derive.ts` — `routesEstimate`.
- `ols.ts` — `solve`, `fitOls` (moved from web).
- `xfp.ts` — `XFP_FEATURES`, `XFP_MIN_ROWS`, `xfpFeatures`, `fitXfpCoefficients`, `predictXfp`.
- `build.ts` — `PlayerDbInput`, `mergeInto`, `buildPlayerDb`.
- `index.ts` — re-exports; `packages/core/src/index.ts` adds `export * from './playerdb';`.
- `packages/core/src/sleeper/types.ts` — `SleeperWeekStat` gains `opponent` and `player`.

**Script**: `scripts/syncPlayers.ts`; `package.json` gains `sync:players`; `.github/workflows/sync.yml` gains a step.

**Web**:
- `src/data/load.ts` — `hasPlayerDb`, `loadPlayerDb`.
- `src/lib/playerdb/aggregate.ts` — `Agg`, `TeamTotals`, `WEIGHTED`, `aggregateWeeks`, `aggregate`.
- `src/lib/playerdb/columns.ts` — `Tab`, `TABS`, `Mode`, `Fmt`, `ColumnDef`, `LEAD_COLUMNS`, `TAB_COLUMNS`, `columnsFor`, `columnValue`, `belowMin`, `fmtValue`, `tabPositions`.
- `src/lib/playerdb/percentile.ts` — `percentiles`, `tintFor`.
- `src/lib/playerdb/rosters.ts` — `rosterMap`.
- `src/lib/playerdb/url.ts` — `DbState`, `RosterFilter`, `parseState`, `serializeState`.
- `src/lib/playerdb/directory.ts` — `dbDirectory`.
- `src/components/players/db/PlayerDbToolbar.tsx`, `PlayerDbTable.tsx`, `TintCell.tsx`, `WeekRows.tsx`.
- `src/pages/PlayersPage.tsx`; `src/routes.tsx`; `src/components/Nav.tsx`; `src/lib/xfp.ts` (uses core `fitOls`).
- `src/test/playerDbFixtures.ts` — the mini database every web test uses.

---

### Task 1: Worktree, types and schema

**Files:**
- Create: `packages/core/src/playerdb/types.ts`, `packages/core/src/playerdb/schema.ts`, `packages/core/src/playerdb/index.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/sleeper/types.ts:71-75`
- Test: `packages/core/test/playerdb/schema.test.ts`

**Interfaces:**
- Produces: everything in `types.ts` below; `PlayerDbSchema`; `SleeperWeekStat.opponent?: string | null` and `SleeperWeekStat.player?: { position?: string | null; first_name?: string; last_name?: string } | null`.

- [ ] **Step 1: Worktree and baseline**

Use `EnterWorktree` with name `player-db`. In it:

```bash
pnpm install --frozen-lockfile > /tmp/claude-501/install.log 2>&1; echo "exit $?"
pnpm test > /tmp/claude-501/base.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/base.log
```
Expected: both exit 0 (record the core and web test counts).

- [ ] **Step 2: Write the failing schema test**

`packages/core/test/playerdb/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PlayerDbSchema } from '../../src/playerdb/schema';
import { PLAYER_WEEK_KEYS, type PlayerDb } from '../../src/playerdb/types';

export const miniDb = (): PlayerDb => ({
  year: 2026, throughWeek: 2, routesReal: false, builtAt: '2026-10-17T00:00:00.000Z',
  players: { '1': { id: '1', gsisId: '00-1', pfrId: 'AbcdA01', name: 'A Back', pos: 'RB', teams: ['SF'], birthDate: '2000-01-01', yearsExp: 2, draft: { year: 2024, round: 1, pick: 9 }, college: 'State', height: 72, weight: 210 } },
  teamWeeks: [{ team: 'SF', week: 1, opp: 'LAR', offSnaps: 60, passAtt: 30, rushAtt: 25, dropbacks: 32, rzLooks: 8, airYds: 250, passPlays: null }],
  xfp: { QB: null, RB: [1, 0.5, 0.01, 1, 0.3, 1.2], WR: null, TE: null },
  rows: [{ id: '1', week: 1, team: 'SF', gp: 1, opp: 'LAR', pts: 12.3, ru_att: 15, ru_yds: 70, re_tgt: 3, snaps: 40, teamSnaps: 60, routesEst: 21 }],
});

describe('PlayerDbSchema', () => {
  it('accepts a well-formed database', () => {
    expect(PlayerDbSchema.parse(miniDb())).toEqual(miniDb());
  });
  it('rejects a row missing its week and a row with an unknown key', () => {
    const noWeek = miniDb();
    delete (noWeek.rows[0] as Partial<typeof noWeek.rows[0]>).week;
    expect(() => PlayerDbSchema.parse(noWeek)).toThrow();
    const junk = miniDb();
    (junk.rows[0] as unknown as Record<string, unknown>).bogus = 1;
    expect(() => PlayerDbSchema.parse(junk)).toThrow(/bogus/);
  });
  it('lists every documented key exactly once', () => {
    expect(new Set(PLAYER_WEEK_KEYS).size).toBe(PLAYER_WEEK_KEYS.length);
    for (const k of ['pts', 'xfp', 'routes', 'routesEst', 'pa_cpoe', 're_sep', 'ru_ryoeAtt', 'fumLost']) expect(PLAYER_WEEK_KEYS).toContain(k);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd packages/core && npx vitest run test/playerdb/schema.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; tail -5 /tmp/claude-501/t.log`
Expected: exit 1, cannot resolve `../../src/playerdb/schema`.

- [ ] **Step 4: Types**

`packages/core/src/playerdb/types.ts`:
```ts
import type { PlayerId } from '../types';

export type DbPos = 'QB' | 'RB' | 'WR' | 'TE';
export const DB_POSITIONS: readonly DbPos[] = ['QB', 'RB', 'WR', 'TE'];
export const isDbPos = (p: string | null | undefined): p is DbPos => (DB_POSITIONS as readonly string[]).includes(p ?? '');

/** Every numeric field a PlayerWeek may carry. Prefixes: pa_ passing, ru_ rushing, re_ receiving. */
export const PLAYER_WEEK_KEYS = [
  'gs', 'pts', 'proj', 'ppr', 'posRankPpr', 'xfp', 'snaps', 'teamSnaps', 'routes', 'routesEst',
  'pa_att', 'pa_cmp', 'pa_yds', 'pa_td', 'pa_int', 'pa_sack', 'pa_sackYds', 'pa_air', 'pa_fd', 'pa_rz', 'pa_cmp40', 'pa_rtg', 'pa_2pt',
  'pa_epa', 'pa_cpoe', 'pa_pacr', 'pa_yac',
  'pa_ttt', 'pa_iay', 'pa_cay', 'pa_aggr', 'pa_ays', 'pa_xcmp',
  'pa_bad', 'pa_badPct', 'pa_press', 'pa_pressPct', 'pa_blitz', 'pa_hurry', 'pa_hit', 'pa_drops',
  'ru_att', 'ru_yds', 'ru_td', 'ru_fd', 'ru_rz', 'ru_bt', 'ru_yac', 'ru_tfl', 'ru_40', 'ru_2pt',
  'ru_epa', 'ru_10', 'ru_20',
  'ru_ybc', 'ru_yacPfr',
  'ru_xyds', 'ru_ryoe', 'ru_ryoeAtt', 'ru_eff', 'ru_box8', 'ru_tlos',
  're_tgt', 're_rec', 're_yds', 're_td', 're_fd', 're_air', 're_yac', 're_drop', 're_rz', 're_20', 're_40', 're_2pt',
  're_epa', 're_racr', 're_tgtShare', 're_ayShare', 're_wopr',
  're_cush', 're_sep', 're_iay', 're_iayShare', 're_xyac', 're_yacoe',
  're_bt', 're_dropPfr', 're_dropPct', 're_int', 're_rtg',
  'fum', 'fumLost',
] as const;
export type PlayerWeekKey = (typeof PLAYER_WEEK_KEYS)[number];

/** One player's week. Only id, week, team and gp are always present; absent = null. */
export type PlayerWeek = { id: PlayerId; week: number; team: string; gp: number; opp?: string } & Partial<Record<PlayerWeekKey, number>>;

export interface DbPlayer {
  id: PlayerId;
  gsisId: string | null;
  pfrId: string | null;
  name: string;
  pos: DbPos;
  /** every team he had a row for this season, in week order */
  teams: string[];
  birthDate: string | null;
  yearsExp: number | null;
  draft: { year: number; round: number; pick: number } | null;
  college: string | null;
  height: number | null;
  weight: number | null;
}

/** One NFL team's offensive volume in one week, summed from every player's Sleeper row for that team. */
export interface TeamWeek {
  team: string; week: number; opp: string;
  offSnaps: number;
  passAtt: number; rushAtt: number;
  /** passAtt + sacks taken */
  dropbacks: number;
  /** red-zone carries + red-zone targets */
  rzLooks: number;
  /** passing air yards */
  airYds: number;
  /** pass plays from the participation feed; null while routes are estimated */
  passPlays: number | null;
}

export type XfpCoefficients = Record<DbPos, number[] | null>;

export interface PlayerDb {
  year: number;
  throughWeek: number;
  routesReal: boolean;
  builtAt: string;
  players: Record<PlayerId, DbPlayer>;
  teamWeeks: TeamWeek[];
  xfp: XfpCoefficients;
  rows: PlayerWeek[];
}
```

- [ ] **Step 5: Schema**

`packages/core/src/playerdb/schema.ts`:
```ts
import { z } from 'zod';
import { PLAYER_WEEK_KEYS } from './types';

const KEYS = new Set<string>(PLAYER_WEEK_KEYS);
const Pos = z.enum(['QB', 'RB', 'WR', 'TE']);

const PlayerWeek = z.object({ id: z.string(), week: z.number().int().min(1), team: z.string(), gp: z.number(), opp: z.string().optional() })
  .catchall(z.number())
  .superRefine((row, ctx) => {
    for (const k of Object.keys(row)) {
      if (k === 'id' || k === 'week' || k === 'team' || k === 'gp' || k === 'opp' || KEYS.has(k)) continue;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown PlayerWeek key ${k}` });
    }
  });

const DbPlayer = z.object({
  id: z.string(), gsisId: z.string().nullable(), pfrId: z.string().nullable(), name: z.string(), pos: Pos,
  teams: z.array(z.string()), birthDate: z.string().nullable(), yearsExp: z.number().nullable(),
  draft: z.object({ year: z.number(), round: z.number(), pick: z.number() }).nullable(),
  college: z.string().nullable(), height: z.number().nullable(), weight: z.number().nullable(),
});

const TeamWeek = z.object({
  team: z.string(), week: z.number(), opp: z.string(), offSnaps: z.number(), passAtt: z.number(), rushAtt: z.number(),
  dropbacks: z.number(), rzLooks: z.number(), airYds: z.number(), passPlays: z.number().nullable(),
});

const Coef = z.array(z.number()).nullable();

export const PlayerDbSchema = z.object({
  year: z.number(), throughWeek: z.number(), routesReal: z.boolean(), builtAt: z.string(),
  players: z.record(DbPlayer),
  teamWeeks: z.array(TeamWeek),
  xfp: z.object({ QB: Coef, RB: Coef, WR: Coef, TE: Coef }),
  rows: z.array(PlayerWeek),
});
```

`packages/core/src/playerdb/index.ts`:
```ts
export * from './types';
export * from './schema';
```
Append to `packages/core/src/index.ts`, before the `export * from './schema';` line:
```ts
export * from './playerdb';
```

`packages/core/src/sleeper/types.ts`, replace the `SleeperWeekStat` interface:
```ts
export interface SleeperWeekStat {
  player_id: string;
  team: string | null;
  opponent?: string | null;
  /** the player block Sleeper embeds in each weekly row */
  player?: { position?: string | null; first_name?: string; last_name?: string; years_exp?: number | null } | null;
  stats?: Record<string, number> | null;
}
```

- [ ] **Step 6: Run the test and the core typecheck**

Run: `cd packages/core && npx vitest run test/playerdb/schema.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/playerdb packages/core/src/index.ts packages/core/src/sleeper/types.ts packages/core/test/playerdb/schema.test.ts
git commit -m "Player db: types and schema

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: CSV parser and field helpers

**Files:**
- Create: `packages/core/src/playerdb/csv.ts`, `packages/core/src/playerdb/fields.ts`
- Modify: `packages/core/src/playerdb/index.ts`
- Test: `packages/core/test/playerdb/csv.test.ts`, `packages/core/test/playerdb/fields.test.ts`

**Interfaces:**
- Produces: `parseCsv(text: string): Generator<Record<string, string>>`; `numberOf(s: string | undefined): number | null`; `round3(n: number): number`; `mapFields(row, fields): Partial<Record<PlayerWeekKey, number>>`; `indexWeekly(rows, idCol, fields, accept): Map<string, Partial<Record<PlayerWeekKey, number>>>` keyed `${id}|${week}`.

- [ ] **Step 1: Failing tests**

`packages/core/test/playerdb/csv.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../src/playerdb/csv';

const rows = (t: string) => [...parseCsv(t)];

describe('parseCsv', () => {
  it('maps every data line onto the header', () => {
    expect(rows('a,b\n1,2\n3,4\n')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
  it('handles quoted commas, doubled quotes and embedded newlines', () => {
    expect(rows('name,note\n"Smith, Jr.","said ""hi""\nthere"\n')).toEqual([{ name: 'Smith, Jr.', note: 'said "hi"\nthere' }]);
  });
  it('accepts CRLF, a BOM, a missing final newline and skips blank lines', () => {
    expect(rows('﻿a,b\r\n1,2\r\n\r\n3,4')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
  it('pads short lines with empty strings', () => {
    expect(rows('a,b,c\n1,2\n')).toEqual([{ a: '1', b: '2', c: '' }]);
  });
});
```

`packages/core/test/playerdb/fields.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { indexWeekly, mapFields, numberOf, round3 } from '../../src/playerdb/fields';

describe('numberOf', () => {
  it('parses numbers and treats blanks, NA and junk as null', () => {
    expect(numberOf('3.5')).toBe(3.5);
    expect(numberOf('0')).toBe(0);
    expect(numberOf('')).toBeNull();
    expect(numberOf('NA')).toBeNull();
    expect(numberOf('abc')).toBeNull();
    expect(numberOf(undefined)).toBeNull();
  });
});

describe('mapFields', () => {
  it('renames present numeric columns and drops the rest, rounding to 3 dp', () => {
    expect(mapFields({ passing_epa: '4.75172', pacr: '', junk: '9' }, { passing_epa: 'pa_epa', pacr: 'pa_pacr' })).toEqual({ pa_epa: 4.752 });
    expect(round3(0.2222222)).toBe(0.222);
  });
});

describe('indexWeekly', () => {
  it('keys rows by id and week, skipping rejected rows and merging duplicates', () => {
    const rows = [
      { pid: 'x', week: '1', t: 'REG', v: '1' },
      { pid: 'x', week: '1', t: 'REG', w: '2' },
      { pid: 'x', week: '2', t: 'POST', v: '3' },
      { pid: '', week: '2', t: 'REG', v: '3' },
    ];
    const m = indexWeekly(rows, 'pid', { v: 'pa_att', w: 'pa_cmp' }, (r) => r.t === 'REG');
    expect([...m.keys()]).toEqual(['x|1']);
    expect(m.get('x|1')).toEqual({ pa_att: 1, pa_cmp: 2 });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/core && npx vitest run test/playerdb/csv.test.ts test/playerdb/fields.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1 (modules missing).

- [ ] **Step 3: Implement**

`packages/core/src/playerdb/csv.ts`:
```ts
const COMMA = 44, LF = 10, CR = 13, QUOTE = 34;

/** RFC 4180 rows as objects keyed by the header line. Quoted fields may hold commas, newlines and doubled quotes. */
export function* parseCsv(text: string): Generator<Record<string, string>> {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let header: string[] | null = null;
  while (i < n) {
    const fields: string[] = [];
    let endOfLine = false;
    while (!endOfLine) {
      let field = '';
      if (text.charCodeAt(i) === QUOTE) {
        i++;
        let start = i;
        while (i < n) {
          if (text.charCodeAt(i) === QUOTE) {
            field += text.slice(start, i);
            if (text.charCodeAt(i + 1) === QUOTE) { field += '"'; i += 2; start = i; continue; }
            i++;
            break;
          }
          i++;
        }
        if (i >= n && start < i) field += text.slice(start, i);
      }
      const start = i;
      let c = 0;
      while (i < n && (c = text.charCodeAt(i)) !== COMMA && c !== LF && c !== CR) i++;
      field += text.slice(start, i);
      fields.push(field);
      if (i >= n) endOfLine = true;
      else if (c === COMMA) i++;
      else { if (c === CR) i++; if (text.charCodeAt(i) === LF) i++; endOfLine = true; }
    }
    if (fields.length === 1 && fields[0] === '') continue;
    if (!header) { header = fields; continue; }
    const row: Record<string, string> = {};
    for (let k = 0; k < header.length; k++) row[header[k]] = fields[k] ?? '';
    yield row;
  }
}
```

`packages/core/src/playerdb/fields.ts`:
```ts
import type { PlayerWeekKey } from './types';

export type FieldMap = Readonly<Record<string, PlayerWeekKey>>;
export type WeekFields = Partial<Record<PlayerWeekKey, number>>;

export const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** A CSV cell as a number; blank, NA and unparsable cells are null. */
export function numberOf(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (t === '' || t === 'NA' || t === 'NaN' || t === 'NULL') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Rename the numeric columns in `fields`; absent or blank columns are left out. */
export function mapFields(row: Record<string, string>, fields: FieldMap): WeekFields {
  const out: WeekFields = {};
  for (const [col, key] of Object.entries(fields)) {
    const v = numberOf(row[col]);
    if (v !== null) out[key] = round3(v);
  }
  return out;
}

export const weekKey = (id: string, week: number | string): string => `${id}|${week}`;

/** Index weekly CSV rows by `${idCol}|${week}`, keeping rows `accept` allows; duplicate keys merge, later values winning. */
export function indexWeekly(rows: Iterable<Record<string, string>>, idCol: string, fields: FieldMap, accept: (row: Record<string, string>) => boolean): Map<string, WeekFields> {
  const out = new Map<string, WeekFields>();
  for (const row of rows) {
    const id = row[idCol];
    const week = numberOf(row.week);
    if (!id || week === null || week < 1 || week > 18 || !accept(row)) continue;
    const key = weekKey(id, week);
    out.set(key, { ...(out.get(key) ?? {}), ...mapFields(row, fields) });
  }
  return out;
}
```
Append to `packages/core/src/playerdb/index.ts`:
```ts
export * from './csv';
export * from './fields';
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/core && npx vitest run test/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb
git commit -m "Player db: CSV parser and field helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Id crosswalk

**Files:**
- Create: `packages/core/src/playerdb/crosswalk.ts`
- Modify: `packages/core/src/playerdb/index.ts`
- Test: `packages/core/test/playerdb/crosswalk.test.ts`

**Interfaces:**
- Produces: `normalizeName(name): string`, `normalizeTeam(team): string`, `NameHint { name: string; pos: string; team: string | null }`, `Crosswalk { gsisOf(sleeperId, hint): string | null; pfrOf(sleeperId, hint): string | null }`, `buildCrosswalk(ids, nflPlayers, snaps): Crosswalk` where the three arguments are iterables of parsed CSV rows from `db_playerids.csv`, `players.csv` and `snap_counts_{year}.csv`.

- [ ] **Step 1: Failing test**

`packages/core/test/playerdb/crosswalk.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildCrosswalk, normalizeName, normalizeTeam } from '../../src/playerdb/crosswalk';

const ids = [
  { sleeper_id: '12514', gsis_id: '00-0040129', pfr_id: 'EgbuEm01', name: 'Emeka Egbuka', position: 'WR', team: 'TBB' },
  { sleeper_id: '4034', gsis_id: '00-0033280', pfr_id: 'NA', name: 'Christian McCaffrey', position: 'RB', team: 'SFO' },
  { sleeper_id: 'NA', gsis_id: '00-0099999', pfr_id: 'NoboNo01', name: 'Nobody', position: 'QB', team: 'FA' },
];
const nflPlayers = [
  { gsis_id: '00-0033280', display_name: 'Christian McCaffrey', position: 'RB', latest_team: 'SF' },
  { gsis_id: '00-0012345', display_name: 'Odell Beckham Jr.', position: 'WR', latest_team: 'LA' },
  { gsis_id: '00-0055555', display_name: 'Mike Williams', position: 'WR', latest_team: 'LAC' },
  { gsis_id: '00-0066666', display_name: 'Mike Williams', position: 'WR', latest_team: 'NYJ' },
];
const snaps = [
  { pfr_player_id: 'McCaCh01', player: 'Christian McCaffrey', position: 'RB', team: 'SF' },
  { pfr_player_id: 'BeckOd01', player: 'Odell Beckham', position: 'WR', team: 'LA' },
];

describe('normalize', () => {
  it('strips punctuation, suffixes and case; maps nflverse team codes to Sleeper', () => {
    expect(normalizeName("Odell Beckham Jr.")).toBe('odell beckham');
    expect(normalizeName('A.J. Brown')).toBe('aj brown');
    expect(normalizeName('Kenneth Walker III')).toBe('kenneth walker');
    expect(normalizeTeam('LA')).toBe('LAR');
    expect(normalizeTeam('TBB')).toBe('TB');
    expect(normalizeTeam('KC')).toBe('KC');
  });
});

describe('buildCrosswalk', () => {
  const cw = buildCrosswalk(ids, nflPlayers, snaps);
  it('uses the id file first', () => {
    expect(cw.gsisOf('12514', { name: 'x', pos: 'WR', team: null })).toBe('00-0040129');
    expect(cw.pfrOf('12514', { name: 'x', pos: 'WR', team: null })).toBe('EgbuEm01');
  });
  it('falls back to name, position and team when an id is NA or the player is missing', () => {
    expect(cw.pfrOf('4034', { name: 'Christian McCaffrey', pos: 'RB', team: 'SF' })).toBe('McCaCh01');
    expect(cw.gsisOf('999', { name: 'Odell Beckham Jr.', pos: 'WR', team: 'LAR' })).toBe('00-0012345');
    expect(cw.pfrOf('999', { name: 'Odell Beckham Jr.', pos: 'WR', team: 'LAR' })).toBe('BeckOd01');
  });
  it('falls back to name and position only when that pair is unique', () => {
    expect(cw.gsisOf('999', { name: 'Odell Beckham', pos: 'WR', team: 'MIA' })).toBe('00-0012345');
    expect(cw.gsisOf('999', { name: 'Mike Williams', pos: 'WR', team: 'MIA' })).toBeNull();
  });
  it('returns null for a miss', () => {
    expect(cw.gsisOf('999', { name: 'Unknown Guy', pos: 'TE', team: 'KC' })).toBeNull();
    expect(cw.pfrOf('999', { name: 'Unknown Guy', pos: 'TE', team: 'KC' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/core && npx vitest run test/playerdb/crosswalk.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/core/src/playerdb/crosswalk.ts`:
```ts
/** nflverse / DynastyProcess team codes that differ from Sleeper's. */
export const TEAM_ALIASES: Readonly<Record<string, string>> = {
  LA: 'LAR', STL: 'LAR', SD: 'LAC', OAK: 'LV', LVR: 'LV', JAC: 'JAX', WSH: 'WAS',
  TBB: 'TB', GBP: 'GB', KCC: 'KC', NEP: 'NE', NOS: 'NO', SFO: 'SF',
};
export const normalizeTeam = (team: string): string => TEAM_ALIASES[team] ?? team;

const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)$/;
/** Lower-case, no punctuation, no generational suffix, single spaces. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.'’"\-]/g, '').replace(/\s+/g, ' ').trim().replace(SUFFIX, '').trim();
}

export interface NameHint { name: string; pos: string; team: string | null }
export interface Crosswalk {
  gsisOf(sleeperId: string, hint: NameHint): string | null;
  pfrOf(sleeperId: string, hint: NameHint): string | null;
}

const present = (v: string | undefined): string | null => (v && v !== 'NA' ? v : null);

/** name|pos|team → id, and name|pos → id when unique (null when ambiguous). */
class NameIndex {
  private byTeam = new Map<string, string>();
  private byPos = new Map<string, string | null>();
  add(name: string, pos: string, team: string, id: string) {
    const n = normalizeName(name);
    this.byTeam.set(`${n}|${pos}|${normalizeTeam(team)}`, id);
    const k = `${n}|${pos}`;
    if (!this.byPos.has(k)) this.byPos.set(k, id);
    else if (this.byPos.get(k) !== id) this.byPos.set(k, null);
  }
  find(hint: NameHint): string | null {
    const n = normalizeName(hint.name);
    if (hint.team) {
      const hit = this.byTeam.get(`${n}|${hint.pos}|${normalizeTeam(hint.team)}`);
      if (hit) return hit;
    }
    return this.byPos.get(`${n}|${hint.pos}`) ?? null;
  }
}

export function buildCrosswalk(
  ids: Iterable<Record<string, string>>,
  nflPlayers: Iterable<Record<string, string>>,
  snaps: Iterable<Record<string, string>>,
): Crosswalk {
  const gsis = new Map<string, string>();
  const pfr = new Map<string, string>();
  for (const r of ids) {
    const sid = present(r.sleeper_id);
    if (!sid) continue;
    const g = present(r.gsis_id); if (g) gsis.set(sid, g);
    const p = present(r.pfr_id); if (p) pfr.set(sid, p);
  }
  const gsisNames = new NameIndex();
  for (const r of nflPlayers) if (r.gsis_id && r.display_name) gsisNames.add(r.display_name, r.position ?? '', r.latest_team ?? '', r.gsis_id);
  const pfrNames = new NameIndex();
  for (const r of snaps) if (r.pfr_player_id && r.player) pfrNames.add(r.player, r.position ?? '', r.team ?? '', r.pfr_player_id);
  return {
    gsisOf: (sid, hint) => gsis.get(sid) ?? gsisNames.find(hint),
    pfrOf: (sid, hint) => pfr.get(sid) ?? pfrNames.find(hint),
  };
}
```
Append `export * from './crosswalk';` to `packages/core/src/playerdb/index.ts`.

- [ ] **Step 4: Run the tests**

Run: `cd packages/core && npx vitest run test/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb
git commit -m "Player db: Sleeper to gsis and PFR id crosswalk

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Sleeper source adapter

**Files:**
- Create: `packages/core/src/playerdb/sources/sleeper.ts`
- Modify: `packages/core/src/playerdb/index.ts`
- Test: `packages/core/test/playerdb/sleeper.test.ts`

**Interfaces:**
- Consumes: `SleeperWeekStat` (Task 1), `scoreStats` from `../scoring`.
- Produces: `SLEEPER_FIELDS: FieldMap`-like map from Sleeper stat keys to `PlayerWeekKey`; `sleeperRow(raw, week, scoring, projection): PlayerWeek | null`; `positionOf(raw, directoryPos, overrides): DbPos | null`.

- [ ] **Step 1: Failing test**

`packages/core/test/playerdb/sleeper.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { positionOf, sleeperRow } from '../../src/playerdb/sources/sleeper';

const scoring = { rush_yd: 0.1, rec: 1, rec_yd: 0.1, rush_td: 6 };
const raw = {
  player_id: '12514', team: 'TB', opponent: 'DAL', player: { position: 'WR' },
  stats: { gp: 1, gs: 1, off_snp: 64, tm_off_snp: 72, rec: 6, rec_tgt: 9, rec_yd: 38, rec_air_yd: 22, rec_yar: 16, rec_drop: 1, rec_rz_tgt: 2, rec_20_29: 1, rush_att: 1, rush_yd: 14, rush_td: 1, pts_ppr: 17.2, pos_rank_ppr: 17 },
};

describe('sleeperRow', () => {
  it('maps the counting stats, scores league points and the projection, and buckets 20+ catches', () => {
    const row = sleeperRow(raw, 5, scoring, { rec: 4, rec_yd: 50 });
    expect(row).toMatchObject({ id: '12514', week: 5, team: 'TB', opp: 'DAL', gp: 1, gs: 1, snaps: 64, teamSnaps: 72, re_rec: 6, re_tgt: 9, re_yds: 38, re_air: 22, re_yac: 16, re_drop: 1, re_rz: 2, re_20: 1, ru_att: 1, ru_yds: 14, ru_td: 1, ppr: 17.2, posRankPpr: 17 });
    expect(row!.pts).toBeCloseTo(6 + 3.8 + 1.4 + 6, 2);
    expect(row!.proj).toBeCloseTo(9, 2);
    expect(row).not.toHaveProperty('pa_att');
    expect(row).not.toHaveProperty('routes');
  });
  it('omits the projection when there is none and leaves re_20 out when no bucket is present', () => {
    const row = sleeperRow({ player_id: '1', team: 'KC', stats: { gp: 1, pass_att: 30 } }, 1, scoring, undefined)!;
    expect(row).not.toHaveProperty('proj');
    expect(row).not.toHaveProperty('re_20');
    expect(row.pa_att).toBe(30);
  });
  it('returns null for a player who did not play or has no team', () => {
    expect(sleeperRow({ player_id: '1', team: 'KC', stats: { gp: 0, pass_att: 1 } }, 1, scoring, undefined)).toBeNull();
    expect(sleeperRow({ player_id: '1', team: null, stats: { gp: 1 } }, 1, scoring, undefined)).toBeNull();
    expect(sleeperRow({ player_id: '1', team: 'KC', stats: null }, 1, scoring, undefined)).toBeNull();
  });
});

describe('positionOf', () => {
  it('prefers the override, then the row, then the directory, and rejects non-table positions', () => {
    expect(positionOf({ player_id: '12530', team: 'JAX', player: { position: 'DB' }, stats: {} }, 'DB', { '12530': 'WR' })).toBe('WR');
    expect(positionOf({ player_id: '1', team: 'KC', player: { position: 'TE' }, stats: {} }, 'WR', {})).toBe('TE');
    expect(positionOf({ player_id: '1', team: 'KC', stats: {} }, 'RB', {})).toBe('RB');
    expect(positionOf({ player_id: '1', team: 'KC', player: { position: 'K' }, stats: {} }, null, {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/core && npx vitest run test/playerdb/sleeper.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/core/src/playerdb/sources/sleeper.ts`:
```ts
import type { SleeperWeekStat } from '../../sleeper/types';
import { scoreStats } from '../../scoring';
import { isDbPos, type DbPos, type PlayerWeek, type PlayerWeekKey } from '../types';

/** Sleeper weekly stat key → PlayerWeek key. Keys Sleeper lacks for a player are simply absent. */
export const SLEEPER_FIELDS: Readonly<Record<string, PlayerWeekKey>> = {
  gs: 'gs', off_snp: 'snaps', tm_off_snp: 'teamSnaps', pts_ppr: 'ppr', pos_rank_ppr: 'posRankPpr',
  pass_att: 'pa_att', pass_cmp: 'pa_cmp', pass_yd: 'pa_yds', pass_td: 'pa_td', pass_int: 'pa_int', pass_sack: 'pa_sack', pass_sack_yds: 'pa_sackYds',
  pass_air_yd: 'pa_air', pass_fd: 'pa_fd', pass_rz_att: 'pa_rz', pass_cmp_40p: 'pa_cmp40', pass_rtg: 'pa_rtg', pass_2pt: 'pa_2pt',
  rush_att: 'ru_att', rush_yd: 'ru_yds', rush_td: 'ru_td', rush_fd: 'ru_fd', rush_rz_att: 'ru_rz', rush_btkl: 'ru_bt', rush_yac: 'ru_yac',
  rush_tkl_loss: 'ru_tfl', rush_40p: 'ru_40', rush_2pt: 'ru_2pt',
  rec_tgt: 're_tgt', rec: 're_rec', rec_yd: 're_yds', rec_td: 're_td', rec_fd: 're_fd', rec_air_yd: 're_air', rec_yar: 're_yac', rec_drop: 're_drop',
  rec_rz_tgt: 're_rz', rec_40p: 're_40', rec_2pt: 're_2pt',
  fum: 'fum', fum_lost: 'fumLost',
};

const REC_20_BUCKETS = ['rec_20_29', 'rec_30_39', 'rec_40p'];

/** One PlayerWeek from a Sleeper weekly row; null when he did not play or has no team. */
export function sleeperRow(raw: SleeperWeekStat, week: number, scoring: Record<string, number>, projection: Record<string, number> | undefined): PlayerWeek | null {
  const stats = raw.stats;
  if (!stats || (stats.gp ?? 0) < 1 || !raw.team) return null;
  const row: PlayerWeek = { id: raw.player_id, week, team: raw.team, gp: stats.gp };
  if (raw.opponent) row.opp = raw.opponent;
  for (const [k, key] of Object.entries(SLEEPER_FIELDS)) {
    const v = stats[k];
    if (typeof v === 'number') row[key] = v;
  }
  if (REC_20_BUCKETS.some((k) => k in stats)) row.re_20 = REC_20_BUCKETS.reduce((s, k) => s + (stats[k] ?? 0), 0);
  row.pts = scoreStats(stats, scoring);
  if (projection) row.proj = scoreStats(projection, scoring);
  return row;
}

/** The table position: league override, then the weekly row, then the Sleeper directory; null outside QB/RB/WR/TE. */
export function positionOf(raw: SleeperWeekStat, directoryPos: string | null, overrides: Readonly<Record<string, string>>): DbPos | null {
  const pos = overrides[raw.player_id] ?? raw.player?.position ?? directoryPos;
  return isDbPos(pos) ? pos : null;
}
```
Append `export * from './sources/sleeper';` to `packages/core/src/playerdb/index.ts`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd packages/core && npx vitest run test/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb
git commit -m "Player db: Sleeper weekly row adapter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: nflverse, Next Gen Stats, PFR, snap count and player-meta adapters

**Files:**
- Create: `packages/core/src/playerdb/sources/nflverse.ts`, `sources/ngs.ts`, `sources/pfr.ts`, `sources/players.ts`
- Create fixtures: `packages/core/test/fixtures/playerdb/stats_player_week.csv`, `ngs_receiving.csv`, `advstats_week_rec.csv`, `snap_counts.csv`, `players.csv` (3–5 real rows each, cut from the live files with `head -1` plus a few `grep`-ed rows; keep every column)
- Modify: `packages/core/src/playerdb/index.ts`
- Test: `packages/core/test/playerdb/sources.test.ts`

**Interfaces:**
- Consumes: `indexWeekly`, `numberOf`, `parseCsv` (Task 2).
- Produces: `nflverseWeekly(rows): Map<string, WeekFields>` keyed `${gsis}|${week}`; `ngsWeekly(rows, year, fields): Map<string, WeekFields>` keyed `${gsis}|${week}`; `pfrWeekly(rows, fields): Map<string, WeekFields>` keyed `${pfr}|${week}`; `nflPlayerMeta(rows): Map<string, PlayerMeta>` keyed by gsis where `PlayerMeta = Pick<DbPlayer, 'birthDate' | 'draft' | 'college' | 'height' | 'weight'>`; the field-map constants.

- [ ] **Step 1: Cut the fixtures**

From the files already downloaded in the brainstorming scratchpad, or fresh with `curl -sL`, write each fixture as the header line plus rows for Emeka Egbuka (gsis `00-0040129`, pfr `EgbuEm01`) weeks 1–2 of 2026 and one row for a different player, e.g.:

```bash
F=packages/core/test/fixtures/playerdb; mkdir -p $F
S=/private/tmp/claude-501/-Users-mathiasfoster-repos/f8dae2d5-733b-4498-925e-0fd74f75d3c5/scratchpad/dl
( head -1 $S/spw2026.csv; grep -E '^00-0040129,.*,2026,(1|2),REG' $S/spw2026.csv; grep -m1 -E '^00-0033280,.*,2026,1,REG' $S/spw2026.csv ) > $F/stats_player_week.csv
( head -1 $S/ngs_rec.csv; grep -E '^2026,REG,(0|1|2),Emeka Egbuka' $S/ngs_rec.csv; grep -m1 -E '^2025,REG,1,Emeka Egbuka' $S/ngs_rec.csv ) > $F/ngs_receiving.csv
( head -1 $S/pfr_rec.csv; grep -E '2026,(1|2),REG,TB,.*Emeka Egbuka' $S/pfr_rec.csv ) > $F/advstats_week_rec.csv
( head -1 $S/snaps2026.csv; grep -E ',2026,REG,(1|2),Emeka Egbuka,' $S/snaps2026.csv; grep -m1 'POST' $S/snaps2026.csv || true ) > $F/snap_counts.csv
( head -1 $S/players.csv; grep -m1 '^00-0040129,' $S/players.csv; grep -m1 '^00-0033280,' $S/players.csv ) > $F/players.csv
wc -l $F/*.csv
```
If the scratchpad is gone, download with the URLs in the spec's source table. Open each fixture and note the real values you will assert on (targets, EPA, separation, drops, offense_snaps, birth_date); write them into the test below in place of the example numbers.

- [ ] **Step 2: Failing test**

`packages/core/test/playerdb/sources.test.ts` (numbers below are from the 2026-10-17 files; replace with the fixture's actual values):
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../../src/playerdb/csv';
import { nflverseWeekly } from '../../src/playerdb/sources/nflverse';
import { NGS_RECEIVING_FIELDS, ngsWeekly } from '../../src/playerdb/sources/ngs';
import { PFR_REC_FIELDS, SNAP_FIELDS, pfrWeekly } from '../../src/playerdb/sources/pfr';
import { nflPlayerMeta } from '../../src/playerdb/sources/players';

const fixture = (name: string) => [...parseCsv(readFileSync(new URL(`../fixtures/playerdb/${name}`, import.meta.url), 'utf8'))];
const EGBUKA = '00-0040129';

describe('nflverseWeekly', () => {
  it('keys regular-season rows by gsis and week with the advanced fields', () => {
    const m = nflverseWeekly(fixture('stats_player_week.csv'));
    const wk1 = m.get(`${EGBUKA}|1`)!;
    expect(wk1.re_epa).toBeCloseTo(4.752, 3);
    expect(wk1.re_tgtShare).toBeCloseTo(0.222, 3);
    expect(wk1.re_wopr).toBeCloseTo(0.745, 3);
    expect(wk1.re_yac).toBe(20);
    expect(wk1.re_fd).toBe(3);
    expect(wk1).not.toHaveProperty('pa_epa'); // blank for a receiver
    expect(m.has(`${EGBUKA}|2`)).toBe(true);
  });
});

describe('ngsWeekly', () => {
  it('keeps only the asked season, drops the week-0 season total', () => {
    const m = ngsWeekly(fixture('ngs_receiving.csv'), 2026, NGS_RECEIVING_FIELDS);
    expect(m.has(`${EGBUKA}|0`)).toBe(false);
    const wk1 = m.get(`${EGBUKA}|1`)!;
    expect(wk1.re_sep).toBeCloseTo(2.405, 3);
    expect(wk1.re_cush).toBeCloseTo(7.44, 2);
    expect(wk1.re_yacoe).toBeCloseTo(1.176, 3);
    expect([...m.keys()].every((k) => k.startsWith(EGBUKA))).toBe(true);
    expect(ngsWeekly(fixture('ngs_receiving.csv'), 2025, NGS_RECEIVING_FIELDS).size).toBe(1);
  });
});

describe('pfrWeekly', () => {
  it('keys by pfr id and week, skipping the postseason', () => {
    const rec = pfrWeekly(fixture('advstats_week_rec.csv'), PFR_REC_FIELDS);
    expect(rec.get('EgbuEm01|1')).toMatchObject({ re_dropPfr: 0, re_rtg: 110.4 });
    const snaps = pfrWeekly(fixture('snap_counts.csv'), SNAP_FIELDS);
    expect(snaps.get('EgbuEm01|1')?.snaps).toBeGreaterThan(0);
    expect([...snaps.keys()].some((k) => k.endsWith('|19'))).toBe(false);
  });
});

describe('nflPlayerMeta', () => {
  it('reads birth date, draft slot, college and measurements', () => {
    const m = nflPlayerMeta(fixture('players.csv'));
    expect(m.get(EGBUKA)).toEqual({ birthDate: '2002-10-14', draft: { year: 2025, round: 1, pick: 19 }, college: 'Ohio State', height: 73, weight: 205 });
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd packages/core && npx vitest run test/playerdb/sources.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 4: Implement**

`packages/core/src/playerdb/sources/nflverse.ts`:
```ts
import { indexWeekly, type FieldMap, type WeekFields } from '../fields';

/** stats_player_week columns → PlayerWeek keys. Keys Sleeper also provides (sacks, first downs, YAC) only fill gaps: the build merges base-first. */
export const NFLVERSE_FIELDS: FieldMap = {
  passing_epa: 'pa_epa', passing_cpoe: 'pa_cpoe', pacr: 'pa_pacr', passing_yards_after_catch: 'pa_yac', sacks_suffered: 'pa_sack', passing_first_downs: 'pa_fd',
  rushing_epa: 'ru_epa', rushing_10: 'ru_10', rushing_20: 'ru_20', rushing_first_downs: 'ru_fd',
  receiving_epa: 're_epa', receiving_yards_after_catch: 're_yac', racr: 're_racr', target_share: 're_tgtShare', air_yards_share: 're_ayShare', wopr: 're_wopr', receiving_first_downs: 're_fd',
};

export function nflverseWeekly(rows: Iterable<Record<string, string>>): Map<string, WeekFields> {
  return indexWeekly(rows, 'player_id', NFLVERSE_FIELDS, (r) => r.season_type === 'REG');
}
```

`packages/core/src/playerdb/sources/ngs.ts`:
```ts
import { indexWeekly, type FieldMap, type WeekFields } from '../fields';

export const NGS_RECEIVING_FIELDS: FieldMap = {
  avg_cushion: 're_cush', avg_separation: 're_sep', avg_intended_air_yards: 're_iay', percent_share_of_intended_air_yards: 're_iayShare',
  avg_expected_yac: 're_xyac', avg_yac_above_expectation: 're_yacoe',
};
export const NGS_RUSHING_FIELDS: FieldMap = {
  efficiency: 'ru_eff', percent_attempts_gte_eight_defenders: 'ru_box8', avg_time_to_los: 'ru_tlos',
  expected_rush_yards: 'ru_xyds', rush_yards_over_expected: 'ru_ryoe', rush_yards_over_expected_per_att: 'ru_ryoeAtt',
};
export const NGS_PASSING_FIELDS: FieldMap = {
  avg_time_to_throw: 'pa_ttt', avg_intended_air_yards: 'pa_iay', avg_completed_air_yards: 'pa_cay', aggressiveness: 'pa_aggr',
  avg_air_yards_to_sticks: 'pa_ays', expected_completion_percentage: 'pa_xcmp', completion_percentage_above_expectation: 'pa_cpoe',
};

/** The all-seasons NGS file narrowed to one regular season; week 0 (season totals) is dropped by indexWeekly's week ≥ 1 rule. */
export function ngsWeekly(rows: Iterable<Record<string, string>>, year: number, fields: FieldMap): Map<string, WeekFields> {
  return indexWeekly(rows, 'player_gsis_id', fields, (r) => r.season === String(year) && r.season_type === 'REG');
}
```

`packages/core/src/playerdb/sources/pfr.ts`:
```ts
import { indexWeekly, type FieldMap, type WeekFields } from '../fields';

export const PFR_REC_FIELDS: FieldMap = { receiving_broken_tackles: 're_bt', receiving_drop: 're_dropPfr', receiving_drop_pct: 're_dropPct', receiving_int: 're_int', receiving_rat: 're_rtg' };
export const PFR_RUSH_FIELDS: FieldMap = { rushing_yards_before_contact: 'ru_ybc', rushing_yards_after_contact: 'ru_yacPfr', rushing_broken_tackles: 'ru_bt' };
export const PFR_PASS_FIELDS: FieldMap = {
  passing_bad_throws: 'pa_bad', passing_bad_throw_pct: 'pa_badPct', times_pressured: 'pa_press', times_pressured_pct: 'pa_pressPct',
  times_blitzed: 'pa_blitz', times_hurried: 'pa_hurry', times_hit: 'pa_hit', passing_drops: 'pa_drops',
};
/** snap_counts: offensive snaps, used only where Sleeper's off_snp is missing. */
export const SNAP_FIELDS: FieldMap = { offense_snaps: 'snaps' };

export function pfrWeekly(rows: Iterable<Record<string, string>>, fields: FieldMap): Map<string, WeekFields> {
  return indexWeekly(rows, 'pfr_player_id', fields, (r) => r.game_type === 'REG');
}
```

`packages/core/src/playerdb/sources/players.ts`:
```ts
import { numberOf } from '../fields';
import type { DbPlayer } from '../types';

export type PlayerMeta = Pick<DbPlayer, 'birthDate' | 'draft' | 'college' | 'height' | 'weight'>;

/** nflverse players.csv → per-gsis biography fields. */
export function nflPlayerMeta(rows: Iterable<Record<string, string>>): Map<string, PlayerMeta> {
  const out = new Map<string, PlayerMeta>();
  for (const r of rows) {
    if (!r.gsis_id) continue;
    const year = numberOf(r.draft_year), round = numberOf(r.draft_round), pick = numberOf(r.draft_pick);
    out.set(r.gsis_id, {
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(r.birth_date ?? '') ? r.birth_date : null,
      draft: year !== null && round !== null && pick !== null ? { year, round, pick } : null,
      college: r.college_name || null,
      height: numberOf(r.height),
      weight: numberOf(r.weight),
    });
  }
  return out;
}
```
Append to `packages/core/src/playerdb/index.ts`:
```ts
export * from './sources/nflverse';
export * from './sources/ngs';
export * from './sources/pfr';
export * from './sources/players';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `cd packages/core && npx vitest run test/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0. If an asserted number differs from the fixture, fix the test's number (the fixture is the truth), not the adapter.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb packages/core/test/fixtures/playerdb
git commit -m "Player db: nflverse, NGS, PFR, snap and biography adapters

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Participation routes, team weeks and the route estimate

**Files:**
- Create: `packages/core/src/playerdb/sources/participation.ts`, `packages/core/src/playerdb/teamWeeks.ts`, `packages/core/src/playerdb/derive.ts`
- Modify: `packages/core/src/playerdb/index.ts`
- Test: `packages/core/test/playerdb/participation.test.ts`, `packages/core/test/playerdb/teamWeeks.test.ts`

**Interfaces:**
- Produces: `weekOfGame(gameId): number`; `Participation { routes: Map<string, number>; passPlays: Map<string, number> }` keyed `${gsis}|${week}` and `${team}|${week}`; `countRoutes(rows, routeRunners: ReadonlySet<string>): Participation`; `teamWeekKey(team, week): string`; `teamWeeksOf(sleeperWeeks: Map<number, SleeperWeekStat[]>, passPlays: Map<string, number> | null): TeamWeek[]`; `routesEstimate(row: PlayerWeek, tw: TeamWeek | undefined): number | null`.

- [ ] **Step 1: Failing tests**

`packages/core/test/playerdb/participation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { countRoutes, weekOfGame } from '../../src/playerdb/sources/participation';

const play = (game: string, team: string, pass: boolean, players: string[]) =>
  ({ nflverse_game_id: game, possession_team: team, time_to_throw: pass ? '2.5' : '', offense_players: players.join(';') });

describe('countRoutes', () => {
  it('counts pass plays per team-week and routes per route runner on the field', () => {
    const rows = [
      play('2025_01_TB_CIN', 'TB', true, ['00-A', '00-B', '00-Q']),
      play('2025_01_TB_CIN', 'TB', false, ['00-A', '00-B']),
      play('2025_01_TB_CIN', 'TB', true, ['00-A']),
      play('2025_01_TB_CIN', 'CIN', true, ['00-C']),
      play('2025_19_TB_CIN', 'TB', true, ['00-A']),
    ];
    const p = countRoutes(rows, new Set(['00-A', '00-B', '00-C']));
    expect(p.passPlays.get('TB|1')).toBe(2);
    expect(p.passPlays.get('CIN|1')).toBe(1);
    expect(p.passPlays.has('TB|19')).toBe(false);
    expect(p.routes.get('00-A|1')).toBe(2);
    expect(p.routes.get('00-B|1')).toBe(1);
    expect(p.routes.has('00-Q|1')).toBe(false);
  });
  it('reads the week from the game id', () => {
    expect(weekOfGame('2025_09_ARI_DAL')).toBe(9);
    expect(weekOfGame('2025_18_ARI_DAL')).toBe(18);
  });
});
```

`packages/core/test/playerdb/teamWeeks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { teamWeekKey, teamWeeksOf } from '../../src/playerdb/teamWeeks';
import { routesEstimate } from '../../src/playerdb/derive';

const r = (id: string, team: string | null, stats: Record<string, number>, opponent = 'X') => ({ player_id: id, team, opponent, stats });

describe('teamWeeksOf', () => {
  it('sums each team-week from every position and takes the max team snaps', () => {
    const weeks = new Map([[1, [
      r('q', 'SF', { tm_off_snp: 60, pass_att: 30, pass_sack: 2, pass_air_yd: 250, pass_rz_att: 4 }, 'LAR'),
      r('rb', 'SF', { tm_off_snp: 60, rush_att: 20, rush_rz_att: 3, rec_tgt: 4, rec_rz_tgt: 1 }, 'LAR'),
      r('ol', 'SF', { tm_off_snp: 60 }, 'LAR'),
      r('k', 'SF', { fgm: 2 }, 'LAR'),
      r('rb2', 'LAR', { tm_off_snp: 55, rush_att: 10 }, 'SF'),
      r('fa', null, { rush_att: 99 }),
    ]]]);
    const tws = teamWeeksOf(weeks, new Map([['SF|1', 33]]));
    expect(tws).toEqual([
      { team: 'LAR', week: 1, opp: 'SF', offSnaps: 55, passAtt: 0, rushAtt: 10, dropbacks: 0, rzLooks: 0, airYds: 0, passPlays: null },
      { team: 'SF', week: 1, opp: 'LAR', offSnaps: 60, passAtt: 30, rushAtt: 20, dropbacks: 32, rzLooks: 4, airYds: 250, passPlays: 33 },
    ]);
    expect(teamWeekKey('SF', 1)).toBe('SF|1');
  });
});

describe('routesEstimate', () => {
  const tw = { team: 'SF', week: 1, opp: 'LAR', offSnaps: 60, passAtt: 30, rushAtt: 20, dropbacks: 32, rzLooks: 4, airYds: 250, passPlays: null };
  it('scales team dropbacks by snap share', () => {
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45, teamSnaps: 60 }, tw)).toBe(24);
  });
  it('is null without snaps, team snaps or a team week', () => {
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45 }, tw)).toBeNull();
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45, teamSnaps: 0 }, tw)).toBeNull();
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45, teamSnaps: 60 }, undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/core && npx vitest run test/playerdb/participation.test.ts test/playerdb/teamWeeks.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/core/src/playerdb/sources/participation.ts`:
```ts
import { weekKey } from '../fields';
import { teamWeekKey } from '../teamWeeks';

export interface Participation {
  /** `${gsis}|${week}` → routes run (pass plays he was on the field for) */
  routes: Map<string, number>;
  /** `${team}|${week}` → pass plays */
  passPlays: Map<string, number>;
}

/** nflverse game ids look like 2025_09_ARI_DAL. */
export const weekOfGame = (gameId: string): number => Number(gameId.split('_')[1]);

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** A pass play is a participation row with a time to throw. Only `routeRunners` (RB/WR/TE gsis ids) accrue routes. Weeks past 18 are ignored. */
export function countRoutes(rows: Iterable<Record<string, string>>, routeRunners: ReadonlySet<string>): Participation {
  const routes = new Map<string, number>();
  const passPlays = new Map<string, number>();
  for (const r of rows) {
    const week = weekOfGame(r.nflverse_game_id ?? '');
    if (!(week >= 1 && week <= 18) || !r.time_to_throw || !r.possession_team) continue;
    bump(passPlays, teamWeekKey(r.possession_team, week));
    for (const gsis of (r.offense_players ?? '').split(';')) if (routeRunners.has(gsis)) bump(routes, weekKey(gsis, week));
  }
  return { routes, passPlays };
}
```

`packages/core/src/playerdb/teamWeeks.ts`:
```ts
import type { SleeperWeekStat } from '../sleeper/types';
import type { TeamWeek } from './types';

export const teamWeekKey = (team: string, week: number): string => `${team}|${week}`;

/** One TeamWeek per team per week, summed from every player's Sleeper row (all positions). Sorted by week then team. */
export function teamWeeksOf(sleeperWeeks: Map<number, SleeperWeekStat[]>, passPlays: Map<string, number> | null): TeamWeek[] {
  const out: TeamWeek[] = [];
  for (const [week, rows] of [...sleeperWeeks.entries()].sort((a, b) => a[0] - b[0])) {
    const byTeam = new Map<string, TeamWeek>();
    for (const r of rows) {
      if (!r.team) continue;
      const s = r.stats ?? {};
      let tw = byTeam.get(r.team);
      if (!tw) {
        tw = { team: r.team, week, opp: r.opponent ?? '', offSnaps: 0, passAtt: 0, rushAtt: 0, dropbacks: 0, rzLooks: 0, airYds: 0, passPlays: passPlays?.get(teamWeekKey(r.team, week)) ?? null };
        byTeam.set(r.team, tw);
      }
      if (!tw.opp && r.opponent) tw.opp = r.opponent;
      tw.offSnaps = Math.max(tw.offSnaps, s.tm_off_snp ?? 0);
      tw.passAtt += s.pass_att ?? 0;
      tw.rushAtt += s.rush_att ?? 0;
      tw.dropbacks += (s.pass_att ?? 0) + (s.pass_sack ?? 0);
      tw.rzLooks += (s.rush_rz_att ?? 0) + (s.rec_rz_tgt ?? 0);
      tw.airYds += s.pass_air_yd ?? 0;
    }
    out.push(...[...byTeam.values()].sort((a, b) => (a.team < b.team ? -1 : 1)));
  }
  return out;
}
```

`packages/core/src/playerdb/derive.ts`:
```ts
import type { PlayerWeek, TeamWeek } from './types';

/** Routes guessed from snap share × team dropbacks, for seasons without participation data. */
export function routesEstimate(row: PlayerWeek, tw: TeamWeek | undefined): number | null {
  if (!tw || !row.snaps || !row.teamSnaps) return null;
  return Math.round((row.snaps / row.teamSnaps) * tw.dropbacks);
}
```
Append to `packages/core/src/playerdb/index.ts`:
```ts
export * from './sources/participation';
export * from './teamWeeks';
export * from './derive';
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd packages/core && npx vitest run test/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb
git commit -m "Player db: routes from participation, team weeks, route estimate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Least squares in core and the xFP model

**Files:**
- Create: `packages/core/src/playerdb/ols.ts`, `packages/core/src/playerdb/xfp.ts`
- Modify: `packages/core/src/playerdb/index.ts`, `packages/web/src/lib/xfp.ts`
- Test: `packages/core/test/playerdb/xfp.test.ts`; existing `packages/web/src/lib/xfp.test.ts` must still pass

**Interfaces:**
- Produces: `solve(A: number[][], b: number[]): number[] | null`; `fitOls(X: number[][], y: number[]): number[] | null` (column 0 is the intercept; columns with no variance get coefficient 0); `XFP_FEATURES: Record<DbPos, readonly PlayerWeekKey[]>`; `XFP_MIN_ROWS = 50`; `xfpFeatures(pos, row): number[]`; `fitXfpCoefficients(rows: PlayerWeek[], posOf: (id: string) => DbPos | null): XfpCoefficients`; `predictXfp(coef: number[] | null, pos: DbPos, row: PlayerWeek): number | null`.

- [ ] **Step 1: Failing test**

`packages/core/test/playerdb/xfp.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fitOls } from '../../src/playerdb/ols';
import { XFP_FEATURES, XFP_MIN_ROWS, fitXfpCoefficients, predictXfp, xfpFeatures } from '../../src/playerdb/xfp';
import type { PlayerWeek } from '../../src/playerdb/types';

describe('fitOls', () => {
  it('recovers known coefficients and zeroes a constant column', () => {
    const X: number[][] = [], y: number[] = [];
    for (let i = 0; i < 30; i++) { const a = i % 7, b = (i * 3) % 11; X.push([1, a, b, 5]); y.push(2 + 0.5 * a - 1.25 * b); }
    const beta = fitOls(X, y)!;
    expect(beta[0]).toBeCloseTo(2, 6);
    expect(beta[1]).toBeCloseTo(0.5, 6);
    expect(beta[2]).toBeCloseTo(-1.25, 6);
    expect(beta[3]).toBe(0);
  });
});

describe('xfp', () => {
  const posOf = (id: string) => (id.startsWith('q') ? 'QB' : id.startsWith('w') ? 'WR' : null) as 'QB' | 'WR' | null;
  const rows: PlayerWeek[] = [];
  for (let i = 0; i < 60; i++) {
    const tgt = i % 12, air = (i * 7) % 90, rz = i % 3;
    rows.push({ id: `w${i}`, week: 1 + (i % 4), team: 'X', gp: 1, re_tgt: tgt, re_air: air, re_rz: rz, pts: 1 + 1.5 * tgt + 0.05 * air + 2 * rz });
  }
  rows.push({ id: 'q1', week: 1, team: 'X', gp: 1, pa_att: 30, pts: 20 });
  rows.push({ id: 'w999', week: 1, team: 'X', gp: 1, pts: 0 }); // no opportunity: excluded from the fit

  it('fits one model per position with enough rows and leaves the others null', () => {
    const coef = fitXfpCoefficients(rows, posOf);
    expect(coef.QB).toBeNull();
    expect(coef.RB).toBeNull();
    const wr = coef.WR!;
    expect(wr).toHaveLength(1 + XFP_FEATURES.WR.length);
    expect(wr[0]).toBeCloseTo(1, 4);
    expect(wr[1]).toBeCloseTo(1.5, 4);
    expect(wr[2]).toBeCloseTo(0.05, 4);
    expect(wr[3]).toBeCloseTo(2, 4);
    expect(wr[4]).toBe(0);
    expect(XFP_MIN_ROWS).toBe(50);
  });
  it('predicts from the features, treating missing ones as 0, and returns null without a model', () => {
    const coef = fitXfpCoefficients(rows, posOf);
    expect(predictXfp(coef.WR, 'WR', { id: 'w', week: 1, team: 'X', gp: 1, re_tgt: 4, re_air: 40, re_rz: 1 })).toBeCloseTo(1 + 6 + 2 + 2, 2);
    expect(predictXfp(coef.WR, 'WR', { id: 'w', week: 1, team: 'X', gp: 1 })).toBeCloseTo(1, 2);
    expect(predictXfp(null, 'QB', { id: 'q', week: 1, team: 'X', gp: 1 })).toBeNull();
    expect(xfpFeatures('QB', { id: 'q', week: 1, team: 'X', gp: 1, pa_att: 30, ru_att: 5 })).toEqual([1, 30, 0, 0, 5, 0]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/core && npx vitest run test/playerdb/xfp.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/core/src/playerdb/ols.ts`:
```ts
/** Solve A·x = b by Gaussian elimination with partial pivoting; null when singular. */
export function solve(A: number[][], b: number[]): number[] | null {
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

/** Ordinary least squares. Column 0 is the intercept; columns with no variance are dropped and get coefficient 0. Null when singular or empty. */
export function fitOls(X: number[][], y: number[]): number[] | null {
  if (X.length === 0 || X.length !== y.length) return null;
  const k = X[0].length;
  const active = [0, ...Array.from({ length: k - 1 }, (_, j) => j + 1).filter((j) => X.some((row) => row[j] !== X[0][j]))];
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
```

`packages/core/src/playerdb/xfp.ts`:
```ts
import { fitOls } from './ols';
import { round2 } from '../scoring';
import { DB_POSITIONS, type DbPos, type PlayerWeek, type PlayerWeekKey, type XfpCoefficients } from './types';

/** Opportunity features per position; the model is pts = c0 + Σ ci · feature_i. */
export const XFP_FEATURES: Readonly<Record<DbPos, readonly PlayerWeekKey[]>> = {
  QB: ['pa_att', 'pa_air', 'pa_rz', 'ru_att', 'ru_rz'],
  RB: ['re_tgt', 're_air', 're_rz', 'ru_att', 'ru_rz'],
  WR: ['re_tgt', 're_air', 're_rz', 'ru_att', 'ru_rz'],
  TE: ['re_tgt', 're_air', 're_rz', 'ru_att', 'ru_rz'],
};
export const XFP_MIN_ROWS = 50;

export const xfpFeatures = (pos: DbPos, row: PlayerWeek): number[] => [1, ...XFP_FEATURES[pos].map((k) => row[k] ?? 0)];

/** One OLS fit per position over played rows with at least one opportunity; null under XFP_MIN_ROWS rows. */
export function fitXfpCoefficients(rows: PlayerWeek[], posOf: (id: string) => DbPos | null): XfpCoefficients {
  const out = { QB: null, RB: null, WR: null, TE: null } as XfpCoefficients;
  for (const pos of DB_POSITIONS) {
    const X: number[][] = [], y: number[] = [];
    for (const r of rows) {
      if (r.gp < 1 || r.pts === undefined || posOf(r.id) !== pos) continue;
      const f = xfpFeatures(pos, r);
      if (f.slice(1).every((v) => v === 0)) continue;
      X.push(f); y.push(r.pts);
    }
    out[pos] = X.length >= XFP_MIN_ROWS ? fitOls(X, y) : null;
  }
  return out;
}

export function predictXfp(coef: number[] | null, pos: DbPos, row: PlayerWeek): number | null {
  if (!coef) return null;
  const f = xfpFeatures(pos, row);
  return round2(coef.reduce((s, c, j) => s + c * f[j], 0));
}
```
Append to `packages/core/src/playerdb/index.ts`:
```ts
export * from './ols';
export * from './xfp';
```

Replace the body of `packages/web/src/lib/xfp.ts` so it reuses `fitOls` (public API unchanged):
```ts
import { fitOls } from '@fantasy-dash/core';
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

export function fitXfp(lines: PlayerLine[]): XfpModel {
  const coef: Record<string, number[] | null> = {};
  for (const pos of XFP_POSITIONS) {
    const rows = lines.filter((l) => l.played && l.position === pos);
    coef[pos] = rows.length < MIN_FIT_LINES ? null : fitOls(rows.map(features), rows.map((l) => l.points));
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

- [ ] **Step 4: Run both packages' tests and typechecks**

Run: `pnpm test > /tmp/claude-501/t.log 2>&1; echo "exit $?"; pnpm typecheck > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0; `packages/web/src/lib/xfp.test.ts` unchanged and green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb packages/web/src/lib/xfp.ts
git commit -m "Player db: least squares in core, per-position xFP model

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `buildPlayerDb`

**Files:**
- Create: `packages/core/src/playerdb/build.ts`
- Modify: `packages/core/src/playerdb/index.ts`
- Test: `packages/core/test/playerdb/build.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces:
```ts
export interface PlayerDbInput {
  year: number; throughWeek: number; builtAt: string;
  scoring: Record<string, number>;
  positionOverrides: Readonly<Record<string, string>>;
  /** week → every NFL player's Sleeper row */
  sleeperWeeks: Map<number, SleeperWeekStat[]>;
  /** week → Sleeper projection stat map */
  projections: Map<number, StatMap>;
  /** the Sleeper player directory, for names, positions, birth dates and experience */
  directory: Record<string, SleeperPlayer>;
  crosswalk: Crosswalk;
  /** `${gsis}|${week}` → fields from the nflverse weekly file and the three NGS files, already merged */
  byGsis: Map<string, WeekFields>;
  /** `${pfr}|${week}` → fields from the three PFR files and the snap counts, already merged */
  byPfr: Map<string, WeekFields>;
  nflPlayers: Map<string, PlayerMeta>;
  participation: Participation | null;
}
export function mergeInto(base: PlayerWeek, extra: WeekFields | undefined): void; // base wins
export function buildPlayerDb(input: PlayerDbInput): PlayerDb;
```

- [ ] **Step 1: Failing test**

`packages/core/test/playerdb/build.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildPlayerDb, mergeInto, type PlayerDbInput } from '../../src/playerdb/build';
import { PlayerDbSchema } from '../../src/playerdb/schema';
import type { SleeperWeekStat } from '../../src/sleeper/types';

const scoring = { rec: 1, rec_yd: 0.1, rush_yd: 0.1, pass_yd: 0.04 };
const wr = (id: string, team: string, week: number, tgt: number, extra: Record<string, number> = {}): SleeperWeekStat =>
  ({ player_id: id, team, opponent: 'OPP', player: { position: 'WR' }, stats: { gp: 1, rec_tgt: tgt, rec: tgt - 1, rec_yd: tgt * 10, rec_air_yd: tgt * 8, rec_yar: 5, off_snp: 50, tm_off_snp: 60, ...extra } });
const qb = (id: string, team: string): SleeperWeekStat => ({ player_id: id, team, opponent: 'OPP', player: { position: 'QB' }, stats: { gp: 1, pass_att: 30, pass_sack: 2, pass_air_yd: 240, pass_yd: 250 } });

function input(over: Partial<PlayerDbInput> = {}): PlayerDbInput {
  const sleeperWeeks = new Map<number, SleeperWeekStat[]>();
  for (let w = 1; w <= 2; w++) sleeperWeeks.set(w, [
    wr('w1', 'TB', w, 9), wr('w2', 'TB', w, 4), wr('dup', 'TB', w, 1), qb('q1', 'TB'),
    { player_id: 'k1', team: 'TB', player: { position: 'K' }, stats: { gp: 1, fgm: 2 } },
    { player_id: 'inj', team: 'TB', player: { position: 'WR' }, stats: { gp: 0 } },
  ]);
  return {
    year: 2026, throughWeek: 2, builtAt: '2026-10-17T00:00:00.000Z', scoring, positionOverrides: {},
    sleeperWeeks,
    projections: new Map([[1, { w1: { rec: 5, rec_yd: 60 } }]]),
    directory: {
      w1: { player_id: 'w1', full_name: 'Wide One', position: 'WR', team: 'TB', years_exp: 1, birth_date: '2002-10-14' },
      w2: { player_id: 'w2', full_name: 'Wide Two', position: 'WR', team: 'TB' },
      dup: { player_id: 'dup', full_name: 'No Map', position: 'WR', team: 'TB' },
      q1: { player_id: 'q1', full_name: 'Quarter One', position: 'QB', team: 'TB' },
    },
    crosswalk: { gsisOf: (id) => ({ w1: '00-1', w2: '00-2', q1: '00-q' }[id] ?? null), pfrOf: (id) => ({ w1: 'WideOn01' }[id] ?? null) },
    byGsis: new Map([['00-1|1', { re_epa: 2.5, re_yac: 99, re_sep: 3.1 }], ['00-q|1', { pa_epa: 4, pa_sack: 7 }]]),
    byPfr: new Map([['WideOn01|1', { re_bt: 1, re_rtg: 100 }]]),
    nflPlayers: new Map([['00-1', { birthDate: '2002-10-14', draft: { year: 2025, round: 1, pick: 19 }, college: 'Ohio State', height: 73, weight: 205 }]]),
    participation: null,
    ...over,
  };
}

describe('mergeInto', () => {
  it('fills only the keys the base lacks', () => {
    const base = { id: 'a', week: 1, team: 'X', gp: 1, re_yac: 5 } as const;
    const row = { ...base };
    mergeInto(row, { re_yac: 99, re_epa: 1 });
    expect(row).toEqual({ ...base, re_epa: 1 });
    mergeInto(row, undefined);
    expect(row).toEqual({ ...base, re_epa: 1 });
  });
});

describe('buildPlayerDb', () => {
  const db = buildPlayerDb(input());
  it('keeps only played QB/RB/WR/TE rows, sorted by week then id, and validates', () => {
    expect(PlayerDbSchema.parse(db)).toEqual(db);
    expect(db.rows.map((r) => `${r.week}:${r.id}`)).toEqual(['1:dup', '1:q1', '1:w1', '1:w2', '2:dup', '2:q1', '2:w1', '2:w2']);
    expect(db.throughWeek).toBe(2);
    expect(db.routesReal).toBe(false);
  });
  it('joins nflverse and PFR fields through the crosswalk, base winning', () => {
    const w1 = db.rows.find((r) => r.id === 'w1' && r.week === 1)!;
    expect(w1).toMatchObject({ re_epa: 2.5, re_sep: 3.1, re_bt: 1, re_rtg: 100, re_yac: 5, proj: 11 });
    const q1 = db.rows.find((r) => r.id === 'q1' && r.week === 1)!;
    expect(q1).toMatchObject({ pa_epa: 4, pa_sack: 2 });
    const dup = db.rows.find((r) => r.id === 'dup' && r.week === 1)!;
    expect(dup).not.toHaveProperty('re_epa');
    expect(db.players.dup.gsisId).toBeNull();
  });
  it('estimates routes from snap share when there is no participation data', () => {
    const w1 = db.rows.find((r) => r.id === 'w1' && r.week === 1)!;
    expect(w1.routesEst).toBe(Math.round((50 / 60) * 32));
    expect(w1).not.toHaveProperty('routes');
    expect(db.teamWeeks.find((t) => t.team === 'TB' && t.week === 1)).toMatchObject({ passAtt: 30, dropbacks: 32, airYds: 240, passPlays: null });
  });
  it('uses real routes and pass plays when participation is given', () => {
    const real = buildPlayerDb(input({ participation: { routes: new Map([['00-1|1', 31]]), passPlays: new Map([['TB|1', 35]]) } }));
    expect(real.routesReal).toBe(true);
    const w1 = real.rows.find((r) => r.id === 'w1' && r.week === 1)!;
    expect(w1.routes).toBe(31);
    expect(w1).not.toHaveProperty('routesEst');
    expect(real.teamWeeks.find((t) => t.team === 'TB' && t.week === 1)!.passPlays).toBe(35);
  });
  it('builds player meta from the directory, the crosswalk and the nflverse biography', () => {
    expect(db.players.w1).toEqual({ id: 'w1', gsisId: '00-1', pfrId: 'WideOn01', name: 'Wide One', pos: 'WR', teams: ['TB'], birthDate: '2002-10-14', yearsExp: 1, draft: { year: 2025, round: 1, pick: 19 }, college: 'Ohio State', height: 73, weight: 205 });
    expect(db.players.w2).toMatchObject({ gsisId: '00-2', pfrId: null, draft: null, birthDate: null });
    expect(db.players).not.toHaveProperty('k1');
    expect(db.players).not.toHaveProperty('inj');
  });
  it('leaves xfp off when a position has too few rows', () => {
    expect(db.xfp).toEqual({ QB: null, RB: null, WR: null, TE: null });
    expect(db.rows[0]).not.toHaveProperty('xfp');
  });
  it('applies position overrides', () => {
    const o = buildPlayerDb(input({ positionOverrides: { k1: 'TE' } }));
    expect(o.players.k1.pos).toBe('TE');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/core && npx vitest run test/playerdb/build.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/core/src/playerdb/build.ts`:
```ts
import type { SleeperPlayer, SleeperWeekStat, StatMap } from '../sleeper/types';
import type { Crosswalk } from './crosswalk';
import { routesEstimate } from './derive';
import { weekKey, type WeekFields } from './fields';
import type { Participation } from './sources/participation';
import type { PlayerMeta } from './sources/players';
import { positionOf, sleeperRow } from './sources/sleeper';
import { teamWeekKey, teamWeeksOf } from './teamWeeks';
import { fitXfpCoefficients, predictXfp } from './xfp';
import type { DbPlayer, DbPos, PlayerDb, PlayerWeek, PlayerWeekKey, TeamWeek } from './types';

export interface PlayerDbInput {
  year: number; throughWeek: number; builtAt: string;
  scoring: Record<string, number>;
  positionOverrides: Readonly<Record<string, string>>;
  /** week → every NFL player's Sleeper row */
  sleeperWeeks: Map<number, SleeperWeekStat[]>;
  /** week → Sleeper projection stat map */
  projections: Map<number, StatMap>;
  /** the Sleeper player directory, for names, positions, birth dates and experience */
  directory: Record<string, SleeperPlayer>;
  crosswalk: Crosswalk;
  /** `${gsis}|${week}` → fields from the nflverse weekly file and the three NGS files, already merged */
  byGsis: Map<string, WeekFields>;
  /** `${pfr}|${week}` → fields from the three PFR files and the snap counts, already merged */
  byPfr: Map<string, WeekFields>;
  nflPlayers: Map<string, PlayerMeta>;
  participation: Participation | null;
}

/** Copy `extra` fields the base row does not already have. Sleeper's numbers always win. */
export function mergeInto(base: PlayerWeek, extra: WeekFields | undefined): void {
  if (!extra) return;
  for (const [k, v] of Object.entries(extra) as [PlayerWeekKey, number][]) if (base[k] === undefined) base[k] = v;
}

const nameOf = (p: SleeperPlayer | undefined, raw: SleeperWeekStat): string => {
  const fromRow = `${raw.player?.first_name ?? ''} ${raw.player?.last_name ?? ''}`.trim();
  return p?.full_name ?? (fromRow || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim()) || raw.player_id;
};

export function buildPlayerDb(input: PlayerDbInput): PlayerDb {
  const { crosswalk, directory, participation } = input;
  const teamWeeks = teamWeeksOf(input.sleeperWeeks, participation?.passPlays ?? null);
  const teamWeekOf = new Map<string, TeamWeek>(teamWeeks.map((t) => [teamWeekKey(t.team, t.week), t]));
  const players: Record<string, DbPlayer> = {};
  const posOf = new Map<string, DbPos>();
  const rows: PlayerWeek[] = [];

  for (const [week, raws] of [...input.sleeperWeeks.entries()].sort((a, b) => a[0] - b[0])) {
    if (week < 1 || week > input.throughWeek) continue;
    const proj = input.projections.get(week) ?? {};
    for (const raw of raws.sort((a, b) => (a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0))) {
      const dir = directory[raw.player_id];
      const pos = positionOf(raw, dir?.position ?? null, input.positionOverrides);
      if (!pos) continue;
      const row = sleeperRow(raw, week, input.scoring, proj[raw.player_id]);
      if (!row) continue;
      let p = players[raw.player_id];
      if (!p) {
        const hint = { name: nameOf(dir, raw), pos, team: raw.team };
        const gsisId = crosswalk.gsisOf(raw.player_id, hint);
        const meta = gsisId ? input.nflPlayers.get(gsisId) : undefined;
        p = {
          id: raw.player_id, gsisId, pfrId: crosswalk.pfrOf(raw.player_id, hint), name: hint.name, pos, teams: [],
          birthDate: meta?.birthDate ?? (/^\d{4}-\d{2}-\d{2}$/.test(dir?.birth_date ?? '') ? dir!.birth_date! : null),
          yearsExp: typeof dir?.years_exp === 'number' ? dir.years_exp : null,
          draft: meta?.draft ?? null, college: meta?.college ?? null, height: meta?.height ?? null, weight: meta?.weight ?? null,
        };
        players[raw.player_id] = p;
        posOf.set(raw.player_id, pos);
      }
      if (!p.teams.includes(row.team)) p.teams.push(row.team);
      if (p.gsisId) mergeInto(row, input.byGsis.get(weekKey(p.gsisId, week)));
      if (p.pfrId) mergeInto(row, input.byPfr.get(weekKey(p.pfrId, week)));
      if (participation) {
        if (p.gsisId && pos !== 'QB') { const r = participation.routes.get(weekKey(p.gsisId, week)); if (r !== undefined) row.routes = r; }
      } else if (pos !== 'QB') {
        const est = routesEstimate(row, teamWeekOf.get(teamWeekKey(row.team, week)));
        if (est !== null) row.routesEst = est;
      }
      rows.push(row);
    }
  }

  const xfp = fitXfpCoefficients(rows, (id) => posOf.get(id) ?? null);
  for (const r of rows) {
    const v = predictXfp(xfp[posOf.get(r.id)!], posOf.get(r.id)!, r);
    if (v !== null) r.xfp = v;
  }
  rows.sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { year: input.year, throughWeek: input.throughWeek, routesReal: participation !== null, builtAt: input.builtAt, players, teamWeeks, xfp, rows };
}
```
Append `export * from './build';` to `packages/core/src/playerdb/index.ts`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd packages/core && npx vitest run test/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/playerdb packages/core/test/playerdb
git commit -m "Player db: buildPlayerDb joins every source into one season file

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The sync script, workflow step and the first data files

**Files:**
- Create: `scripts/syncPlayers.ts`
- Modify: `package.json` (scripts), `.github/workflows/sync.yml`, `README.md` (one paragraph under the sync section)
- Data: `data/playerdb/2023.json` … `2026.json`

**Interfaces:**
- Consumes: `buildPlayerDb`, `PlayerDbSchema`, `parseCsv`, `buildCrosswalk`, `nflverseWeekly`, `ngsWeekly` + the three NGS field maps, `pfrWeekly` + the PFR/snap field maps, `nflPlayerMeta`, `countRoutes`, `SleeperClient`, `leagueConfig`.
- Produces: `pnpm sync:players [--full] [--season YYYY] [--dry-run]`.

- [ ] **Step 1: Script**

`scripts/syncPlayers.ts`:
```ts
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  SleeperClient, PlayerDbSchema, buildPlayerDb, buildCrosswalk, countRoutes, nflPlayerMeta, nflverseWeekly, ngsWeekly, parseCsv, pfrWeekly,
  NGS_PASSING_FIELDS, NGS_RECEIVING_FIELDS, NGS_RUSHING_FIELDS, PFR_PASS_FIELDS, PFR_REC_FIELDS, PFR_RUSH_FIELDS, SNAP_FIELDS,
  type PlayerDbInput, type SleeperLeague, type SleeperWeekStat, type StatMap, type WeekFields,
} from '@fantasy-dash/core';
import { leagueConfig } from '../league.config';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data', 'playerdb');
const args = process.argv.slice(2);
const full = args.includes('--full');
const dryRun = args.includes('--dry-run');
const onlySeason = args.includes('--season') ? Number(args[args.indexOf('--season') + 1]) : null;
const log = (msg: string) => console.log(`[sync:players] ${msg}`);

const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download';
const URLS = {
  ids: 'https://github.com/dynastyprocess/data/raw/master/files/db_playerids.csv',
  players: `${NFLVERSE}/players/players.csv`,
  ngsReceiving: `${NFLVERSE}/nextgen_stats/ngs_receiving.csv.gz`,
  ngsRushing: `${NFLVERSE}/nextgen_stats/ngs_rushing.csv.gz`,
  ngsPassing: `${NFLVERSE}/nextgen_stats/ngs_passing.csv.gz`,
  weekly: (y: number) => `${NFLVERSE}/stats_player/stats_player_week_${y}.csv`,
  pfrRec: (y: number) => `${NFLVERSE}/pfr_advstats/advstats_week_rec_${y}.csv`,
  pfrRush: (y: number) => `${NFLVERSE}/pfr_advstats/advstats_week_rush_${y}.csv`,
  pfrPass: (y: number) => `${NFLVERSE}/pfr_advstats/advstats_week_pass_${y}.csv`,
  snaps: (y: number) => `${NFLVERSE}/snap_counts/snap_counts_${y}.csv`,
  participation: (y: number) => `${NFLVERSE}/pbp_participation/pbp_participation_${y}.csv`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Download a text or gzipped-text file; null on 404; retried three times on other failures. */
async function fetchText(url: string): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const text = url.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
      log(`  fetched ${url.split('/download/')[1] ?? url} (${(buf.length / 1e6).toFixed(1)} MB)`);
      return text;
    } catch (err) {
      if (attempt >= 3) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}

const rowsOf = (text: string | null) => (text ? [...parseCsv(text)] : []);

/** Merge several `${id}|${week}` maps; earlier maps win on a shared key. */
function mergeMaps(...maps: Map<string, WeekFields>[]): Map<string, WeekFields> {
  const out = new Map<string, WeekFields>();
  for (const m of maps) for (const [k, v] of m) out.set(k, { ...v, ...(out.get(k) ?? {}) });
  return out;
}

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

interface Shared { crosswalkIds: Record<string, string>[]; nflPlayers: Record<string, string>[]; ngsRec: Record<string, string>[]; ngsRush: Record<string, string>[]; ngsPass: Record<string, string>[] }

async function buildSeason(client: SleeperClient, league: SleeperLeague, directory: PlayerDbInput['directory'], shared: Shared): Promise<ReturnType<typeof buildPlayerDb>> {
  const year = Number(league.season);
  const complete = league.status === 'complete';
  const throughWeek = complete ? 18 : Math.min(18, league.settings.last_scored_leg ?? 0);
  log(`${year}: ${complete ? 'finished' : `in season, through week ${throughWeek}`}`);

  const sleeperWeeks = new Map<number, SleeperWeekStat[]>();
  const projections = new Map<number, StatMap>();
  for (let week = 1; week <= throughWeek; week++) {
    const [rows, proj] = await Promise.all([client.getWeekStats(league.season, week), client.getProjections(league.season, week)]);
    if (!rows) { log(`WARNING: ${year} week ${week}: Sleeper weekly rows missing`); continue; }
    sleeperWeeks.set(week, rows);
    if (proj) projections.set(week, proj);
  }

  const snaps = rowsOf(await fetchText(URLS.snaps(year)));
  const crosswalk = buildCrosswalk(shared.crosswalkIds, shared.nflPlayers, snaps);
  const byGsis = mergeMaps(
    nflverseWeekly(rowsOf(await fetchText(URLS.weekly(year)))),
    ngsWeekly(shared.ngsRec, year, NGS_RECEIVING_FIELDS),
    ngsWeekly(shared.ngsRush, year, NGS_RUSHING_FIELDS),
    ngsWeekly(shared.ngsPass, year, NGS_PASSING_FIELDS),
  );
  const byPfr = mergeMaps(
    pfrWeekly(rowsOf(await fetchText(URLS.pfrRec(year))), PFR_REC_FIELDS),
    pfrWeekly(rowsOf(await fetchText(URLS.pfrRush(year))), PFR_RUSH_FIELDS),
    pfrWeekly(rowsOf(await fetchText(URLS.pfrPass(year))), PFR_PASS_FIELDS),
    pfrWeekly(snaps, SNAP_FIELDS),
  );

  let participation: PlayerDbInput['participation'] = null;
  if (complete) {
    const text = await fetchText(URLS.participation(year));
    if (text) {
      // Route runners: every RB/WR/TE gsis id the crosswalk can name, taken from the nflverse player list.
      const runners = new Set(shared.nflPlayers.filter((p) => ['RB', 'WR', 'TE'].includes(p.position)).map((p) => p.gsis_id));
      participation = countRoutes(parseCsv(text), runners);
      log(`  routes for ${participation.routes.size} player-weeks, pass plays for ${participation.passPlays.size} team-weeks`);
    } else {
      log(`  no participation file for ${year}; routes will be estimated`);
    }
  }

  const db = buildPlayerDb({
    year, throughWeek, builtAt: new Date().toISOString(), scoring: league.scoring_settings, positionOverrides: leagueConfig.positionOverrides,
    sleeperWeeks, projections, directory, crosswalk, byGsis, byPfr, nflPlayers: nflPlayerMeta(shared.nflPlayers), participation,
  });
  const unmapped = Object.values(db.players).filter((p) => !p.gsisId).length;
  log(`  ${db.rows.length} rows, ${Object.keys(db.players).length} players (${unmapped} without a gsis id), xfp fitted for ${Object.entries(db.xfp).filter(([, c]) => c).map(([p]) => p).join(' ') || 'nobody'}`);
  PlayerDbSchema.parse(db);
  return db;
}

async function main() {
  const client = new SleeperClient();
  const leagues = (await walkLeagueChain(client, leagueConfig.leagueId)).filter((l) => onlySeason === null || Number(l.season) === onlySeason);
  log(`Seasons: ${leagues.map((l) => l.season).join(', ')}`);

  const todo = leagues.filter((l) => {
    const finished = l.status === 'complete' && existsSync(path.join(OUT_DIR, `${l.season}.json`));
    if (finished && !full) log(`${l.season}: finished and already built, skipping (pass --full to rebuild)`);
    return !finished || full;
  });
  if (todo.length === 0) { log('Nothing to do'); return; }

  log('Fetching the Sleeper player directory');
  const directory = await client.getPlayers();
  if (!directory) throw new Error('Player directory unavailable');

  log('Fetching shared nflverse files');
  const shared: Shared = {
    crosswalkIds: rowsOf(await fetchText(URLS.ids)),
    nflPlayers: rowsOf(await fetchText(URLS.players)),
    ngsRec: rowsOf(await fetchText(URLS.ngsReceiving)),
    ngsRush: rowsOf(await fetchText(URLS.ngsRushing)),
    ngsPass: rowsOf(await fetchText(URLS.ngsPassing)),
  };
  if (shared.crosswalkIds.length === 0) throw new Error('Id crosswalk download was empty');

  const staging = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-playerdb-')) : path.join(ROOT, '.tmp', 'playerdb');
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const built: string[] = [];
  for (const league of todo) {
    const db = await buildSeason(client, league, directory, shared);
    const file = path.join(staging, `${db.year}.json`);
    await writeFile(file, JSON.stringify(db));
    built.push(file);
  }
  if (dryRun) { log(`Dry run complete. Output in ${staging}`); return; }
  await mkdir(OUT_DIR, { recursive: true });
  for (const file of built) await rename(file, path.join(OUT_DIR, path.basename(file)));
  await rm(staging, { recursive: true, force: true });
  log(`Wrote ${built.length} season file(s) to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('[sync:players] FAILED:', err);
  process.exit(1);
});
```

`package.json`, in `scripts`, after `"sync:dry"`:
```json
    "sync:players": "tsx scripts/syncPlayers.ts",
```

`.github/workflows/sync.yml`, after the "Sync Sleeper data" step:
```yaml
      - name: Sync player database
        if: github.event_name != 'push'
        continue-on-error: true
        run: pnpm sync:players
```

`README.md`: under the section that describes `pnpm sync`, add:
```markdown
`pnpm sync:players` builds `data/playerdb/{year}.json`: every NFL QB/RB/WR/TE's weekly line from Sleeper joined with nflverse (weekly advanced stats, Next Gen Stats, PFR advanced stats, snap counts, and for finished seasons the participation feed for routes run). Finished seasons are skipped once built; pass `--full` to rebuild them, `--season 2026` for one year, `--dry-run` to write to a temp dir. It runs after the Sleeper sync in the weekly workflow and may fail without blocking the league data.
```

- [ ] **Step 2: Typecheck the script, then dry-run one season**

Run: `pnpm typecheck:scripts > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"; pnpm sync:players --dry-run --season 2026 > /tmp/claude-501/dry.log 2>&1; echo "exit $?"; tail -8 /tmp/claude-501/dry.log`
Expected: tsc exit 0; the dry run exits 0 and logs rows/players counts with few unmapped players (under 30) and xfp fitted for all four positions.

Inspect the output with node (path from the log): confirm a known receiver's week has `re_tgt`, `re_epa`, `re_sep`, `snaps`, `teamSnaps`, `routesEst`, `xfp`, and that `players[id].draft` is filled.

- [ ] **Step 3: Build every season for real**

Run: `pnpm sync:players --full > /tmp/claude-501/full.log 2>&1; echo "exit $?"; grep -E "rows|routes for|FAILED" /tmp/claude-501/full.log; ls -la data/playerdb`
Expected: exit 0; 2023–2025 log "routes for N player-weeks" and `routesReal` true; 2026 estimated; four files, each under 3 MB.

Run it again without `--full`: `pnpm sync:players > /tmp/claude-501/again.log 2>&1; echo "exit $?"; grep -c skipping /tmp/claude-501/again.log`
Expected: exit 0 and three "skipping" lines (only 2026 rebuilt).

- [ ] **Step 4: Commit**

```bash
git add scripts/syncPlayers.ts package.json .github/workflows/sync.yml README.md data/playerdb
git commit -m "Player db: sync script, workflow step, first season files

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Web data layer: loader, fixtures, aggregation and column definitions

**Files:**
- Create: `packages/web/src/test/playerDbFixtures.ts`, `packages/web/src/lib/playerdb/aggregate.ts`, `packages/web/src/lib/playerdb/columns.ts`
- Modify: `packages/web/src/data/load.ts`
- Test: `packages/web/src/lib/playerdb/aggregate.test.ts`, `packages/web/src/lib/playerdb/columns.test.ts`

**Interfaces:**
- Consumes: `PlayerDb`, `PlayerWeek`, `PlayerWeekKey`, `TeamWeek`, `DbPos`, `teamWeekKey` from core.
- Produces:
  - `hasPlayerDb(year): boolean`, `loadPlayerDb(year): Promise<PlayerDb>` (rejects with a 404 `Response` when missing).
  - `Agg { id; team; games; weeks; s; w; t: TeamTotals; routes; routesEst; projDiff: number | null; posRank: number | null; rows }`, `TeamTotals { passAtt; rushAtt; dropbacks; rzLooks; airYds }`, `WEIGHTED`, `aggregateWeeks(db, rows, weeks): Agg`, `aggregate(db, from, to): Agg[]` (posRank set per position by Σ pts).
  - `Tab`, `TABS`, `tabPositions(tab): DbPos[]`, `Mode`, `Fmt`, `ColumnDef`, `COLUMNS`, `TAB_GROUPS`, `columnsFor(tab): ColumnDef[]`, `groupsFor(tab): { group: string; cols: ColumnDef[] }[]`, `columnValue(col, a, mode): number | null`, `belowMin(col, a): boolean`, `fmtValue(v, fmt, mode): string`, `DEFAULT_SORT = 'pts'`.
  - Fixture: `miniDb(): PlayerDb` with players `w1` (WR, TB then KC in week 3), `w2` (WR, TB), `r1` (RB, TB), `q1` (QB, TB), `t1` (TE, KC); weeks 1–3; `routesReal: false`; team weeks for TB and KC weeks 1–3.

- [ ] **Step 1: Fixture**

`packages/web/src/test/playerDbFixtures.ts`:
```ts
import type { DbPlayer, PlayerDb, PlayerWeek, TeamWeek } from '@fantasy-dash/core';

export const player = (id: string, pos: DbPlayer['pos'], teams: string[], name = id.toUpperCase()): DbPlayer =>
  ({ id, gsisId: `00-${id}`, pfrId: null, name, pos, teams, birthDate: null, yearsExp: 2, draft: null, college: null, height: null, weight: null });

export const row = (id: string, week: number, team: string, extra: Partial<PlayerWeek> = {}): PlayerWeek => ({ id, week, team, gp: 1, opp: 'OPP', ...extra });

export const teamWeek = (team: string, week: number, extra: Partial<TeamWeek> = {}): TeamWeek =>
  ({ team, week, opp: 'OPP', offSnaps: 60, passAtt: 30, rushAtt: 20, dropbacks: 32, rzLooks: 8, airYds: 240, passPlays: null, ...extra });

/** Five players over three weeks. w1 is traded from TB to KC for week 3; w2 misses week 3; w1 has NGS separation in weeks 1–2 only. */
export function miniDb(): PlayerDb {
  return {
    year: 2026, throughWeek: 3, routesReal: false, builtAt: '2026-10-17T00:00:00.000Z',
    players: { w1: player('w1', 'WR', ['TB', 'KC'], 'Wide One'), w2: player('w2', 'WR', ['TB'], 'Wide Two'), r1: player('r1', 'RB', ['TB'], 'Run One'), q1: player('q1', 'QB', ['TB'], 'Quarter One'), t1: player('t1', 'TE', ['KC'], 'Tight One') },
    teamWeeks: [
      teamWeek('TB', 1), teamWeek('TB', 2), teamWeek('TB', 3),
      teamWeek('KC', 1, { passAtt: 40, dropbacks: 42, airYds: 300 }), teamWeek('KC', 2, { passAtt: 40, dropbacks: 42, airYds: 300 }), teamWeek('KC', 3, { passAtt: 40, dropbacks: 42, airYds: 300 }),
    ],
    xfp: { QB: null, RB: null, WR: [1, 1.5, 0.05, 2, 0, 0], TE: null },
    rows: [
      row('q1', 1, 'TB', { pts: 20, pa_att: 30, pa_cmp: 20, pa_yds: 250, pa_td: 2, pa_int: 1, pa_sack: 2, pa_air: 240, pa_epa: 5, pa_cpoe: 3, snaps: 60, teamSnaps: 60 }),
      row('r1', 1, 'TB', { pts: 15, ru_att: 18, ru_yds: 90, ru_td: 1, ru_rz: 3, re_tgt: 3, re_rec: 2, re_yds: 15, snaps: 40, teamSnaps: 60, routesEst: 12 }),
      row('w1', 1, 'TB', { pts: 18.5, re_tgt: 9, re_rec: 6, re_yds: 85, re_td: 1, re_fd: 4, re_air: 100, re_yac: 20, re_rz: 2, re_sep: 3, re_drop: 1, re_epa: 4, proj: 14, snaps: 50, teamSnaps: 60, routesEst: 27, xfp: 16 }),
      row('w2', 1, 'TB', { pts: 6, re_tgt: 4, re_rec: 3, re_yds: 30, re_air: 40, snaps: 30, teamSnaps: 60, routesEst: 16, xfp: 8 }),
      row('t1', 1, 'KC', { pts: 9, re_tgt: 5, re_rec: 4, re_yds: 50, re_air: 30, snaps: 45, teamSnaps: 60, routesEst: 32 }),
      row('q1', 2, 'TB', { pts: 25, pa_att: 35, pa_cmp: 25, pa_yds: 300, pa_td: 3, pa_sack: 1, pa_air: 260, pa_epa: 8, pa_cpoe: 5, snaps: 60, teamSnaps: 60 }),
      row('r1', 2, 'TB', { pts: 8, ru_att: 12, ru_yds: 40, re_tgt: 1, re_rec: 1, re_yds: 5, snaps: 30, teamSnaps: 60, routesEst: 9 }),
      row('w1', 2, 'TB', { pts: 11.5, re_tgt: 7, re_rec: 4, re_yds: 55, re_fd: 2, re_air: 80, re_yac: 10, re_rz: 1, re_sep: 2, re_epa: 1, proj: 15, snaps: 55, teamSnaps: 60, routesEst: 29, xfp: 12 }),
      row('w2', 2, 'TB', { pts: 12, re_tgt: 6, re_rec: 5, re_yds: 70, re_air: 50, snaps: 40, teamSnaps: 60, routesEst: 21, xfp: 11 }),
      row('t1', 2, 'KC', { pts: 4, re_tgt: 2, re_rec: 2, re_yds: 20, re_air: 10, snaps: 40, teamSnaps: 60, routesEst: 28 }),
      row('q1', 3, 'TB', { pts: 10, pa_att: 25, pa_cmp: 15, pa_yds: 150, pa_int: 2, pa_sack: 3, pa_air: 200, pa_epa: -4, pa_cpoe: -2, snaps: 60, teamSnaps: 60 }),
      row('r1', 3, 'TB', { pts: 22, ru_att: 20, ru_yds: 120, ru_td: 2, ru_rz: 4, re_tgt: 2, re_rec: 2, re_yds: 20, snaps: 45, teamSnaps: 60, routesEst: 14 }),
      row('w1', 3, 'KC', { pts: 20, re_tgt: 10, re_rec: 7, re_yds: 110, re_td: 1, re_fd: 5, re_air: 120, re_yac: 30, re_rz: 2, re_epa: 6, proj: 13, snaps: 58, teamSnaps: 60, routesEst: 41, xfp: 19 }),
      row('t1', 3, 'KC', { pts: 14, re_tgt: 6, re_rec: 5, re_yds: 60, re_td: 1, re_air: 40, snaps: 50, teamSnaps: 60, routesEst: 35 }),
    ],
  };
}
```

- [ ] **Step 2: Failing tests**

`packages/web/src/lib/playerdb/aggregate.test.ts`:
```ts
import { aggregate, aggregateWeeks } from './aggregate';
import { miniDb } from '../../test/playerDbFixtures';

const byId = (from: number, to: number) => Object.fromEntries(aggregate(miniDb(), from, to).map((a) => [a.id, a]));

describe('aggregate', () => {
  it('sums counting stats over the range and counts played games and weeks', () => {
    const w1 = byId(1, 3).w1;
    expect(w1.games).toBe(3);
    expect(w1.weeks).toBe(3);
    expect(w1.s.re_tgt).toBe(26);
    expect(w1.s.re_yds).toBe(250);
    expect(w1.s.pts).toBe(50);
    expect(w1.routes).toBe(97);
    expect(w1.routesEst).toBe(true);
    expect(w1.team).toBe('KC');
  });
  it('narrows to the range, keeping the week count for minimums', () => {
    const w2 = byId(2, 3).w2;
    expect(w2.games).toBe(1);
    expect(w2.weeks).toBe(2);
    expect(w2.s.re_tgt).toBe(6);
    expect(byId(3, 3)).not.toHaveProperty('w2');
  });
  it('weights NGS averages by targets over the weeks that have them, never NaN', () => {
    const w1 = byId(1, 3).w1;
    expect(w1.w.re_sep).toBeCloseTo((3 * 9 + 2 * 7) / 16, 6);
    expect(byId(1, 3).w2.w.re_sep).toBeUndefined();
    expect(byId(3, 3).w1.w.re_sep).toBeUndefined();
  });
  it('sums team totals from the player\'s own team-weeks across a trade', () => {
    const w1 = byId(1, 3).w1;
    expect(w1.t.passAtt).toBe(30 + 30 + 40);
    expect(w1.t.dropbacks).toBe(32 + 32 + 42);
    expect(w1.t.airYds).toBe(240 + 240 + 300);
  });
  it('tracks projection difference over weeks with a projection and ranks by points within position', () => {
    const a = byId(1, 3);
    expect(a.w1.projDiff).toBeCloseTo((18.5 - 14) + (11.5 - 15) + (20 - 13), 6);
    expect(a.r1.projDiff).toBeNull();
    expect(a.w1.posRank).toBe(1);
    expect(a.w2.posRank).toBe(2);
    expect(a.r1.posRank).toBe(1);
    expect(a.t1.posRank).toBe(1);
  });
  it('uses real routes when the database has them', () => {
    const db = miniDb();
    db.routesReal = true;
    db.rows = db.rows.map((r) => ({ ...r, routes: r.routesEst === undefined ? undefined : r.routesEst + 1, routesEst: undefined }));
    const w1 = aggregate(db, 1, 3).find((a) => a.id === 'w1')!;
    expect(w1.routes).toBe(100);
    expect(w1.routesEst).toBe(false);
  });
  it('aggregateWeeks builds a one-week aggregate for a nested row', () => {
    const db = miniDb();
    const a = aggregateWeeks(db, [db.rows.find((r) => r.id === 'w1' && r.week === 2)!], 1);
    expect(a).toMatchObject({ id: 'w1', games: 1, weeks: 1, team: 'TB', routes: 29 });
    expect(a.s.re_tgt).toBe(7);
    expect(a.t.passAtt).toBe(30);
  });
});
```

`packages/web/src/lib/playerdb/columns.test.ts`:
```ts
import { COLUMNS, DEFAULT_SORT, TABS, TAB_GROUPS, belowMin, columnValue, columnsFor, fmtValue, groupsFor, tabPositions } from './columns';
import { aggregate } from './aggregate';
import { miniDb } from '../../test/playerDbFixtures';

const agg = (id: string, from = 1, to = 3) => aggregate(miniDb(), from, to).find((a) => a.id === id)!;

describe('column catalogue', () => {
  it('every tab lists existing columns with no duplicates and the lead block first', () => {
    for (const tab of TABS) {
      const cols = columnsFor(tab);
      const keys = cols.map((c) => c.key);
      expect(new Set(keys).size, tab).toBe(keys.length);
      for (const g of TAB_GROUPS[tab]) for (const k of g.keys) expect(COLUMNS[k], `${tab}:${k}`).toBeDefined();
      expect(keys.slice(0, 5)).toEqual(['g', 'pts', 'ppg', 'posRank', 'projPlus']);
      expect(groupsFor(tab)[0].group).toBe('');
    }
    expect(COLUMNS[DEFAULT_SORT]).toBeDefined();
    expect(tabPositions('all')).toEqual(['QB', 'RB', 'WR', 'TE']);
    expect(tabPositions('te')).toEqual(['TE']);
  });
  it('every column has a definition and a format', () => {
    for (const c of Object.values(COLUMNS)) { expect(c.def.length, c.key).toBeGreaterThan(8); expect(['int', 'dec1', 'dec2', 'pct', 'signed1']).toContain(c.fmt); }
  });
});

describe('columnValue', () => {
  const w1 = agg('w1');
  it('computes rates from summed numerators and denominators', () => {
    expect(columnValue(COLUMNS.catchPct, w1, 'total')).toBeCloseTo(17 / 26, 6);
    expect(columnValue(COLUMNS.yprr, w1, 'total')).toBeCloseTo(250 / 97, 6);
    expect(columnValue(COLUMNS.tgtPct, w1, 'total')).toBeCloseTo(26 / 100, 6);
    expect(columnValue(COLUMNS.ayPct, w1, 'total')).toBeCloseTo(300 / 780, 6);
    expect(columnValue(COLUMNS.wopr, w1, 'total')).toBeCloseTo(1.5 * 26 / 100 + 0.7 * 300 / 780, 6);
    expect(columnValue(COLUMNS.snapPct, w1, 'total')).toBeCloseTo(163 / 180, 6);
    expect(columnValue(COLUMNS.fdrr, w1, 'total')).toBeCloseTo(11 / 97, 6);
    expect(columnValue(COLUMNS.epaDb, agg('q1'), 'total')).toBeCloseTo(9 / 96, 6);
  });
  it('divides counting stats by games in per-game mode and leaves rates alone', () => {
    expect(columnValue(COLUMNS.tgt, w1, 'total')).toBe(26);
    expect(columnValue(COLUMNS.tgt, w1, 'pg')).toBeCloseTo(26 / 3, 6);
    expect(columnValue(COLUMNS.catchPct, w1, 'pg')).toBeCloseTo(17 / 26, 6);
    expect(columnValue(COLUMNS.ppg, w1, 'pg')).toBeCloseTo(50 / 3, 6);
  });
  it('returns null for missing numerators or zero denominators', () => {
    expect(columnValue(COLUMNS.ypc, w1, 'total')).toBeNull();
    expect(columnValue(COLUMNS.sep, agg('w2'), 'total')).toBeNull();
    expect(columnValue(COLUMNS.fpoe, agg('t1'), 'total')).toBeNull();
    expect(columnValue(COLUMNS.fpoe, w1, 'total')).toBeCloseTo(50 - 47, 6);
  });
  it('flags rate cells under the per-week minimum', () => {
    expect(belowMin(COLUMNS.catchPct, agg('r1'))).toBe(true);         // 6 targets < 3 × 3
    expect(belowMin(COLUMNS.catchPct, agg('w2'))).toBe(false);        // 10 targets ≥ 3 × 3
    expect(belowMin(COLUMNS.yprr, agg('r1'))).toBe(false);            // 35 routes ≥ 10 × 3
  });
  it('marks route columns as estimated and lower-is-better columns', () => {
    expect(COLUMNS.yprr.est).toBe(true);
    expect(COLUMNS.int.lowerIsBetter).toBe(true);
    expect(COLUMNS.pts.tinted).toBe(false);
  });
  it('formats by kind, and ints as one decimal in per-game mode', () => {
    expect(fmtValue(26, 'int', 'total')).toBe('26');
    expect(fmtValue(26 / 3, 'int', 'pg')).toBe('8.7');
    expect(fmtValue(0.6538, 'pct', 'total')).toBe('65.4%');
    expect(fmtValue(2.5773, 'dec2', 'total')).toBe('2.58');
    expect(fmtValue(3, 'signed1', 'total')).toBe('+3.0');
    expect(fmtValue(null, 'int', 'total')).toBe('–');
  });
});
```
- [ ] **Step 3: Run them to see them fail**

Run: `cd packages/web && npx vitest run src/lib/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 4: Loader**

`packages/web/src/data/load.ts`, after the `seasonMods` line:
```ts
const playerDbMods = import.meta.glob<{ default: PlayerDb }>('../../../../data/playerdb/*.json');
```
Add `PlayerDb` to the type import from `@fantasy-dash/core`. At the end of the file:
```ts
const playerDbCache = new Map<number, Promise<PlayerDb>>();
const playerDbKey = (year: number) => Object.keys(playerDbMods).find((k) => k.endsWith(`/${year}.json`));

/** Whether a player database file exists for the season (a new year has none until its first sync). */
export const hasPlayerDb = (year: number): boolean => playerDbKey(year) !== undefined;

export function loadPlayerDb(year: number): Promise<PlayerDb> {
  let pending = playerDbCache.get(year);
  if (!pending) {
    const key = playerDbKey(year);
    if (!key) return Promise.reject(new Response(`No player data for ${year}`, { status: 404 }));
    pending = playerDbMods[key]().then((m) => m.default).catch((err) => { playerDbCache.delete(year); throw err; });
    playerDbCache.set(year, pending);
  }
  return pending;
}
```

- [ ] **Step 5: Aggregation**

`packages/web/src/lib/playerdb/aggregate.ts`:
```ts
import { teamWeekKey, type PlayerDb, type PlayerWeek, type PlayerWeekKey, type TeamWeek } from '@fantasy-dash/core';

export interface TeamTotals { passAtt: number; rushAtt: number; dropbacks: number; rzLooks: number; airYds: number }

/** One player's numbers over a week range. `s` are sums, `w` are weighted averages, `t` the totals of the team-weeks he played in. */
export interface Agg {
  id: string;
  /** team of his last week in the range */
  team: string;
  games: number;
  /** weeks in the range (for minimum scaling), not weeks played */
  weeks: number;
  s: Partial<Record<PlayerWeekKey, number>>;
  w: Partial<Record<PlayerWeekKey, number>>;
  t: TeamTotals;
  routes: number;
  routesEst: boolean;
  /** Σ (pts − proj) over weeks with a projection; null when none */
  projDiff: number | null;
  /** rank by Σ pts within his position over the same range; set by aggregate() */
  posRank: number | null;
  rows: PlayerWeek[];
}

/** Per-game rates from NGS, PFR and Sleeper, averaged with these weights. */
export const WEIGHTED: Partial<Record<PlayerWeekKey, PlayerWeekKey>> = {
  re_cush: 're_tgt', re_sep: 're_tgt', re_iay: 're_tgt', re_iayShare: 're_tgt', re_xyac: 're_rec', re_yacoe: 're_rec', re_rtg: 're_tgt',
  ru_ryoeAtt: 'ru_att', ru_eff: 'ru_att', ru_box8: 'ru_att', ru_tlos: 'ru_att',
  pa_ttt: 'pa_att', pa_iay: 'pa_att', pa_cay: 'pa_att', pa_aggr: 'pa_att', pa_ays: 'pa_att', pa_xcmp: 'pa_att', pa_cpoe: 'pa_att', pa_rtg: 'pa_att',
};
/** Source rates the table recomputes from sums instead. */
const SKIPPED = new Set<PlayerWeekKey>(['posRankPpr', 're_dropPct', 'pa_badPct', 'pa_pressPct', 're_tgtShare', 're_ayShare', 're_wopr', 're_racr', 'pa_pacr']);

const twIndex = new WeakMap<PlayerDb, Map<string, TeamWeek>>();
function teamWeekOf(db: PlayerDb, team: string, week: number): TeamWeek | undefined {
  let idx = twIndex.get(db);
  if (!idx) { idx = new Map(db.teamWeeks.map((t) => [teamWeekKey(t.team, t.week), t])); twIndex.set(db, idx); }
  return idx.get(teamWeekKey(team, week));
}

export function aggregateWeeks(db: PlayerDb, rows: PlayerWeek[], weeks: number): Agg {
  const s: Agg['s'] = {}, w: Agg['w'] = {};
  const wsum: Partial<Record<PlayerWeekKey, number>> = {}, wden: Partial<Record<PlayerWeekKey, number>> = {};
  const t: TeamTotals = { passAtt: 0, rushAtt: 0, dropbacks: 0, rzLooks: 0, airYds: 0 };
  let games = 0, routes = 0, projDiff: number | null = null;
  for (const r of rows) {
    if (r.gp >= 1) games++;
    for (const [k, v] of Object.entries(r) as [string, unknown][]) {
      if (typeof v !== 'number' || k === 'week' || k === 'gp') continue;
      const key = k as PlayerWeekKey;
      if (SKIPPED.has(key)) continue;
      const weightKey = WEIGHTED[key];
      if (weightKey) {
        const weight = r[weightKey] ?? 0;
        if (weight > 0) { wsum[key] = (wsum[key] ?? 0) + v * weight; wden[key] = (wden[key] ?? 0) + weight; }
      } else {
        s[key] = (s[key] ?? 0) + v;
      }
    }
    routes += (db.routesReal ? r.routes : r.routesEst) ?? 0;
    if (r.proj !== undefined && r.pts !== undefined) projDiff = (projDiff ?? 0) + (r.pts - r.proj);
    const tw = teamWeekOf(db, r.team, r.week);
    if (tw) { t.passAtt += tw.passAtt; t.rushAtt += tw.rushAtt; t.dropbacks += tw.dropbacks; t.rzLooks += tw.rzLooks; t.airYds += tw.airYds; }
  }
  for (const k of Object.keys(wsum) as PlayerWeekKey[]) w[k] = wsum[k]! / wden[k]!;
  const last = rows[rows.length - 1];
  return { id: last?.id ?? '', team: last?.team ?? '', games, weeks, s, w, t, routes, routesEst: !db.routesReal, projDiff, posRank: null, rows };
}

/** Every player with a row in weeks from..to, with position ranks by points. */
export function aggregate(db: PlayerDb, from: number, to: number): Agg[] {
  const grouped = new Map<string, PlayerWeek[]>();
  for (const r of db.rows) {
    if (r.week < from || r.week > to) continue;
    const list = grouped.get(r.id);
    if (list) list.push(r); else grouped.set(r.id, [r]);
  }
  const out = [...grouped.values()].map((rows) => aggregateWeeks(db, rows, to - from + 1));
  const byPos = new Map<string, Agg[]>();
  for (const a of out) {
    const pos = db.players[a.id]?.pos ?? '?';
    byPos.set(pos, [...(byPos.get(pos) ?? []), a]);
  }
  for (const list of byPos.values()) {
    list.sort((a, b) => (b.s.pts ?? 0) - (a.s.pts ?? 0) || (a.id < b.id ? -1 : 1));
    list.forEach((a, i) => { a.posRank = i + 1; });
  }
  return out;
}
```

- [ ] **Step 6: Columns**

`packages/web/src/lib/playerdb/columns.ts`:
```ts
import type { DbPos, PlayerWeekKey } from '@fantasy-dash/core';
import { fmtSigned } from '../format';
import type { Agg } from './aggregate';

export type Tab = 'all' | 'qb' | 'rb' | 'wr' | 'te';
export const TABS: readonly Tab[] = ['all', 'qb', 'rb', 'wr', 'te'];
export const tabPositions = (tab: Tab): DbPos[] => (tab === 'all' ? ['QB', 'RB', 'WR', 'TE'] : [tab.toUpperCase() as DbPos]);
export type Mode = 'total' | 'pg';
export type Fmt = 'int' | 'dec1' | 'dec2' | 'pct' | 'signed1';
export const DEFAULT_SORT = 'pts';

export interface ColumnDef {
  key: string;
  label: string;
  def: string;
  fmt: Fmt;
  value: (a: Agg) => number | null;
  /** counting stat: divided by games played in per-game mode */
  perGame?: boolean;
  lowerIsBetter?: boolean;
  /** default true; the anchors (G, Pts, PPG, Pos rank) are false */
  tinted?: boolean;
  /** rate columns: the denominator must reach perWeek × weeks in range to be tinted */
  min?: { denom: (a: Agg) => number; perWeek: number };
  /** route-based: estimated while the season's routes are */
  est?: boolean;
}

/** Per-week sample minimums. */
export const MIN = { tgt: 3, car: 5, routes: 10, db: 12, snaps: 10 } as const;

const S = (k: PlayerWeekKey) => (a: Agg): number => a.s[k] ?? 0;
const sum = (k: PlayerWeekKey) => (a: Agg): number | null => a.s[k] ?? null;
const W = (k: PlayerWeekKey) => (a: Agg): number | null => a.w[k] ?? null;
const ratio = (num: (a: Agg) => number | null, den: (a: Agg) => number) => (a: Agg): number | null => {
  const n = num(a), d = den(a);
  return n === null || d <= 0 ? null : n / d;
};
const add = (...ks: PlayerWeekKey[]) => (a: Agg): number => ks.reduce((t, k) => t + (a.s[k] ?? 0), 0);
const anySum = (...ks: PlayerWeekKey[]) => (a: Agg): number | null => (ks.some((k) => a.s[k] !== undefined) ? add(...ks)(a) : null);
const routes = (a: Agg) => a.routes;
const dropbacks = add('pa_att', 'pa_sack');
const touches = add('ru_att', 're_rec');
const drops = (a: Agg): number | null => a.s.re_drop ?? a.s.re_dropPfr ?? null;
const games = (a: Agg) => a.games;
const minTgt = { denom: S('re_tgt'), perWeek: MIN.tgt };
const minCar = { denom: S('ru_att'), perWeek: MIN.car };
const minRoutes = { denom: routes, perWeek: MIN.routes };
const minDb = { denom: dropbacks, perWeek: MIN.db };
const minSnaps = { denom: S('snaps'), perWeek: MIN.snaps };

const col = (key: string, label: string, def: string, fmt: Fmt, value: ColumnDef['value'], extra: Partial<ColumnDef> = {}): ColumnDef => ({ key, label, def, fmt, value, ...extra });
const count = (key: string, label: string, def: string, k: PlayerWeekKey, extra: Partial<ColumnDef> = {}) => col(key, label, def, 'int', sum(k), { perGame: true, ...extra });

const list: ColumnDef[] = [
  // lead
  col('g', 'G', 'Games played in the range', 'int', games, { tinted: false }),
  col('pts', 'Pts', 'Fantasy points under league scoring', 'dec1', sum('pts'), { tinted: false }),
  col('ppg', 'PPG', 'Fantasy points per game played', 'dec1', ratio(sum('pts'), games), { tinted: false }),
  col('posRank', 'Rk', 'Rank by fantasy points among players at the position over the range', 'int', (a) => a.posRank, { tinted: false, lowerIsBetter: true }),
  col('projPlus', 'Proj±', 'Fantasy points minus Sleeper\'s projection, summed over weeks with a projection', 'signed1', (a) => a.projDiff),
  // passing
  count('cmp', 'Cmp', 'Completions', 'pa_cmp'),
  count('att', 'Att', 'Pass attempts', 'pa_att'),
  col('cmpPct', 'Cmp%', 'Completions per attempt', 'pct', ratio(sum('pa_cmp'), S('pa_att')), { min: minDb }),
  count('paYds', 'Yds', 'Passing yards', 'pa_yds'),
  col('ya', 'Y/A', 'Passing yards per attempt', 'dec1', ratio(sum('pa_yds'), S('pa_att')), { min: minDb }),
  count('paTd', 'TD', 'Passing touchdowns', 'pa_td'),
  count('int', 'INT', 'Interceptions thrown', 'pa_int', { lowerIsBetter: true }),
  count('sacks', 'Sk', 'Sacks taken', 'pa_sack', { lowerIsBetter: true }),
  col('rtg', 'Rtg', 'Passer rating, weighted by attempts', 'dec1', W('pa_rtg'), { min: minDb }),
  col('adot', 'aDOT', 'Average depth of target: passing air yards per attempt', 'dec1', ratio(sum('pa_air'), S('pa_att')), { min: minDb }),
  count('paAir', 'Air', 'Passing air yards', 'pa_air'),
  count('paYac', 'YAC', 'Yards after the catch by his receivers', 'pa_yac'),
  col('cpoe', 'CPOE', 'Completion percentage over expected (Next Gen Stats), weighted by attempts', 'dec1', W('pa_cpoe'), { min: minDb }),
  col('epaDb', 'EPA/db', 'Passing expected points added per dropback (attempts plus sacks)', 'dec2', ratio(sum('pa_epa'), dropbacks), { min: minDb }),
  col('pacr', 'PACR', 'Passing air conversion ratio: passing yards per air yard', 'dec2', ratio(sum('pa_yds'), S('pa_air')), { min: minDb }),
  col('badPct', 'Bad%', 'Bad throws per attempt (Pro Football Reference)', 'pct', ratio(sum('pa_bad'), S('pa_att')), { lowerIsBetter: true, min: minDb }),
  col('pressPct', 'Press%', 'Dropbacks under pressure (Pro Football Reference)', 'pct', ratio(sum('pa_press'), dropbacks), { lowerIsBetter: true, min: minDb }),
  col('ttt', 'TTT', 'Average time to throw in seconds (Next Gen Stats)', 'dec2', W('pa_ttt'), { lowerIsBetter: true, min: minDb }),
  col('aggr', 'Aggr%', 'Aggressiveness: share of throws into tight coverage (Next Gen Stats)', 'dec1', W('pa_aggr'), { min: minDb }),
  count('deep', '40+', 'Completions of 40 yards or more', 'pa_cmp40'),
  count('rzAtt', 'RZ att', 'Pass attempts inside the red zone', 'pa_rz'),
  // rushing
  count('car', 'Car', 'Carries', 'ru_att'),
  count('ruYds', 'Yds', 'Rushing yards', 'ru_yds'),
  col('ypc', 'YPC', 'Rushing yards per carry', 'dec1', ratio(sum('ru_yds'), S('ru_att')), { min: minCar }),
  count('ruTd', 'TD', 'Rushing touchdowns', 'ru_td'),
  count('ruFd', 'FD', 'Rushing first downs', 'ru_fd'),
  count('ru10', '10+', 'Carries of 10 yards or more', 'ru_10'),
  count('ru20', '20+', 'Carries of 20 yards or more', 'ru_20'),
  col('ybc', 'YBC/att', 'Rushing yards before contact per carry (Pro Football Reference)', 'dec2', ratio(sum('ru_ybc'), S('ru_att')), { min: minCar }),
  col('yacAtt', 'YAC/att', 'Rushing yards after contact per carry', 'dec2', ratio((a) => a.s.ru_yac ?? a.s.ru_yacPfr ?? null, S('ru_att')), { min: minCar }),
  count('bt', 'BT', 'Broken tackles on carries', 'ru_bt'),
  col('btTouch', 'BT/touch', 'Broken tackles per touch, carries and catches together', 'dec2', ratio(anySum('ru_bt', 're_bt'), touches), { min: minCar }),
  col('ryoeAtt', 'RYOE/att', 'Rushing yards over expected per carry (Next Gen Stats)', 'dec2', W('ru_ryoeAtt'), { min: minCar }),
  col('box8', '8+ box', 'Share of carries against eight or more defenders in the box (Next Gen Stats)', 'dec1', W('ru_box8'), { min: minCar }),
  col('stuffPct', 'Stuff%', 'Carries tackled for a loss per carry', 'pct', ratio(sum('ru_tfl'), S('ru_att')), { lowerIsBetter: true, min: minCar }),
  col('ruEpa', 'Rush EPA', 'Rushing expected points added', 'dec1', sum('ru_epa')),
  count('fum', 'Fum', 'Fumbles', 'fum', { lowerIsBetter: true }),
  count('ruRz', 'RZ car', 'Carries inside the red zone', 'ru_rz'),
  // receiving
  count('tgt', 'Tgt', 'Targets', 're_tgt'),
  count('rec', 'Rec', 'Receptions', 're_rec'),
  count('reYds', 'Yds', 'Receiving yards', 're_yds'),
  count('reTd', 'TD', 'Receiving touchdowns', 're_td'),
  count('reFd', 'FD', 'Receiving first downs', 're_fd'),
  col('catchPct', 'Catch%', 'Receptions per target', 'pct', ratio(sum('re_rec'), S('re_tgt')), { min: minTgt }),
  col('ypt', 'YPT', 'Receiving yards per target', 'dec1', ratio(sum('re_yds'), S('re_tgt')), { min: minTgt }),
  col('ypr', 'YPR', 'Receiving yards per reception', 'dec1', ratio(sum('re_yds'), S('re_rec')), { min: minTgt }),
  col('adotRe', 'aDOT', 'Average depth of target: air yards per target', 'dec1', ratio(sum('re_air'), S('re_tgt')), { min: minTgt }),
  count('reAir', 'Air', 'Receiving air yards', 're_air'),
  count('reYac', 'YAC', 'Yards after the catch', 're_yac'),
  col('yacRec', 'YAC/rec', 'Yards after the catch per reception', 'dec1', ratio(sum('re_yac'), S('re_rec')), { min: minTgt }),
  col('yacoe', 'YACOE', 'Yards after the catch over expected per reception (Next Gen Stats)', 'dec2', W('re_yacoe'), { min: minTgt }),
  col('drops', 'Drops', 'Dropped passes', 'int', drops, { perGame: true, lowerIsBetter: true }),
  col('dropPct', 'Drop%', 'Drops per target', 'pct', ratio(drops, S('re_tgt')), { lowerIsBetter: true, min: minTgt }),
  count('re20', '20+', 'Receptions of 20 yards or more', 're_20'),
  col('sep', 'Sep', 'Average separation from the nearest defender at the catch point, in yards (Next Gen Stats)', 'dec2', W('re_sep'), { min: minTgt }),
  col('cush', 'Cush', 'Average cushion from the nearest defender at the snap, in yards (Next Gen Stats)', 'dec2', W('re_cush'), { lowerIsBetter: true, min: minTgt }),
  col('racr', 'RACR', 'Receiver air conversion ratio: receiving yards per air yard', 'dec2', ratio(sum('re_yds'), S('re_air')), { min: minTgt }),
  col('reEpa', 'Rec EPA', 'Receiving expected points added', 'dec1', sum('re_epa')),
  col('epaTgt', 'EPA/tgt', 'Receiving expected points added per target', 'dec2', ratio(sum('re_epa'), S('re_tgt')), { min: minTgt }),
  count('reRz', 'RZ tgt', 'Targets inside the red zone', 're_rz'),
  col('rzTgtPct', 'RZ tgt%', 'Share of the team\'s red-zone looks that were targets to him', 'pct', ratio(sum('re_rz'), (a) => a.t.rzLooks)),
  // usage
  count('snaps', 'Snaps', 'Offensive snaps', 'snaps'),
  col('snapPct', 'Snap%', 'Offensive snaps per team offensive snap', 'pct', ratio(sum('snaps'), S('teamSnaps')), { min: minSnaps }),
  col('dbPg', 'DB/g', 'Dropbacks (attempts plus sacks) per game', 'dec1', ratio(dropbacks, games)),
  col('routes', 'Routes', 'Routes run: pass plays he was on the field for', 'int', routes, { perGame: true, est: true }),
  col('routePct', 'Route%', 'Routes run per team dropback', 'pct', ratio(routes, (a) => a.t.dropbacks), { est: true, min: minSnaps }),
  col('yprr', 'YPRR', 'Receiving yards per route run', 'dec2', ratio(sum('re_yds'), routes), { est: true, min: minRoutes }),
  col('tprr', 'TPRR', 'Targets per route run', 'dec2', ratio(sum('re_tgt'), routes), { est: true, min: minRoutes }),
  col('fdrr', 'FDRR', 'Receiving first downs per route run', 'dec2', ratio(sum('re_fd'), routes), { est: true, min: minRoutes }),
  col('tgtPct', 'Tgt%', 'Targets per team pass attempt', 'pct', ratio(sum('re_tgt'), (a) => a.t.passAtt)),
  col('ayPct', 'AY%', 'Share of the team\'s passing air yards', 'pct', ratio(sum('re_air'), (a) => a.t.airYds)),
  col('wopr', 'WOPR', 'Weighted opportunity rating: 1.5 × target share + 0.7 × air-yards share', 'dec2', (a) => {
    const tgt = ratio(sum('re_tgt'), (x) => x.t.passAtt)(a), ay = ratio(sum('re_air'), (x) => x.t.airYds)(a);
    return tgt === null ? null : 1.5 * tgt + 0.7 * (ay ?? 0);
  }),
  col('carryPct', 'Carry%', 'Carries per team rush attempt', 'pct', ratio(sum('ru_att'), (a) => a.t.rushAtt)),
  col('opp', 'Opp', 'Opportunities: carries plus targets', 'int', anySum('ru_att', 're_tgt'), { perGame: true }),
  col('oppPct', 'Opp%', 'Opportunities per team play (rush attempts plus pass attempts)', 'pct', ratio(anySum('ru_att', 're_tgt'), (a) => a.t.rushAtt + a.t.passAtt)),
  col('rzTouches', 'RZ', 'Red-zone carries plus red-zone targets', 'int', anySum('ru_rz', 're_rz'), { perGame: true }),
  col('rzPct', 'RZ%', 'Share of the team\'s red-zone looks (carries plus targets)', 'pct', ratio(anySum('ru_rz', 're_rz'), (a) => a.t.rzLooks)),
  col('touchesPg', 'Tch/g', 'Touches (carries plus receptions) per game', 'dec1', ratio(anySum('ru_att', 're_rec'), games)),
  // fantasy
  col('xfp', 'xFP', 'Expected fantasy points from opportunity (per-position model fitted on every NFL player-week this season)', 'dec1', sum('xfp'), { perGame: true }),
  col('xfpPg', 'xFP/g', 'Expected fantasy points per game', 'dec1', ratio(sum('xfp'), games)),
  col('fpoe', 'FPOE', 'Fantasy points over expected: points minus xFP', 'signed1', (a) => (a.s.xfp === undefined || a.s.pts === undefined ? null : a.s.pts - a.s.xfp), { perGame: true }),
  col('fpoePg', 'FPOE/g', 'Fantasy points over expected per game', 'signed1', ratio((a) => (a.s.xfp === undefined || a.s.pts === undefined ? null : a.s.pts - a.s.xfp), games)),
  col('fpTouch', 'FP/touch', 'Fantasy points per touch', 'dec2', ratio(sum('pts'), touches), { min: minCar }),
  col('fpSnap', 'FP/snap', 'Fantasy points per offensive snap', 'dec2', ratio(sum('pts'), S('snaps')), { min: minSnaps }),
  col('fpTgt', 'FP/tgt', 'Fantasy points per target', 'dec2', ratio(sum('pts'), S('re_tgt')), { min: minTgt }),
  col('fpRoute', 'FP/route', 'Fantasy points per route run', 'dec2', ratio(sum('pts'), routes), { est: true, min: minRoutes }),
  // all-positions
  col('touches', 'Touches', 'Carries plus receptions', 'int', anySum('ru_att', 're_rec'), { perGame: true }),
  col('totYds', 'Yds', 'Passing, rushing and receiving yards', 'int', anySum('pa_yds', 'ru_yds', 're_yds'), { perGame: true }),
  col('totTd', 'TD', 'Passing, rushing and receiving touchdowns', 'int', anySum('pa_td', 'ru_td', 're_td'), { perGame: true }),
  col('totEpa', 'EPA', 'Passing, rushing and receiving expected points added', 'dec1', anySum('pa_epa', 'ru_epa', 're_epa')),
];

export const COLUMNS: Readonly<Record<string, ColumnDef>> = Object.fromEntries(list.map((c) => [c.key, c]));

const LEAD = ['g', 'pts', 'ppg', 'posRank', 'projPlus'];
const FANTASY = ['xfp', 'xfpPg', 'fpoe', 'fpoePg'];
const WR_GROUPS = [
  { group: '', keys: LEAD },
  { group: 'Receiving', keys: ['tgt', 'rec', 'reYds', 'reTd', 'reFd', 'catchPct', 'ypt', 'ypr', 'adotRe', 'reAir', 'reYac', 'yacRec', 'yacoe', 'drops', 'dropPct', 're20', 'sep', 'cush', 'racr', 'reEpa', 'epaTgt'] },
  { group: 'Usage', keys: ['snaps', 'snapPct', 'routes', 'routePct', 'tgtPct', 'ayPct', 'wopr', 'yprr', 'tprr', 'fdrr', 'reRz', 'rzTgtPct'] },
  { group: 'Rushing', keys: ['car', 'ruYds', 'ruTd'] },
  { group: 'Fantasy', keys: [...FANTASY, 'fpTgt', 'fpRoute'] },
];
export const TAB_GROUPS: Readonly<Record<Tab, { group: string; keys: string[] }[]>> = {
  all: [
    { group: '', keys: LEAD },
    { group: 'Volume', keys: ['touches', 'totYds', 'totTd', 'snapPct', 'oppPct', 'totEpa'] },
    { group: 'Fantasy', keys: ['xfp', 'fpoe'] },
  ],
  qb: [
    { group: '', keys: LEAD },
    { group: 'Passing', keys: ['cmp', 'att', 'cmpPct', 'paYds', 'ya', 'paTd', 'int', 'sacks', 'rtg'] },
    { group: 'Advanced', keys: ['adot', 'paAir', 'paYac', 'cpoe', 'epaDb', 'pacr', 'badPct', 'pressPct', 'ttt', 'aggr', 'deep', 'rzAtt'] },
    { group: 'Rushing', keys: ['car', 'ruYds', 'ruTd', 'ruRz', 'ruEpa'] },
    { group: 'Usage', keys: ['snaps', 'snapPct', 'dbPg'] },
    { group: 'Fantasy', keys: FANTASY },
  ],
  rb: [
    { group: '', keys: LEAD },
    { group: 'Rushing', keys: ['car', 'ruYds', 'ypc', 'ruTd', 'ruFd', 'ru10', 'ru20', 'ybc', 'yacAtt', 'bt', 'btTouch', 'ryoeAtt', 'box8', 'stuffPct', 'ruEpa', 'fum'] },
    { group: 'Receiving', keys: ['tgt', 'rec', 'reYds', 'reTd', 'ypt', 'yacRec', 'routes', 'routePct', 'yprr', 'tprr'] },
    { group: 'Usage', keys: ['snaps', 'snapPct', 'carryPct', 'tgtPct', 'opp', 'oppPct', 'rzTouches', 'rzPct', 'wopr', 'touchesPg'] },
    { group: 'Fantasy', keys: [...FANTASY, 'fpTouch', 'fpSnap'] },
  ],
  wr: WR_GROUPS,
  te: WR_GROUPS,
};

export const groupsFor = (tab: Tab): { group: string; cols: ColumnDef[] }[] => TAB_GROUPS[tab].map((g) => ({ group: g.group, cols: g.keys.map((k) => COLUMNS[k]) }));
export const columnsFor = (tab: Tab): ColumnDef[] => groupsFor(tab).flatMap((g) => g.cols);

export function columnValue(col: ColumnDef, a: Agg, mode: Mode): number | null {
  const v = col.value(a);
  if (v === null) return null;
  if (col.perGame && mode === 'pg') return a.games > 0 ? v / a.games : null;
  return v;
}

export const belowMin = (col: ColumnDef, a: Agg): boolean => (col.min ? col.min.denom(a) < col.min.perWeek * a.weeks : false);

export function fmtValue(v: number | null, fmt: Fmt, mode: Mode): string {
  if (v === null || Number.isNaN(v)) return '–';
  const f = mode === 'pg' && fmt === 'int' ? 'dec1' : fmt;
  switch (f) {
    case 'int': return String(Math.round(v));
    case 'dec1': return v.toFixed(1);
    case 'dec2': return v.toFixed(2);
    case 'pct': return `${(v * 100).toFixed(1)}%`;
    case 'signed1': return fmtSigned(v, 1);
  }
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `cd packages/web && npx vitest run src/lib/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/data/load.ts packages/web/src/test/playerDbFixtures.ts packages/web/src/lib/playerdb
git commit -m "Player db web: loader, range aggregation, column catalogue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Percentile tints, roster attribution, URL state, directory shim

**Files:**
- Create: `packages/web/src/lib/playerdb/percentile.ts`, `rosters.ts`, `url.ts`, `directory.ts`
- Test: `packages/web/src/lib/playerdb/percentile.test.ts`, `rosters.test.ts`, `url.test.ts`, `directory.test.ts`

**Interfaces:**
- Produces: `percentiles(values: (number | null)[]): (number | null)[]` (0..1 by average rank; a single value is 0.5); `tintFor(p: number | null, lowerIsBetter?: boolean): string` (CSS colour, `'transparent'` for null or the midpoint); `TINT_STRENGTH = 45`; `rosterMap(season: Season): Record<PlayerId, UserId>`; `RosterFilter` (string: `'all' | 'rostered' | 'fa' | userId`); `DbState { tab: Tab; from: number; to: number; mode: Mode; roster: string; sort: string; dir: 'asc' | 'desc'; q: string }`; `parseState(params: URLSearchParams, throughWeek: number): DbState`; `serializeState(state: DbState, throughWeek: number): URLSearchParams`; `dbDirectory(db: PlayerDb): PlayerDirectory`.

- [ ] **Step 1: Failing tests**

`packages/web/src/lib/playerdb/percentile.test.ts`:
```ts
import { TINT_STRENGTH, percentiles, tintFor } from './percentile';

describe('percentiles', () => {
  it('ranks from 0 to 1, averaging ties and skipping nulls', () => {
    expect(percentiles([10, 30, 20, null])).toEqual([0, 1, 0.5, null]);
    expect(percentiles([5, 5, 1])).toEqual([0.75, 0.75, 0]);
    expect(percentiles([7])).toEqual([0.5]);
    expect(percentiles([])).toEqual([]);
  });
});

describe('tintFor', () => {
  it('is transparent at the midpoint and for null, green above, red below, reversed for lower-is-better', () => {
    expect(tintFor(null)).toBe('transparent');
    expect(tintFor(0.5)).toBe('transparent');
    expect(tintFor(1)).toBe(`color-mix(in srgb, var(--win) ${TINT_STRENGTH}%, transparent)`);
    expect(tintFor(0)).toBe(`color-mix(in srgb, var(--loss) ${TINT_STRENGTH}%, transparent)`);
    expect(tintFor(0.75)).toBe(`color-mix(in srgb, var(--win) ${TINT_STRENGTH / 2}%, transparent)`);
    expect(tintFor(1, true)).toBe(`color-mix(in srgb, var(--loss) ${TINT_STRENGTH}%, transparent)`);
  });
});
```

`packages/web/src/lib/playerdb/rosters.test.ts`:
```ts
import type { Transaction } from '@fantasy-dash/core';
import { rosterMap } from './rosters';
import { game, line, season, side, week } from '../../test/playerFixtures';

const tx = (id: string, type: Transaction['type'], wk: number, created: number, adds: [string, string][], drops: [string, string][]): Transaction =>
  ({ id, type, week: wk, created, adds: adds.map(([playerId, userId]) => ({ playerId, userId })), drops: drops.map(([playerId, userId]) => ({ playerId, userId })), bid: null });

describe('rosterMap', () => {
  it('starts from the last played week\'s lineups, bench included, then applies later transactions in order', () => {
    const s = season(2026, [
      week(1, [game(2026, 1, 1, side('A', 100, [line('w1', 10)], [line('r1', 5)]), side('B', 90, [line('q1', 20)]))]),
      week(2, [game(2026, 2, 1, side('A', 100, [line('w1', 10)], [line('r1', 5)]), side('B', 90, [line('q1', 20)], [line('t1', 3)]))]),
      week(3, []),
    ], null, 2);
    s.transactions = [
      tx('1', 'waiver', 2, 100, [['w9', 'A']], [['r1', 'A']]),          // week 2: already reflected in the lineups, ignored
      tx('3', 'free_agent', 3, 300, [['t1', 'A']], [['t1', 'B']]),      // later: B drops t1, A adds him
      tx('2', 'waiver', 3, 200, [['r2', 'B']], [['q1', 'B']]),          // earlier created: applied first
    ];
    expect(rosterMap(s)).toEqual({ w1: 'A', r1: 'A', t1: 'A', r2: 'B' });
  });
  it('is empty before any week is played, apart from transactions', () => {
    const s = season(2026, [week(1, [])], null, 0);
    s.transactions = [tx('1', 'free_agent', 1, 1, [['w1', 'A']], [])];
    expect(rosterMap(s)).toEqual({ w1: 'A' });
  });
});
```

`packages/web/src/lib/playerdb/url.test.ts`:
```ts
import { parseState, serializeState } from './url';

describe('url state', () => {
  it('defaults everything and omits defaults when serializing', () => {
    const s = parseState(new URLSearchParams(''), 6);
    expect(s).toEqual({ tab: 'all', from: 1, to: 6, mode: 'total', roster: 'all', sort: 'pts', dir: 'desc', q: '' });
    expect(serializeState(s, 6).toString()).toBe('');
  });
  it('round-trips every param', () => {
    const p = new URLSearchParams('tab=wr&from=3&to=5&mode=pg&roster=123&sort=yprr&dir=asc&q=egb');
    const s = parseState(p, 6);
    expect(s).toEqual({ tab: 'wr', from: 3, to: 5, mode: 'pg', roster: '123', sort: 'yprr', dir: 'asc', q: 'egb' });
    expect(serializeState(s, 6).toString()).toBe(p.toString());
  });
  it('falls back on junk, clamps weeks and swaps a reversed range', () => {
    const s = parseState(new URLSearchParams('tab=xx&from=9&to=0&mode=zz&sort=nope&dir=up'), 6);
    expect(s).toMatchObject({ tab: 'all', from: 1, to: 6, mode: 'total', sort: 'pts', dir: 'desc' });
    expect(parseState(new URLSearchParams('from=5&to=2'), 6)).toMatchObject({ from: 2, to: 5 });
  });
});
```

`packages/web/src/lib/playerdb/directory.test.ts`:
```ts
import { dbDirectory } from './directory';
import { miniDb } from '../../test/playerDbFixtures';

describe('dbDirectory', () => {
  it('exposes every database player as a PlayerInfo with his last team', () => {
    const d = dbDirectory(miniDb());
    expect(d.w1).toEqual({ id: 'w1', name: 'Wide One', firstName: 'Wide', lastName: 'One', position: 'WR', team: 'KC', yearsExp: 2, birthDate: null });
    expect(Object.keys(d)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/web && npx vitest run src/lib/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/web/src/lib/playerdb/percentile.ts`:
```ts
/** Translucency of a fully green or red cell; the draft board uses the same strength. */
export const TINT_STRENGTH = 45;

/** 0..1 by average rank among the non-null values (ties share a rank); a lone value sits at 0.5. */
export function percentiles(values: (number | null)[]): (number | null)[] {
  const idx = values.map((v, i) => [v, i] as const).filter((p): p is readonly [number, number] => p[0] !== null).sort((a, b) => a[0] - b[0]);
  const out: (number | null)[] = values.map(() => null);
  const n = idx.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const rank = (i + j) / 2;
    for (let k = i; k <= j; k++) out[idx[k][1]] = n === 1 ? 0.5 : rank / (n - 1);
    i = j + 1;
  }
  return out;
}

/** Cell background for a percentile: red below the midpoint, green above, stronger towards the ends. */
export function tintFor(p: number | null, lowerIsBetter = false): string {
  if (p === null) return 'transparent';
  const s = (p - 0.5) * 2 * (lowerIsBetter ? -1 : 1);
  const strength = Math.round(Math.abs(s) * TINT_STRENGTH * 100) / 100;
  if (strength === 0) return 'transparent';
  return `color-mix(in srgb, var(${s > 0 ? '--win' : '--loss'}) ${strength}%, transparent)`;
}
```

`packages/web/src/lib/playerdb/rosters.ts`:
```ts
import type { PlayerId, Season, UserId } from '@fantasy-dash/core';

/** Who holds each player now: the last played week's lineups (bench included), then every later transaction in created order. */
export function rosterMap(season: Season): Record<PlayerId, UserId> {
  const out: Record<PlayerId, UserId> = {};
  const last = [...season.weeks].reverse().find((w) => w.played && w.games.length > 0);
  if (last) {
    for (const g of last.games) for (const side of g.sides) {
      for (const e of side.starters) if (e.player) out[e.player.playerId] = side.userId;
      for (const b of side.bench) out[b.playerId] = side.userId;
    }
  }
  const after = last?.week ?? 0;
  const later = season.transactions.filter((t) => t.week > after).sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
  for (const t of later) {
    for (const d of t.drops) if (out[d.playerId] === d.userId) delete out[d.playerId];
    for (const a of t.adds) out[a.playerId] = a.userId;
  }
  return out;
}
```

`packages/web/src/lib/playerdb/url.ts`:
```ts
import { COLUMNS, DEFAULT_SORT, TABS, type Mode, type Tab } from './columns';

/** 'all' | 'rostered' | 'fa' | a manager's user id */
export type RosterFilter = string;

export interface DbState { tab: Tab; from: number; to: number; mode: Mode; roster: RosterFilter; sort: string; dir: 'asc' | 'desc'; q: string }

const clampWeek = (v: string | null, fallback: number, max: number): number => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
};

export function parseState(params: URLSearchParams, throughWeek: number): DbState {
  const max = Math.max(1, throughWeek);
  const tab = params.get('tab') as Tab | null;
  const mode = params.get('mode');
  const sort = params.get('sort');
  const dir = params.get('dir');
  let from = clampWeek(params.get('from'), 1, max);
  let to = clampWeek(params.get('to'), max, max);
  if (from > to) [from, to] = [to, from];
  return {
    tab: tab && TABS.includes(tab) ? tab : 'all',
    from, to,
    mode: mode === 'pg' ? 'pg' : 'total',
    roster: params.get('roster') || 'all',
    sort: sort && COLUMNS[sort] ? sort : DEFAULT_SORT,
    dir: dir === 'asc' ? 'asc' : 'desc',
    q: params.get('q') ?? '',
  };
}

export function serializeState(s: DbState, throughWeek: number): URLSearchParams {
  const p = new URLSearchParams();
  if (s.tab !== 'all') p.set('tab', s.tab);
  if (s.from !== 1) p.set('from', String(s.from));
  if (s.to !== Math.max(1, throughWeek)) p.set('to', String(s.to));
  if (s.mode !== 'total') p.set('mode', s.mode);
  if (s.roster !== 'all') p.set('roster', s.roster);
  if (s.sort !== DEFAULT_SORT) p.set('sort', s.sort);
  if (s.dir !== 'desc') p.set('dir', s.dir);
  if (s.q) p.set('q', s.q);
  return p;
}
```

`packages/web/src/lib/playerdb/directory.ts`:
```ts
import type { PlayerDb, PlayerDirectory } from '@fantasy-dash/core';

const cache = new WeakMap<PlayerDb, PlayerDirectory>();

/** The database's players as a PlayerDirectory, so Headshot, PosPill and the name helpers work for unrostered players too. */
export function dbDirectory(db: PlayerDb): PlayerDirectory {
  let d = cache.get(db);
  if (d) return d;
  d = {};
  for (const p of Object.values(db.players)) {
    const [firstName, ...rest] = p.name.split(' ');
    d[p.id] = { id: p.id, name: p.name, firstName, lastName: rest.join(' '), position: p.pos, team: p.teams[p.teams.length - 1] ?? null, yearsExp: p.yearsExp, birthDate: p.birthDate };
  }
  cache.set(db, d);
  return d;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd packages/web && npx vitest run src/lib/playerdb > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/playerdb
git commit -m "Player db web: percentile tints, roster attribution, URL state

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Toolbar component

**Files:**
- Create: `packages/web/src/components/players/db/PlayerDbToolbar.tsx`
- Test: `packages/web/src/components/players/db/PlayerDbToolbar.test.tsx`

**Interfaces:**
- Consumes: `DbState`, `TABS`, `Mode`, `SeasonPicker`.
- Produces: `PlayerDbToolbar` with props `{ state: DbState; onChange: (patch: Partial<DbState>) => void; years: number[]; year: number; onYear: (y: number) => void; throughWeek: number; managers: { userId: string; name: string }[] }`. Search is debounced 150 ms.

- [ ] **Step 1: Failing test**

`packages/web/src/components/players/db/PlayerDbToolbar.test.tsx`:
```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import PlayerDbToolbar from './PlayerDbToolbar';
import type { DbState } from '../../../lib/playerdb/url';

const state: DbState = { tab: 'all', from: 1, to: 6, mode: 'total', roster: 'all', sort: 'pts', dir: 'desc', q: '' };
const managers = [{ userId: '1', name: 'Alice' }, { userId: '2', name: 'Bob' }];

function setup(over: Partial<DbState> = {}) {
  const onChange = vi.fn();
  const onYear = vi.fn();
  render(<PlayerDbToolbar state={{ ...state, ...over }} onChange={onChange} years={[2025, 2026]} year={2026} onYear={onYear} throughWeek={6} managers={managers} />);
  return { onChange, onYear };
}

describe('PlayerDbToolbar', () => {
  it('switches tabs, marking the current one pressed', () => {
    const { onChange } = setup({ tab: 'wr' });
    expect(screen.getByRole('button', { name: 'WR' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'RB' }));
    expect(onChange).toHaveBeenCalledWith({ tab: 'rb' });
  });
  it('sets the week range from the selects and the chips', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ from: 3 });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({ to: 5 });
    fireEvent.click(screen.getByRole('button', { name: 'Last 4' }));
    expect(onChange).toHaveBeenCalledWith({ from: 3, to: 6 });
    fireEvent.click(screen.getByRole('button', { name: 'Season' }));
    expect(onChange).toHaveBeenCalledWith({ from: 1, to: 6 });
  });
  it('toggles per-game mode and the roster filter, listing every manager', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Per game' }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'pg' });
    const roster = screen.getByLabelText('Roster') as HTMLSelectElement;
    expect([...roster.options].map((o) => o.textContent)).toEqual(['All players', 'Rostered', 'Free agents', 'Alice', 'Bob']);
    fireEvent.change(roster, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({ roster: '2' });
  });
  it('debounces the search box and changes the season', () => {
    vi.useFakeTimers();
    const { onChange, onYear } = setup();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search players' }), { target: { value: 'egb' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onChange).toHaveBeenCalledWith({ q: 'egb' });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '2025' } }); // the season picker is the first select
    expect(onYear).toHaveBeenCalledWith(2025);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/web && npx vitest run src/components/players/db > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/web/src/components/players/db/PlayerDbToolbar.tsx`:
```tsx
import { useEffect, useState } from 'react';
import SeasonPicker from '../../SeasonPicker';
import { TABS, type Tab } from '../../../lib/playerdb/columns';
import type { DbState } from '../../../lib/playerdb/url';

interface Props {
  state: DbState;
  onChange: (patch: Partial<DbState>) => void;
  years: number[];
  year: number;
  onYear: (y: number) => void;
  throughWeek: number;
  managers: { userId: string; name: string }[];
}

const TAB_LABELS: Record<Tab, string> = { all: 'All', qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE' };
const pill = (on: boolean) => `rounded-full px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`;
const select = 'num rounded border border-line bg-surface px-2 py-1 text-ink';

/** Position tabs, season, week range, total/per-game, roster filter and search. Everything it changes lives in the URL. */
export default function PlayerDbToolbar({ state, onChange, years, year, onYear, throughWeek, managers }: Props) {
  const weeks = Array.from({ length: Math.max(1, throughWeek) }, (_, i) => i + 1);
  const [q, setQ] = useState(state.q);
  useEffect(() => { setQ(state.q); }, [state.q]);
  useEffect(() => {
    if (q === state.q) return;
    const t = setTimeout(() => onChange({ q }), 150);
    return () => clearTimeout(t);
  }, [q, state.q, onChange]);

  return (
    <div className="sticky top-12 z-[5] -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg/90 px-4 py-2 text-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div role="group" aria-label="Position" className="flex gap-1">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={state.tab === t} onClick={() => onChange({ tab: t })} className={pill(state.tab === t)}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <SeasonPicker years={years} value={year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
      <div className="flex items-center gap-2 text-muted">
        <label className="flex items-center gap-1">From
          <select aria-label="From" value={state.from} onChange={(e) => onChange({ from: Number(e.target.value) })} className={select}>
            {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">To
          <select aria-label="To" value={state.to} onChange={(e) => onChange({ to: Number(e.target.value) })} className={select}>
            {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => onChange({ from: Math.max(1, throughWeek - 3), to: Math.max(1, throughWeek) })} className={pill(false)}>Last 4</button>
        <button type="button" onClick={() => onChange({ from: 1, to: Math.max(1, throughWeek) })} className={pill(false)}>Season</button>
      </div>
      <div role="group" aria-label="Mode" className="flex gap-1">
        <button type="button" aria-pressed={state.mode === 'total'} onClick={() => onChange({ mode: 'total' })} className={pill(state.mode === 'total')}>Total</button>
        <button type="button" aria-pressed={state.mode === 'pg'} onClick={() => onChange({ mode: 'pg' })} className={pill(state.mode === 'pg')}>Per game</button>
      </div>
      <label className="flex items-center gap-2 text-muted">Roster
        <select aria-label="Roster" value={state.roster} onChange={(e) => onChange({ roster: e.target.value })} className={select}>
          <option value="all">All players</option>
          <option value="rostered">Rostered</option>
          <option value="fa">Free agents</option>
          {managers.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </label>
      <input type="search" aria-label="Search players" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-ink sm:max-w-56" />
    </div>
  );
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd packages/web && npx vitest run src/components/players/db > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/players/db
git commit -m "Player db web: toolbar

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: The table, tinted cells and week expansion

**Files:**
- Create: `packages/web/src/components/players/db/TintCell.tsx`, `WeekRows.tsx`, `PlayerDbTable.tsx`
- Test: `packages/web/src/components/players/db/PlayerDbTable.test.tsx`

**Interfaces:**
- Consumes: `Agg`, `aggregateWeeks`, `groupsFor`, `columnValue`, `belowMin`, `fmtValue`, `COLUMNS`, `percentiles`, `tintFor`, `dbDirectory`, `Headshot`, `PosPill`, `Avatar`, `TeamLink`, `DbState`.
- Produces:
  - `PlayerDbTable` props `{ db: PlayerDb; aggs: Agg[]; state: DbState; onSort: (key: string) => void; year: number; managers: Record<UserId, Manager>; rosters: Record<PlayerId, UserId>; collapsed: ReadonlySet<string>; onToggleGroup: (group: string) => void }`. It sorts, tints, pages (25 + Show 25 more) and expands one row at a time.
  - `useCollapsedGroups(tab): [ReadonlySet<string>, (group: string) => void]` persisted in `localStorage` key `playerdb.collapsed.{tab}`.
  - `sortAggs(aggs, state): Agg[]` exported for the page's count line.
  - `TintCell` props `{ value: number | null; col: ColumnDef; mode: Mode; tint: string; dim: boolean; est: boolean }`.
  - `WeekRows` props `{ db: PlayerDb; agg: Agg; cols: ColumnDef[]; mode: Mode; span: number }` rendering one `<tr>` whose single cell spans the table and holds the nested week table.

- [ ] **Step 1: Failing test**

`packages/web/src/components/players/db/PlayerDbTable.test.tsx`:
```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useState } from 'react';
import PlayerDbTable, { sortAggs, useCollapsedGroups } from './PlayerDbTable';
import { aggregate } from '../../../lib/playerdb/aggregate';
import { tabPositions } from '../../../lib/playerdb/columns';
import type { DbState } from '../../../lib/playerdb/url';
import { miniDb } from '../../../test/playerDbFixtures';

const base: DbState = { tab: 'wr', from: 1, to: 3, mode: 'total', roster: 'all', sort: 'pts', dir: 'desc', q: '' };
const managers = { A: { userId: 'A', displayName: 'Alice', teamName: 'Team A', avatar: null, rosterId: 1 } };

function Harness({ state: initial, collapsed = new Set<string>() }: { state: DbState; collapsed?: Set<string> }) {
  const [state, setState] = useState(initial);
  const [col, setCol] = useState<ReadonlySet<string>>(collapsed);
  const db = miniDb();
  const aggs = aggregate(db, state.from, state.to).filter((a) => tabPositions(state.tab).includes(db.players[a.id].pos));
  return (
    <PlayerDbTable db={db} aggs={aggs} state={state} year={2026} managers={managers} rosters={{ w1: 'A' }} collapsed={col}
      onToggleGroup={(g) => setCol((c) => { const n = new Set(c); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
      onSort={(key) => setState((s) => ({ ...s, sort: key, dir: s.sort === key ? (s.dir === 'desc' ? 'asc' : 'desc') : 'desc' }))} />
  );
}
const names = () => screen.getAllByTestId('db-row').map((r) => within(r).getByTestId('db-name').textContent);

describe('PlayerDbTable', () => {
  it('sorts by points by default, flips on a second click, and ranks rows', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    expect(names()).toEqual(['Wide One', 'Tight One', 'Wide Two']);
    const tgt = screen.getByRole('columnheader', { name: /^Tgt/ });
    fireEvent.click(within(tgt).getByRole('button'));
    expect(names()).toEqual(['Wide One', 'Tight One', 'Wide Two']);
    fireEvent.click(within(tgt).getByRole('button'));
    expect(names()).toEqual(['Wide Two', 'Tight One', 'Wide One']);
    expect(screen.getAllByTestId('db-row')[0]).toHaveTextContent(/^1/);
  });
  it('shows the manager for rostered players, FA otherwise, with a sticky lead block', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    const rows = screen.getAllByTestId('db-row');
    expect(within(rows[0]).getByRole('link', { name: 'Team A' })).toHaveAttribute('href', '/teams/2026/A');
    expect(within(rows[1]).getByText('FA')).toBeInTheDocument();
    expect(within(rows[0]).getByTestId('db-name').closest('td')).toHaveClass('sticky');
  });
  it('tints rate cells by percentile and leaves points untinted', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    const rows = screen.getAllByTestId('db-row');
    expect(within(rows[0]).getByTestId('cell-tgt').style.background).toContain('--win');   // Wide One, 26 targets
    expect(within(rows[2]).getByTestId('cell-tgt').style.background).toContain('--loss');  // Wide Two, 10 targets
    expect(within(rows[0]).getByTestId('cell-pts').style.background).toBe('');
  });
  it('dims a rate under the sample minimum and shows a dash for a missing value', () => {
    render(<MemoryRouter><Harness state={{ ...base, tab: 'rb' }} /></MemoryRouter>);
    const r1 = screen.getByTestId('db-row');
    expect(within(r1).getByTestId('cell-ypt')).toHaveClass('text-muted');        // 6 targets < 3 × 3
    expect(within(r1).getByTestId('cell-ypt').style.background).toBe('');
    expect(within(r1).getByTestId('cell-ypc')).not.toHaveClass('text-muted');    // 50 carries ≥ 5 × 3
    expect(within(r1).getByTestId('cell-ybc')).toHaveTextContent('–');           // no PFR data in the fixture
  });
  it('marks estimated route columns', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    expect(within(screen.getAllByTestId('db-row')[0]).getByTestId('cell-yprr')).toHaveTextContent('°');
    expect(screen.getByRole('columnheader', { name: /^YPRR/ })).toHaveAttribute('title', expect.stringContaining('Estimated'));
  });
  it('collapses a group to one narrow column and expands it again', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    expect(screen.getByRole('columnheader', { name: /^Catch%/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Receiving' }));
    expect(screen.queryByRole('columnheader', { name: /^Catch%/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Receiving' }));
    expect(screen.getByRole('columnheader', { name: /^Catch%/ })).toBeInTheDocument();
  });
  it('expands one row at a time into its weeks', () => {
    render(<MemoryRouter><Harness state={base} /></MemoryRouter>);
    fireEvent.click(within(screen.getAllByTestId('db-row')[0]).getByTestId('db-name'));
    let weeks = screen.getByTestId('db-weeks');
    expect(within(weeks).getAllByTestId('db-week').map((r) => r.textContent?.slice(0, 1))).toEqual(['1', '2', '3']);
    expect(within(weeks).getByTestId('db-week-total')).toHaveTextContent('50.0');
    fireEvent.click(within(screen.getAllByTestId('db-row')[1]).getByTestId('db-name'));
    weeks = screen.getByTestId('db-weeks');
    expect(within(weeks).getAllByTestId('db-week')).toHaveLength(3);
    expect(screen.getAllByTestId('db-weeks')).toHaveLength(1);
    fireEvent.click(within(screen.getAllByTestId('db-row')[1]).getByTestId('db-name'));
    expect(screen.queryByTestId('db-weeks')).toBeNull();
  });
  it('pages 25 at a time', () => {
    const db = miniDb();
    const many = Array.from({ length: 30 }, (_, i) => ({ ...db.rows[2], id: `w${i + 10}`, pts: 30 - i }));
    db.rows = [...db.rows, ...many];
    for (const r of many) db.players[r.id] = { ...db.players.w1, id: r.id, name: `Extra ${r.id}` };
    const aggs = aggregate(db, 1, 3).filter((a) => db.players[a.id].pos === 'WR');
    render(<MemoryRouter><PlayerDbTable db={db} aggs={aggs} state={base} year={2026} managers={{}} rosters={{}} collapsed={new Set()} onToggleGroup={() => {}} onSort={() => {}} /></MemoryRouter>);
    expect(screen.getAllByTestId('db-row')).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: 'Show 25 more' }));
    expect(screen.getAllByTestId('db-row')).toHaveLength(32);
    expect(screen.queryByRole('button', { name: 'Show 25 more' })).toBeNull();
  });
  it('sortAggs puts nulls last in both directions', () => {
    const db = miniDb();
    const aggs = aggregate(db, 1, 3);
    const asc = sortAggs(aggs, { ...base, sort: 'sep', dir: 'asc' }).map((a) => a.id);
    const desc = sortAggs(aggs, { ...base, sort: 'sep', dir: 'desc' }).map((a) => a.id);
    expect(asc[0]).toBe('w1'); expect(desc[0]).toBe('w1');
    expect(asc.slice(1).sort()).toEqual(desc.slice(1).sort());
  });
  it('useCollapsedGroups persists per tab', () => {
    function Probe() {
      const [c, toggle] = useCollapsedGroups('rb');
      return <button onClick={() => toggle('Rushing')}>{[...c].join(',') || 'none'}</button>;
    }
    render(<Probe />);
    expect(screen.getByRole('button')).toHaveTextContent('none');
    act(() => { fireEvent.click(screen.getByRole('button')); });
    expect(screen.getByRole('button')).toHaveTextContent('Rushing');
    expect(localStorage.getItem('playerdb.collapsed.rb')).toBe('["Rushing"]');
    localStorage.clear();
  });
});
```
- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/web && npx vitest run src/components/players/db/PlayerDbTable.test.tsx > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/web/src/components/players/db/TintCell.tsx`:
```tsx
import { fmtValue, type ColumnDef, type Mode } from '../../../lib/playerdb/columns';

interface Props { value: number | null; col: ColumnDef; mode: Mode; tint: string; dim: boolean; est: boolean }

/** One numeric cell: percentile tint behind normal ink, muted when under the sample minimum, ° after an estimated route number. */
export default function TintCell({ value, col, mode, tint, dim, est }: Props) {
  const text = fmtValue(value, col.fmt, mode);
  const tone = col.fmt === 'signed1' && value !== null && value !== 0 ? (value > 0 ? 'text-win' : 'text-loss') : '';
  return (
    <td data-testid={`cell-${col.key}`} className={`num whitespace-nowrap px-2 py-1.5 text-right ${dim || value === null ? 'text-muted' : tone}`} style={dim || tint === 'transparent' ? undefined : { background: tint }}>
      {text}{est && value !== null ? <span className="text-muted">°</span> : null}
    </td>
  );
}
```

`packages/web/src/components/players/db/WeekRows.tsx`:
```tsx
import type { PlayerDb } from '@fantasy-dash/core';
import { aggregateWeeks, type Agg } from '../../../lib/playerdb/aggregate';
import { columnValue, type ColumnDef, type Mode } from '../../../lib/playerdb/columns';
import TintCell from './TintCell';

interface Props { db: PlayerDb; agg: Agg; cols: ColumnDef[]; mode: Mode; span: number }

/** The expanded row: his weeks in the range, one line each, and the range total. */
export default function WeekRows({ db, agg, cols, mode, span }: Props) {
  const weeks = agg.rows.map((r) => ({ row: r, a: aggregateWeeks(db, [r], 1) }));
  const cells = (a: Agg, est: boolean) => cols.map((c) => <TintCell key={c.key} value={columnValue(c, a, 'total')} col={c} mode="total" tint="transparent" dim={false} est={est && Boolean(c.est)} />);
  return (
    <tr data-testid="db-weeks">
      <td colSpan={span} className="bg-surface-2/50 px-3 py-2">
        <table className="w-full text-xs">
          <thead><tr className="section-label"><th className="px-2 py-1 text-left">Wk</th><th className="px-2 py-1 text-left">Opp</th>{cols.map((c) => <th key={c.key} className="px-2 py-1 text-right">{c.label}</th>)}</tr></thead>
          <tbody>
            {weeks.map(({ row, a }) => (
              <tr key={row.week} data-testid="db-week" className="border-t border-line/60">
                <td className="num px-2 py-1">{row.week}</td><td className="px-2 py-1 text-muted">{row.team}{row.opp ? ` v ${row.opp}` : ''}</td>{cells(a, agg.routesEst)}
              </tr>
            ))}
            <tr data-testid="db-week-total" className="border-t border-line font-medium"><td className="px-2 py-1" colSpan={2}>{mode === 'pg' ? 'Per game' : 'Total'}</td>{cols.map((c) => <TintCell key={c.key} value={columnValue(c, agg, mode)} col={c} mode={mode} tint="transparent" dim={false} est={agg.routesEst && Boolean(c.est)} />)}</tr>
          </tbody>
        </table>
      </td>
    </tr>
  );
}
```

`packages/web/src/components/players/db/PlayerDbTable.tsx`:
```tsx
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { Manager, PlayerDb, PlayerId, UserId } from '@fantasy-dash/core';
import Avatar from '../../Avatar';
import Headshot from '../../Headshot';
import PosPill from '../../PosPill';
import { TeamLink } from '../../NameLink';
import type { Agg } from '../../../lib/playerdb/aggregate';
import { COLUMNS, belowMin, columnValue, groupsFor, type ColumnDef, type Tab } from '../../../lib/playerdb/columns';
import { dbDirectory } from '../../../lib/playerdb/directory';
import { percentiles, tintFor } from '../../../lib/playerdb/percentile';
import type { DbState } from '../../../lib/playerdb/url';
import TintCell from './TintCell';
import WeekRows from './WeekRows';

export const PAGE = 25;

interface Props {
  db: PlayerDb;
  aggs: Agg[];
  state: DbState;
  onSort: (key: string) => void;
  year: number;
  managers: Record<UserId, Manager>;
  rosters: Record<PlayerId, UserId>;
  collapsed: ReadonlySet<string>;
  onToggleGroup: (group: string) => void;
}

/** Sort by the state's column, nulls last whichever way, ties by points then id. */
export function sortAggs(aggs: Agg[], state: DbState): Agg[] {
  const col = COLUMNS[state.sort] ?? COLUMNS.pts;
  const sign = state.dir === 'asc' ? 1 : -1;
  return [...aggs].sort((a, b) => {
    const va = columnValue(col, a, state.mode), vb = columnValue(col, b, state.mode);
    if (va === null && vb === null) return (b.s.pts ?? 0) - (a.s.pts ?? 0);
    if (va === null) return 1;
    if (vb === null) return -1;
    return sign * (va - vb) || (b.s.pts ?? 0) - (a.s.pts ?? 0) || (a.id < b.id ? -1 : 1);
  });
}

/** Collapsed column groups for a tab, remembered in localStorage (ignored when storage is unavailable). */
export function useCollapsedGroups(tab: Tab): [ReadonlySet<string>, (group: string) => void] {
  const key = `playerdb.collapsed.${tab}`;
  const [set, setSet] = useState<ReadonlySet<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]); } catch { return new Set(); }
  });
  useEffect(() => {
    try { setSet(new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[])); } catch { setSet(new Set()); }
  }, [key]);
  const toggle = useCallback((group: string) => {
    setSet((c) => {
      const n = new Set(c);
      if (n.has(group)) n.delete(group); else n.add(group);
      try { localStorage.setItem(key, JSON.stringify([...n])); } catch { /* storage unavailable */ }
      return n;
    });
  }, [key]);
  return [set, toggle];
}

const th = 'section-label whitespace-nowrap px-2 py-2 text-right';
const lead = 'sticky bg-surface';

export default function PlayerDbTable({ db, aggs, state, onSort, year, managers, rosters, collapsed, onToggleGroup }: Props) {
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setShown(PAGE); setOpen(null); }, [state.tab, state.from, state.to, state.roster, state.q]);

  const groups = groupsFor(state.tab);
  const leadCols = groups[0].cols;
  const bodyGroups = groups.slice(1);
  const visibleCols: ColumnDef[] = [...leadCols, ...bodyGroups.filter((g) => !collapsed.has(g.group)).flatMap((g) => g.cols)];
  const sorted = useMemo(() => sortAggs(aggs, state), [aggs, state]);
  const tints = useMemo(() => {
    const out = new Map<string, (string | null)[]>();
    for (const c of visibleCols) {
      if (c.tinted === false) continue;
      const values = sorted.map((a) => (belowMin(c, a) ? null : columnValue(c, a, state.mode)));
      out.set(c.key, percentiles(values).map((p) => tintFor(p, c.lowerIsBetter)));
    }
    return out;
  }, [sorted, visibleCols, state.mode]);
  const dir = dbDirectory(db);
  const span = 3 + visibleCols.length;
  const sortArrow = (key: string) => (state.sort === key ? (state.dir === 'desc' ? ' ▾' : ' ▴') : '');
  const headerTitle = (c: ColumnDef) => (c.est && !db.routesReal ? `${c.def}. Estimated from snap share × team dropbacks until the NFL publishes participation data.` : c.def);
  const cell = (c: ColumnDef, a: Agg, i: number) => (
    <TintCell key={c.key} value={columnValue(c, a, state.mode)} col={c} mode={state.mode} tint={tints.get(c.key)?.[i] ?? 'transparent'} dim={belowMin(c, a)} est={Boolean(c.est) && a.routesEst} />
  );

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-[2] bg-surface">
          <tr>
            <th colSpan={3 + leadCols.length} className={`${lead} left-0 z-[3] border-b border-line`} />
            {bodyGroups.map((g) => {
              const off = collapsed.has(g.group);
              return (
                <th key={g.group} colSpan={off ? 1 : g.cols.length} className="section-label border-b border-l border-line px-2 py-1 text-left">
                  <button type="button" aria-label={`${off ? 'Expand' : 'Collapse'} ${g.group}`} onClick={() => onToggleGroup(g.group)} className="hover:text-ink">{off ? '▸ ' : '▾ '}{g.group}</button>
                </th>
              );
            })}
          </tr>
          <tr>
            <th className={`${lead} left-0 z-[3] w-8 border-b border-line px-2 py-2 text-left section-label`}>#</th>
            <th className={`${lead} left-8 z-[3] min-w-48 border-b border-line px-2 py-2 text-left section-label`}>Player</th>
            <th className="section-label border-b border-line px-2 py-2 text-left">Mgr</th>
            {leadCols.map((c) => <HeaderCell key={c.key} col={c} title={headerTitle(c)} arrow={sortArrow(c.key)} onSort={onSort} />)}
            {bodyGroups.map((g) => (collapsed.has(g.group)
              ? <th key={g.group} className={`${th} border-b border-l border-line text-muted`}>…</th>
              : g.cols.map((c, i) => <HeaderCell key={c.key} col={c} title={headerTitle(c)} arrow={sortArrow(c.key)} onSort={onSort} first={i === 0} />)))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, shown).map((a, i) => {
            const p = db.players[a.id];
            const owner = rosters[a.id];
            const m = owner ? managers[owner] : undefined;
            const isOpen = open === a.id;
            return (
              <Fragment key={a.id}>
                <tr data-testid="db-row" className="border-t border-line transition-colors hover:bg-surface-2/60">
                  <td className={`${lead} left-0 num border-b border-line px-2 py-1.5 text-muted`}>{i + 1}</td>
                  <td className={`${lead} left-8 border-b border-line px-2 py-1.5`}>
                    <button type="button" data-testid="db-name" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : a.id)} className="flex items-center gap-2 text-left hover:text-accent">
                      <span className="hidden sm:inline"><Headshot players={dir} id={a.id} size={24} /></span>
                      <span className="font-medium">{p?.name ?? a.id}</span>
                      <span className="text-xs text-muted">{a.team}</span>
                      <PosPill pos={p?.pos ?? '?'} />
                    </button>
                  </td>
                  <td className="border-b border-line px-2 py-1.5">
                    {m ? (
                      <TeamLink userId={owner} year={year} className="flex items-center gap-1.5 text-xs"><Avatar avatar={m.avatar} name={m.displayName} size={18} />{m.teamName ?? m.displayName}</TeamLink>
                    ) : <span className="text-xs text-muted">FA</span>}
                  </td>
                  {leadCols.map((c) => cell(c, a, i))}
                  {bodyGroups.map((g) => (collapsed.has(g.group)
                    ? <td key={g.group} className="border-b border-l border-line" />
                    : g.cols.map((c) => cell(c, a, i))))}
                </tr>
                {isOpen && <WeekRows db={db} agg={a} cols={visibleCols} mode={state.mode} span={span} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && <p className="px-4 py-6 text-sm text-muted">No players match.</p>}
      {shown < sorted.length && (
        <div className="border-t border-line px-4 py-3">
          <button type="button" onClick={() => setShown((s) => s + PAGE)} className="text-sm text-accent hover:underline">Show {PAGE} more</button>
        </div>
      )}
    </div>
  );
}

function HeaderCell({ col, title, arrow, onSort, first = false }: { col: ColumnDef; title: string; arrow: string; onSort: (key: string) => void; first?: boolean }) {
  return (
    <th scope="col" title={title} className={`${th} border-b border-line ${first ? 'border-l' : ''}`}>
      <button type="button" onClick={() => onSort(col.key)} className="hover:text-ink">{col.label}{arrow}</button>
    </th>
  );
}
```
Column alignment: the header's second row and every body row walk `bodyGroups` in the same order, emitting either the group's cells or one placeholder, so counts always match.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd packages/web && npx vitest run src/components/players/db > /tmp/claude-501/t.log 2>&1; echo "exit $?"; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/players/db
git commit -m "Player db web: the table, tinted cells, week expansion

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: The page, route, nav tab and real-data smoke test

**Files:**
- Create: `packages/web/src/pages/PlayersPage.tsx`, `packages/web/src/pages/PlayersPage.test.tsx`, `packages/web/src/lib/playerdb/smoke.test.ts`
- Modify: `packages/web/src/routes.tsx`, `packages/web/src/routes.test.tsx`, `packages/web/src/components/Nav.tsx:15-22`, `packages/web/src/components/Nav.test.tsx`

**Interfaces:**
- Consumes: `loadPlayerDb`, `hasPlayerDb`, `loadSeason`, `aggregate`, `tabPositions`, `parseState`, `serializeState`, `rosterMap`, `PlayerDbToolbar`, `PlayerDbTable`, `useCollapsedGroups`, `sortAggs`, `COLUMNS`, `groupsFor`.
- Produces: route `players/:season` with loader `playersLoader` returning `{ season: Season; db: PlayerDb | null }`; `players` redirect; nav entry.

- [ ] **Step 1: Failing tests**

Add to `packages/web/src/routes.test.tsx`:
```ts
  it('serves the players page per season and sends the bare URL to the current year', async () => {
    expect(RETIRED_PATHS).toEqual({ 'all-time': '/records' });
    expect(child('players')?.element).toBeUndefined();
    expect(await locationOf(run('players'))).toBe(`/players/${currentSeason.year}`);
    expect(child('players/:season')?.element).toBeTruthy();
    await expect(run('players/:season', { season: '1999' })).rejects.toMatchObject({ status: 404 });
    const data = (await run('players/:season', { season: String(currentSeason.year) })) as { season: { year: number }; db: { year: number } | null };
    expect(data.season.year).toBe(currentSeason.year);
    expect(data.db === null || data.db.year === currentSeason.year).toBe(true);
  });
```
and change the first test's expectation to `expect(RETIRED_PATHS).toEqual({ 'all-time': '/records' });` (keep its loop).

Add to `packages/web/src/components/Nav.test.tsx`:
```ts
  it('has a Players tab between Managers and Head to Head', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    const nav = screen.getAllByRole('navigation')[0];
    const labels = [...nav.querySelectorAll('a, button')].map((el) => el.textContent).filter((t) => t && t !== 'Menu');
    const i = labels.indexOf('Players');
    expect(i).toBeGreaterThan(0);
    expect(labels[i - 1]).toBe('Managers');
    expect(labels[i + 1]).toBe('Head to Head');
    expect(nav.querySelector('a[href="/players"]')).not.toBeNull();
  });
```

`packages/web/src/pages/PlayersPage.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import PlayersPage from './PlayersPage';
import { miniDb } from '../test/playerDbFixtures';
import { game, line, season, side, week } from '../test/playerFixtures';

function mount(db: ReturnType<typeof miniDb> | null, path = '/players/2026') {
  const s = season(2026, [week(1, [game(2026, 1, 1, side('A', 100, [line('w1', 10)]), side('B', 90, [line('q1', 20)]))])], null, 1);
  s.managers = { A: { userId: 'A', displayName: 'Alice', teamName: 'Team A', avatar: null, rosterId: 1 }, B: { userId: 'B', displayName: 'Bob', teamName: null, avatar: null, rosterId: 2 } };
  s.standings = [{ userId: 'A', rank: 1, w: 1, l: 0, t: 0, winPct: 1, pf: 100, pa: 90, ppg: 100, maxPoints: 110, efficiency: 0.9, streak: 'W1', allPlay: { w: 1, l: 0, t: 0, pct: 1 }, weeklyHighs: 1 }, { userId: 'B', rank: 2, w: 0, l: 1, t: 0, winPct: 0, pf: 90, pa: 100, ppg: 90, maxPoints: 100, efficiency: 0.9, streak: 'L1', allPlay: { w: 0, l: 1, t: 0, pct: 0 }, weeklyHighs: 0 }];
  const router = createMemoryRouter([{ path: '/players/:season', element: <PlayersPage />, loader: () => ({ season: s, db }) }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('PlayersPage', () => {
  it('renders the table for the season with the count line and the definitions', () => {
    mount(miniDb());
    expect(screen.getByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByText(/Showing 5 of 5 · weeks 1–3 · 2026/)).toBeInTheDocument();
    expect(screen.getAllByTestId('db-row')).toHaveLength(5);
    expect(screen.getByText('Column definitions')).toBeInTheDocument();
  });
  it('filters by tab, roster and search through the URL', () => {
    const router = mount(miniDb(), '/players/2026?tab=wr&roster=A');
    expect(screen.getAllByTestId('db-row')).toHaveLength(1);
    expect(screen.getByTestId('db-name')).toHaveTextContent('Wide One');
    fireEvent.change(screen.getByLabelText('Roster'), { target: { value: 'fa' } });
    expect(router.state.location.search).toBe('?tab=wr&roster=fa');
    expect(screen.getAllByTestId('db-row').map((r) => within(r).getByTestId('db-name').textContent)).toEqual(expect.arrayContaining(['Tight One', 'Wide Two']));
  });
  it('sorts through the URL, first click descending, lower-is-better ascending', () => {
    const router = mount(miniDb(), '/players/2026?tab=qb');
    fireEvent.click(within(screen.getByRole('columnheader', { name: /^INT/ })).getByRole('button'));
    expect(router.state.location.search).toBe('?tab=qb&sort=int&dir=asc');
    fireEvent.click(within(screen.getByRole('columnheader', { name: /^Att/ })).getByRole('button'));
    expect(router.state.location.search).toBe('?tab=qb&sort=att');
  });
  it('explains when the season has no player data yet', () => {
    mount(null);
    expect(screen.getByText('No player data yet for 2026')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
```

`packages/web/src/lib/playerdb/smoke.test.ts`:
```ts
import { readdirSync, readFileSync } from 'node:fs';
import { PlayerDbSchema, type PlayerDb } from '@fantasy-dash/core';
import { aggregate } from './aggregate';
import { TABS, columnValue, columnsFor, tabPositions } from './columns';

const dir = new URL('../../../../../data/playerdb/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('committed player databases', () => {
  it.each(files)('%s validates and aggregates for every tab without NaN', (file) => {
    const db = PlayerDbSchema.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8'))) as PlayerDb;
    expect(db.rows.length).toBeGreaterThan(500);
    const aggs = aggregate(db, 1, db.throughWeek);
    for (const tab of TABS) {
      const rows = aggs.filter((a) => tabPositions(tab).includes(db.players[a.id].pos));
      expect(rows.length, `${file} ${tab}`).toBeGreaterThan(20);
      for (const c of columnsFor(tab)) for (const a of rows) {
        const v = columnValue(c, a, 'total');
        expect(v === null || Number.isFinite(v), `${file} ${tab} ${c.key} ${a.id}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/web && npx vitest run src/routes.test.tsx src/components/Nav.test.tsx src/pages/PlayersPage.test.tsx src/lib/playerdb/smoke.test.ts > /tmp/claude-501/t.log 2>&1; echo "exit $?"`
Expected: exit 1.

- [ ] **Step 3: Implement**

`packages/web/src/pages/PlayersPage.tsx`:
```tsx
import { useCallback, useMemo } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { PlayerDb, Season } from '@fantasy-dash/core';
import PlayerDbToolbar from '../components/players/db/PlayerDbToolbar';
import PlayerDbTable, { sortAggs, useCollapsedGroups } from '../components/players/db/PlayerDbTable';
import SeasonPicker from '../components/SeasonPicker';
import { history } from '../data/load';
import { aggregate } from '../lib/playerdb/aggregate';
import { COLUMNS, groupsFor, tabPositions } from '../lib/playerdb/columns';
import { rosterMap } from '../lib/playerdb/rosters';
import { parseState, serializeState, type DbState } from '../lib/playerdb/url';

export interface PlayersData { season: Season; db: PlayerDb | null }

export default function PlayersPage() {
  const { season, db } = useLoaderData() as PlayersData;
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const onYear = (y: number) => navigate(`/players/${y}`);

  if (!db) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight">Players</h1><SeasonPicker years={years} value={season.year} onChange={(v) => { if (v !== 'all') onYear(v); }} /></div>
        <p className="card px-4 py-6 text-sm text-muted">No player data yet for {season.year}</p>
      </div>
    );
  }
  return <Loaded season={season} db={db} years={years} onYear={onYear} />;
}

function Loaded({ season, db, years, onYear }: { season: Season; db: PlayerDb; years: number[]; onYear: (y: number) => void }) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params, db.throughWeek), [params, db.throughWeek]);
  const onChange = useCallback((patch: Partial<DbState>) => {
    setParams((prev) => serializeState({ ...parseState(prev, db.throughWeek), ...patch }, db.throughWeek), { replace: true });
  }, [setParams, db.throughWeek]);
  const onSort = (key: string) => onChange(state.sort === key ? { dir: state.dir === 'desc' ? 'asc' : 'desc' } : { sort: key, dir: COLUMNS[key]?.lowerIsBetter ? 'asc' : 'desc' });
  const [collapsed, toggleGroup] = useCollapsedGroups(state.tab);

  const rosters = useMemo(() => rosterMap(season), [season]);
  const managerList = season.standings.map((r) => ({ userId: r.userId, name: season.managers[r.userId]?.teamName ?? season.managers[r.userId]?.displayName ?? r.userId }));
  const allAggs = useMemo(() => aggregate(db, state.from, state.to), [db, state.from, state.to]);
  const aggs = useMemo(() => {
    const positions = tabPositions(state.tab);
    const q = state.q.trim().toLowerCase();
    return allAggs.filter((a) => {
      const p = db.players[a.id];
      if (!p || !positions.includes(p.pos)) return false;
      const owner = rosters[a.id];
      if (state.roster === 'rostered' && !owner) return false;
      if (state.roster === 'fa' && owner) return false;
      if (state.roster !== 'all' && state.roster !== 'rostered' && state.roster !== 'fa' && owner !== state.roster) return false;
      return !q || p.name.toLowerCase().includes(q);
    });
  }, [allAggs, db, state.tab, state.roster, state.q, rosters]);
  const shown = Math.min(25, sortAggs(aggs, state).length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="text-sm text-muted">Showing {shown} of {aggs.length} · weeks {state.from}–{state.to} · {db.year}{db.routesReal ? '' : ' · routes estimated'}</p>
      </div>
      <PlayerDbToolbar state={state} onChange={onChange} years={years} year={db.year} onYear={onYear} throughWeek={db.throughWeek} managers={managerList} />
      <PlayerDbTable db={db} aggs={aggs} state={state} onSort={onSort} year={db.year} managers={season.managers} rosters={rosters} collapsed={collapsed} onToggleGroup={toggleGroup} />
      <details className="card px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Column definitions</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {groupsFor(state.tab).flatMap((g) => g.cols).map((c) => (
            <div key={c.key} className="flex gap-2"><dt className="num shrink-0 font-medium">{c.label}</dt><dd className="text-muted">{c.def}{c.est && !db.routesReal ? ' (estimated this season)' : ''}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-muted">Rates are summed numerators over summed denominators across the chosen weeks. Cells are tinted by percentile among the rows shown; a rate under its sample minimum (targets 3, carries 5, routes 10, dropbacks 12, snaps 10 per week) is greyed. xFP is refitted every sync, so early-season values move until the sample settles.</p>
      </details>
    </div>
  );
}
```

`packages/web/src/routes.tsx`:
- import `PlayersPage` and `hasPlayerDb, loadPlayerDb` (extend the `./data/load` import).
- Add after `topTeamLoader`:
```ts
/** The season plus its player database, or null for a year not yet synced; 404 for a year the league never played. */
export async function playersLoader({ params }: LoaderFunctionArgs) {
  const year = Number(params.season);
  if (!history.seasons.some((s) => s.year === year)) throw new Response(`No season ${params.season}`, { status: 404 });
  const [season, db] = await Promise.all([loadSeason(year), hasPlayerDb(year) ? loadPlayerDb(year) : Promise.resolve(null)]);
  return { season, db };
}
```
- Change `RETIRED_PATHS` to `{ 'all-time': '/records' }`.
- Add routes after the managers entries:
```ts
      { path: 'players', loader: () => redirect(`/players/${currentSeason.year}`) },
      { path: 'players/:season', loader: playersLoader, element: <PlayersPage /> },
```

`packages/web/src/components/Nav.tsx`, in the items list, after the managers menu entry:
```ts
  { kind: 'link', to: '/players', label: 'Players' },
```

- [ ] **Step 4: Run the whole web suite and typecheck**

Run: `cd packages/web && npx vitest run > /tmp/claude-501/t.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/t.log; npx tsc --noEmit > /tmp/claude-501/tc.log 2>&1; echo "tsc exit $?"`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "Players tab: page, route, nav, real-data smoke test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Screenshots, closing notes, pull request

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-player-database-design.md` (closing notes section)

- [ ] **Step 1: Build and preview**

```bash
pnpm build > /tmp/claude-501/build.log 2>&1; echo "exit $?"
(cd packages/web && npx vite preview --port 4173 > /tmp/claude-501/preview.log 2>&1 &) ; sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/players/2026
```
Expected: build exit 0, preview answers 200.

- [ ] **Step 2: Screenshots**

Write `/private/tmp/claude-501/shot.mjs` (CDP against headless Chrome on port 9222; start Chrome with `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9222 --window-size=1280,900 about:blank &` if nothing listens):
```js
import { WebSocket } from 'ws'; // or use the scratchpad's existing shot2.mjs pattern
```
If a `shot*.mjs` from an earlier session exists in the scratchpad, reuse it. Capture, dark and light (toggle via the theme button or `localStorage.theme`):
- `/players/2026` at 1280 (All tab, default)
- `/players/2026?tab=wr&sort=yprr` at 1280 with the Receiving group collapsed and the first row expanded (click through CDP before the capture)
- `/players/2025?tab=rb&from=10&to=14&mode=pg` at 1280 (real routes)
- `/players/2026?tab=wr` at 400
Look at each image: the lead block stays put when the table is scrolled sideways, tints read as a gentle heat map, ° marks only on 2026, no horizontal page scroll at 400.

- [ ] **Step 3: Closing notes**

Append to the spec:
```markdown
## Closing notes (implementation)

- Built on branch `player-db`, plan `docs/superpowers/plans/2026-10-17-player-database.md`.
- Data: `data/playerdb/2023–2026.json`; 2023–2025 carry real routes from the participation feed, 2026 estimates until the NFL publishes it.
- Crosswalk misses on the first build: <N> players (practice-squad names), listed in the sync log.
- xFP fitted for all four positions in every season.
- Deviations from the spec, if any, listed here.
```
Fill in the real numbers from the sync log.

- [ ] **Step 4: Full verification and PR**

```bash
pnpm test > /tmp/claude-501/all.log 2>&1; echo "exit $?"; grep -E "Tests " /tmp/claude-501/all.log
pnpm typecheck > /tmp/claude-501/tc.log 2>&1; echo "exit $?"; pnpm typecheck:scripts >> /tmp/claude-501/tc.log 2>&1; echo "exit $?"
git add docs/superpowers/specs/2026-10-17-player-database-design.md
git commit -m "Player db: closing notes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin player-db
gh pr create --title "Players tab: player database" --body "$(cat <<'MSG'
A new **Players** tab: every NFL QB/RB/WR/TE for a season and week range in one sortable, percentile-tinted table, with basic and advanced metrics (snap/route/target share, YPRR, EPA, CPOE, separation, RYOE, xFP, FPOE).

Data comes from a new `pnpm sync:players` step that joins Sleeper's weekly rows with nflverse files (weekly advanced stats, Next Gen Stats, PFR advanced, snap counts, participation for finished seasons) into `data/playerdb/{year}.json`. It runs after the Sleeper sync and cannot block it.

Spec: `docs/superpowers/specs/2026-10-17-player-database-design.md`. Plan: `docs/superpowers/plans/2026-10-17-player-database.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
MSG
)"
```
Then use `superpowers:finishing-a-development-branch`.

## Plan self-review notes

- Spec coverage: sources (Tasks 4–6, 9), schema (1), crosswalk (3), xFP (7), build (8), script/workflow/README (9), loader and aggregation rules (10), columns per tab incl. lower-is-better list and minimums (10), tints (11, 13), roster attribution (11), URL params (11, 14), toolbar (12), table incl. sticky lead, group collapse, paging, expansion, estimated marks (13), route/nav/empty state/definitions (14), smoke test and screenshots (14, 15).
- The spec's "Dropbacks/g" and "Touches/g" are `dbPg` and `touchesPg`; "Deep (40+)" is `deep`; "Rec EPA" is `reEpa`; "8+ box %" is `box8`.
- Not built, by design: FTN charting, K/DEF, player page (see the spec's out-of-scope list).
