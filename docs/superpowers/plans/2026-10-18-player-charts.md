# Player Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four play-by-play graphics to the player page: a route tree (WR, TE, RB), run lanes (RB), passing zones and a pressure & coverage card (QB).

**Architecture:**
- **Core:** a pure builder in `packages/core/src/charts/` turns nflverse play-by-play and participation rows into a per-season `ChartDb` of raw counts, keyed by gsis id.
- **Sync:** `scripts/syncPlayers.ts` gets a second phase that writes `data/charts/{year}.json`.
- **Web:** the app lazy-loads those files and ranks players in the browser with a single generic engine (`lib/charts/rank.ts`) driven by one spec per chart. It draws the four cards as SVG fields that share pieces from `components/charts/Field.tsx`.

**Tech Stack:**
- TypeScript, zod 3
- React 18, react-router 7, Tailwind 4
- Vitest with Testing Library (jsdom)
- tsx for scripts

**Spec:** `docs/superpowers/specs/2026-10-18-player-charts-design.md`

## Global Constraints

**Data:**
- One chart file per season: `data/charts/{year}.json`, players keyed by gsis id. Separate from the player database.
- Tuple orders, fixed:
  - route: `targets, catches, yards, epa, tds`
  - lane: `carries, yards, epa, successes, tds`
  - zone: `attempts, completions, yards, epa, tds, ints, cpoeSum, cpoeN`
  - split: `dropbacks, attempts, completions, yards, epa, sacks`
- Regular season only: weeks 1–18 with `season_type` = `REG`.
- Positions come from that season's player database by gsis id, falling back to nflverse `players.csv`. Only QB, RB, WR and TE are kept.

**Ranking:**
- Within position and within the selected filter.
- `percentiles()` from `lib/playerdb/percentile.ts`, scaled 0–100 and rounded.

| Card | Minimum to be ranked | Share pool |
|---|---|---|
| Route tree | 5 targets | 50+ targets (20+ man or zone) |
| Run lanes | 10 carries | 100+ carries (30+ light or heavy) |
| Passing zones | 10 attempts | 150+ attempts (50+ clean or pressured) |
| Pressure & coverage | 20 dropbacks | None |

- Sack % ranks lower as better.

**Display:**
- The main number is always the actual stat. Small text gives the percentile ("92nd") and the volume.
- Colour:
  - Share uses the heat scale `--heat-0…3`.
  - "How good" metrics use red → yellow → green from `--loss`, `--warn` and `--win`.
  - Unranked items use `--dim`, with "too few to rank".
- New theme tokens, in both dark and light: `--field`, `--field-band`, `--field-line`, `--los`, `--heat-0`, `--heat-1`, `--heat-2`, `--heat-3`, `--on-chip`.
- Passing-zone text has no outline. The chevrons sit at fixed positions in each zone.

**Cards by position:**
- WR and TE: route tree.
- RB: run lanes and route tree.
- QB: passing zones and the pressure card.
- K and DEF: none.
- A card is hidden when the player has no data for it. Its season picker lists only seasons with his data, defaulting to the newest.

## Review Focus

1. **A player with no gsis id, or with no chart data.** Every card must hide without throwing.
   - Pinned by "hides every card when the player has no gsis id" in Task 9.
2. **A player who is ranked in one filter but under the minimum in another.** For example, enough targets on a route overall but not against man. The chip must turn grey with "too few to rank", not show a stale percentile.
   - Pinned by "switching to vs Man greys a route he has too few man targets on" in Task 6.
3. **EPA that rounds to zero.** It must print "+0.00", never "-0.00".
   - Pinned in Task 4's `fmtSigned` test.
4. **Participation rows with blank fields.** Blank `was_pressure`, `defenders_in_box`, `defense_man_zone_type` or `time_to_throw` must leave the play out of that filter but keep it in `all`.
   - Pinned in Task 1.
5. **A season with chart data where the player has no rows for this card,** such as a 2023 rookie's later years. The picker must list only his seasons, and changing the picker must not crash.
   - Pinned by "lists only his chart seasons" in Task 9.

---

## File structure

**Core:**
- Create:
  - `packages/core/src/charts/types.ts`: keys, tuple types and `ChartDb`
  - `packages/core/src/charts/schema.ts`: `ChartDbSchema`
  - `packages/core/src/charts/build.ts`: `buildCharts`, `laneOf`, `zoneOf`
  - `packages/core/src/charts/index.ts`
- Modify: `packages/core/src/index.ts` to export `./charts`
- Test: `packages/core/test/charts/build.test.ts`

**Sync:**
- Modify: `scripts/syncPlayers.ts` to add the charts phase
- Create (generated): `data/charts/2023.json`, `data/charts/2024.json`, `data/charts/2025.json`

**Web lib:**
- Create:
  - `packages/web/src/lib/charts/scale.ts`: colours, formatters, ordinals
  - `packages/web/src/lib/charts/rank.ts`: the generic ranking engine
  - `packages/web/src/lib/charts/specs.ts`: one spec per chart, plus labels
- Tests:
  - `packages/web/src/lib/charts/scale.test.ts`
  - `packages/web/src/lib/charts/rank.test.ts`
  - `packages/web/src/lib/charts/smoke.test.ts`
- Fixture: `packages/web/src/test/chartFixtures.ts`

**Web components:**
- Create in `packages/web/src/components/charts/`:
  - `Field.tsx`: `ChartCard`, `Seg`, `Sidelines`, `Chip`, `Arrowhead`, `Chevrons`, `TipLine`
  - `ChartBars.tsx`
  - `RouteTree.tsx`, `RunLanes.tsx`, `PassingZones.tsx`, `PressureCard.tsx`
- Tests in the same folder:
  - `RouteTree.test.tsx`, `RunLanes.test.tsx`, `PassingZones.test.tsx`, `PressureCard.test.tsx`

**Web wiring:**
- Modify:
  - `packages/web/src/index.css`: theme tokens
  - `packages/web/src/data/load.ts`: `hasCharts`, `loadCharts`
  - `packages/web/src/routes.tsx`: `playerLoader` also loads charts
  - `packages/web/src/pages/PlayerPage.tsx`: the cards
- Tests: modify `packages/web/src/pages/PlayerPage.test.tsx`

Commands used throughout, run from the repo root:
- core tests: `pnpm --filter @fantasy-dash/core exec vitest run <path>`
- web tests: `pnpm --filter @fantasy-dash/web exec vitest run <path>`
- full suite: `pnpm test`
- types: `pnpm typecheck && pnpm typecheck:scripts`
- build: `pnpm build`

---

### Task 1: Core chart builder

**Files:**
- Create:
  - `packages/core/src/charts/types.ts`
  - `packages/core/src/charts/schema.ts`
  - `packages/core/src/charts/build.ts`
  - `packages/core/src/charts/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/charts/build.test.ts`

**Interfaces:**
- Consumes: `DbPos` and `isDbPos` from `packages/core/src/playerdb/types.ts`.
- Produces, from `@fantasy-dash/core`:
  - `ROUTES`, `LANES`, `BANDS`, `SIDES`, `ZONES`, `SPLITS`
  - types `Route`, `Lane`, `Band`, `Side`, `Zone`, `Split`, `Coverage`, `Box`, `Pocket`, `Counts`, `ChartPlayer`, `ChartDb`
  - `ChartDbSchema`
  - `buildCharts(pbp: Iterable<Row>, participation: Iterable<Row>, posOf: (gsis: string) => DbPos | null, year: number, builtAt: string): ChartDb`
  - `laneOf(location: string, gap: string): Lane | null`
  - `zoneOf(airYards: string, location: string): Zone | null`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/charts/build.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCharts, laneOf, zoneOf, ChartDbSchema, type DbPos } from '../../src';

type Row = Record<string, string>;
let nextPlay = 1;
/** one play-by-play row; game 2025_01_AAA_BBB, regular season week 1 unless overridden */
const play = (f: Row): Row => ({ game_id: '2025_01_AAA_BBB', play_id: `${nextPlay++}.0`, season_type: 'REG', week: '1', epa: '0', ...f });
/** the participation row for a play */
const part = (p: Row, f: Row): Row => ({ nflverse_game_id: p.game_id, play_id: String(Math.trunc(Number(p.play_id))), ...f });

const POS: Record<string, DbPos> = { W: 'WR', T: 'TE', R: 'RB', Q: 'QB' };
const posOf = (g: string) => POS[g] ?? null;
const build = (plays: Row[], parts: Row[]) => buildCharts(plays, parts, posOf, 2025, '2026-01-01T00:00:00.000Z');

describe('laneOf / zoneOf', () => {
  it('maps run location and gap to a lane', () => {
    expect(laneOf('middle', '')).toBe('MID');
    expect(laneOf('left', 'end')).toBe('LE');
    expect(laneOf('right', 'guard')).toBe('RG');
    expect(laneOf('left', '')).toBeNull();
    expect(laneOf('', '')).toBeNull();
  });
  it('bands air yards at -1, 0, 9, 10, 19, 20', () => {
    expect(zoneOf('-1', 'left')).toBe('blos|left');
    expect(zoneOf('0', 'left')).toBe('short|left');
    expect(zoneOf('9', 'middle')).toBe('short|middle');
    expect(zoneOf('10', 'right')).toBe('mid|right');
    expect(zoneOf('19', 'right')).toBe('mid|right');
    expect(zoneOf('20', 'right')).toBe('deep|right');
    expect(zoneOf('NA', 'right')).toBeNull();
    expect(zoneOf('5', '')).toBeNull();
  });
});

describe('buildCharts: routes', () => {
  it('credits a routed target to the receiver under all and its coverage, and skips a target with no route', () => {
    const a = play({ receiver_player_id: 'W', complete_pass: '1', receiving_yards: '12', epa: '1.5', pass_touchdown: '1' });
    const b = play({ receiver_player_id: 'W', complete_pass: '0', receiving_yards: '0', epa: '-0.5' });
    const c = play({ receiver_player_id: 'W', complete_pass: '1', receiving_yards: '30' });
    const db = build([a, b, c], [part(a, { route: 'SLANT', defense_man_zone_type: 'MAN_COVERAGE' }), part(b, { route: 'SLANT', defense_man_zone_type: '' }), part(c, { route: '' })]);
    expect(db.players.W.pos).toBe('WR');
    expect(db.players.W.routes!.all.SLANT).toEqual([2, 1, 12, 1, 1]);
    expect(db.players.W.routes!.man.SLANT).toEqual([1, 1, 12, 1.5, 1]);
    expect(db.players.W.routes!.zone.SLANT).toBeUndefined();
    expect(db.players.W.lanes).toBeUndefined();
  });
  it('keeps a TE and an RB target, drops a receiver of another position or with no position', () => {
    const a = play({ receiver_player_id: 'T' }), b = play({ receiver_player_id: 'R' }), c = play({ receiver_player_id: 'X' }), d = play({ receiver_player_id: 'Q' });
    const db = build([a, b, c, d], [a, b, c, d].map((p) => part(p, { route: 'GO', defense_man_zone_type: 'ZONE_COVERAGE' })));
    expect(db.players.T.routes!.all.GO![0]).toBe(1);
    expect(db.players.R.routes!.all.GO![0]).toBe(1);
    expect(db.players.X).toBeUndefined();
    expect(db.players.Q?.routes).toBeUndefined();
  });
  it('ignores postseason and week 19+ plays', () => {
    const a = play({ receiver_player_id: 'W', season_type: 'POST', week: '19' }), b = play({ receiver_player_id: 'W', week: '19' });
    const db = build([a, b], [part(a, { route: 'GO' }), part(b, { route: 'GO' })]);
    expect(db.players.W).toBeUndefined();
  });
});

describe('buildCharts: lanes', () => {
  it('files RB carries by lane and box, counts success as positive EPA, skips scrambles and missing gaps', () => {
    const a = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'left', run_gap: 'tackle', yards_gained: '6', epa: '0.4', rush_touchdown: '1' });
    const b = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'left', run_gap: 'tackle', yards_gained: '-1', epa: '-0.6' });
    const c = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'left', run_gap: '', yards_gained: '3' });
    const d = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'middle', run_gap: '', qb_scramble: '1', yards_gained: '9' });
    const db = build([a, b, c, d], [part(a, { defenders_in_box: '6' }), part(b, { defenders_in_box: '8' }), part(c, {}), part(d, {})]);
    const lanes = db.players.R.lanes!;
    expect(lanes.all.LT).toEqual([2, 5, -0.2, 1, 1]);
    expect(lanes.light.LT).toEqual([1, 6, 0.4, 1, 1]);
    expect(lanes.heavy.LT).toEqual([1, -1, -0.6, 0, 0]);
    expect(lanes.all.MID).toBeUndefined();
  });
  it('a carry with no box count goes only into all; a WR carry is not charted', () => {
    const a = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'right', run_gap: 'end', yards_gained: '4' });
    const b = play({ rush_attempt: '1', rusher_player_id: 'W', run_location: 'right', run_gap: 'end', yards_gained: '4' });
    const db = build([a, b], [part(a, { defenders_in_box: '' })]);
    expect(db.players.R.lanes!.all.RE![0]).toBe(1);
    expect(db.players.R.lanes!.light.RE).toBeUndefined();
    expect(db.players.R.lanes!.heavy.RE).toBeUndefined();
    expect(db.players.W?.lanes).toBeUndefined();
  });
});

describe('buildCharts: zones and splits', () => {
  const qb = (f: Row) => play({ pass_attempt: '1', passer_player_id: 'Q', sack: '0', ...f });
  it('files attempts by zone and pocket; a sack counts as a dropback but not a zone attempt', () => {
    const a = qb({ air_yards: '8', pass_location: 'right', complete_pass: '1', passing_yards: '11', epa: '0.9', pass_touchdown: '1', cpoe: '12.5' });
    const b = qb({ air_yards: '25', pass_location: 'left', complete_pass: '0', passing_yards: '0', epa: '-1.1', interception: '1', cpoe: 'NA' });
    const s = qb({ sack: '1', epa: '-2' });
    const db = build([a, b, s], [
      part(a, { was_pressure: 'FALSE', number_of_pass_rushers: '4', defense_man_zone_type: 'ZONE_COVERAGE', defense_coverage_type: 'COVER_3', time_to_throw: '2.1' }),
      part(b, { was_pressure: 'TRUE', number_of_pass_rushers: '6', defense_man_zone_type: 'MAN_COVERAGE', defense_coverage_type: 'COVER_9', time_to_throw: '3.4' }),
      part(s, { was_pressure: 'TRUE', number_of_pass_rushers: '', defense_man_zone_type: '', defense_coverage_type: '', time_to_throw: '' }),
    ]);
    const z = db.players.Q.zones!, sp = db.players.Q.splits!;
    expect(z.all['short|right']).toEqual([1, 1, 11, 0.9, 1, 0, 12.5, 1]);
    expect(z.clean['short|right']).toEqual([1, 1, 11, 0.9, 1, 0, 12.5, 1]);
    expect(z.pressured['deep|left']).toEqual([1, 0, 0, -1.1, 0, 1, 0, 0]);
    expect(sp.all).toEqual([3, 2, 1, 11, -2.2, 1]);
    expect(sp.pressured).toEqual([2, 1, 0, 0, -3.1, 1]);
    expect(sp.clean).toEqual([1, 1, 1, 11, 0.9, 0]);
    expect(sp.blitz).toEqual([1, 1, 0, 0, -1.1, 0]);
    expect(sp.noblitz).toEqual([1, 1, 1, 11, 0.9, 0]);
    expect(sp.man![0]).toBe(1);
    expect(sp.zone![0]).toBe(1);
    expect(sp.COVER_3![0]).toBe(1);
    expect(Object.keys(sp)).not.toContain('COVER_9');
    expect(sp.quick![0]).toBe(1);
    expect(sp.hold![0]).toBe(1);
  });
  it('a dropback with no participation row counts only in all', () => {
    const a = qb({ air_yards: '3', pass_location: 'middle', complete_pass: '1', passing_yards: '3' });
    const db = build([a], []);
    expect(db.players.Q.splits).toEqual({ all: [1, 1, 1, 3, 0, 0] });
    expect(db.players.Q.zones!.all['short|middle']![0]).toBe(1);
    expect(db.players.Q.zones!.clean).toEqual({});
  });
  it('the result parses with ChartDbSchema', () => {
    const a = qb({ air_yards: '3', pass_location: 'middle' });
    expect(() => ChartDbSchema.parse(build([a], [part(a, { was_pressure: 'FALSE' })]))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/core exec vitest run test/charts/build.test.ts`
Expected: FAIL. The imports `buildCharts`, `laneOf` and `zoneOf` are not exported.

- [ ] **Step 3: Write the types**

Create `packages/core/src/charts/types.ts`:

```ts
import type { DbPos } from '../playerdb/types';

/** nflverse participation `route` values: the route the targeted receiver ran */
export const ROUTES = ['QUICK OUT', 'HITCH/CURL', 'GO', 'SCREEN', 'IN/DIG', 'DEEP OUT', 'SHALLOW CROSS/DRAG', 'SLANT', 'POST', 'SWING', 'CORNER', 'WHEEL', 'TEXAS/ANGLE'] as const;
export type Route = (typeof ROUTES)[number];
/** run lanes, offense's left to right */
export const LANES = ['LE', 'LT', 'LG', 'MID', 'RG', 'RT', 'RE'] as const;
export type Lane = (typeof LANES)[number];
/** air-yard bands: behind the line, 0–9, 10–19, 20+ */
export const BANDS = ['blos', 'short', 'mid', 'deep'] as const;
export type Band = (typeof BANDS)[number];
export const SIDES = ['left', 'middle', 'right'] as const;
export type Side = (typeof SIDES)[number];
export type Zone = `${Band}|${Side}`;
export const ZONES: readonly Zone[] = BANDS.flatMap((b) => SIDES.map((s) => `${b}|${s}` as Zone));
export const SPLITS = ['all', 'clean', 'pressured', 'noblitz', 'blitz', 'man', 'zone', 'COVER_0', 'COVER_1', 'COVER_2', 'COVER_3', 'COVER_4', 'COVER_6', 'quick', 'hold'] as const;
export type Split = (typeof SPLITS)[number];
export type Coverage = 'all' | 'man' | 'zone';
export type Box = 'all' | 'light' | 'heavy';
export type Pocket = 'all' | 'clean' | 'pressured';

/**
 * A fixed-order tuple of sums.
 * route: targets, catches, yards, epa, tds
 * lane:  carries, yards, epa, successes (epa > 0), tds
 * zone:  attempts, completions, yards, epa, tds, ints, cpoeSum, cpoeN
 * split: dropbacks, attempts, completions, yards, epa, sacks
 */
export type Counts = number[];

export interface ChartPlayer {
  pos: DbPos;
  routes?: Record<Coverage, Partial<Record<Route, Counts>>>;
  lanes?: Record<Box, Partial<Record<Lane, Counts>>>;
  zones?: Record<Pocket, Partial<Record<Zone, Counts>>>;
  splits?: Partial<Record<Split, Counts>>;
}

/** One season of play-by-play chart counts, keyed by gsis id. Regular season, weeks 1–18. */
export interface ChartDb {
  year: number;
  builtAt: string;
  players: Record<string, ChartPlayer>;
}
```

- [ ] **Step 4: Write the schema**

Create `packages/core/src/charts/schema.ts`:

```ts
import { z } from 'zod';
import { LANES, ROUTES, SPLITS, ZONES } from './types';

const tuple = (n: number) => z.array(z.number()).length(n);
const table = <T extends readonly [string, ...string[]]>(keys: T, n: number) => z.record(z.enum(keys), tuple(n));
const ZoneEnum = ZONES as unknown as readonly [string, ...string[]];

export const ChartDbSchema = z.object({
  year: z.number(),
  builtAt: z.string(),
  players: z.record(z.object({
    pos: z.enum(['QB', 'RB', 'WR', 'TE']),
    routes: z.object({ all: table(ROUTES, 5), man: table(ROUTES, 5), zone: table(ROUTES, 5) }).optional(),
    lanes: z.object({ all: table(LANES, 5), light: table(LANES, 5), heavy: table(LANES, 5) }).optional(),
    zones: z.object({ all: table(ZoneEnum, 8), clean: table(ZoneEnum, 8), pressured: table(ZoneEnum, 8) }).optional(),
    splits: table(SPLITS, 6).optional(),
  })),
});
```

- [ ] **Step 5: Write the builder**

Create `packages/core/src/charts/build.ts`:

```ts
import type { DbPos } from '../playerdb/types';
import { ROUTES, type Band, type ChartDb, type ChartPlayer, type Counts, type Lane, type Route, type Split, type Zone } from './types';

type Row = Record<string, string>;
const present = (v: string | undefined): v is string => v !== undefined && v !== '' && v !== 'NA';
const num = (v: string | undefined): number => { const x = Number(v); return present(v) && Number.isFinite(x) ? x : 0; };
const playKey = (game: string | undefined, play: string | undefined) => `${game ?? ''}|${Math.trunc(Number(play))}`;
const ROUTE_SET = new Set<string>(ROUTES);

/** The run lane from nflverse run_location and run_gap; null when either is missing. */
export function laneOf(location: string, gap: string): Lane | null {
  if (location === 'middle') return 'MID';
  if (location !== 'left' && location !== 'right') return null;
  const g = ({ end: 'E', tackle: 'T', guard: 'G' } as Record<string, string>)[gap];
  return g ? (`${location === 'left' ? 'L' : 'R'}${g}` as Lane) : null;
}

/** The passing zone from air yards and pass_location; null when either is missing. */
export function zoneOf(airYards: string, location: string): Zone | null {
  if (!present(airYards) || !['left', 'middle', 'right'].includes(location)) return null;
  const ay = Number(airYards);
  const band: Band = ay < 0 ? 'blos' : ay < 10 ? 'short' : ay < 20 ? 'mid' : 'deep';
  return `${band}|${location}` as Zone;
}

function bump<K extends string>(table: Partial<Record<K, Counts>>, key: K, values: number[]) {
  const c = (table[key] ??= values.map(() => 0));
  values.forEach((v, i) => { c[i] += v; });
}

const round = (v: number, places: number) => { const f = 10 ** places; const r = Math.round(v * f) / f; return r === 0 ? 0 : r; };
/** yards and counts to integers, epa to 2 places, cpoe sums to 1 place */
function roundAll(p: ChartPlayer) {
  const fix = (t: Partial<Record<string, Counts>>, epaAt: number, extra: Record<number, number> = {}) => {
    for (const c of Object.values(t)) if (c) c.forEach((v, i) => { c[i] = round(v, i === epaAt ? 2 : extra[i] ?? 0); });
  };
  if (p.routes) for (const t of Object.values(p.routes)) fix(t, 3);
  if (p.lanes) for (const t of Object.values(p.lanes)) fix(t, 2);
  if (p.zones) for (const t of Object.values(p.zones)) fix(t, 3, { 6: 1 });
  if (p.splits) fix(p.splits, 4);
}

/**
 * Play-by-play joined to participation (on game and play), as per-player chart counts.
 * Routes for WR/TE/RB targets with a route; lanes for RB carries (not scrambles); zones and splits for QB dropbacks.
 * Blank participation fields leave a play out of that filter but keep it in `all`.
 */
export function buildCharts(pbp: Iterable<Row>, participation: Iterable<Row>, posOf: (gsis: string) => DbPos | null, year: number, builtAt: string): ChartDb {
  const parts = new Map<string, Row>();
  for (const r of participation) parts.set(playKey(r.nflverse_game_id, r.play_id), r);
  const players: Record<string, ChartPlayer> = {};
  const player = (gsis: string, allowed: DbPos[]): ChartPlayer | null => {
    const pos = players[gsis]?.pos ?? posOf(gsis);
    if (!pos || !allowed.includes(pos)) return null;
    return (players[gsis] ??= { pos });
  };

  for (const p of pbp) {
    const week = num(p.week);
    if (p.season_type !== 'REG' || week < 1 || week > 18) continue;
    const x = parts.get(playKey(p.game_id, p.play_id));

    if (present(p.receiver_player_id) && x && ROUTE_SET.has(x.route)) {
      const pl = player(p.receiver_player_id, ['WR', 'TE', 'RB']);
      if (pl) {
        const t = (pl.routes ??= { all: {}, man: {}, zone: {} });
        const v = [1, num(p.complete_pass), num(p.receiving_yards), num(p.epa), num(p.pass_touchdown)];
        const cov = x.defense_man_zone_type === 'MAN_COVERAGE' ? 'man' : x.defense_man_zone_type === 'ZONE_COVERAGE' ? 'zone' : null;
        bump(t.all, x.route as Route, v);
        if (cov) bump(t[cov], x.route as Route, v);
      }
    }

    if (p.rush_attempt === '1' && p.qb_scramble !== '1' && present(p.rusher_player_id)) {
      const lane = laneOf(p.run_location ?? '', p.run_gap ?? '');
      const pl = lane ? player(p.rusher_player_id, ['RB']) : null;
      if (pl && lane) {
        const t = (pl.lanes ??= { all: {}, light: {}, heavy: {} });
        const v = [1, num(p.yards_gained), num(p.epa), num(p.epa) > 0 ? 1 : 0, num(p.rush_touchdown)];
        bump(t.all, lane, v);
        if (present(x?.defenders_in_box)) bump(t[Number(x.defenders_in_box) <= 6 ? 'light' : 'heavy'], lane, v);
      }
    }

    if (p.pass_attempt === '1' && present(p.passer_player_id)) {
      const pl = player(p.passer_player_id, ['QB']);
      if (pl) {
        const sack = p.sack === '1';
        const pocket = x?.was_pressure === 'TRUE' ? 'pressured' : x?.was_pressure === 'FALSE' ? 'clean' : null;
        const s = (pl.splits ??= {});
        const keys: Split[] = ['all'];
        if (pocket) keys.push(pocket);
        if (present(x?.number_of_pass_rushers)) keys.push(Number(x.number_of_pass_rushers) >= 5 ? 'blitz' : 'noblitz');
        if (x?.defense_man_zone_type === 'MAN_COVERAGE') keys.push('man');
        if (x?.defense_man_zone_type === 'ZONE_COVERAGE') keys.push('zone');
        if (x && ['COVER_0', 'COVER_1', 'COVER_2', 'COVER_3', 'COVER_4', 'COVER_6'].includes(x.defense_coverage_type)) keys.push(x.defense_coverage_type as Split);
        if (present(x?.time_to_throw)) keys.push(Number(x.time_to_throw) < 2.5 ? 'quick' : 'hold');
        const sv = [1, sack ? 0 : 1, sack ? 0 : num(p.complete_pass), sack ? 0 : num(p.passing_yards), num(p.epa), sack ? 1 : 0];
        for (const k of keys) bump(s, k, sv);
        const zone = sack ? null : zoneOf(p.air_yards ?? '', p.pass_location ?? '');
        if (zone) {
          const z = (pl.zones ??= { all: {}, clean: {}, pressured: {} });
          const hasCpoe = present(p.cpoe);
          const zv = [1, num(p.complete_pass), num(p.passing_yards), num(p.epa), num(p.pass_touchdown), num(p.interception), hasCpoe ? num(p.cpoe) : 0, hasCpoe ? 1 : 0];
          bump(z.all, zone, zv);
          if (pocket) bump(z[pocket], zone, zv);
        }
      }
    }
  }
  for (const p of Object.values(players)) roundAll(p);
  return { year, builtAt, players };
}
```

Create `packages/core/src/charts/index.ts`:

```ts
export * from './types';
export * from './schema';
export * from './build';
```

In `packages/core/src/index.ts`, after `export * from './playerdb';` add:

```ts
export * from './charts';
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/core exec vitest run test/charts/build.test.ts`
Expected: PASS, 10 tests.

Some expected EPA sums in the test are float sums such as -2.2 and -3.1. If one fails by floating error, the cause is that the test reads the rounded output: check that `roundAll` ran, rather than loosening the test.

- [ ] **Step 7: Run the core suite and typecheck, then commit**

Run: `pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/core typecheck`
Expected: all pass.

```bash
git add packages/core/src/charts packages/core/src/index.ts packages/core/test/charts
git commit -m "Charts: core builder for route, lane, zone and pressure counts from nflverse play-by-play"
```

---

### Task 2: Sync phase and the chart files

**Files:**
- Modify: `scripts/syncPlayers.ts`
- Create (generated): `data/charts/2023.json`, `data/charts/2024.json`, `data/charts/2025.json`

**Interfaces:**
- Consumes: `buildCharts`, `ChartDbSchema`, `PlayerDbSchema`, `isDbPos`, `parseCsv` and `DbPos` from `@fantasy-dash/core`.
- Produces: the committed `data/charts/{year}.json` files, which Tasks 8–9 read.

The script has no unit tests; its logic lives in the tested `buildCharts`. Verification here is a dry run, the real run, a schema parse, and spot numbers.

- [ ] **Step 1: Add the URL, the output dir, and the imports**

In `scripts/syncPlayers.ts`:
- Add `ChartDbSchema, buildCharts, isDbPos, type DbPos` to the `@fantasy-dash/core` import.
- After `const OUT_DIR = ...` add:

```ts
const CHART_DIR = path.join(ROOT, 'data', 'charts');
```

In `URLS`, after `participation`, add:

```ts
  pbp: (y: number) => `${NFLVERSE}/pbp/play_by_play_${y}.csv.gz`,
```

- [ ] **Step 2: Split `main` into two phases**

Move everything in `main()` from `const todo = leagues.filter(...)` to the end of the function into a new function, unchanged except for its signature:

```ts
/** Phase 1: the player database. */
async function playerDbPhase(client: SleeperClient, leagues: SleeperLeague[]) {
  // (the moved body: todo, directory, shared files, staging, build, rename)
}
```

The moved body's `return` statements now end only this phase. Then add the charts phase:

```ts
/** A chart file is final when it parses; finished seasons with a final file are not rebuilt. */
function chartFileFinal(file: string): boolean {
  if (!existsSync(file)) return false;
  try { ChartDbSchema.parse(JSON.parse(readFileSync(file, 'utf8'))); return true; } catch { return false; }
}

/** gsis → position: the season's player database first (league overrides apply), then the nflverse player list. */
function positionsFor(year: number, nflPlayers: Record<string, string>[]): (gsis: string) => DbPos | null {
  const m = new Map<string, DbPos>();
  for (const r of nflPlayers) if (r.gsis_id && isDbPos(r.position)) m.set(r.gsis_id, r.position);
  const file = path.join(OUT_DIR, `${year}.json`);
  if (existsSync(file)) for (const p of Object.values(PlayerDbSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).players)) if (p.gsisId) m.set(p.gsisId, p.pos);
  return (g) => m.get(g) ?? null;
}

/** Phase 2: play-by-play charts. A season without a participation or play-by-play file yet is skipped, not an error. */
async function chartsPhase(leagues: SleeperLeague[]) {
  const todo = leagues.filter((l) => {
    if (full || l.status !== 'complete') return true;
    if (chartFileFinal(path.join(CHART_DIR, `${l.season}.json`))) { log(`${l.season}: charts already built, skipping`); return false; }
    return true;
  });
  if (todo.length === 0) return;
  const staging = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-charts-')) : path.join(ROOT, '.tmp', 'charts');
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  let nflPlayers: Record<string, string>[] | null = null;
  const built: string[] = [];
  for (const league of todo) {
    const year = Number(league.season);
    const part = await fetchText(URLS.participation(year));
    if (part === null) { log(`${year}: no participation file yet; no charts`); continue; }
    const pbp = await fetchText(URLS.pbp(year));
    if (pbp === null) { log(`${year}: no play-by-play file yet; no charts`); continue; }
    nflPlayers ??= rowsOf(await requireText(URLS.players, 'nflverse player list'));
    const db = buildCharts(parseCsv(pbp), parseCsv(part), positionsFor(year, nflPlayers), year, new Date().toISOString());
    ChartDbSchema.parse(db);
    log(`${year}: charts for ${Object.keys(db.players).length} players`);
    const file = path.join(staging, `${year}.json`);
    await writeFile(file, JSON.stringify(db));
    built.push(file);
  }
  if (dryRun) { log(`Dry run: charts in ${staging}`); return; }
  await mkdir(CHART_DIR, { recursive: true });
  for (const file of built) await rename(file, path.join(CHART_DIR, path.basename(file)));
  await rm(staging, { recursive: true, force: true });
  log(`Wrote ${built.length} chart file(s) to ${CHART_DIR}`);
}
```

`main()` now ends with:

```ts
  log(`Seasons: ${leagues.map((l) => l.season).join(', ')}`);
  await playerDbPhase(client, leagues);
  await chartsPhase(leagues);
}
```

- [ ] **Step 3: Typecheck the scripts**

Run: `pnpm typecheck:scripts`
Expected: no errors.

- [ ] **Step 4: Dry run for 2025**

Run: `pnpm sync:players --dry-run --season 2025`

Expected log lines:
- `2025: finished and already built, skipping`
- `2025: charts for N players`, with N between 400 and 1200
- `Dry run: charts in /…/fantasy-dash-charts-…`

- [ ] **Step 5: Real run**

Run: `pnpm sync:players`

Expected:
- 2023, 2024 and 2025 each log `charts for N players`.
- 2026 logs `no participation file yet; no charts`.
- `Wrote 3 chart file(s)`.

Then check the spot numbers. These are regular-season counts, measured while writing this plan:

Run:
```bash
node -e "const d=require('./data/charts/2025.json');const s=(t)=>Object.values(t).reduce((a,c)=>a+c[0],0);console.log(s(d.players['00-0039075'].routes.all), d.players['00-0039075'].routes.all['IN/DIG'][0], s(d.players['00-0038542'].lanes.all), d.players['00-0038542'].lanes.all.RT[0], d.players['00-0034857'].splits.all[0], d.players['00-0034857'].zones.all['short|right'][0])"
```
Expected: `163 20 287 61 507 84`.

Also run `ls -la data/charts`. Expected: three files, each under 2 MB.

- [ ] **Step 6: Commit**

```bash
git add scripts/syncPlayers.ts data/charts
git commit -m "Charts: sync phase builds data/charts/{year}.json from nflverse play-by-play and participation"
```

---

### Task 3: Theme tokens, scale and formatters

**Files:**
- Modify: `packages/web/src/index.css`
- Create: `packages/web/src/lib/charts/scale.ts`
- Test: `packages/web/src/lib/charts/scale.test.ts`

**Interfaces:**
- Produces:
  - `heatColor(share: number, max: number): string`
  - `pctColor(p: number | null): string`
  - `chipInk(fill: 'heat' | 'pct', share?: number): string`
  - `ordinal(n: number): string`
  - `fmtPct(v: number): string`
  - `fmtDec1(v: number): string`
  - `fmtSigned(v: number, places: number): string`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/lib/charts/scale.test.ts`:

```ts
import { chipInk, fmtDec1, fmtPct, fmtSigned, heatColor, ordinal, pctColor } from './scale';

describe('chart scale', () => {
  it('heat steps through the four heat tokens and caps at the max', () => {
    expect(heatColor(0, 0.2)).toBe('var(--heat-0)');
    expect(heatColor(0.2, 0.2)).toBe('var(--heat-3)');
    expect(heatColor(0.5, 0.2)).toBe('var(--heat-3)');
    expect(heatColor(0.1, 0.2)).toBe('color-mix(in srgb, var(--heat-2) 50%, var(--heat-1))');
  });
  it('percentile colour runs loss → warn → win and greys an unranked item', () => {
    expect(pctColor(null)).toBe('var(--dim)');
    expect(pctColor(0)).toBe('var(--loss)');
    expect(pctColor(50)).toBe('var(--warn)');
    expect(pctColor(100)).toBe('var(--win)');
    expect(pctColor(25)).toBe('color-mix(in oklch, var(--warn) 50%, var(--loss))');
    expect(pctColor(75)).toBe('color-mix(in oklch, var(--win) 50%, var(--warn))');
  });
  it('chip ink is the page ink on a dim heat chip, the on-chip token otherwise', () => {
    expect(chipInk('heat', 0.05)).toBe('var(--ink)');
    expect(chipInk('heat', 0.15)).toBe('var(--on-chip)');
    expect(chipInk('pct')).toBe('var(--on-chip)');
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 92, 100].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '92nd', '100th']);
  });
  it('formats, never printing -0.00', () => {
    expect(fmtPct(0.153)).toBe('15%');
    expect(fmtDec1(14.18)).toBe('14.2');
    expect(fmtSigned(0.314, 2)).toBe('+0.31');
    expect(fmtSigned(-0.004, 2)).toBe('+0.00');
    expect(fmtSigned(-0.5, 2)).toBe('-0.50');
    expect(fmtSigned(3.24, 1)).toBe('+3.2');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/charts/scale.test.ts`
Expected: FAIL, because `./scale` can't be resolved.

- [ ] **Step 3: Implement**

Create `packages/web/src/lib/charts/scale.ts`:

```ts
/** Share on the heat scale: four theme tokens, mixed between neighbours, full at `max`. */
export function heatColor(share: number, max: number): string {
  const t = Math.min(1, Math.max(0, share / max)) * 3;
  const i = Math.min(2, Math.floor(t));
  const f = Math.round((t - i) * 100);
  if (f === 0) return `var(--heat-${i})`;
  if (f === 100 || t === 3) return `var(--heat-${i + 1})`;
  return `color-mix(in srgb, var(--heat-${i + 1}) ${f}%, var(--heat-${i}))`;
}

/** A 0–100 percentile on the percentile bars' red → yellow → green; grey when unranked. */
export function pctColor(p: number | null): string {
  if (p === null) return 'var(--dim)';
  if (p <= 0) return 'var(--loss)';
  if (p === 50) return 'var(--warn)';
  if (p >= 100) return 'var(--win)';
  return p < 50 ? `color-mix(in oklch, var(--warn) ${p * 2}%, var(--loss))` : `color-mix(in oklch, var(--win) ${(p - 50) * 2}%, var(--warn))`;
}

/** Text colour on a chip: the page ink on a dim heat chip (share under 9%), the on-chip token otherwise. */
export const chipInk = (fill: 'heat' | 'pct', share = 1): string => (fill === 'heat' && share < 0.09 ? 'var(--ink)' : 'var(--on-chip)');

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
export const fmtDec1 = (v: number) => v.toFixed(1);
/** Signed, fixed places; a value that rounds to zero prints as +0.00. */
export function fmtSigned(v: number, places: number): string {
  const r = Number(v.toFixed(places));
  return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(places)}`;
}
```

In `packages/web/src/index.css`:
- Add to the end of the `:root { … }` block, after `--pos-DEF`:

```css
  --field: #141b25;
  --field-band: #232d3b;
  --field-line: #2c3849;
  --los: #4d7fe6;
  --heat-0: #33435a;
  --heat-1: #3f6aa8;
  --heat-2: #6fa6ee;
  --heat-3: #cfe5ff;
  --on-chip: #11161e;
```

- Add to the end of the `:root[data-theme="light"] { … }` block:

```css
  --field: #eef2f7;
  --field-band: #d9e0ea;
  --field-line: #c6cfdb;
  --los: #2f6fe0;
  --heat-0: #dde6f2;
  --heat-1: #9dbbe6;
  --heat-2: #4f84d1;
  --heat-3: #1d4e9e;
  --on-chip: #ffffff;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/charts/scale.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/index.css packages/web/src/lib/charts/scale.ts packages/web/src/lib/charts/scale.test.ts
git commit -m "Charts: field and heat theme tokens, colour scales and formatters"
```

---

### Task 4: Ranking engine and chart specs

**Files:**
- Create:
  - `packages/web/src/lib/charts/rank.ts`
  - `packages/web/src/lib/charts/specs.ts`
  - `packages/web/src/test/chartFixtures.ts`
- Test: `packages/web/src/lib/charts/rank.test.ts`

**Interfaces:**
- Consumes:
  - `ChartDb`, `ChartPlayer`, `Counts` and the key constants from `@fantasy-dash/core`
  - `percentiles` from `lib/playerdb/percentile.ts`
  - the formatters from Task 3
- Produces:
  - `MetricDef { label: string; value: (c: Counts) => number | null; fmt: (v: number) => string; lowerIsBetter?: boolean }`
  - `ChartSpec<K, F>`:
    - `keys: readonly K[]`
    - `table(p: ChartPlayer): Record<F, Partial<Record<K, Counts>>> | undefined`
    - `min: number`
    - `sharePool: Record<F, number>`
    - `shareMax: number`
    - `unit: string`
    - `metrics: Record<string, MetricDef>`
  - `ChartItem<K>`:
    - `key: K`
    - `counts: Counts`
    - `volume: number`
    - `share: number`
    - `sharePct: number | null`
    - `value: number | null`
    - `pct: number | null`
    - `ranked: boolean`
  - `chartItems<K, F>(spec, db: ChartDb, gsis: string, filter: F, metric: string): ChartItem<K>[] | null`
  - `hasChart(spec, db, gsis): boolean`
  - `ROUTE_SPEC`, `LANE_SPEC`, `ZONE_SPEC`, `SPLIT_SPEC`
  - label maps `ROUTE_LABEL`, `LANE_LABEL`, `SPLIT_GROUPS`
  - `miniCharts(): ChartDb`

Item order is `spec.keys` order, filtered to keys he has counts for. For metric `'share'`, `value` is the share and `pct` is `sharePct`.

- [ ] **Step 1: Write the fixture**

Create `packages/web/src/test/chartFixtures.ts`:

```ts
import type { ChartDb } from '@fantasy-dash/core';

/** 2025 charts for the miniDb players (gsis `00-<id>`) plus peers. Numbers chosen so percentiles are easy to read. */
export function miniCharts(year = 2025): ChartDb {
  return {
    year, builtAt: '2026-01-01T00:00:00.000Z',
    players: {
      '00-w1': { pos: 'WR', routes: {
        all: { GO: [30, 15, 450, 9, 3], 'IN/DIG': [15, 12, 180, 4.5, 1], SLANT: [5, 4, 30, 0.5, 0] },
        man: { GO: [10, 4, 120, 1, 1], 'IN/DIG': [3, 2, 20, 0.2, 0] },
        zone: { GO: [20, 11, 330, 8, 2], 'IN/DIG': [15, 12, 180, 4.5, 1], SLANT: [5, 4, 30, 0.5, 0] } } },
      '00-w2': { pos: 'WR', routes: {
        all: { GO: [20, 6, 160, -2, 0], 'IN/DIG': [40, 30, 400, 8, 2] },
        man: { GO: [20, 6, 160, -2, 0], 'IN/DIG': [10, 7, 90, 1, 0] },
        zone: { 'IN/DIG': [30, 23, 310, 7, 2] } } },
      '00-x3': { pos: 'WR', routes: { all: { GO: [10, 7, 240, 6, 2] }, man: {}, zone: { GO: [10, 7, 240, 6, 2] } } },
      '00-t1': { pos: 'TE', routes: { all: { GO: [6, 2, 40, -1, 0], 'IN/DIG': [4, 3, 30, 0.4, 0] }, man: {}, zone: { GO: [6, 2, 40, -1, 0], 'IN/DIG': [4, 3, 30, 0.4, 0] } } },
      '00-r1': { pos: 'RB',
        routes: { all: { SWING: [12, 10, 60, 1, 0] }, man: {}, zone: { SWING: [12, 10, 60, 1, 0] } },
        lanes: { all: { LT: [60, 300, 3, 30, 2], MID: [9, 30, -1, 3, 0], RE: [41, 160, -2, 15, 1] }, light: { LT: [40, 230, 4, 22, 2] }, heavy: { LT: [20, 70, -1, 8, 0], MID: [9, 30, -1, 3, 0] } } },
      '00-r2': { pos: 'RB', lanes: { all: { LT: [30, 90, -2, 10, 0], RE: [80, 400, 4, 40, 3] }, light: {}, heavy: {} } },
      '00-q1': { pos: 'QB',
        zones: { all: { 'short|right': [80, 64, 600, 12, 5, 1, 40, 80], 'deep|left': [8, 2, 90, -1, 1, 1, -10, 8], 'mid|middle': [70, 40, 700, 9, 4, 2, 0, 70] }, clean: { 'short|right': [60, 50, 480, 10, 4, 0, 30, 60] }, pressured: { 'short|right': [20, 14, 120, 2, 1, 1, 10, 20] } },
        splits: { all: [170, 158, 106, 1390, 18, 12], pressured: [40, 30, 16, 200, -9, 10], clean: [130, 128, 90, 1190, 27, 2], man: [60, 56, 36, 500, 4, 4], zone: [110, 102, 70, 890, 14, 8], COVER_0: [12, 11, 5, 60, -2, 1] } },
      '00-q2': { pos: 'QB',
        zones: { all: { 'short|right': [90, 60, 500, 4, 2, 2, -20, 90], 'mid|middle': [70, 30, 450, 2, 2, 3, -50, 70] }, clean: {}, pressured: {} },
        splits: { all: [170, 165, 100, 1100, 2, 5], pressured: [50, 48, 20, 300, -12, 2], clean: [120, 117, 80, 800, 14, 3], man: [70, 68, 40, 450, 1, 2], zone: [100, 97, 60, 650, 1, 3] } },
    },
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/web/src/lib/charts/rank.test.ts`:

```ts
import { miniCharts } from '../../test/chartFixtures';
import { chartItems, hasChart } from './rank';
import { LANE_SPEC, ROUTE_SPEC, SPLIT_SPEC, ZONE_SPEC } from './specs';

const db = miniCharts();
const item = <K extends string>(items: { key: K }[] | null, key: K) => items!.find((i) => i.key === key)!;

describe('chartItems: routes', () => {
  it('ranks yards per target among WRs with 5+ targets on the route', () => {
    const go = item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt'), 'GO');
    expect(go.value).toBe(15);
    expect(go.pct).toBe(50);           // 8, 15, 24
    expect(item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt'), 'IN/DIG').pct).toBe(100); // 12 vs 10
  });
  it('ranks a route he has exactly 5 targets on, and leaves one with 4 unranked', () => {
    expect(item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt'), 'SLANT').ranked).toBe(true);
    const dig = item(chartItems(ROUTE_SPEC, db, '00-t1', 'all', 'ypt'), 'IN/DIG');
    expect(dig.ranked).toBe(false);
    expect(dig.pct).toBeNull();
    expect(dig.value).toBe(7.5);
  });
  it('ranks a TE only against TEs', () => {
    expect(item(chartItems(ROUTE_SPEC, db, '00-t1', 'all', 'ypt'), 'GO').pct).toBe(50); // the lone TE
  });
  it('target share is ranked within the 50+ target pool, plus himself', () => {
    const go = item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'share'), 'GO');
    expect(go.share).toBeCloseTo(0.6);
    expect(go.value).toBeCloseTo(0.6);
    expect(go.pct).toBe(100);          // w1 0.6 vs w2 0.333; x3 (10 targets) is out of the pool
    expect(go.sharePct).toBe(100);
  });
  it('filters by coverage, and only lists routes he has counts for in that filter', () => {
    const man = chartItems(ROUTE_SPEC, db, '00-w1', 'man', 'ypt')!;
    expect(man.map((i) => i.key)).toEqual(['GO', 'IN/DIG']);
    expect(man[0].pct).toBe(100);       // 12 vs w2's 8
    expect(man[1].ranked).toBe(false);  // 3 man targets on the dig
  });
  it('lists items in route order, null for a player with no route table, and hasChart follows', () => {
    expect(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt')!.map((i) => i.key)).toEqual(['GO', 'IN/DIG', 'SLANT']);
    expect(chartItems(ROUTE_SPEC, db, '00-q1', 'all', 'ypt')).toBeNull();
    expect(chartItems(ROUTE_SPEC, db, 'nobody', 'all', 'ypt')).toBeNull();
    expect(hasChart(ROUTE_SPEC, db, '00-w1')).toBe(true);
    expect(hasChart(ROUTE_SPEC, db, '00-r2')).toBe(false);
  });
});

describe('chartItems: lanes, zones, splits', () => {
  it('lanes need 10 carries; success % is successes over carries', () => {
    const items = chartItems(LANE_SPEC, db, '00-r1', 'all', 'succ')!;
    expect(item(items, 'LT').value).toBe(0.5);
    expect(item(items, 'LT').pct).toBe(100);   // 0.5 vs r2's 0.333
    expect(item(items, 'MID').ranked).toBe(false);
  });
  it('zones: CPOE is the mean over attempts with a CPOE', () => {
    const z = item(chartItems(ZONE_SPEC, db, '00-q1', 'all', 'cpoe'), 'short|right');
    expect(z.value).toBe(0.5);
    expect(z.pct).toBe(100);
    expect(item(chartItems(ZONE_SPEC, db, '00-q1', 'all', 'cpoe'), 'deep|left').ranked).toBe(false);
  });
  it('splits: sack % ranks lower as better', () => {
    const all = item(chartItems(SPLIT_SPEC, db, '00-q1', 'all', 'sack'), 'all');
    expect(all.value).toBeCloseTo(12 / 170);
    expect(all.pct).toBe(0);                    // q2 sacks less
    expect(item(chartItems(SPLIT_SPEC, db, '00-q2', 'all', 'sack'), 'all').pct).toBe(100);
  });
  it('splits: a split under 20 dropbacks is unranked', () => {
    expect(item(chartItems(SPLIT_SPEC, db, '00-q1', 'all', 'epa'), 'COVER_0').ranked).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/charts/rank.test.ts`
Expected: FAIL, because `./rank` can't be resolved.

- [ ] **Step 4: Implement the engine**

Create `packages/web/src/lib/charts/rank.ts`:

```ts
import type { ChartDb, ChartPlayer, Counts } from '@fantasy-dash/core';
import { percentiles } from '../playerdb/percentile';

export interface MetricDef { label: string; value: (c: Counts) => number | null; fmt: (v: number) => string; lowerIsBetter?: boolean }

export interface ChartSpec<K extends string, F extends string> {
  keys: readonly K[];
  /** his table by filter; undefined when he has none */
  table: (p: ChartPlayer) => Record<F, Partial<Record<K, Counts>>> | undefined;
  /** volume (counts[0]) on an item needed to be ranked */
  min: number;
  /** total volume in a filter needed to be in the share pool */
  sharePool: Record<F, number>;
  /** share at which the heat scale is full */
  shareMax: number;
  /** volume unit for small text: tgt, car, att, db */
  unit: string;
  metrics: Record<string, MetricDef>;
}

export interface ChartItem<K extends string> {
  key: K;
  counts: Counts;
  volume: number;
  share: number;
  sharePct: number | null;
  /** the selected metric's value; the share when the metric is 'share' */
  value: number | null;
  /** 0–100 among his position; null when unranked */
  pct: number | null;
  ranked: boolean;
}

const total = (t: Partial<Record<string, Counts>> | undefined) => Object.values(t ?? {}).reduce((a, c) => a + (c?.[0] ?? 0), 0);
const rankOf = (values: (number | null)[], idx: number): number | null => { const p = percentiles(values)[idx]; return p === null ? null : Math.round(p * 100); };

export function hasChart<K extends string, F extends string>(spec: ChartSpec<K, F>, db: ChartDb, gsis: string): boolean {
  const t = db.players[gsis] ? spec.table(db.players[gsis]) : undefined;
  return !!t && Object.values(t).some((f) => Object.keys(f as object).length > 0);
}

/** His items in one filter, each with its share and the selected metric, ranked within his position. */
export function chartItems<K extends string, F extends string>(spec: ChartSpec<K, F>, db: ChartDb, gsis: string, filter: F, metric: string): ChartItem<K>[] | null {
  const me = db.players[gsis];
  const mine = me ? spec.table(me)?.[filter] : undefined;
  if (!me || !mine) return null;
  const peers = Object.entries(db.players).filter(([, p]) => p.pos === me.pos).map(([g, p]) => ({ g, t: spec.table(p)?.[filter] }));
  const myTotal = total(mine);
  const sharePeers = peers.filter((p) => p.g === gsis || total(p.t) >= spec.sharePool[filter]);
  const def = metric === 'share' ? null : spec.metrics[metric];
  return spec.keys.filter((k) => mine[k]).map((k) => {
    const counts = mine[k]!;
    const volume = counts[0];
    const share = myTotal ? volume / myTotal : 0;
    const sharePct = rankOf(sharePeers.map((p) => { const t = total(p.t); return t ? (p.t?.[k]?.[0] ?? 0) / t : 0; }), sharePeers.findIndex((p) => p.g === gsis));
    if (!def) return { key: k, counts, volume, share, sharePct, value: share, pct: sharePct, ranked: true };
    const value = def.value(counts);
    const ranked = volume >= spec.min && value !== null;
    const pool = peers.filter((p) => (p.t?.[k]?.[0] ?? 0) >= spec.min);
    const sign = def.lowerIsBetter ? -1 : 1;
    const pct = ranked ? rankOf(pool.map((p) => { const v = def.value(p.t![k]!); return v === null ? null : sign * v; }), pool.findIndex((p) => p.g === gsis)) : null;
    return { key: k, counts, volume, share, sharePct, value, pct, ranked };
  });
}
```

- [ ] **Step 5: Implement the specs**

Create `packages/web/src/lib/charts/specs.ts`:

```ts
import { LANES, ROUTES, SPLITS, ZONES, type Box, type Coverage, type Lane, type Pocket, type Route, type Split, type Zone } from '@fantasy-dash/core';
import type { ChartSpec } from './rank';
import { fmtDec1, fmtPct, fmtSigned } from './scale';

const per = (num: number, den: number) => (c: number[]) => (c[den] ? c[num] / c[den] : null);

export const ROUTE_SPEC: ChartSpec<Route, Coverage> = {
  keys: ROUTES, table: (p) => p.routes, min: 5, sharePool: { all: 50, man: 20, zone: 20 }, shareMax: 0.2, unit: 'tgt',
  metrics: {
    ypt: { label: 'Yds/tgt', value: per(2, 0), fmt: fmtDec1 },
    catch: { label: 'Catch %', value: per(1, 0), fmt: fmtPct },
    epa: { label: 'EPA/tgt', value: per(3, 0), fmt: (v) => fmtSigned(v, 2) },
  },
};

export const LANE_SPEC: ChartSpec<Lane, Box> = {
  keys: LANES, table: (p) => p.lanes, min: 10, sharePool: { all: 100, light: 30, heavy: 30 }, shareMax: 0.25, unit: 'car',
  metrics: {
    ypc: { label: 'Yds/carry', value: per(1, 0), fmt: fmtDec1 },
    succ: { label: 'Success %', value: per(3, 0), fmt: fmtPct },
    epa: { label: 'EPA/carry', value: per(2, 0), fmt: (v) => fmtSigned(v, 2) },
  },
};

export const ZONE_SPEC: ChartSpec<Zone, Pocket> = {
  keys: ZONES, table: (p) => p.zones, min: 10, sharePool: { all: 150, clean: 50, pressured: 50 }, shareMax: 0.2, unit: 'att',
  metrics: {
    comp: { label: 'Comp %', value: per(1, 0), fmt: fmtPct },
    ypa: { label: 'Yds/att', value: per(2, 0), fmt: fmtDec1 },
    epa: { label: 'EPA/att', value: per(3, 0), fmt: (v) => fmtSigned(v, 2) },
    cpoe: { label: 'CPOE', value: per(6, 7), fmt: (v) => fmtSigned(v, 1) },
  },
};

/** Splits have no filter: one table under 'all'. */
export const SPLIT_SPEC: ChartSpec<Split, 'all'> = {
  keys: SPLITS, table: (p) => (p.splits ? { all: p.splits } : undefined), min: 20, sharePool: { all: Infinity }, shareMax: 1, unit: 'db',
  metrics: {
    epa: { label: 'EPA/dropback', value: per(4, 0), fmt: (v) => fmtSigned(v, 2) },
    comp: { label: 'Comp %', value: per(2, 1), fmt: fmtPct },
    ypa: { label: 'Yds/att', value: per(3, 1), fmt: fmtDec1 },
    sack: { label: 'Sack %', value: per(5, 0), fmt: (v) => `${(v * 100).toFixed(1)}%`, lowerIsBetter: true },
  },
};

export const ROUTE_LABEL: Record<Route, string> = {
  'QUICK OUT': 'Quick out', 'HITCH/CURL': 'Hitch', GO: 'Go', SCREEN: 'Screen', 'IN/DIG': 'Dig', 'DEEP OUT': 'Deep out',
  'SHALLOW CROSS/DRAG': 'Drag', SLANT: 'Slant', POST: 'Post', SWING: 'Swing', CORNER: 'Corner', WHEEL: 'Wheel', 'TEXAS/ANGLE': 'Angle',
};
export const LANE_LABEL: Record<Lane, string> = { LE: 'Left end', LT: 'Left tackle', LG: 'Left guard', MID: 'Middle', RG: 'Right guard', RT: 'Right tackle', RE: 'Right end' };
export const SPLIT_GROUPS: { label: string; rows: [Split, string][] }[] = [
  { label: 'Pocket', rows: [['clean', 'Clean'], ['pressured', 'Pressured']] },
  { label: 'Pass rush', rows: [['noblitz', '4 or fewer'], ['blitz', 'Blitz (5+)']] },
  { label: 'Coverage', rows: [['man', 'Man'], ['zone', 'Zone']] },
  { label: 'Shell', rows: [['COVER_0', 'Cover 0'], ['COVER_1', 'Cover 1'], ['COVER_2', 'Cover 2'], ['COVER_3', 'Cover 3'], ['COVER_4', 'Cover 4'], ['COVER_6', 'Cover 6']] },
  { label: 'Time to throw', rows: [['quick', 'Under 2.5 s'], ['hold', '2.5 s or more']] },
];
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/charts/rank.test.ts`
Expected: PASS, 10 tests.

`percentiles()` gives a lone value 0.5, which is why the lone-TE case expects 50.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/lib/charts/rank.ts packages/web/src/lib/charts/specs.ts packages/web/src/lib/charts/rank.test.ts packages/web/src/test/chartFixtures.ts
git commit -m "Charts: ranking engine and specs for routes, lanes, zones and pressure splits"
```

---

### Task 5: Shared field pieces and the bar list

**Files:**
- Create:
  - `packages/web/src/components/charts/Field.tsx`
  - `packages/web/src/components/charts/ChartBars.tsx`
- Test: covered through the card tests in Tasks 6–8. This task adds no behaviour of its own beyond markup, so it is committed together with Task 6, whose tests exercise it.

**Interfaces:**
- Produces, from `Field.tsx`:
  - `ChartCard({ id, title, years, year, onYear, controls, tip, legend, children })`: a `<section aria-labelledby>` with an `<h2 id>`, so tests find it by region name.
  - `Seg<T extends string>({ label, options: [T, string][], value: T, onChange })`: buttons with `aria-pressed`.
  - `Sidelines({ width, top, bottom, band, marks: { y: number; label: string }[] })`
  - `Chip({ x, y, text, fill, ink, anchor })`, which returns `{ el, width }`
  - `Arrowhead({ from, to, fill, size })`
  - `Chevrons({ cx, y, gap, fill })`
  - `TipLine({ children })`
  - `useHot()`, which returns `[hot, bind]`. `bind(key)` gives `onMouseEnter`, `onMouseLeave` and `onClick` (tap toggles).
- Produces, from `ChartBars.tsx`:
  - `ChartBars({ rows, hot, bind })`
  - `BarRow`:
    - `key: string`
    - `label: string`
    - `sub: string`
    - `width: number` (0–100)
    - `fill: string`
    - `value: string`
    - `rank: string`

- [ ] **Step 1: Write `Field.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import SeasonPicker from '../SeasonPicker';

/** Hover (and tap on touch) highlights one item; the rest dim. */
export function useHot(): [string | null, (key: string) => { onMouseEnter: () => void; onMouseLeave: () => void; onClick: () => void }] {
  const [hot, setHot] = useState<string | null>(null);
  return [hot, (key) => ({ onMouseEnter: () => setHot(key), onMouseLeave: () => setHot(null), onClick: () => setHot((h) => (h === key ? null : key)) })];
}

export function Seg<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-md bg-surface-2 p-0.5">
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}
          className={`rounded px-2.5 py-0.5 text-xs ${v === value ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`}>{text}</button>
      ))}
    </div>
  );
}

export function ChartCard({ id, title, years, year, onYear, controls, tip, legend, children }: {
  id: string; title: string; years: number[]; year: number; onYear: (y: number) => void; controls: ReactNode; tip: ReactNode; legend: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 pb-2 pt-3">
        <div className="flex items-center gap-3">
          <h2 id={id} className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
          <SeasonPicker years={years} value={year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">{controls}</div>
      </div>
      {children}
      <div className="min-h-[2.5rem] border-t border-line px-4 py-2 text-xs" data-testid="chart-tip">{tip}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-muted">{legend}</div>
    </section>
  );
}

export const TipLine = ({ children }: { children: ReactNode }) => <span>{children}</span>;

/** The grey sideline bands either side of the field, with yard marks. */
export function Sidelines({ width, top, bottom, band, marks }: { width: number; top: number; bottom: number; band: number; marks: { y: number; label: string }[] }) {
  return (
    <g>
      {[0, width - band].map((x) => <rect key={x} x={x} y={top} width={band} height={bottom - top} rx={3} style={{ fill: 'var(--field-band)' }} />)}
      {marks.flatMap((m) => [band / 2, width - band / 2].map((x) => (
        <text key={`${m.label}-${x}`} x={x} y={m.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--muted)' }}>{m.label}</text>
      )))}
    </g>
  );
}

/** A rounded label chip. Width is estimated from the text so labels can be laid out before render. */
export function Chip({ x, y, text, fill, ink, anchor = 'start' }: { x: number; y: number; text: string; fill: string; ink: string; anchor?: 'start' | 'middle' | 'end' }) {
  const width = text.length * 7 + 10;
  const x0 = anchor === 'start' ? x : anchor === 'middle' ? x - width / 2 : x - width;
  return {
    width,
    el: (
      <g data-chip={text}>
        <rect x={x0} y={y - 11} width={width} height={15} rx={4} style={{ fill }} />
        <text x={x0 + width / 2} y={y} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: ink }}>{text}</text>
      </g>
    ),
  };
}

/** A filled arrowhead at `to`, pointing away from `from`. */
export function Arrowhead({ from, to, fill, size = 9 }: { from: [number, number]; to: [number, number]; fill: string; size?: number }) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const pt = (ang: number, r: number) => `${to[0] + Math.cos(ang) * r},${to[1] + Math.sin(ang) * r}`;
  return <polygon points={`${pt(a, size * 0.6)} ${pt(a + 2.4, size)} ${pt(a - 2.4, size)}`} style={{ fill }} />;
}

/** » and « either side of a number, at fixed distances from the centre. */
export function Chevrons({ cx, y, gap, fill }: { cx: number; y: number; gap: number; fill: string }) {
  const one = (x: number, dir: 1 | -1) => [0, 6].map((o) => (
    <path key={o} d={`M${x + o * dir} ${y - 9} L${x + o * dir + 7 * dir} ${y} L${x + o * dir} ${y + 9}`} fill="none" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: fill }} />
  ));
  return <g>{one(cx - gap, 1)}{one(cx + gap, -1)}</g>;
}
```

- [ ] **Step 2: Write `ChartBars.tsx`**

```tsx
export interface BarRow { key: string; label: string; sub: string; width: number; fill: string; value: string; rank: string }

/** The secondary list beside a chart: one bar per item, linked to the chart by hover. */
export default function ChartBars({ rows, hot, bind }: { rows: BarRow[]; hot: string | null; bind: (k: string) => object }) {
  return (
    <ul className="flex flex-col justify-center gap-0.5 border-t border-line px-4 py-3 lg:border-l lg:border-t-0" aria-label="Bars">
      {rows.map((r) => (
        <li key={r.key} data-key={r.key} data-hot={hot === r.key} {...bind(r.key)}
          className={`grid cursor-pointer grid-cols-[6rem_minmax(0,1fr)_3.6rem_2.4rem] items-center gap-2.5 rounded px-1.5 py-1 text-xs ${hot === r.key ? 'bg-surface-2' : ''}`}>
          <span className="truncate">{r.label} <span className="text-muted">{r.sub}</span></span>
          <span className="relative h-1.5 rounded-full bg-surface-2"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, r.width)}%`, background: r.fill }} /></span>
          <span className="num text-right text-muted">{r.value}</span>
          <span className="num text-right font-semibold">{r.rank}</span>
        </li>
      ))}
    </ul>
  );
}
```

No commit yet: Task 6's tests exercise these pieces, and Task 6 commits them.

---

### Task 6: Route tree card

**Files:**
- Create: `packages/web/src/components/charts/RouteTree.tsx`
- Test: `packages/web/src/components/charts/RouteTree.test.tsx`

**Interfaces:**
- Consumes:
  - `chartItems`, `ROUTE_SPEC` and `ROUTE_LABEL` (Task 4)
  - `heatColor`, `pctColor`, `chipInk` and `ordinal` (Task 3)
  - everything from Task 5
- Produces: the default export `RouteTree({ charts: ChartDb[]; gsis: string; pos: string })`. It renders nothing when no season has route data for `gsis`. Its section's region name is "Route tree".

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/charts/RouteTree.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import RouteTree from './RouteTree';

const card = () => screen.getByRole('region', { name: /Route tree/ });
const chips = () => [...card().querySelectorAll('[data-chip]')].map((n) => n.getAttribute('data-chip'));

describe('RouteTree', () => {
  it('opens on target share: chips show his share, routes he was never targeted on are not drawn', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    expect(chips()).toEqual(['60%', '30%', '10%']);
    expect(card().querySelectorAll('[data-route]')).toHaveLength(3);
    expect(within(card()).getByRole('button', { name: 'Target share' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('a metric shows the real stat on the chip and the percentile in the small text', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/tgt' }));
    expect(chips()).toEqual(['15.0', '12.0', '6.0']);
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('100');
    expect(within(card()).getAllByText(/100th · 15 tgt/).length).toBeGreaterThan(0);
  });
  it('switching to vs Man greys a route he has too few man targets on', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/tgt' }));
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('100');
    fireEvent.click(within(card()).getByRole('button', { name: 'vs Man' }));
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('');
    expect(within(card()).getAllByText(/3 tgt · too few to rank/).length).toBeGreaterThan(0);
  });
  it('a TE route under 5 targets is greyed with no rank', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-t1" pos="TE" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/tgt' }));
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('');
  });
  it('hovering a bar highlights its route and fills the tip line', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    fireEvent.mouseEnter(card().querySelector('li[data-key="GO"]')!);
    expect(card().querySelector('[data-route="GO"]')!.getAttribute('data-hot')).toBe('true');
    expect(screen.getByTestId('chart-tip')).toHaveTextContent('Go · 30 targets, 15 catches, 450 yds, 3 TD');
    expect(screen.getByTestId('chart-tip')).toHaveTextContent('ranked against 3 WRs');
  });
  it('renders nothing for a player with no route data', () => {
    const { container } = render(<RouteTree charts={[miniCharts()]} gsis="00-q1" pos="QB" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/charts/RouteTree.test.tsx`
Expected: FAIL, because `./RouteTree` can't be resolved.

- [ ] **Step 3: Implement**

Create `packages/web/src/components/charts/RouteTree.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { ChartDb, Coverage, Route } from '@fantasy-dash/core';
import { chartItems, hasChart, type ChartItem } from '../../lib/charts/rank';
import { chipInk, heatColor, ordinal, pctColor } from '../../lib/charts/scale';
import { ROUTE_LABEL, ROUTE_SPEC } from '../../lib/charts/specs';
import ChartBars from './ChartBars';
import { Arrowhead, ChartCard, Chip, Seg, Sidelines, useHot } from './Field';

/** Route paths in yards from the receiver (x < 0 is inside), the label anchor, and a fixed label spot where the tip would collide. */
const SHAPES: Record<Route, { p: [number, number][]; a: 'start' | 'middle' | 'end'; l?: [number, number] }> = {
  GO: { p: [[0, 12], [0, 23]], a: 'middle' },
  POST: { p: [[0, 12], [-7, 20]], a: 'end' },
  CORNER: { p: [[0, 12], [6, 19]], a: 'start' },
  'IN/DIG': { p: [[0, 12], [-10, 12]], a: 'end' },
  'DEEP OUT': { p: [[0, 12], [7, 12]], a: 'start' },
  'HITCH/CURL': { p: [[0, 12], [-2.8, 9]], a: 'end', l: [-3.6, 9.4] },
  SLANT: { p: [[0, 3], [-5.5, 8]], a: 'end', l: [-6.3, 6.6] },
  'QUICK OUT': { p: [[0, 3], [5.5, 3]], a: 'start' },
  'SHALLOW CROSS/DRAG': { p: [[0, 0], [-2, 2.5], [-11.5, 3.5]], a: 'end' },
  'TEXAS/ANGLE': { p: [[0, 0], [2.5, 3], [-3, 6.5]], a: 'end' },
  WHEEL: { p: [[0, 0], [3, 1], [5.5, 4], [6, 15]], a: 'start' },
  SCREEN: { p: [[0, 0], [-1, -1.5], [-4, -2.2]], a: 'end' },
  SWING: { p: [[0, 0], [3, -1.5], [7, -0.5], [9, 1.5]], a: 'start', l: [9.8, -0.9] },
};
const METRICS: [string, string][] = [['share', 'Target share'], ['ypt', 'Yds/tgt'], ['catch', 'Catch %'], ['epa', 'EPA/tgt']];
const COVERAGES: [Coverage, string][] = [['all', 'All'], ['man', 'vs Man'], ['zone', 'vs Zone']];
const W = 660, BAND = 30, OX = 365, OY = 272, SX = 12.5, SY = 10.2, H = 330;
const X = (x: number) => OX + x * SX, Y = (y: number) => OY - y * SY;

export default function RouteTree({ charts, gsis, pos }: { charts: ChartDb[]; gsis: string; pos: string }) {
  const years = useMemo(() => charts.filter((c) => hasChart(ROUTE_SPEC, c, gsis)).map((c) => c.year).sort((a, b) => b - a), [charts, gsis]);
  const [year, setYear] = useState(years[0] ?? 0);
  const [cov, setCov] = useState<Coverage>('all');
  const [metric, setMetric] = useState('share');
  const [hot, bind] = useHot();
  const db = charts.find((c) => c.year === year) ?? charts.find((c) => c.year === years[0]);
  const items = useMemo(() => (db ? chartItems(ROUTE_SPEC, db, gsis, cov, metric) ?? [] : []), [db, gsis, cov, metric]);
  if (!years.length || !db) return null;

  const share = metric === 'share';
  const def = share ? null : ROUTE_SPEC.metrics[metric];
  const colour = (i: ChartItem<Route>) => (share ? heatColor(i.share, ROUTE_SPEC.shareMax) : pctColor(i.pct));
  const main = (i: ChartItem<Route>) => (share ? `${Math.round(i.share * 100)}%` : def!.fmt(i.value!));
  const small = (i: ChartItem<Route>) => (share ? `${i.volume} tgt` : i.ranked ? `${ordinal(i.pct!)} · ${i.volume} tgt` : `${i.volume} tgt · too few to rank`);
  const pool = Object.values(db.players).filter((p) => p.pos === db.players[gsis]?.pos && (p.routes?.[cov] ? Object.keys(p.routes[cov]).length : 0) > 0).length;
  const hotItem = items.find((i) => i.key === hot);
  const marks = [0, 5, 10, 15, 20].map((v) => ({ y: Y(v), label: v === 0 ? 'LOS' : `+${v}` }));

  return (
    <ChartCard id="chart-routes" title="Route tree" years={years} year={year} onYear={setYear}
      controls={<><Seg label="Coverage" options={COVERAGES} value={cov} onChange={setCov} /><Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} /></>}
      tip={hotItem ? <>
        <b>{ROUTE_LABEL[hotItem.key]}</b> · {hotItem.counts[0]} targets, {hotItem.counts[1]} catches, {hotItem.counts[2]} yds, {hotItem.counts[4]} TD
        {' · '}{Math.round(hotItem.share * 100)}% of his targets
        {Object.entries(ROUTE_SPEC.metrics).map(([k, m]) => { const one = chartItems(ROUTE_SPEC, db, gsis, cov, k)!.find((x) => x.key === hotItem.key)!; return <span key={k}> · {m.label} <b>{m.fmt(one.value!)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
        <span className="text-muted"> · ranked against {pool} {pos}s</span>
      </> : <span className="text-muted">Hover a route for its numbers.</span>}
      legend={share ? <span>Share of his targets, 0% to 20%+ · switch metric to see how he ranks among {pos}s on each route</span>
        : <span>{def!.label} percentile among {pos}s · grey = under {ROUTE_SPEC.min} targets, not ranked</span>}>
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(15rem,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[760px] px-2 py-3" role="img" aria-label={`Route tree, ${year}`}>
          <rect x={BAND} y={Y(24)} width={W - 2 * BAND} height={H - Y(24)} style={{ fill: 'var(--field)' }} />
          {[5, 10, 15, 20].map((v) => <line key={v} x1={BAND} x2={W - BAND} y1={Y(v)} y2={Y(v)} strokeWidth={1} style={{ stroke: 'var(--field-line)' }} />)}
          <Sidelines width={W} top={Y(24)} bottom={H} band={BAND} marks={marks} />
          <line x1={BAND} x2={W - BAND} y1={Y(0)} y2={Y(0)} strokeWidth={2} style={{ stroke: 'var(--los)' }} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(12)} strokeWidth={3} strokeLinecap="round" style={{ stroke: 'var(--dim)' }} />
          <g className={hot ? '[&>g]:opacity-15 [&>g[data-hot=true]]:opacity-100' : ''}>
            {items.map((i) => {
              const s = SHAPES[i.key], c = colour(i);
              const pts = s.p.map(([x, y]) => [X(x), Y(y)] as [number, number]);
              const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
              const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
              const lx = s.l ? X(s.l[0]) : b[0] + Math.cos(ang) * 14;
              const ly = s.l ? Y(s.l[1]) : b[1] + Math.sin(ang) * 14 + (s.a === 'middle' ? -4 : 4);
              const name = ROUTE_LABEL[i.key], sm = small(i);
              const nameW = name.length * 6.6, chipText = main(i), chipW = chipText.length * 7 + 10, smW = sm.length * 5.4;
              const total = nameW + 5 + chipW + 4 + smW;
              const x0 = s.a === 'end' ? lx - total : s.a === 'middle' ? lx - total / 2 : lx;
              const chip = Chip({ x: x0 + nameW + 5, y: ly, text: chipText, fill: share || i.ranked ? c : 'var(--surface-2)', ink: share ? chipInk('heat', i.share) : i.ranked ? chipInk('pct') : 'var(--muted)' });
              return (
                <g key={i.key} data-route={i.key} data-pct={share ? '' : String(i.pct ?? '')} data-hot={hot === i.key} className="cursor-pointer transition-opacity" {...bind(i.key)}>
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="transparent" strokeWidth={16} />
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={!share && !i.ranked ? '2 6' : undefined} style={{ stroke: c }} />
                  <Arrowhead from={a} to={b} fill={c} />
                  <text x={x0} y={ly} fontSize={11.5} fontWeight={600} style={{ fill: 'var(--ink)' }}>{name}</text>
                  {chip.el}
                  <text x={x0 + nameW + 5 + chipW + 4} y={ly} fontSize={10} style={{ fill: 'var(--muted)' }}>{sm}</text>
                </g>
              );
            })}
          </g>
          <circle cx={X(0)} cy={Y(0)} r={8} style={{ fill: 'var(--ink)' }} />
          <text x={X(0)} y={Y(0) + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} style={{ fill: 'var(--bg)' }}>{pos === 'RB' ? 'RB' : pos}</text>
        </svg>
        <ChartBars hot={hot} bind={bind} rows={[...items].sort((p, q) => q.volume - p.volume).map((i) => ({
          key: i.key, label: ROUTE_LABEL[i.key], sub: share ? '' : String(i.volume),
          width: share ? (i.volume / Math.max(...items.map((x) => x.volume))) * 100 : i.pct ?? 0,
          fill: colour(i), value: share ? `${i.volume} tgt` : def!.fmt(i.value!), rank: share ? `${Math.round(i.share * 100)}%` : i.ranked ? String(i.pct) : '–',
        }))} />
      </div>
    </ChartCard>
  );
}
```

Note: the "ranked against N" count is the players at his position with any counts in the filter, as in the mockup's hover line.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/charts/RouteTree.test.tsx`
Expected: PASS, 6 tests.

The "15.0" chip comes from `fmtDec1(15)`. In the "100th · 15 tgt" text, 100 is the dig's percentile and 15 is the dig's targets.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/charts
git commit -m "Charts: shared field pieces, bar list and the route tree card"
```

---

### Task 7: Run lanes card

**Files:**
- Create: `packages/web/src/components/charts/RunLanes.tsx`
- Test: `packages/web/src/components/charts/RunLanes.test.tsx`

**Interfaces:**
- Consumes: `LANE_SPEC` and `LANE_LABEL`, plus the Task 3–5 pieces.
- Produces: the default export `RunLanes({ charts: ChartDb[]; gsis: string })`. Its region name is "Run lanes". It renders nothing without lane data.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/charts/RunLanes.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import RunLanes from './RunLanes';

const card = () => screen.getByRole('region', { name: /Run lanes/ });
const lane = (k: string) => card().querySelector(`[data-lane="${k}"]`)!;

describe('RunLanes', () => {
  it('opens on carry share, with the bars in field order', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" />);
    expect(lane('LT').querySelector('[data-chip]')!.getAttribute('data-chip')).toBe('55%');
    expect([...card().querySelectorAll('li[data-key]')].map((n) => n.getAttribute('data-key'))).toEqual(['LT', 'MID', 'RE']);
  });
  it('Yds/carry shows the stat with its percentile; a 9-carry lane is unranked', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/carry' }));
    expect(lane('LT').querySelector('[data-chip]')!.getAttribute('data-chip')).toBe('5.0');
    expect(lane('LT').getAttribute('data-pct')).toBe('100');
    expect(lane('MID').getAttribute('data-pct')).toBe('');
  });
  it('the box switch filters carries', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Heavy box (7+)' }));
    expect(card().querySelectorAll('[data-lane]')).toHaveLength(2);
  });
  it('renders nothing without lane data', () => {
    const { container } = render(<RunLanes charts={[miniCharts()]} gsis="00-w1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/charts/RunLanes.test.tsx`
Expected: FAIL, because `./RunLanes` can't be resolved.

- [ ] **Step 3: Implement**

Create `packages/web/src/components/charts/RunLanes.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { Box, ChartDb, Lane } from '@fantasy-dash/core';
import { chartItems, hasChart, type ChartItem } from '../../lib/charts/rank';
import { chipInk, heatColor, ordinal, pctColor } from '../../lib/charts/scale';
import { LANE_LABEL, LANE_SPEC } from '../../lib/charts/specs';
import ChartBars from './ChartBars';
import { Arrowhead, ChartCard, Chip, Seg, Sidelines, useHot } from './Field';

/** gap: where he crosses the line (px from centre); tip: where the arrow ends */
const GEO: Record<Lane, { gap: number; tip: [number, number] }> = {
  LE: { gap: -158, tip: [-245, 150] }, LT: { gap: -62, tip: [-165, 78] }, LG: { gap: -21, tip: [-78, 128] },
  MID: { gap: 0, tip: [0, 62] },
  RG: { gap: 21, tip: [78, 128] }, RT: { gap: 62, tip: [165, 78] }, RE: { gap: 158, tip: [245, 150] },
};
const LINE: [string, number, boolean][] = [['TE', -118, true], ['LT', -82, false], ['LG', -41, false], ['C', 0, false], ['RG', 41, false], ['RT', 82, false], ['TE', 118, true]];
const METRICS: [string, string][] = [['share', 'Carry share'], ['ypc', 'Yds/carry'], ['succ', 'Success %'], ['epa', 'EPA/carry']];
const BOXES: [Box, string][] = [['all', 'All'], ['light', 'Light box (≤6)'], ['heavy', 'Heavy box (7+)']];
const W = 700, BAND = 30, CX = 350, LOS = 232, RB_Y = 330, H = 370;

export default function RunLanes({ charts, gsis }: { charts: ChartDb[]; gsis: string }) {
  const years = useMemo(() => charts.filter((c) => hasChart(LANE_SPEC, c, gsis)).map((c) => c.year).sort((a, b) => b - a), [charts, gsis]);
  const [year, setYear] = useState(years[0] ?? 0);
  const [box, setBox] = useState<Box>('all');
  const [metric, setMetric] = useState('share');
  const [hot, bind] = useHot();
  const db = charts.find((c) => c.year === year) ?? charts.find((c) => c.year === years[0]);
  const items = useMemo(() => (db ? chartItems(LANE_SPEC, db, gsis, box, metric) ?? [] : []), [db, gsis, box, metric]);
  if (!years.length || !db) return null;

  const share = metric === 'share';
  const def = share ? null : LANE_SPEC.metrics[metric];
  const colour = (i: ChartItem<Lane>) => (share ? heatColor(i.share, LANE_SPEC.shareMax) : pctColor(i.pct));
  const hotItem = items.find((i) => i.key === hot);

  return (
    <ChartCard id="chart-lanes" title="Run lanes" years={years} year={year} onYear={setYear}
      controls={<><Seg label="Box" options={BOXES} value={box} onChange={setBox} /><Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} /></>}
      tip={hotItem ? <>
        <b>{LANE_LABEL[hotItem.key]}</b> · {hotItem.counts[0]} carries, {hotItem.counts[1]} yds, {hotItem.counts[4]} TD · {Math.round(hotItem.share * 100)}% of his carries
        {Object.entries(LANE_SPEC.metrics).map(([k, m]) => { const one = chartItems(LANE_SPEC, db, gsis, box, k)!.find((x) => x.key === hotItem.key)!; return <span key={k}> · {m.label} <b>{m.fmt(one.value!)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
      </> : <span className="text-muted">Hover a lane for its numbers.</span>}
      legend={share ? <span>Share of his carries, 0% to 25%+</span>
        : <><span>{def!.label} percentile among RBs · grey = under {LANE_SPEC.min} carries, not ranked</span><span>Success = a carry that gained EPA</span></>}>
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(15rem,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[760px] px-2 py-3" role="img" aria-label={`Run lanes, ${year}`}>
          <rect x={BAND} y={20} width={W - 2 * BAND} height={H - 20} style={{ fill: 'var(--field)' }} />
          <Sidelines width={W} top={20} bottom={H} band={BAND} marks={[{ y: LOS, label: 'LOS' }]} />
          <line x1={BAND} x2={W - BAND} y1={LOS} y2={LOS} strokeWidth={2} style={{ stroke: 'var(--los)' }} />
          <g className={hot ? '[&>g]:opacity-15 [&>g[data-hot=true]]:opacity-100' : ''}>
            {items.map((i) => {
              const g = GEO[i.key], c = colour(i);
              const gap: [number, number] = [CX + g.gap, LOS], tip: [number, number] = [CX + g.tip[0], g.tip[1]];
              const ctrl = Math.abs(g.gap) > 100 ? [CX + g.gap * 0.55, LOS + 38] : [CX + g.gap * 0.6, LOS + 30];
              const d = `M${CX},${RB_Y - 12} Q${ctrl[0]},${ctrl[1]} ${gap[0]},${gap[1]} L${tip[0]},${tip[1]}`;
              const chipText = share ? `${Math.round(i.share * 100)}%` : def!.fmt(i.value!);
              const sm = share ? `${i.volume} car` : i.ranked ? `${ordinal(i.pct!)} · ${i.volume} car` : `${i.volume} car · too few to rank`;
              const ly = tip[1] - 14, chipW = chipText.length * 7 + 10, rowW = chipW + 4 + sm.length * 5.4, x0 = tip[0] - rowW / 2;
              const chip = Chip({ x: x0, y: ly, text: chipText, fill: share || i.ranked ? c : 'var(--surface-2)', ink: share ? chipInk('heat', i.share) : i.ranked ? chipInk('pct') : 'var(--muted)' });
              return (
                <g key={i.key} data-lane={i.key} data-pct={share ? '' : String(i.pct ?? '')} data-hot={hot === i.key} className="cursor-pointer transition-opacity" {...bind(i.key)}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={18} />
                  <path d={d} fill="none" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={!share && !i.ranked ? '2 6' : undefined} style={{ stroke: c }} />
                  <Arrowhead from={gap} to={tip} fill={c} size={10} />
                  <text x={tip[0]} y={ly - 17} textAnchor="middle" fontSize={11.5} fontWeight={600} style={{ fill: 'var(--ink)' }}>{LANE_LABEL[i.key]}</text>
                  {chip.el}
                  <text x={x0 + chipW + 4} y={ly} fontSize={10} style={{ fill: 'var(--muted)' }}>{sm}</text>
                </g>
              );
            })}
          </g>
          {LINE.map(([t, x, ghost]) => (
            <g key={`${t}${x}`}>
              <rect x={CX + x - 13} y={LOS + 4} width={26} height={22} rx={5} strokeDasharray={ghost ? '3 3' : undefined} style={{ fill: ghost ? 'var(--field)' : 'var(--line)', stroke: 'var(--field-line)' }} />
              <text x={CX + x} y={LOS + 19} textAnchor="middle" fontSize={9} fontWeight={600} style={{ fill: 'var(--muted)' }}>{t}</text>
            </g>
          ))}
          <circle cx={CX} cy={RB_Y} r={10} style={{ fill: 'var(--ink)' }} />
          <text x={CX} y={RB_Y + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} style={{ fill: 'var(--bg)' }}>RB</text>
          <text x={W - BAND - 6} y={H - 8} textAnchor="end" fontSize={9} style={{ fill: 'var(--muted)' }}>offense&apos;s left ← → offense&apos;s right</text>
        </svg>
        <ChartBars hot={hot} bind={bind} rows={items.map((i) => ({
          key: i.key, label: LANE_LABEL[i.key], sub: share ? '' : String(i.volume),
          width: share ? (i.volume / Math.max(...items.map((x) => x.volume))) * 100 : i.pct ?? 0,
          fill: colour(i), value: share ? `${i.volume} car` : def!.fmt(i.value!), rank: share ? `${Math.round(i.share * 100)}%` : i.ranked ? String(i.pct) : '–',
        }))} />
      </div>
    </ChartCard>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/charts/RunLanes.test.tsx`
Expected: PASS, 4 tests.

The 55% chip is LT's 60 carries out of r1's 110 in `all`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/charts/RunLanes.tsx packages/web/src/components/charts/RunLanes.test.tsx
git commit -m "Charts: run lanes card"
```

---

### Task 8: Passing zones and pressure cards

**Files:**
- Create:
  - `packages/web/src/components/charts/PassingZones.tsx`
  - `packages/web/src/components/charts/PressureCard.tsx`
- Tests:
  - `packages/web/src/components/charts/PassingZones.test.tsx`
  - `packages/web/src/components/charts/PressureCard.test.tsx`

**Interfaces:**
- Consumes: `ZONE_SPEC`, `SPLIT_SPEC` and `SPLIT_GROUPS`, plus the Task 3–5 pieces.
- Produces:
  - `PassingZones({ charts, gsis })`: region "Passing zones"
  - `PressureCard({ charts, gsis })`: region "Under pressure & vs coverage"

  Each renders nothing without data.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/components/charts/PassingZones.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import PassingZones from './PassingZones';

const card = () => screen.getByRole('region', { name: /Passing zones/ });
const zone = (k: string) => card().querySelector(`[data-zone="${k}"]`)!;

describe('PassingZones', () => {
  it('opens on throw share; the main number is the share', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" />);
    expect(zone('short|right').querySelector('[data-main]')!.textContent).toBe('51%');
    expect(card().querySelectorAll('[data-zone]')).toHaveLength(3);
  });
  it('a metric shows the actual stat as the main number and the percentile underneath', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Comp %' }));
    expect(zone('short|right').querySelector('[data-main]')!.textContent).toBe('80%');
    expect(zone('short|right')).toHaveTextContent('100th · 80 att');
    expect(zone('deep|left')).toHaveTextContent('too few to rank');
  });
  it('tiles show All / vs Man / vs Zone from the splits, EPA per dropback for share', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" />);
    const tiles = within(card()).getAllByTestId('zone-tile');
    expect(tiles.map((t) => t.textContent)).toEqual([expect.stringContaining('+0.11'), expect.stringContaining('+0.07'), expect.stringContaining('+0.13')]);
  });
  it('renders nothing without zone data', () => {
    const { container } = render(<PassingZones charts={[miniCharts()]} gsis="00-w1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

Create `packages/web/src/components/charts/PressureCard.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import PressureCard from './PressureCard';

const card = () => screen.getByRole('region', { name: /Under pressure/ });
const row = (k: string) => card().querySelector(`li[data-key="${k}"]`)!;

describe('PressureCard', () => {
  it('lists All dropbacks then the splits he has, with EPA per dropback and percentile', () => {
    render(<PressureCard charts={[miniCharts()]} gsis="00-q1" />);
    expect(row('all')).toHaveTextContent('+0.11');
    expect(row('pressured')).toHaveTextContent('-0.23');
    expect(row('COVER_0')).toHaveTextContent('–');
    expect(row('blitz')).toBeNull();
  });
  it('Sack % ranks lower as better', () => {
    render(<PressureCard charts={[miniCharts()]} gsis="00-q1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Sack %' }));
    expect(row('all')).toHaveTextContent('7.1%');
    expect(row('all').getAttribute('data-pct')).toBe('0');
  });
  it('renders nothing without splits', () => {
    const { container } = render(<PressureCard charts={[miniCharts()]} gsis="00-w1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/charts/PassingZones.test.tsx src/components/charts/PressureCard.test.tsx`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement `PassingZones.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { BANDS, SIDES, type ChartDb, type Pocket, type Zone } from '@fantasy-dash/core';
import { chartItems, hasChart, type ChartItem } from '../../lib/charts/rank';
import { heatColor, ordinal, pctColor } from '../../lib/charts/scale';
import { SPLIT_SPEC, ZONE_SPEC } from '../../lib/charts/specs';
import { ChartCard, Chevrons, Seg, Sidelines, useHot } from './Field';

const METRICS: [string, string][] = [['share', 'Throw share'], ['comp', 'Comp %'], ['ypa', 'Yds/att'], ['epa', 'EPA/att'], ['cpoe', 'CPOE']];
const POCKETS: [Pocket, string][] = [['all', 'All'], ['clean', 'Clean pocket'], ['pressured', 'Pressured']];
/** depth range in yards for each band, to scale: 7 behind the line to 35 past it */
const RANGE: Record<string, [number, number]> = { deep: [20, 35], mid: [10, 20], short: [0, 10], blos: [-7, 0] };
const BAND_LABEL: Record<string, string> = { deep: '20+ yds', mid: '10–19', short: '0–9', blos: 'Behind the line' };
const W = 460, SB = 34, FX = SB + 6, FW = W - 2 * FX, YD = 8, TOP = 10, CW = FW / 3;
const Y = (v: number) => TOP + (35 - v) * YD, H = Y(-7) + 8;
/** the tiles' stat for each metric: comp and ypa match, the rest show EPA per dropback */
const TILE: Record<string, string> = { share: 'epa', cpoe: 'epa', epa: 'epa', comp: 'comp', ypa: 'ypa' };

export default function PassingZones({ charts, gsis }: { charts: ChartDb[]; gsis: string }) {
  const years = useMemo(() => charts.filter((c) => hasChart(ZONE_SPEC, c, gsis)).map((c) => c.year).sort((a, b) => b - a), [charts, gsis]);
  const [year, setYear] = useState(years[0] ?? 0);
  const [pocket, setPocket] = useState<Pocket>('all');
  const [metric, setMetric] = useState('share');
  const [hot, bind] = useHot();
  const db = charts.find((c) => c.year === year) ?? charts.find((c) => c.year === years[0]);
  const items = useMemo(() => (db ? chartItems(ZONE_SPEC, db, gsis, pocket, metric) ?? [] : []), [db, gsis, pocket, metric]);
  const splits = useMemo(() => (db ? chartItems(SPLIT_SPEC, db, gsis, 'all', TILE[metric]) ?? [] : []), [db, gsis, metric]);
  if (!years.length || !db) return null;

  const share = metric === 'share';
  const def = share ? null : ZONE_SPEC.metrics[metric];
  const tileDef = SPLIT_SPEC.metrics[TILE[metric]];
  const colour = (i: ChartItem<Zone>) => (share ? heatColor(i.share, ZONE_SPEC.shareMax) : pctColor(i.pct));
  const hotItem = items.find((i) => i.key === hot);
  const uid = `zg-${year}`;

  return (
    <ChartCard id="chart-zones" title="Passing zones" years={years} year={year} onYear={setYear}
      controls={<><Seg label="Pocket" options={POCKETS} value={pocket} onChange={setPocket} /><Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} /></>}
      tip={hotItem ? <>
        <b>{BAND_LABEL[hotItem.key.split('|')[0]]} {hotItem.key.split('|')[1]}</b> · {hotItem.counts[0]} att, {hotItem.counts[1]} comp, {hotItem.counts[2]} yds, {hotItem.counts[4]} TD, {hotItem.counts[5]} INT · {Math.round(hotItem.share * 100)}% of his throws
        {Object.entries(ZONE_SPEC.metrics).map(([k, m]) => { const one = chartItems(ZONE_SPEC, db, gsis, pocket, k)!.find((x) => x.key === hotItem.key)!; return one.value === null ? null : <span key={k}> · {m.label} <b>{m.fmt(one.value)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
      </> : <span className="text-muted">Hover a zone for its numbers.</span>}
      legend={share ? <span>Share of his throws, 0% to 20%+ · depth is air yards, drawn to scale</span>
        : <><span>{def!.label} percentile among QBs · grey = under {ZONE_SPEC.min} throws, not ranked</span>{metric === 'cpoe' && <span>CPOE = completion % over what an average QB completes on the same throws</span>}</>}>
      <div className="px-3 pt-3">
        <svg viewBox={`0 0 ${W} ${H + 26}`} className="mx-auto block w-full max-w-[560px]" role="img" aria-label={`Passing zones, ${year}`}>
          <defs><filter id={uid} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={16} /></filter></defs>
          <rect x={FX} y={Y(35)} width={FW} height={H - Y(35)} style={{ fill: 'var(--field)' }} />
          <Sidelines width={W} top={Y(35)} bottom={H} band={SB} marks={[[0, 'LOS'], [10, '+10'], [20, '+20'], [30, '+30']].map(([v, l]) => ({ y: Y(v as number), label: l as string }))} />
          {Array.from({ length: 43 }, (_, n) => n - 7).map((v) => (
            <g key={v}>
              {v % 5 === 0 && v !== 0 && <line x1={FX} x2={FX + FW} y1={Y(v)} y2={Y(v)} strokeWidth={1.2} style={{ stroke: 'var(--field-line)' }} />}
              {[[FX, FX + 7], [FX + FW - 7, FX + FW], [FX + CW - 5, FX + CW + 5], [FX + 2 * CW - 5, FX + 2 * CW + 5]].map(([a, b]) => <line key={a} x1={a} x2={b} y1={Y(v)} y2={Y(v)} style={{ stroke: 'var(--field-line)' }} />)}
            </g>
          ))}
          {items.map((i) => {
            const [band, side] = i.key.split('|');
            const [lo, hi] = RANGE[band], cx = FX + SIDES.indexOf(side as (typeof SIDES)[number]) * CW + CW / 2, h = Y(lo) - Y(hi), cy = (Y(lo) + Y(hi)) / 2;
            const dim = !share && !i.ranked;
            return <ellipse key={i.key} cx={cx} cy={cy} rx={CW * 0.36} ry={Math.min(46, h * 0.42)} filter={`url(#${uid})`} opacity={dim ? 0.25 : share ? 0.35 + 0.5 * Math.min(1, i.share / ZONE_SPEC.shareMax) : 0.6} style={{ fill: colour(i) }} />;
          })}
          <line x1={FX} x2={FX + FW} y1={Y(0)} y2={Y(0)} strokeWidth={3} style={{ stroke: 'var(--los)' }} />
          <g className={hot ? '[&>g]:opacity-25 [&>g[data-hot=true]]:opacity-100' : ''}>
            {items.map((i) => {
              const [band, side] = i.key.split('|');
              const [lo, hi] = RANGE[band], cx = FX + SIDES.indexOf(side as (typeof SIDES)[number]) * CW + CW / 2, h = Y(lo) - Y(hi), cy = (Y(lo) + Y(hi)) / 2;
              const main = share ? `${Math.round(i.share * 100)}%` : def!.fmt(i.value!);
              const sub = share ? `${i.volume} att` : i.ranked ? `${ordinal(i.pct!)} · ${i.volume} att` : `${i.volume} att · too few to rank`;
              const small = h < 70, fs = main.length > 4 ? (small ? 17 : 20) : small ? 20 : 23, ny = cy + (small ? 2 : 4), c = colour(i), ranked = share || i.ranked;
              return (
                <g key={i.key} data-zone={i.key} data-pct={share ? '' : String(i.pct ?? '')} data-hot={hot === i.key} className="cursor-pointer transition-opacity" {...bind(i.key)}>
                  <rect x={cx - CW / 2 + 4} y={cy - h / 2 + 3} width={CW - 8} height={h - 6} fill="transparent" />
                  {ranked && <Chevrons cx={cx} y={ny - fs * 0.33} gap={50} fill={c} />}
                  <text data-main x={cx} y={ny} textAnchor="middle" fontSize={fs} fontWeight={800} style={{ fill: ranked ? 'var(--ink)' : 'var(--muted)' }}>{main}</text>
                  {ranked && <line x1={cx - 22} x2={cx + 22} y1={ny + 4} y2={ny + 4} strokeWidth={2.5} strokeLinecap="round" style={{ stroke: c }} />}
                  <text x={cx} y={ny + (small ? 16 : 19)} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)' }}>{sub}</text>
                </g>
              );
            })}
          </g>
          {SIDES.map((s, n) => <text key={s} x={FX + n * CW + CW / 2} y={H + 18} textAnchor="middle" fontSize={10.5} style={{ fill: 'var(--muted)' }}>{s[0].toUpperCase() + s.slice(1)}</text>)}
        </svg>
        <div className="grid grid-cols-3 gap-2 pb-3 pt-2">
          {([['all', 'All'], ['man', 'vs Man'], ['zone', 'vs Zone']] as const).map(([k, label]) => {
            const s = splits.find((x) => x.key === k);
            return (
              <div key={k} data-testid="zone-tile" className="overflow-hidden rounded-lg bg-surface-2 text-center">
                <div className="num py-2 text-2xl font-bold">{s?.value != null ? tileDef.fmt(s.value) : '–'}</div>
                <div className="flex items-center justify-center gap-1.5 bg-bg px-1 py-1.5 text-[11px] text-muted">
                  {label} · {tileDef.label}
                  {s?.ranked && <span className="rounded px-1 font-bold" style={{ background: pctColor(s.pct), color: 'var(--on-chip)' }}>{s.pct}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}
```

`BANDS` is imported to keep the band order canonical for future use. If the linter flags it as unused, remove it from the import.

- [ ] **Step 4: Implement `PressureCard.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { ChartDb, Split } from '@fantasy-dash/core';
import { chartItems, hasChart } from '../../lib/charts/rank';
import { ordinal, pctColor } from '../../lib/charts/scale';
import { SPLIT_GROUPS, SPLIT_SPEC } from '../../lib/charts/specs';
import { ChartCard, Seg, useHot } from './Field';

const METRICS: [string, string][] = [['epa', 'EPA/dropback'], ['comp', 'Comp %'], ['ypa', 'Yds/att'], ['sack', 'Sack %']];

export default function PressureCard({ charts, gsis }: { charts: ChartDb[]; gsis: string }) {
  const years = useMemo(() => charts.filter((c) => hasChart(SPLIT_SPEC, c, gsis)).map((c) => c.year).sort((a, b) => b - a), [charts, gsis]);
  const [year, setYear] = useState(years[0] ?? 0);
  const [metric, setMetric] = useState('epa');
  const [hot, bind] = useHot();
  const db = charts.find((c) => c.year === year) ?? charts.find((c) => c.year === years[0]);
  const items = useMemo(() => (db ? chartItems(SPLIT_SPEC, db, gsis, 'all', metric) ?? [] : []), [db, gsis, metric]);
  if (!years.length || !db) return null;

  const def = SPLIT_SPEC.metrics[metric];
  const by = new Map(items.map((i) => [i.key, i]));
  const all = by.get('all');
  const hotItem = hot ? by.get(hot as Split) : undefined;
  const row = (k: Split, label: string, strong = false) => {
    const i = by.get(k);
    if (!i) return null;
    return (
      <li key={k} data-key={k} data-pct={String(i.pct ?? '')} {...bind(k)}
        className={`grid cursor-pointer grid-cols-[8rem_minmax(0,1fr)_3.6rem_2.4rem] items-center gap-2.5 rounded px-1.5 py-1 text-xs ${hot === k ? 'bg-surface-2' : ''}`}>
        <span className="truncate">{strong ? <b>{label}</b> : label} <span className="text-muted">{i.volume}</span></span>
        <span className="relative h-1.5 rounded-full bg-surface-2">
          {i.ranked && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, i.pct!)}%`, background: pctColor(i.pct) }} />}
          {k !== 'all' && all?.ranked && <span className="absolute -inset-y-1 w-0.5 rounded bg-muted" style={{ left: `calc(${all.pct}% - 1px)` }} />}
        </span>
        <span className="num text-right text-muted">{i.value === null ? '–' : def.fmt(i.value)}</span>
        <span className="num text-right font-semibold">{i.ranked ? i.pct : '–'}</span>
      </li>
    );
  };

  return (
    <ChartCard id="chart-pressure" title="Under pressure & vs coverage" years={years} year={year} onYear={setYear}
      controls={<Seg label="Metric" options={METRICS} value={metric} onChange={setMetric} />}
      tip={hotItem ? <>
        {hotItem.counts[0]} dropbacks, {hotItem.counts[1]} att, {hotItem.counts[2]} comp, {hotItem.counts[3]} yds, {hotItem.counts[5]} sacks
        {Object.entries(SPLIT_SPEC.metrics).map(([k, m]) => { const one = chartItems(SPLIT_SPEC, db, gsis, 'all', k)!.find((x) => x.key === hotItem.key)!; return one.value === null ? null : <span key={k}> · {m.label} <b>{m.fmt(one.value)}</b>{one.ranked ? ` (${ordinal(one.pct!)})` : ''}</span>; })}
      </> : <span className="text-muted">Each row ranks him only against QBs in the same situation, not against his own other rows.</span>}
      legend={<><span>{def.label} percentile among QBs in the same situation · under {SPLIT_SPEC.min} dropbacks, not ranked</span><span>Tick = his All dropbacks percentile</span>{metric === 'sack' && <span>Lower sack % ranks higher</span>}</>}>
      <ul className="px-3 py-2" aria-label="Splits">
        {row('all', 'All dropbacks', true)}
        {SPLIT_GROUPS.map((g) => {
          const rows = g.rows.map(([k, label]) => row(k, label)).filter(Boolean);
          return rows.length ? [<li key={g.label} className="px-1.5 pb-0.5 pt-2.5 text-[10px] uppercase tracking-wide text-muted">{g.label}</li>, ...rows] : null;
        })}
      </ul>
    </ChartCard>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/charts/PassingZones.test.tsx src/components/charts/PressureCard.test.tsx`
Expected: PASS, 7 tests.

Fixture arithmetic:

| Item | Calculation | Result |
|---|---|---|
| Share, short right | 80 / (80 + 8 + 70) | 51% |
| Comp %, short right | 64 / 80 | 80%; pool q1 0.8 vs q2 0.667, so 100th |
| EPA/db, all | 18 / 170 | +0.11 |
| EPA/db, man | 4 / 60 | +0.07 |
| EPA/db, zone | 14 / 110 | +0.13 |
| EPA/db, pressured | −9 / 40 | −0.23 |
| Sack %, all | 12 / 170 | 7.1% |

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/charts/PassingZones.tsx packages/web/src/components/charts/PassingZones.test.tsx packages/web/src/components/charts/PressureCard.tsx packages/web/src/components/charts/PressureCard.test.tsx
git commit -m "Charts: passing zones glow map and the pressure & coverage card"
```

---

### Task 9: Load the chart files and put the cards on the player page

**Files:**
- Modify:
  - `packages/web/src/data/load.ts`
  - `packages/web/src/routes.tsx` (`playerLoader`)
  - `packages/web/src/pages/PlayerPage.tsx`
  - `packages/web/src/pages/PlayerPage.test.tsx`
- Create: `packages/web/src/lib/charts/smoke.test.ts`

**Interfaces:**
- Consumes: the four cards (Tasks 6–8) and `miniCharts` (Task 4).
- Produces:
  - `hasCharts(year: number): boolean`
  - `loadCharts(year: number): Promise<ChartDb>`
  - `PlayerPageData` gains `charts: ChartDb[]`

- [ ] **Step 1: Write the failing page tests**

In `packages/web/src/pages/PlayerPage.test.tsx`:
- Add the import:

```ts
import { miniCharts } from '../test/chartFixtures';
```

- Change `mount` to:

```ts
function mount(id: string, seasons = leagueSeasons(), charts = [miniCharts()]) {
  loaded = { id, seasons, dbs: [miniDb()], charts };
  render(<MemoryRouter initialEntries={[`/player/${id}`]}><Routes><Route path="/player/:id" element={<PlayerPage />} /></Routes></MemoryRouter>);
}
```

- Append inside `describe('PlayerPage', …)`:

```ts
  it('a WR gets the route tree, a TE too, between the advanced numbers and the game log', () => {
    mount('w1');
    const tree = section(/Route tree/)!;
    expect(tree).toBeInTheDocument();
    expect(section(/Run lanes/)).toBeNull();
    expect(tree.compareDocumentPosition(section(/Game log/)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section(/Advanced by season/)!.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('an RB gets run lanes and a route tree; a QB gets passing zones and the pressure card', () => {
    mount('r1');
    expect(section(/Run lanes/)).toBeInTheDocument();
    expect(section(/Route tree/)).toBeInTheDocument();
    mount('q1');
    expect(section(/Passing zones/)).toBeInTheDocument();
    expect(section(/Under pressure/)).toBeInTheDocument();
  });
  it('hides every card when the player has no gsis id', () => {
    const db = miniDb();
    db.players.w1 = { ...db.players.w1, gsisId: null };
    loaded = { id: 'w1', seasons: leagueSeasons(), dbs: [db], charts: [miniCharts()] };
    render(<MemoryRouter initialEntries={['/player/w1']}><Routes><Route path="/player/:id" element={<PlayerPage />} /></Routes></MemoryRouter>);
    expect(section(/Route tree/)).toBeNull();
  });
  it('lists only his chart seasons in a card picker', () => {
    const empty = { year: 2024, builtAt: '', players: {} };
    mount('w1', leagueSeasons(), [miniCharts(2025), empty, miniCharts(2023)]);
    const picker = within(section(/Route tree/)!).getByRole('combobox');
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['2025', '2023']);
  });
```

`mount('r1')` and then `mount('q1')` render two pages into the same document. If `section()` finds duplicates there, call `cleanup()` from `@testing-library/react` between the two mounts.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/pages/PlayerPage.test.tsx`
Expected: the four new tests FAIL, because no "Route tree" region exists. The existing tests still pass.

- [ ] **Step 3: Add the loaders**

In `packages/web/src/data/load.ts`:
- Add `ChartDb` to the type import from `@fantasy-dash/core`.
- Under `playerDbMods`, add:

```ts
const chartMods = import.meta.glob<{ default: ChartDb }>('../../../../data/charts/*.json');
```

- At the end of the file, add:

```ts
const chartCache = new Map<number, Promise<ChartDb>>();
const chartKey = (year: number) => Object.keys(chartMods).find((k) => k.endsWith(`/${year}.json`));

/** Whether a play-by-play chart file exists for the season (none until nflverse publishes its participation file). */
export const hasCharts = (year: number): boolean => chartKey(year) !== undefined;

export function loadCharts(year: number): Promise<ChartDb> {
  let pending = chartCache.get(year);
  if (!pending) {
    const key = chartKey(year);
    if (!key) return Promise.reject(new Response(`No charts for ${year}`, { status: 404 }));
    pending = chartMods[key]().then((m) => m.default).catch((err) => { chartCache.delete(year); throw err; });
    chartCache.set(year, pending);
  }
  return pending;
}
```

In `packages/web/src/routes.tsx`:
- Import `hasCharts` and `loadCharts` from `./data/load`.
- Change `playerLoader` to:

```ts
export async function playerLoader({ params }: LoaderFunctionArgs): Promise<PlayerPageData> {
  const id = params.id ?? '';
  const years = history.seasons.map((s) => s.year);
  const [seasons, dbs, charts] = await Promise.all([
    loadAllSeasons(),
    Promise.all(years.filter(hasPlayerDb).map(loadPlayerDb)),
    Promise.all(years.filter(hasCharts).map(loadCharts)),
  ]);
  if (!dbs.some((d) => Object.hasOwn(d.players, id)) && !isRostered(seasons, id)) throw new Response(`No player ${id}`, { status: 404 });
  return { id, seasons, dbs, charts };
}
```

- [ ] **Step 4: Put the cards on the page**

In `packages/web/src/pages/PlayerPage.tsx`:
- Add the imports:

```ts
import type { ChartDb } from '@fantasy-dash/core';
import PassingZones from '../components/charts/PassingZones';
import PressureCard from '../components/charts/PressureCard';
import RouteTree from '../components/charts/RouteTree';
import RunLanes from '../components/charts/RunLanes';
```

- Change the interface and the destructure:

```ts
export interface PlayerPageData { id: PlayerId; seasons: Season[]; dbs: PlayerDb[]; charts: ChartDb[] }
```

```ts
  const { id, seasons, dbs, charts } = useLoaderData() as PlayerPageData;
```

- After the `myDbs` line, add:

```ts
  // gsis ids are stable across seasons: take any season's
  const gsis = useMemo(() => dbs.map((d) => d.players[id]?.gsisId).find((g): g is string => !!g) ?? null, [dbs, id]);
```

- Between the percentile/advanced block and the `GameLog` line, insert:

```tsx
      {gsis && (bio.pos === 'WR' || bio.pos === 'TE') && <RouteTree charts={charts} gsis={gsis} pos={bio.pos} />}
      {gsis && bio.pos === 'RB' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <RunLanes charts={charts} gsis={gsis} />
          <RouteTree charts={charts} gsis={gsis} pos="RB" />
        </div>
      )}
      {gsis && bio.pos === 'QB' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <PassingZones charts={charts} gsis={gsis} />
          <PressureCard charts={charts} gsis={gsis} />
        </div>
      )}
```

The RB and QB pairs use `xl` rather than the spec's `lg`. Each card carries its own bar list beside the field, so two side by side only fit from `xl`; at `lg` they stack. Record this as a ruling.

- [ ] **Step 5: Run the page tests**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/pages/PlayerPage.test.tsx`
Expected: PASS, all tests (8).

- [ ] **Step 6: Write the smoke test over the committed files**

Create `packages/web/src/lib/charts/smoke.test.ts`:

```ts
// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { ChartDbSchema, type ChartDb } from '@fantasy-dash/core';
import { chartItems } from './rank';
import { LANE_SPEC, ROUTE_SPEC, SPLIT_SPEC, ZONE_SPEC } from './specs';

const dir = new URL('../../../../../data/charts/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as ChartDb;
const sum = (t: Record<string, number[] | undefined>) => Object.values(t).reduce((a, c) => a + (c?.[0] ?? 0), 0);
const NACUA = '00-0039075', BIJAN = '00-0038542', ALLEN = '00-0034857';

describe('chart files over the committed data', () => {
  it('every file parses', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) expect(() => ChartDbSchema.parse(load(f)), f).not.toThrow();
  });
  it('2025 matches the regular-season counts measured when the plan was written', () => {
    const db = load('2025.json');
    expect(sum(db.players[NACUA].routes!.all)).toBe(163);
    expect(db.players[NACUA].routes!.all['IN/DIG']![0]).toBe(20);
    expect(sum(db.players[BIJAN].lanes!.all)).toBe(287);
    expect(db.players[BIJAN].lanes!.all.RT![0]).toBe(61);
    expect(db.players[ALLEN].splits!.all![0]).toBe(507);
    expect(db.players[ALLEN].zones!.all['short|right']![0]).toBe(84);
  });
  it('every item of the three 2025 players ranks in 0–100 or is unranked, under every metric', () => {
    const db = load('2025.json');
    const check = (items: { pct: number | null }[] | null) => { for (const i of items ?? []) expect(i.pct === null || (i.pct >= 0 && i.pct <= 100)).toBe(true); };
    for (const m of ['share', ...Object.keys(ROUTE_SPEC.metrics)]) for (const f of ['all', 'man', 'zone'] as const) check(chartItems(ROUTE_SPEC, db, NACUA, f, m));
    for (const m of ['share', ...Object.keys(LANE_SPEC.metrics)]) for (const f of ['all', 'light', 'heavy'] as const) check(chartItems(LANE_SPEC, db, BIJAN, f, m));
    for (const m of ['share', ...Object.keys(ZONE_SPEC.metrics)]) for (const f of ['all', 'clean', 'pressured'] as const) check(chartItems(ZONE_SPEC, db, ALLEN, f, m));
    for (const m of Object.keys(SPLIT_SPEC.metrics)) check(chartItems(SPLIT_SPEC, db, ALLEN, 'all', m));
  });
});
```

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/charts/smoke.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Full verification**

Run: `pnpm test && pnpm typecheck && pnpm typecheck:scripts && pnpm build`
Expected: everything green. The build output lists the chart JSON as separate lazy chunks.

- [ ] **Step 8: Look at it**

Build and preview on a free port (4196–4199 are often taken):

```bash
packages/web/node_modules/.bin/vite preview --port 4211 --strictPort --outDir packages/web/dist
```

Take headless Chrome screenshots of these pages, in both dark and light theme:
- `/player/<Nacua sleeper id>`
- `/player/<Bijan sleeper id>`
- `/player/4984` (Josh Allen)
- a TE

Find the Sleeper ids with `node -e "const p=require('./data/players.json');for(const [k,v] of Object.entries(p))if(['Puka Nacua','Bijan Robinson'].includes(v.name))console.log(k,v.name)"`.

Check that:
- labels don't overlap
- the chevrons stay put
- the light theme is readable

Fix any layout issues before committing.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/data/load.ts packages/web/src/routes.tsx packages/web/src/pages/PlayerPage.tsx packages/web/src/pages/PlayerPage.test.tsx packages/web/src/lib/charts/smoke.test.ts
git commit -m "Charts: load the season chart files and show the cards on the player page by position"
```
