# Stats: Players Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Players tab at `/stats/players` with three things for each position:
- one quadrant chart with team logos and 17 curated stat pairings
- a volume trends table that knows about injuries (RB, WR, TE)
- yards per route run, visualised (WR, TE)

**Architecture:**
- **Core:** the chart builder gains three things:
  - a `plays` section built from play-by-play: success under the yards-to-go rule, explosive runs, red-zone opportunities and EPA by quarter
  - a `participation` flag
  - the parsed nflverse injury report

  It can now run without the participation file, so the current season gets those numbers.
- **Web:** pure modules under `lib/stats/players/` turn a season's player database and chart file into:
  - game states (healthy, short, missed, bye)
  - season stats
  - view pools
  - trends

  Components under `components/stats/players/` draw them. The page is a new route beside the Managers stats.

**Tech Stack:** TypeScript, zod 3, React 18, react-router 7, Tailwind 4, Vitest with Testing Library, tsx scripts.

**Spec:** `docs/superpowers/specs/2026-10-19-stats-players-design.md`

## Global Constraints

- **Positions:** QB, RB, WR and TE only. No All tab, floor and ceiling, left on the bench, fingerprints, leaderboards, or paid metrics.
- **URL:** `/stats/players?season=YYYY&pos=RB&view=<id>`.
  - The tab bar reads "Managers | Players" and links `/stats` and `/stats/players`.
  - The season picker has no All-time option, and the default position is RB.
- **Success** (yards-to-go): ≥ 40% of `ydstogo` on 1st down, ≥ 60% on 2nd, ≥ 100% on 3rd or 4th.
- **Other play rules:**
  - Explosive means `yards_gained` ≥ 10.
  - Red zone means `yardline_100` from 1 to 20, in bands a 1–5, b 6–10, c 11–20.
  - Quarter grouping: Q1–3, and Q4 together with overtime.
- **Red-zone points:**
  - carry = 0.1 × rushing yards + 6 × rushing TD
  - target = catch + 0.1 × receiving yards + 6 × receiving TD
  - expected = his opportunities per band × the league average per band and type
- **Healthy game:** `gp` is set and the game is not injury-shortened. Shortened means either:
  - his snap share was under half his usual (the median of his other games that season) and he is on the report that week or the next, or
  - it is the latest scored week with no later report yet, and his share was under a third of his usual.
- **Per-game averages use healthy games only:** PPG, xFP/G and weighted opportunities per game. Rates use every game.
- **Currently injured:** anyone Out or Doubtful (IR counts as Out) on the latest report week leaves both trend lists and goes to an "Injured" line.
- **Quadrant pool:** each view's minimum, then the 40 with the most volume (QB dropbacks, RB carries + targets, WR/TE targets).
- **Team logos:** `https://sleepercdn.com/images/team_logos/nfl/{team lowercased}.png`. If a logo fails, a circle with the team code takes its place.
- **Trends:**
  - The window is the season's last five scored weeks.
  - The change is the mean of the late healthy games (the last two weeks) minus the mean of the early healthy games.
  - A player needs at least 1 healthy late game and 2 healthy early games.
  - Volume over the window: RB at least 25 carries + targets, WR at least 15 targets, TE at least 10.
  - Score: the mean of each column's change ÷ that column's standard deviation of change.
  - Lists: top 10 up, bottom 6 down.

## Review Focus

1. **A season with no chart file at all** (a new year before its first sync), or with a chart file but no `plays`. The page must render. Views needing play-by-play show "No data yet". Nothing throws.
   - Pinned in Task 9: "renders a season with no chart file".
2. **A player who changed teams mid-season.** His logo and team must be his latest team, and the trends' bye detection must use the team he was on that week.
   - Pinned in Task 4: "uses his latest team".
3. **Zero denominators:** a QB with 0 dropbacks in Q4, an RB with 0 targets for yards per target, routes of 0. These must become null and the player drops out of that view. No NaN or Infinity should reach the SVG.
   - Pinned in Task 4: "never yields NaN".
4. **A participation-only view selected** (by link or chip) for a season without participation. It must show the note, never an empty chart or a crash.
   - Pinned in Task 9.
5. **Many players stacked in one spot** (the crowded bottom-left). Labels must not overlap, and the nudge must stop after a bounded number of moves.
   - Pinned in Task 5: "placeLabels never overlaps on a crowded set".

---

## File structure

**Core:**
- Modify:
  - `packages/core/src/charts/types.ts`: `RZ_KEYS`, `PlayCounts`, `participation`, `injuries`
  - `packages/core/src/charts/schema.ts`
  - `packages/core/src/charts/build.ts`: plays, the no-participation path, `parseInjuries`
- Test: `packages/core/test/charts/build.test.ts`, extended

**Sync:**
- Modify: `scripts/syncPlayers.ts`, for the injuries download, the final-file rule, building without participation, and a `--charts-only` flag
- Data: `data/charts/2023…2026.json`, rebuilt

**Web lib:**
- Create in `packages/web/src/lib/stats/players/`:
  - `health.ts`: `gameStates`, `latestReportWeek`, `currentInjury`
  - `season.ts`: the `PlayerStat` type and `seasonStats`
  - `views.ts`: the `View` type, `VIEWS`, `viewsFor`, `volume` and `viewPool`
  - `quadrant.ts`: `fitLine`, `extent`, `placeLabels` and `shortName`
  - `trends.ts`: `trends`
  - tests: `health.test.ts`, `season.test.ts`, `views.test.ts`, `quadrant.test.ts`, `trends.test.ts` and `smoke.test.ts`
- Create: `packages/web/src/test/statsPlayersFixtures.ts`

**Web components:**
- Create in `packages/web/src/components/stats/players/`:
  - `TeamLogo.tsx`
  - `QuadrantChart.tsx`
  - `TrendsTable.tsx`
  - `YprrChart.tsx`
  - `PlayersStats.tsx`
  - `StatsTabs.tsx`
  - tests: `QuadrantChart.test.tsx`, `TrendsTable.test.tsx` and `PlayersStats.test.tsx`
- Create: `packages/web/src/pages/StatsPlayersPage.tsx`
- Modify:
  - `packages/web/src/pages/StatsPage.tsx`, to add the tab bar
  - `packages/web/src/routes.tsx`, for the route and loader

**Commands:**
- core: `pnpm --filter @fantasy-dash/core exec vitest run <path>`
- web: `pnpm --filter @fantasy-dash/web exec vitest run <path>`
- all: `pnpm test && pnpm typecheck && pnpm typecheck:scripts && pnpm build`

---

### Task 1: Core: plays, the participation flag and the injury report

**Files:**
- Modify:
  - `packages/core/src/charts/types.ts`
  - `packages/core/src/charts/schema.ts`
  - `packages/core/src/charts/build.ts`
- Test: `packages/core/test/charts/build.test.ts`

**Interfaces:**
- Produces:
  - `RZ_KEYS = ['ra','rb','rc','ta','tb','tc']` and `type RzKey`
  - `ChartPlayer.plays?: { rush?: Counts; rz?: Partial<Record<RzKey, Counts>>; qtr?: Counts }`. The tuples are:
    - rush: carries, successes, explosive, yards
    - rz: opportunities, points
    - qtr: dropbacks Q1–3, EPA Q1–3, dropbacks Q4+, EPA Q4+
  - `ChartDb.participation: boolean`
  - `ChartDb.injuries: Record<string, Record<string, [string, string]>>`, mapping gsis → week → [status, injury]
  - `buildCharts(pbp, participation, posOf, year, builtAt, injuries?: Iterable<Row>)`
  - `parseInjuries(rows: Iterable<Row>): ChartDb['injuries']`

- [ ] **Step 1: Update the existing test that relied on an empty participation file**

In `packages/core/test/charts/build.test.ts`, the test "a dropback with no participation row counts only in all" passes `[]` as participation. Under the new rule an empty participation file means no participation at all, so give it one unrelated participation row:

```ts
  it('a dropback with no participation row counts only in all', () => {
    const a = qb({ air_yards: '3', pass_location: 'middle', complete_pass: '1', passing_yards: '3' });
    const other = play({ receiver_player_id: 'W' });
    const db = build([a, other], [part(other, { route: 'GO' })]);
    expect(db.players.Q.splits).toEqual({ all: [1, 1, 1, 3, 0, 0] });
    expect(db.players.Q.zones!.all['short|middle']![0]).toBe(1);
    expect(db.players.Q.zones!.clean).toEqual({});
  });
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/core/test/charts/build.test.ts`:

```ts
import { parseInjuries } from '../../src';

describe('buildCharts: plays (play-by-play only)', () => {
  const rush = (f: Row) => play({ rush_attempt: '1', rusher_player_id: 'R', ...f });
  it('success follows the yards-to-go rule at each down, exactly at the threshold', () => {
    const plays = [
      rush({ down: '1', ydstogo: '10', yards_gained: '4' }),   // 40%: success
      rush({ down: '1', ydstogo: '10', yards_gained: '3' }),   // short
      rush({ down: '2', ydstogo: '5', yards_gained: '3' }),    // 60%: success
      rush({ down: '2', ydstogo: '5', yards_gained: '2' }),    // short
      rush({ down: '3', ydstogo: '2', yards_gained: '2' }),    // 100%: success
      rush({ down: '4', ydstogo: '2', yards_gained: '1' }),    // short
    ];
    const db = build(plays, []);
    expect(db.players.R.plays!.rush).toEqual([6, 3, 0, 15]);
  });
  it('explosive at exactly 10 yards; scrambles and two-point tries are not carries', () => {
    const db = build([
      rush({ down: '1', ydstogo: '10', yards_gained: '10' }),
      rush({ down: '1', ydstogo: '10', yards_gained: '9' }),
      rush({ down: '1', ydstogo: '10', yards_gained: '30', qb_scramble: '1' }),
      rush({ down: '', ydstogo: '0', yards_gained: '2', two_point_attempt: '1' }),
    ], []);
    expect(db.players.R.plays!.rush).toEqual([2, 2, 1, 19]);
  });
  it('red-zone bands at 1, 5, 6, 10, 11, 20 and 21, with PPR points for carries and targets', () => {
    const db = build([
      rush({ yardline_100: '1', rushing_yards: '1', rush_touchdown: '1' }),
      rush({ yardline_100: '5', rushing_yards: '2' }),
      rush({ yardline_100: '6', rushing_yards: '3' }),
      rush({ yardline_100: '10', rushing_yards: '0' }),
      rush({ yardline_100: '11', rushing_yards: '5' }),
      rush({ yardline_100: '20', rushing_yards: '0' }),
      rush({ yardline_100: '21', rushing_yards: '9' }),
      play({ pass_attempt: '1', sack: '0', receiver_player_id: 'R', yardline_100: '8', complete_pass: '1', receiving_yards: '8', pass_touchdown: '1' }),
    ], []);
    expect(db.players.R.plays!.rz).toEqual({ ra: [2, 6.3], rb: [2, 0.3], rc: [2, 0.5], tb: [1, 7.8] });
  });
  it('QB dropbacks split into quarters 1–3 and 4 plus overtime', () => {
    const qb = (q: string, epa: string) => play({ pass_attempt: '1', passer_player_id: 'Q', sack: '0', qtr: q, epa });
    const db = build([qb('1', '0.5'), qb('3', '-0.25'), qb('4', '1'), qb('5', '0.5')], []);
    expect(db.players.Q.plays!.qtr).toEqual([2, 0.25, 2, 1.5]);
  });
  it('with no participation file: participation false, and no routes, lanes, zones or splits', () => {
    const db = build([
      play({ receiver_player_id: 'W' }),
      rush({ run_location: 'left', run_gap: 'tackle', down: '1', ydstogo: '10', yards_gained: '5' }),
      play({ pass_attempt: '1', passer_player_id: 'Q', sack: '0', air_yards: '5', pass_location: 'left' }),
    ], []);
    expect(db.participation).toBe(false);
    expect(db.players.W).toBeUndefined();
    expect(db.players.R.lanes).toBeUndefined();
    expect(db.players.Q.zones).toBeUndefined();
    expect(db.players.Q.splits).toBeUndefined();
    expect(db.players.R.plays!.rush![0]).toBe(1);
  });
  it('with participation: participation true', () => {
    const a = play({ receiver_player_id: 'W' });
    expect(build([a], [part(a, { route: 'GO' })]).participation).toBe(true);
  });
});

describe('parseInjuries', () => {
  it('keeps regular-season rows by gsis and week, IR as Out, a blank status as listed', () => {
    const inj = parseInjuries([
      { season_type: 'REG', gsis_id: 'G1', week: '3', report_status: 'Out', report_primary_injury: 'Knee', practice_primary_injury: 'Knee' },
      { season_type: 'REG', gsis_id: 'G1', week: '5', report_status: '', report_primary_injury: '', practice_primary_injury: 'Knee' },
      { season_type: 'REG', gsis_id: 'G2', week: '6', report_status: 'Injured Reserve', report_primary_injury: 'Groin', practice_primary_injury: '' },
      { season_type: 'POST', gsis_id: 'G3', week: '19', report_status: 'Out', report_primary_injury: 'Ankle', practice_primary_injury: '' },
    ]);
    expect(inj).toEqual({ G1: { '3': ['Out', 'Knee'], '5': ['', 'Knee'] }, G2: { '6': ['Out', 'Groin'] } });
  });
  it('buildCharts stores the parsed report', () => {
    const db = buildCharts([], [], () => null, 2026, 'x', [{ season_type: 'REG', gsis_id: 'G1', week: '2', report_status: 'Questionable', report_primary_injury: 'Hamstring', practice_primary_injury: '' }]);
    expect(db.injuries).toEqual({ G1: { '2': ['Questionable', 'Hamstring'] } });
  });
});
```

Add `buildCharts` to the existing import if it isn't already there.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @fantasy-dash/core exec vitest run test/charts/build.test.ts`
Expected: the new tests FAIL, because `parseInjuries` is not exported and `plays`/`participation` are undefined. The updated old test passes.

- [ ] **Step 4: Types**

In `packages/core/src/charts/types.ts`, after `export type Pocket = …`, add:

```ts
/** red-zone opportunity keys: r = carry, t = target; a = yardline 1–5, b = 6–10, c = 11–20 */
export const RZ_KEYS = ['ra', 'rb', 'rc', 'ta', 'tb', 'tc'] as const;
export type RzKey = (typeof RZ_KEYS)[number];
```

Extend the `Counts` doc comment with these lines:

```ts
 * plays.rush: carries, successes (yards-to-go rule), explosive (10+ yards), yards
 * plays.rz:   opportunities, PPR points
 * plays.qtr:  dropbacks Q1–3, their EPA, dropbacks Q4 + OT, their EPA
```

In `ChartPlayer`, add:

```ts
  /** from play-by-play alone, so present for the current season too */
  plays?: { rush?: Counts; rz?: Partial<Record<RzKey, Counts>>; qtr?: Counts };
```

In `ChartDb`, add:

```ts
  /** whether the participation file existed: routes, lanes, zones and splits are only built when it did */
  participation: boolean;
  /** nflverse weekly injury report: gsis → week → [status (IR as Out; '' when listed without a game status), injury] */
  injuries: Record<string, Record<string, [string, string]>>;
```

- [ ] **Step 5: Schema**

In `packages/core/src/charts/schema.ts`:
- Import `RZ_KEYS`.
- Inside the player object, after `splits`, add:

```ts
    plays: z.object({ rush: tuple(4).optional(), rz: table(RZ_KEYS, 2).optional(), qtr: tuple(4).optional() }).optional(),
```

- In the top-level object, after `builtAt`, add:

```ts
  participation: z.boolean(),
  injuries: z.record(z.record(z.tuple([z.string(), z.string()]))),
```

- [ ] **Step 6: Builder**

In `packages/core/src/charts/build.ts`:
- Import `RZ_KEYS`/`RzKey` types as needed.
- Add:

```ts
/** carry success under the yards-to-go rule: 40% of the distance on 1st down, 60% on 2nd, all of it on 3rd or 4th */
export function rushSuccess(down: number, toGo: number, gained: number): boolean {
  if (down === 1) return gained >= 0.4 * toGo;
  if (down === 2) return gained >= 0.6 * toGo;
  return gained >= toGo;
}
const rzBand = (yl: number): 'a' | 'b' | 'c' | null => (yl >= 1 && yl <= 5 ? 'a' : yl >= 6 && yl <= 10 ? 'b' : yl >= 11 && yl <= 20 ? 'c' : null);

/** The weekly injury report, regular season: gsis → week → [status, injury]; IR counts as Out. */
export function parseInjuries(rows: Iterable<Row>): ChartDb['injuries'] {
  const out: ChartDb['injuries'] = {};
  for (const r of rows) {
    if (r.season_type !== 'REG' || !present(r.gsis_id) || !present(r.week)) continue;
    const status = r.report_status === 'Injured Reserve' ? 'Out' : present(r.report_status) ? r.report_status : '';
    (out[r.gsis_id] ??= {})[String(Number(r.week))] = [status, (present(r.report_primary_injury) ? r.report_primary_injury : present(r.practice_primary_injury) ? r.practice_primary_injury : '')];
  }
  return out;
}
```

Change the signature and the first lines of `buildCharts`:

```ts
export function buildCharts(pbp: Iterable<Row>, participation: Iterable<Row>, posOf: (gsis: string) => DbPos | null, year: number, builtAt: string, injuries: Iterable<Row> = []): ChartDb {
  const parts = new Map<string, Row>();
  for (const r of participation) parts.set(playKey(r.nflverse_game_id, r.play_id), r);
  const hasPart = parts.size > 0;
```

Inside the loop, guard the three existing blocks so they only run when `hasPart`:
- the routes block: `if (hasPart && present(p.receiver_player_id) && x && ROUTE_SET.has(x.route))`
- the lanes block: `if (hasPart && p.rush_attempt === '1' && …)`
- the dropback block: `if (hasPart && p.pass_attempt === '1' && present(p.passer_player_id))`

Then add a new block at the end of the loop body:

```ts
    // play-by-play only: built with or without participation
    if (p.two_point_attempt !== '1') {
      if (p.rush_attempt === '1' && p.qb_scramble !== '1' && present(p.rusher_player_id)) {
        const pl = player(p.rusher_player_id, ['RB']);
        if (pl) {
          const plays = (pl.plays ??= {});
          const gained = num(p.yards_gained);
          bump(plays as Record<string, Counts>, 'rush', [1, rushSuccess(num(p.down), num(p.ydstogo), gained) ? 1 : 0, gained >= 10 ? 1 : 0, gained]);
          const b = rzBand(num(p.yardline_100));
          if (b) bump((plays.rz ??= {}), `r${b}` as RzKey, [1, num(p.rushing_yards) * 0.1 + num(p.rush_touchdown) * 6]);
        }
      }
      if (p.pass_attempt === '1' && p.sack !== '1' && present(p.receiver_player_id)) {
        const b = rzBand(num(p.yardline_100));
        const pl = b ? player(p.receiver_player_id, ['RB']) : null;
        if (pl && b) bump(((pl.plays ??= {}).rz ??= {}), `t${b}` as RzKey, [1, num(p.complete_pass) + num(p.receiving_yards) * 0.1 + num(p.pass_touchdown) * 6]);
      }
      if (p.pass_attempt === '1' && present(p.passer_player_id)) {
        const pl = player(p.passer_player_id, ['QB']);
        if (pl) bump((pl.plays ??= {}) as Record<string, Counts>, 'qtr', num(p.qtr) >= 4 ? [0, 0, 1, num(p.epa)] : [1, num(p.epa), 0, 0]);
      }
    }
```

Note that `player()` creates the player on first sight. Without participation, a receiver who is not an RB never gets created, which is what the "no participation" test expects.

In `roundAll`, add:

```ts
  if (p.plays?.rush) p.plays.rush = p.plays.rush.map((v) => round(v, 0));
  if (p.plays?.rz) for (const c of Object.values(p.plays.rz)) if (c) c.forEach((v, i) => { c[i] = round(v, i === 1 ? 1 : 0); });
  if (p.plays?.qtr) p.plays.qtr = p.plays.qtr.map((v, i) => round(v, i % 2 ? 2 : 0));
```

Change the return to:

```ts
  return { year, builtAt, participation: hasPart, injuries: parseInjuries(injuries), players };
```

- [ ] **Step 7: Keep the player-page fixture typed**

`ChartDb` now requires `participation` and `injuries`. In `packages/web/src/test/chartFixtures.ts`, change the first line of the returned object to:

```ts
    year, builtAt: '2026-01-01T00:00:00.000Z', participation: true, injuries: {},
```

In `packages/web/src/pages/PlayerPage.test.tsx`, change the empty 2024 chart literal to:

```ts
    const empty = { year: 2024, builtAt: '', participation: true, injuries: {}, players: {} };
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter @fantasy-dash/core exec vitest run test/charts/build.test.ts && pnpm typecheck`
Expected: PASS, all tests (10 old + 8 new = 18), and typecheck clean across core and web.

The red-zone expectations, worked through:

| Band | Plays | Opportunities | Points |
|---|---|---|---|
| ra | 1 yd + TD = 6.1, and 2 yds = 0.2 | 2 | 6.3 |
| rb | 3 yds = 0.3, and 0 | 2 | 0.3 |
| rc | 5 yds = 0.5, and 0 | 2 | 0.5 |
| tb | 1 catch + 0.8 + 6 | 1 | 7.8 |

The 21-yard carry is not in the red zone.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/charts packages/core/test/charts packages/web/src/test/chartFixtures.ts packages/web/src/pages/PlayerPage.test.tsx
git commit -m "Charts: play-by-play counts (yards-to-go success, explosive, red zone, quarters), participation flag, injury report"
```

---

### Task 2: Sync: injuries, building without participation, the final-file rule, and the data rebuild

**Files:**
- Modify: `scripts/syncPlayers.ts`
- Data: `data/charts/*.json`

**Interfaces:**
- Consumes: `buildCharts(…, injuries)`, `ChartDbSchema` (Task 1).
- Produces: committed chart files with `plays`, `participation` and `injuries`, including `data/charts/2026.json`.

- [ ] **Step 1: URLs and the flag**

In `URLS`, add:

```ts
  injuries: (y: number) => `${NFLVERSE}/injuries/injuries_${y}.csv`,
```

Under `const dryRun`, add:

```ts
const chartsOnly = args.includes('--charts-only');
```

- [ ] **Step 2: The final-file rule**

Replace `chartFileFinal` with:

```ts
/** A chart file is final when it parses and was built with participation; anything else is rebuilt (participation arrives after a season ends). */
function chartFileFinal(file: string): boolean {
  if (!existsSync(file)) return false;
  try { return ChartDbSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).participation; } catch { return false; }
}
```

- [ ] **Step 3: Build without participation**

In `chartsPhase`, replace the two fetch lines and the `buildCharts` call:

```ts
    const pbp = await fetchText(URLS.pbp(year));
    if (pbp === null) { log(`${year}: no play-by-play file yet; no charts`); continue; }
    const part = await fetchText(URLS.participation(year));
    if (part === null) log(`${year}: no participation file yet; building play-by-play charts only`);
    const injuries = await fetchText(URLS.injuries(year));
    if (injuries === null) log(`${year}: no injury report file`);
    nflPlayers ??= rowsOf(await requireText(URLS.players, 'nflverse player list'));
    const db = buildCharts(parseCsv(pbp), part ? parseCsv(part) : [], positionsFor(year, nflPlayers), year, new Date().toISOString(), injuries ? parseCsv(injuries) : []);
```

- [ ] **Step 4: `--charts-only`**

In `main`, replace `await playerDbPhase(client, leagues);` with:

```ts
  if (!chartsOnly) await playerDbPhase(client, leagues);
```

Then run: `pnpm typecheck:scripts`
Expected: clean.

- [ ] **Step 5: Rebuild the chart files**

Run: `pnpm sync:players --charts-only --full`

Expected:
- 2023, 2024 and 2025 each log `charts for N players`.
- 2026 logs `no participation file yet; building play-by-play charts only` and then `charts for N players`.
- `Wrote 4 chart file(s)`.

Check the result:

```bash
node -e "for (const y of [2023,2024,2025,2026]) { const d=require('./data/charts/'+y+'.json'); const g=d.players['00-0038542']; console.log(y, d.participation, Object.keys(d.injuries).length, g?.plays?.rush, JSON.stringify(g?.plays?.rz)) }"
```

Expected:
- `participation` is true for 2023–2025 and false for 2026.
- The injury count is above 0 for each year.
- Bijan (`00-0038542`) has a `rush` tuple and a `rz` object every year.

- [ ] **Step 6: Run the chart smoke and player-page tests**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/charts src/components/charts`
Expected: PASS.

The existing smoke test's 2025 counts (163, 20, 287, 61, 507, 84) are unchanged, because routes, lanes, zones and splits are built the same way when participation exists.

- [ ] **Step 7: Commit**

```bash
git add scripts/syncPlayers.ts data/charts
git commit -m "Charts sync: injury report, play-by-play charts without participation, rebuild until participation arrives"
```

---

### Task 3: Web: game states (healthy, short, missed, bye) and the current injury

**Files:**
- Create:
  - `packages/web/src/test/statsPlayersFixtures.ts`
  - `packages/web/src/lib/stats/players/health.ts`
- Test: `packages/web/src/lib/stats/players/health.test.ts`

**Interfaces:**
- Produces:
  - `type GameState = 'healthy' | 'short' | 'missed' | 'bye'`
  - `gameStates(db: PlayerDb, injuries: ChartDb['injuries'] | undefined): Map<PlayerId, Map<number, GameState>>`
  - `latestReportWeek(injuries): number`
  - `currentInjury(gsis: string | null, injuries): { status: string; injury: string } | null`
- Fixtures: `statsDb(): PlayerDb` and `statsCharts(): ChartDb`. These are a 2026 season through week 5 with teams AAA, BBB and CCC, where CCC has its bye in week 3. The players:

| Id | Pos | Team | Pattern |
|---|---|---|---|
| `rUp` | RB | AAA | role grows: snap share 0.3, 0.3, 0.3, 0.8, 0.85; carries 5, 5, 6, 18, 20 |
| `rDown` | RB | BBB | role shrinks: snap share 0.8 in weeks 1–3, then 0.3, 0.3 |
| `rHurt` | RB | AAA | a Goedert-style case: snap share 0.9, then 0.2 in week 2 (on the report for week 3), missed weeks 3–4, back to 0.85 in week 5 |
| `rOut` | RB | BBB | a Montgomery-style case: snap share 0.7, 0.7, 0.7, 0.5, 0.45, then listed Out in week 6 |
| `rLast` | RB | CCC | an Achane-style case: snap share 0.85, 0.8, bye, 0.8, then 0.05 in week 5. He is not on the week-6 report, so with that report out it's a real drop; before it (no week-6 report) the provisional rule marks it short |
| `wA` | WR | AAA | steady |
| `wB` | WR | BBB | steady |
| `qA` | QB | AAA | steady |

- [ ] **Step 1: Write the fixture**

Create `packages/web/src/test/statsPlayersFixtures.ts`:

```ts
import type { ChartDb, PlayerDb, PlayerWeek } from '@fantasy-dash/core';
import { player, teamWeek } from './playerDbFixtures';

const TEAMS = ['AAA', 'BBB', 'CCC'];
const BYE: Record<string, number> = { CCC: 3 };

/** snap share per week (null = did not play), carries per week, targets per week */
type Line = { share: (number | null)[]; car?: number[]; tgt?: number[]; extra?: Partial<PlayerWeek> };
const LINES: Record<string, { pos: 'QB' | 'RB' | 'WR' | 'TE'; team: string; name: string } & Line> = {
  rUp:   { pos: 'RB', team: 'AAA', name: 'Rising Back', share: [0.3, 0.3, 0.3, 0.8, 0.85], car: [5, 5, 6, 18, 20], tgt: [1, 1, 1, 4, 5] },
  rDown: { pos: 'RB', team: 'BBB', name: 'Fading Back', share: [0.8, 0.8, 0.8, 0.3, 0.3], car: [18, 17, 18, 6, 5], tgt: [4, 4, 4, 1, 0] },
  rHurt: { pos: 'RB', team: 'AAA', name: 'Hurt Back', share: [0.9, 0.2, null, null, 0.85], car: [20, 3, 0, 0, 19], tgt: [5, 0, 0, 0, 4] },
  rOut:  { pos: 'RB', team: 'BBB', name: 'Out Back', share: [0.7, 0.7, 0.7, 0.5, 0.45], car: [15, 15, 15, 10, 9], tgt: [3, 3, 3, 2, 2] },
  rLast: { pos: 'RB', team: 'CCC', name: 'Last Week Back', share: [0.85, 0.8, null, 0.8, 0.05], car: [18, 17, 0, 18, 1], tgt: [4, 4, 0, 4, 0] },
  wA:    { pos: 'WR', team: 'AAA', name: 'Wide A', share: [0.9, 0.9, 0.9, 0.9, 0.9], tgt: [8, 8, 8, 9, 9] },
  wB:    { pos: 'WR', team: 'BBB', name: 'Wide B', share: [0.85, 0.85, 0.85, 0.85, 0.85], tgt: [6, 6, 6, 6, 7] },
  qA:    { pos: 'QB', team: 'AAA', name: 'Quarter A', share: [1, 1, 1, 1, 1], extra: { pa_att: 30, pa_cmp: 20, pa_yds: 250, pa_td: 2, pa_int: 1, pa_sack: 2, pa_sackYds: 14, pa_epa: 4, pa_cpoe: 2, pa_aggr: 15 } },
};

export function statsDb(): PlayerDb {
  const rows: PlayerWeek[] = [];
  for (const [id, l] of Object.entries(LINES)) {
    l.share.forEach((s, i) => {
      const week = i + 1;
      if (BYE[l.team] === week) return;
      const car = l.car?.[i] ?? 0, tgt = l.tgt?.[i] ?? 0;
      rows.push({ id, week, team: l.team, gp: s === null ? 0 : 1, opp: 'OPP', ...(s === null ? {} : {
        snaps: Math.round(s * 60), teamSnaps: 60, pts: car * 0.6 + tgt * 1.6, xfp: car * 0.55 + tgt * 1.5,
        ru_att: car, ru_yds: car * 4, ru_ryoe: car * 0.2, re_tgt: tgt, re_rec: Math.round(tgt * 0.7), re_yds: tgt * 8, re_fd: Math.round(tgt / 2), re_air: tgt * 9,
        routesEst: l.pos === 'RB' ? Math.round(s * 30) : Math.round(s * 35), re_tgtShare: tgt / 30, re_ayShare: tgt / 35, re_sep: 3, ...l.extra,
      }) });
    });
  }
  return {
    year: 2026, throughWeek: 5, routesReal: false, builtAt: '2026-10-19T00:00:00.000Z',
    players: Object.fromEntries(Object.entries(LINES).map(([id, l]) => [id, player(id, l.pos, [l.team], l.name)])),
    teamWeeks: TEAMS.flatMap((t) => [1, 2, 3, 4, 5].filter((w) => BYE[t] !== w).map((w) => teamWeek(t, w, { rushAtt: 25, passAtt: 30, dropbacks: 32 }))),
    xfp: { QB: null, RB: null, WR: null, TE: null }, rows,
  };
}

export function statsCharts(): ChartDb {
  return {
    year: 2026, builtAt: '2026-10-19T00:00:00.000Z', participation: false,
    injuries: {
      '00-rHurt': { '3': ['Out', 'Knee'], '4': ['Out', 'Knee'] },
      '00-rOut': { '6': ['Out', 'Groin'] },
      '00-wA': { '6': ['Questionable', 'Ankle'] },
    },
    players: {
      '00-rUp': { pos: 'RB', plays: { rush: [54, 27, 6, 216], rz: { ra: [4, 8], rc: [6, 3] } } },
      '00-rDown': { pos: 'RB', plays: { rush: [68, 26, 4, 250], rz: { ra: [6, 6], tb: [2, 4] } } },
      '00-qA': { pos: 'QB', plays: { qtr: [100, 10, 40, 8] } },
    },
  };
}
```

`player()` in `playerDbFixtures.ts` sets `gsisId` to `00-<id>`, which the chart fixture uses.

- [ ] **Step 2: Write the failing test**

Create `packages/web/src/lib/stats/players/health.test.ts`:

```ts
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { currentInjury, gameStates, latestReportWeek } from './health';

describe('gameStates', () => {
  const db = statsDb(), ch = statsCharts();
  const st = gameStates(db, ch.injuries);
  const of = (id: string) => [1, 2, 3, 4, 5].map((w) => st.get(id)!.get(w));
  it('a steady player is healthy every week', () => {
    expect(of('wA')).toEqual(['healthy', 'healthy', 'healthy', 'healthy', 'healthy']);
  });
  it('a game under half his usual snap share with him on the next week\'s report is short; missed games are missed', () => {
    expect(of('rHurt')).toEqual(['healthy', 'short', 'missed', 'missed', 'healthy']);
  });
  it('a bye is a bye', () => {
    expect(of('rLast')[2]).toBe('bye');
  });
  it('the latest week under a third of his usual counts as short before the next report exists', () => {
    const early = { ...ch.injuries }; delete early['00-rOut']; delete early['00-wA'];   // no week-6 report yet
    expect(gameStates(db, early).get('rLast')!.get(5)).toBe('short');
    expect(of('rLast')[4]).toBe('healthy');   // the week-6 report is out and he is not on it
  });
  it('a real role cut (under half his usual, not on any report) stays healthy', () => {
    expect(of('rDown')).toEqual(['healthy', 'healthy', 'healthy', 'healthy', 'healthy']);
  });
  it('without an injury report, only the provisional latest-week rule can mark a game short', () => {
    const st2 = gameStates(db, undefined);
    expect(st2.get('rHurt')!.get(2)).toBe('healthy');
    expect(st2.get('rLast')!.get(5)).toBe('short');
  });
});

describe('injury report helpers', () => {
  it('the latest report week is the highest week listed', () => {
    expect(latestReportWeek(statsCharts().injuries)).toBe(6);
    expect(latestReportWeek(undefined)).toBe(0);
  });
  it('currentInjury is his Out or Doubtful status on the latest report, null otherwise', () => {
    const inj = statsCharts().injuries;
    expect(currentInjury('00-rOut', inj)).toEqual({ status: 'Out', injury: 'Groin' });
    expect(currentInjury('00-wA', inj)).toBeNull();      // Questionable
    expect(currentInjury('00-rHurt', inj)).toBeNull();   // listed weeks 3–4, not on the latest report
    expect(currentInjury(null, inj)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players/health.test.ts`
Expected: FAIL, because `./health` can't be resolved.

- [ ] **Step 4: Implement**

Create `packages/web/src/lib/stats/players/health.ts`:

```ts
import type { ChartDb, PlayerDb, PlayerId, PlayerWeek } from '@fantasy-dash/core';

export type GameState = 'healthy' | 'short' | 'missed' | 'bye';
type Injuries = ChartDb['injuries'] | undefined;
const OUT = new Set(['Out', 'Doubtful']);

const median = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const shareOf = (r: PlayerWeek): number | null => (r.snaps != null && r.teamSnaps ? r.snaps / r.teamSnaps : null);

/** The highest week on the injury report; 0 when there is none. */
export function latestReportWeek(injuries: Injuries): number {
  let w = 0;
  for (const p of Object.values(injuries ?? {})) for (const k of Object.keys(p)) w = Math.max(w, Number(k));
  return w;
}

/** His Out or Doubtful status on the latest report, or null. */
export function currentInjury(gsis: string | null, injuries: Injuries): { status: string; injury: string } | null {
  const e = gsis ? injuries?.[gsis]?.[String(latestReportWeek(injuries))] : undefined;
  return e && OUT.has(e[0]) ? { status: e[0], injury: e[1] } : null;
}

/**
 * Each scored week for every player: healthy, short (injury-shortened), missed or bye.
 * Short: under half his usual snap share (the median of his other games) and on the report that week or the next;
 * or, in the latest scored week before a later report exists, under a third of his usual.
 */
export function gameStates(db: PlayerDb, injuries: Injuries): Map<PlayerId, Map<number, GameState>> {
  const played = new Set(db.teamWeeks.map((t) => `${t.team}|${t.week}`));
  const rows = new Map<PlayerId, Map<number, PlayerWeek>>();
  for (const r of db.rows) { let m = rows.get(r.id); if (!m) rows.set(r.id, (m = new Map())); m.set(r.week, r); }
  const latest = latestReportWeek(injuries);
  const out = new Map<PlayerId, Map<number, GameState>>();
  for (const [id, byWeek] of rows) {
    const p = db.players[id];
    const rep = (p?.gsisId ? injuries?.[p.gsisId] : undefined) ?? {};
    const shares = new Map<number, number>();
    for (const [w, r] of byWeek) { const s = r.gp ? shareOf(r) : null; if (s != null) shares.set(w, s); }
    const states = new Map<number, GameState>();
    let team = p?.teams[0] ?? '';
    for (let w = 1; w <= db.throughWeek; w++) {
      const r = byWeek.get(w);
      if (r) team = r.team;
      if (!r || !r.gp) { states.set(w, played.has(`${team}|${w}`) ? 'missed' : 'bye'); continue; }
      const share = shares.get(w), usual = median([...shares].filter(([k]) => k !== w).map(([, v]) => v));
      let short = false;
      if (share != null && usual != null && usual > 0) {
        const listed = rep[String(w)] !== undefined || rep[String(w + 1)] !== undefined;
        short = (share < usual / 2 && listed) || (w === db.throughWeek && latest <= w && share < usual / 3);
      }
      states.set(w, short ? 'short' : 'healthy');
    }
    out.set(id, states);
  }
  return out;
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players/health.test.ts`
Expected: PASS, 8 tests.

Two cases worth checking by hand:
- **rHurt week 2:** his share is 0.2 against a usual of 0.875 (the median of 0.9 and 0.85). That's under half, and week 3 is on the report, so it's short.
- **rDown weeks 4–5:** his share is 0.3 against a usual of 0.8. That's under half, but he's on no report, and the week-6 report exists so the provisional rule is off. It's healthy: a real role cut.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/test/statsPlayersFixtures.ts packages/web/src/lib/stats/players/health.ts packages/web/src/lib/stats/players/health.test.ts
git commit -m "Stats players: game states from snap share and the injury report"
```

---

### Task 4: Web: season stats

**Files:**
- Create: `packages/web/src/lib/stats/players/season.ts`
- Test: `packages/web/src/lib/stats/players/season.test.ts`

**Interfaces:**
- Consumes: `gameStates` (Task 3).
- Produces: `PlayerStat` (fields below) and `seasonStats(db: PlayerDb, charts: ChartDb | undefined): PlayerStat[]`.

`PlayerStat` has these fields:

| Group | Fields |
|---|---|
| Identity | `id`, `name`, `pos`, `team` (his latest), `games`, `healthy` |
| Fantasy | `ppg`, `xppg` |
| QB | `att`, `dropbacks`, `anya`, `cpoe`, `aggr`, `epaDb`, `epa13`, `epa4`, `db4` |
| Rushing | `car`, `snapPct`, `wopg`, `ypc`, `ypt`, `ryoe`, `succ`, `expl`, `rzX`, `rzA` |
| Receiving | `tgt`, `routes`, `routesEst`, `yds`, `yprr`, `tprr`, `fdrr`, `adot`, `sep`, `catchPct`, `tgtShare` |
| Participation splits | `clean`, `press`, `cleanDb`, `pressDb`, `manEpa`, `zoneEpa`, `manDb`, `zoneDb`, `manYpt`, `zoneYpt`, `manTgt`, `zoneTgt` |

Every numeric stat is `number | null`. Counts are plain numbers.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/lib/stats/players/season.test.ts`:

```ts
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from './season';

const stats = seasonStats(statsDb(), statsCharts());
const by = (id: string) => stats.find((s) => s.id === id)!;

describe('seasonStats', () => {
  it('per-game averages count healthy games only', () => {
    const h = by('rHurt');               // healthy weeks 1 and 5; week 2 short; 3–4 missed
    expect(h.games).toBe(3);
    expect(h.healthy).toBe(2);
    expect(h.ppg).toBeCloseTo(((20 * 0.6 + 5 * 1.6) + (19 * 0.6 + 4 * 1.6)) / 2);
    expect(h.wopg).toBeCloseTo((20 + 19 + 1.5 * (5 + 4)) / 2);
  });
  it('rates count every game played', () => {
    const h = by('rHurt');
    expect(h.car).toBe(42);
    expect(h.ypc).toBeCloseTo(4);
  });
  it('QB: ANY/A, EPA per dropback, quarters', () => {
    const q = by('qA');
    expect(q.dropbacks).toBe(160);
    expect(q.anya).toBeCloseTo((1250 + 20 * 10 - 45 * 5 - 70) / 160);
    expect(q.epaDb).toBeCloseTo(20 / 160);
    expect(q.epa13).toBeCloseTo(0.1);
    expect(q.epa4).toBeCloseTo(0.2);
    expect(q.cpoe).toBeCloseTo(2);
  });
  it('RB play-by-play: success, explosive and red zone against league band averages', () => {
    const u = by('rUp');
    expect(u.succ).toBeCloseTo(0.5);
    expect(u.expl).toBeCloseTo(6 / 54);
    // ra league average = (8 + 6) / (4 + 6) = 1.4; rc = 3 / 6 = 0.5
    expect(u.rzX).toBeCloseTo((4 * 1.4 + 6 * 0.5) / 5);
    expect(u.rzA).toBeCloseTo((8 + 3) / 5);
  });
  it('routes fall back to the estimate and say so', () => {
    const w = by('wA');
    expect(w.routesEst).toBe(true);
    expect(w.yprr).toBeCloseTo(w.yds / w.routes);
  });
  it('participation stats are null without participation', () => {
    expect(by('qA').clean).toBeNull();
    expect(by('wA').manYpt).toBeNull();
  });
  it('uses his latest team', () => {
    const db = statsDb();
    db.rows.filter((r) => r.id === 'wA' && r.week === 5).forEach((r) => { r.team = 'BBB'; });
    expect(seasonStats(db, statsCharts()).find((s) => s.id === 'wA')!.team).toBe('BBB');
  });
  it('never yields NaN or Infinity, even with zero denominators', () => {
    const bad = JSON.stringify(stats, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'BAD' : v));
    expect(bad).not.toContain('BAD');
    expect(by('qA').ypt).toBeNull();     // no targets
    expect(by('wA').succ).toBeNull();    // no play-by-play rushing
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players/season.test.ts`
Expected: FAIL, because `./season` can't be resolved.

- [ ] **Step 3: Implement**

Create `packages/web/src/lib/stats/players/season.ts`:

```ts
import { RZ_KEYS, type ChartDb, type Counts, type PlayerDb, type PlayerId, type PlayerWeek } from '@fantasy-dash/core';
import { gameStates } from './health';

export type Pos = 'QB' | 'RB' | 'WR' | 'TE';
type N = number | null;
export interface PlayerStat {
  id: PlayerId; name: string; pos: Pos; team: string; games: number; healthy: number;
  ppg: N; xppg: N;
  att: number; dropbacks: number; anya: N; cpoe: N; aggr: N; epaDb: N; epa13: N; epa4: N; db4: number;
  car: number; snapPct: N; wopg: N; ypc: N; ypt: N; ryoe: N; succ: N; expl: N; rzX: N; rzA: N;
  tgt: number; routes: number; routesEst: boolean; yds: number; yprr: N; tprr: N; fdrr: N; adot: N; sep: N; catchPct: N; tgtShare: N;
  clean: N; press: N; cleanDb: number; pressDb: number; manEpa: N; zoneEpa: N; manDb: number; zoneDb: number; manYpt: N; zoneYpt: N; manTgt: number; zoneTgt: number;
}

const ratio = (n: number, d: number): N => (d > 0 && Number.isFinite(n / d) ? n / d : null);
const sum = (rs: PlayerWeek[], k: keyof PlayerWeek) => rs.reduce((s, r) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0);
const mean = (rs: PlayerWeek[], k: keyof PlayerWeek): N => { const v = rs.map((r) => r[k]).filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const total = (t: Partial<Record<string, Counts>> | undefined) => Object.values(t ?? {}).reduce((a, c) => [a[0] + (c?.[0] ?? 0), a[1] + (c?.[2] ?? 0), a[2] + (c?.[3] ?? 0)], [0, 0, 0]);

/** League points per red-zone opportunity for each band and type. */
function rzAverages(charts: ChartDb | undefined): Record<string, number> {
  const acc: Record<string, [number, number]> = {};
  for (const p of Object.values(charts?.players ?? {})) for (const [k, c] of Object.entries(p.plays?.rz ?? {})) if (c) { const a = (acc[k] ??= [0, 0]); a[0] += c[0]; a[1] += c[1]; }
  return Object.fromEntries(Object.entries(acc).map(([k, [n, pts]]) => [k, n ? pts / n : 0]));
}

/** Season-to-date stats for every QB/RB/WR/TE with a game played. Per-game averages use healthy games only. */
export function seasonStats(db: PlayerDb, charts: ChartDb | undefined): PlayerStat[] {
  const states = gameStates(db, charts?.injuries);
  const rows = new Map<PlayerId, PlayerWeek[]>();
  for (const r of [...db.rows].sort((a, b) => a.week - b.week)) { const l = rows.get(r.id) ?? []; l.push(r); rows.set(r.id, l); }
  const rz = rzAverages(charts);
  const out: PlayerStat[] = [];
  for (const [id, all] of rows) {
    const p = db.players[id];
    const played = all.filter((r) => r.gp);
    if (!p || !played.length) continue;
    const st = states.get(id)!;
    const healthy = played.filter((r) => st.get(r.week) === 'healthy');
    const c = p.gsisId ? charts?.players[p.gsisId] : undefined;
    const att = sum(played, 'pa_att'), sacks = sum(played, 'pa_sack'), dropbacks = att + sacks;
    const car = sum(played, 'ru_att'), tgt = sum(played, 're_tgt'), yds = sum(played, 're_yds');
    const real = played.some((r) => r.routes != null);
    const routes = real ? sum(played, 'routes') : sum(played, 'routesEst');
    const q = c?.plays?.qtr, ru = c?.plays?.rush;
    const rzX = c?.plays?.rz ? RZ_KEYS.reduce((s, k) => s + (c.plays!.rz![k]?.[0] ?? 0) * (rz[k] ?? 0), 0) : null;
    const rzA = c?.plays?.rz ? RZ_KEYS.reduce((s, k) => s + (c.plays!.rz![k]?.[1] ?? 0), 0) : null;
    const sp = c?.splits, split = (k: 'clean' | 'pressured' | 'man' | 'zone') => sp?.[k];
    const man = total(c?.routes?.man), zone = total(c?.routes?.zone);
    const hasRoutes = !!c?.routes;
    out.push({
      id, name: p.name, pos: p.pos, team: played[played.length - 1].team, games: played.length, healthy: healthy.length,
      ppg: ratio(sum(healthy, 'pts'), healthy.length), xppg: ratio(sum(healthy, 'xfp'), healthy.length),
      att, dropbacks,
      anya: ratio(sum(played, 'pa_yds') + 20 * sum(played, 'pa_td') - 45 * sum(played, 'pa_int') - sum(played, 'pa_sackYds'), dropbacks),
      cpoe: mean(played, 'pa_cpoe'), aggr: mean(played, 'pa_aggr'), epaDb: ratio(sum(played, 'pa_epa'), dropbacks),
      epa13: q ? ratio(q[1], q[0]) : null, epa4: q ? ratio(q[3], q[2]) : null, db4: q?.[2] ?? 0,
      car, snapPct: ratio(sum(played, 'snaps'), sum(played, 'teamSnaps')),
      wopg: ratio(sum(healthy, 'ru_att') + 1.5 * sum(healthy, 're_tgt'), healthy.length),
      ypc: ratio(sum(played, 'ru_yds'), car), ypt: ratio(yds, tgt), ryoe: ratio(sum(played, 'ru_ryoe'), car),
      succ: ru ? ratio(ru[1], ru[0]) : null, expl: ru ? ratio(ru[2], ru[0]) : null,
      // red zone counts are season totals, so per game uses games played
      rzX: rzX === null ? null : ratio(rzX, played.length), rzA: rzA === null ? null : ratio(rzA, played.length),
      tgt, routes, routesEst: !real, yds, yprr: ratio(yds, routes), tprr: ratio(tgt, routes), fdrr: ratio(sum(played, 're_fd'), routes),
      adot: ratio(sum(played, 're_air'), tgt), sep: mean(played, 're_sep'), catchPct: ratio(sum(played, 're_rec'), tgt), tgtShare: mean(played, 're_tgtShare'),
      clean: split('clean') ? ratio(split('clean')![4], split('clean')![0]) : null, cleanDb: split('clean')?.[0] ?? 0,
      press: split('pressured') ? ratio(split('pressured')![4], split('pressured')![0]) : null, pressDb: split('pressured')?.[0] ?? 0,
      manEpa: split('man') ? ratio(split('man')![4], split('man')![0]) : null, manDb: split('man')?.[0] ?? 0,
      zoneEpa: split('zone') ? ratio(split('zone')![4], split('zone')![0]) : null, zoneDb: split('zone')?.[0] ?? 0,
      manYpt: hasRoutes ? ratio(man[1], man[0]) : null, zoneYpt: hasRoutes ? ratio(zone[1], zone[0]) : null, manTgt: man[0], zoneTgt: zone[0],
    });
  }
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players/season.test.ts`
Expected: PASS, 8 tests.

The QB fixture arithmetic, over 5 weeks:

| Stat | Calculation | Value |
|---|---|---|
| Attempts | 30 × 5 | 150 |
| Sacks | 2 × 5 | 10 |
| Dropbacks | 150 + 10 | 160 |
| Passing yards | 250 × 5 | 1250 |
| TDs, INTs | 2 × 5, 1 × 5 | 10, 5 |
| Sack yards | 14 × 5 | 70 |
| EPA | 4 × 5 | 20 |
| EPA Q1–3 | qtr [100, 10, …] | 0.1 |
| EPA Q4 | qtr [40, 8] | 0.2 |

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/stats/players/season.ts packages/web/src/lib/stats/players/season.test.ts
git commit -m "Stats players: season stats with healthy-game per-game averages"
```

---

### Task 5: Web: views, pools and quadrant geometry

**Files:**
- Create:
  - `packages/web/src/lib/stats/players/views.ts`
  - `packages/web/src/lib/stats/players/quadrant.ts`
- Test:
  - `packages/web/src/lib/stats/players/views.test.ts`
  - `packages/web/src/lib/stats/players/quadrant.test.ts`

**Interfaces:**
- Consumes: `PlayerStat` and `Pos` (Task 4).
- Produces:
  - `type Fmt = (v: number) => string`
  - `View`:
    - `id: string`
    - `pos: Pos[]`
    - `label: string`
    - `question: string`
    - `x: keyof PlayerStat`
    - `y: keyof PlayerStat`
    - `xLabel: string`
    - `yLabel: string`
    - `fx: Fmt`
    - `fy: Fmt`
    - `min: (p: PlayerStat) => boolean`
    - `diagonal?: boolean`
    - `participation?: boolean`
    - `quads: [string, string, string, string]`
  - `VIEWS: View[]`
  - `viewsFor(pos: Pos): View[]`
  - `volume(p: PlayerStat): number`
  - `viewPool(view: View, stats: PlayerStat[], pos: Pos): PlayerStat[]`
  - From `quadrant.ts`:
    - `fitLine(xs: number[], ys: number[]): { a: number; b: number } | null`
    - `extent(vals: number[], pad?: number): [number, number]`
    - `placeLabels(items: { x: number; y: number; text: string }[], charW?: number, lineH?: number): { x: number; y: number; text: string }[]`
    - `shortName(name: string): string`

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/lib/stats/players/quadrant.test.ts`:

```ts
import { extent, fitLine, placeLabels, shortName } from './quadrant';

describe('quadrant helpers', () => {
  it('fits y = a + b x', () => {
    const f = fitLine([1, 2, 3], [3, 5, 7])!;
    expect(f.a).toBeCloseTo(1);
    expect(f.b).toBeCloseTo(2);
    expect(fitLine([1, 1], [2, 3])).toBeNull();
  });
  it('pads the extent', () => {
    expect(extent([0, 10], 0.1)).toEqual([-1, 11]);
    expect(extent([5, 5], 0.1)).toEqual([4.9, 5.1]);
  });
  it('shortens names to an initial', () => {
    expect(shortName('Jahmyr Gibbs')).toBe('J. Gibbs');
    expect(shortName("Ja'Marr Chase")).toBe('J. Chase');
    expect(shortName('Amon-Ra St. Brown')).toBe('A. St. Brown');
    expect(shortName('Cher')).toBe('Cher');
  });
  it('placeLabels never overlaps on a crowded set, and stops after a bounded number of nudges', () => {
    const pile = Array.from({ length: 30 }, (_, i) => ({ x: 100 + (i % 3), y: 100, text: `Player ${i}` }));
    const placed = placeLabels(pile, 6.4, 12);
    const boxes = placed.map((p) => ({ x0: p.x, x1: p.x + p.text.length * 6.4, y: p.y }));
    const overlaps = boxes.filter((a, i) => boxes.some((b, j) => j !== i && Math.abs(a.y - b.y) < 12 && a.x0 < b.x1 && b.x0 < a.x1)).length;
    // after the bounded nudge some may still collide; never more than the ones that ran out of room
    expect(placed.every((p) => p.y <= 100 + 12 * 8)).toBe(true);
    expect(overlaps).toBeLessThan(30);
    const spread = placeLabels([{ x: 0, y: 0, text: 'Aaaa' }, { x: 0, y: 0, text: 'Bbbb' }], 6.4, 12);
    expect(spread[1].y - spread[0].y).toBe(12);
  });
});
```

Create `packages/web/src/lib/stats/players/views.test.ts`:

```ts
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from './season';
import { VIEWS, viewPool, viewsFor, volume } from './views';

describe('views', () => {
  it('each position has its views, ids unique within a position', () => {
    expect(viewsFor('QB').map((v) => v.id)).toEqual(['anya', 'aggr', 'clutch', 'press', 'cov']);
    expect(viewsFor('RB').map((v) => v.id)).toEqual(['xfp', 'rz', 'boom', 'ryoe', 'opp', 'ypc']);
    expect(viewsFor('WR').map((v) => v.id)).toEqual(['xfp', 'role', 'yprr', 'sep', 'fd', 'cov']);
    expect(viewsFor('TE').map((v) => v.id)).toEqual(viewsFor('WR').map((v) => v.id));
    for (const v of VIEWS) expect(v.quads).toHaveLength(4);
  });
  it('volume: dropbacks, carries + targets, targets', () => {
    const s = seasonStats(statsDb(), statsCharts());
    expect(volume(s.find((p) => p.id === 'qA')!)).toBe(160);
    expect(volume(s.find((p) => p.id === 'rUp')!)).toBe(54 + 12);
    expect(volume(s.find((p) => p.id === 'wA')!)).toBe(42);
  });
  it('the pool applies the minimum, drops nulls, and keeps the 40 with most volume', () => {
    const s = seasonStats(statsDb(), statsCharts());
    const boom = VIEWS.find((v) => v.id === 'boom' && v.pos.includes('RB'))!;
    expect(viewPool(boom, s, 'RB').map((p) => p.id)).toEqual(['rDown', 'rUp']);   // only they have play-by-play rushing
    const many = Array.from({ length: 60 }, (_, i) => ({ ...s.find((p) => p.id === 'rUp')!, id: `x${i}`, car: 100 + i }));
    const pool = viewPool(VIEWS.find((v) => v.id === 'xfp' && v.pos.includes('RB'))!, many, 'RB');
    expect(pool).toHaveLength(40);
    expect(pool[0].id).toBe('x59');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players/quadrant.test.ts src/lib/stats/players/views.test.ts`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement `quadrant.ts`**

```ts
/** Least-squares y = a + b·x; null when x has no spread. */
export function fitLine(xs: number[], ys: number[]): { a: number; b: number } | null {
  const n = xs.length; if (n < 2) return null;
  const sx = xs.reduce((s, v) => s + v, 0), sy = ys.reduce((s, v) => s + v, 0);
  const sxx = xs.reduce((s, v) => s + v * v, 0), sxy = xs.reduce((s, v, i) => s + v * ys[i], 0);
  const d = n * sxx - sx * sx; if (Math.abs(d) < 1e-12) return null;
  const b = (n * sxy - sx * sy) / d;
  return { a: (sy - b * sx) / n, b };
}

/** min and max padded by a share of the range (or of the value when there is no range). */
export function extent(vals: number[], pad = 0.08): [number, number] {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || Math.abs(hi) * 0.2 || 1;
  return [+(lo - span * pad).toFixed(6), +(hi + span * pad).toFixed(6)];
}

/** "Jahmyr Gibbs" → "J. Gibbs"; one-word names stay whole. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
}

/** Labels to the right of their point, nudged down a line at a time (at most 8) until they clear those already placed. */
export function placeLabels(items: { x: number; y: number; text: string }[], charW = 6.4, lineH = 12): { x: number; y: number; text: string }[] {
  const placed: { x: number; y: number; w: number; text: string }[] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const w = it.text.length * charW;
    let y = it.y;
    for (let k = 0; k < 8 && placed.some((o) => Math.abs(o.y - y) < lineH && it.x < o.x + o.w && o.x < it.x + w); k++) y += lineH;
    placed.push({ x: it.x, y, w, text: it.text });
  }
  return placed.map(({ x, y, text }) => ({ x, y, text }));
}
```

The extent test expects `extent([5, 5], 0.1)` to equal `[4.9, 5.1]`: the span is 5 × 0.2 = 1, so the padding is 0.1.

- [ ] **Step 4: Implement `views.ts`**

```ts
import type { PlayerStat, Pos } from './season';

export type Fmt = (v: number) => string;
export interface View {
  id: string; pos: Pos[]; label: string; question: string;
  x: keyof PlayerStat; y: keyof PlayerStat; xLabel: string; yLabel: string; fx: Fmt; fy: Fmt;
  min: (p: PlayerStat) => boolean; diagonal?: boolean; participation?: boolean;
  /** top-right, top-left, bottom-right, bottom-left */
  quads: [string, string, string, string];
}

const pct: Fmt = (v) => `${Math.round(v * 100)}%`;
const f1: Fmt = (v) => v.toFixed(1);
const f2: Fmt = (v) => v.toFixed(2);
const signed: Fmt = (v) => { const r = Number(v.toFixed(2)); return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(2)}`; };
const signed1: Fmt = (v) => { const r = Number(v.toFixed(1)); return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(1)}`; };
const te = (p: PlayerStat, wr: number, tight: number) => (p.pos === 'TE' ? tight : wr);
const REC: Pos[] = ['WR', 'TE'];

export const VIEWS: View[] = [
  { id: 'anya', pos: ['QB'], label: 'ANY/A vs CPOE', question: 'Who is accurate, and who actually produces?', x: 'cpoe', y: 'anya', xLabel: 'Completion % over expected', yLabel: 'Adjusted net yards per attempt', fx: signed1, fy: f2, min: (p) => p.att >= 80, quads: ['Elite', 'Big plays, loose accuracy', 'Accurate, little output', 'Struggling'] },
  { id: 'aggr', pos: ['QB'], label: 'Tight windows vs EPA', question: 'Who threads tight windows, and does it pay off?', x: 'aggr', y: 'epaDb', xLabel: 'Throws into tight windows (%)', yLabel: 'EPA per dropback', fx: (v) => `${v.toFixed(1)}%`, fy: signed, min: (p) => p.att >= 80, quads: ['Gunslinger who wins', 'Efficient, plays it safe', 'Forcing it', 'Struggling'] },
  { id: 'clutch', pos: ['QB'], label: 'Closers: Q1–3 vs Q4', question: 'Who gets better when the game is on the line?', x: 'epa13', y: 'epa4', xLabel: 'EPA per dropback, quarters 1–3', yLabel: 'EPA per dropback, 4th quarter and overtime', fx: signed, fy: signed, diagonal: true, min: (p) => p.att >= 80 && p.db4 >= 15, quads: ['Good all game', 'Closer', 'Fades late', 'Struggling'] },
  { id: 'press', pos: ['QB'], label: 'Clean vs pressured', question: 'Who holds up when the pocket breaks down?', x: 'clean', y: 'press', xLabel: 'EPA per dropback, clean pocket', yLabel: 'EPA per dropback, under pressure', fx: signed, fy: signed, participation: true, min: (p) => p.cleanDb >= 40 && p.pressDb >= 40, quads: ['Unflappable', 'Thrives in chaos', 'Needs a clean pocket', 'Struggling'] },
  { id: 'cov', pos: ['QB'], label: 'vs Zone vs vs Man', question: 'Who solves man coverage, and who only beats zone?', x: 'zoneEpa', y: 'manEpa', xLabel: 'EPA per dropback vs zone', yLabel: 'EPA per dropback vs man', fx: signed, fy: signed, diagonal: true, participation: true, min: (p) => p.manDb >= 40 && p.zoneDb >= 40, quads: ['Beats everything', 'Man beater', 'Zone beater', 'Struggling'] },
  { id: 'xfp', pos: ['RB'], label: 'Expected vs actual', question: 'Who scored more, or less, than his opportunities were worth?', x: 'xppg', y: 'ppg', xLabel: 'Expected fantasy points per game (xFP/G)', yLabel: 'Actual fantasy points per game', fx: f1, fy: f1, diagonal: true, min: (p) => p.car >= 20, quads: ['Producing', 'Overachiever', 'Underachiever', 'Low volume'] },
  { id: 'rz', pos: ['RB'], label: 'Red zone expected vs actual', question: 'Who cashes in his red-zone chances?', x: 'rzX', y: 'rzA', xLabel: 'Red-zone expected fantasy points per game', yLabel: 'Red-zone actual fantasy points per game', fx: f1, fy: f1, diagonal: true, min: (p) => (p.rzX ?? 0) >= 1.5, quads: ['Goal-line hammer', 'Finds the end zone', 'Wasting chances', 'Limited role'] },
  { id: 'boom', pos: ['RB'], label: 'Success % vs explosive %', question: 'Who keeps the offence on schedule, and who breaks the big one?', x: 'succ', y: 'expl', xLabel: 'Rushing success rate (yards-to-go rule)', yLabel: 'Explosive runs (10+ yards)', fx: pct, fy: pct, min: (p) => p.car >= 20, quads: ['Elite', 'Boom or bust', 'Chain mover', 'Struggling'] },
  { id: 'ryoe', pos: ['RB'], label: 'Success % vs RYOE', question: 'Is his success the blocking, or him?', x: 'succ', y: 'ryoe', xLabel: 'Rushing success rate', yLabel: 'Rushing yards over expected per carry', fx: pct, fy: signed, min: (p) => p.car >= 20, quads: ['Creates and converts', 'Creates, inconsistent', 'System back', 'Struggling'] },
  { id: 'opp', pos: ['RB'], label: 'Snap share vs workload', question: 'Who is on the field, and who is actually fed the ball?', x: 'snapPct', y: 'wopg', xLabel: 'Snap share', yLabel: 'Weighted opportunities per game (carries + 1.5 × targets)', fx: pct, fy: f1, min: (p) => p.car >= 20, quads: ['Workhorse', 'Fed in a small role', 'On the field, not fed', 'Committee'] },
  { id: 'ypc', pos: ['RB'], label: 'Yards per carry vs per target', question: 'Who is efficient as a runner, a receiver, or both?', x: 'ypc', y: 'ypt', xLabel: 'Yards per carry', yLabel: 'Yards per target', fx: f1, fy: f1, min: (p) => p.car >= 30 && p.tgt >= 8, quads: ['Dual threat', 'Receiving back', 'Runner', 'Struggling'] },
  { id: 'xfp', pos: REC, label: 'Expected vs actual', question: 'Who scored more, or less, than his opportunities were worth?', x: 'xppg', y: 'ppg', xLabel: 'Expected fantasy points per game', yLabel: 'Actual fantasy points per game', fx: f1, fy: f1, diagonal: true, min: (p) => p.tgt >= te(p, 15, 12), quads: ['Producing', 'Overachiever', 'Underachiever', 'Low volume'] },
  { id: 'role', pos: REC, label: 'Role map', question: 'What kind of receiver is each one?', x: 'adot', y: 'tgtShare', xLabel: 'Average depth of target (yards)', yLabel: 'Share of team targets', fx: f1, fy: pct, min: (p) => p.tgt >= te(p, 15, 12), quads: ['Alpha deep threat', 'Volume underneath', 'Field stretcher', 'Gadget / checkdown'] },
  { id: 'yprr', pos: REC, label: 'YPRR vs target rate', question: 'Who earns targets, and who does the most with each route?', x: 'tprr', y: 'yprr', xLabel: 'Targets per route run', yLabel: 'Yards per route run', fx: pct, fy: f2, min: (p) => p.routes >= te(p, 60, 40), quads: ['Alpha', 'Efficient, under-fed', 'Volume, not efficient', 'Struggling'] },
  { id: 'sep', pos: REC, label: 'Separation vs catch rate', question: 'Who gets open, and who catches it anyway?', x: 'sep', y: 'catchPct', xLabel: 'Average separation at the catch point (yards)', yLabel: 'Catch rate', fx: f1, fy: pct, min: (p) => p.tgt >= te(p, 15, 12), quads: ['Open and reliable', 'Contested-catch winner', 'Open, leaves plays out there', 'Struggling'] },
  { id: 'fd', pos: REC, label: 'First downs/route vs aDOT', question: 'Who moves the chains, at what depth?', x: 'adot', y: 'fdrr', xLabel: 'Average depth of target', yLabel: 'First downs per route run', fx: f1, fy: pct, min: (p) => p.routes >= te(p, 60, 40), quads: ['Downfield chain mover', 'Underneath chain mover', 'Field stretcher', 'Struggling'] },
  { id: 'cov', pos: REC, label: 'vs Zone vs vs Man', question: 'Who beats man coverage, and who feasts on zone?', x: 'zoneYpt', y: 'manYpt', xLabel: 'Yards per target vs zone', yLabel: 'Yards per target vs man', fx: f1, fy: f1, diagonal: true, participation: true, min: (p) => p.manTgt >= 20 && p.zoneTgt >= 30, quads: ['Beats everything', 'Man beater', 'Zone beater', 'Struggling'] },
];

export const viewsFor = (pos: Pos): View[] => VIEWS.filter((v) => v.pos.includes(pos));
export const volume = (p: PlayerStat): number => (p.pos === 'QB' ? p.dropbacks : p.pos === 'RB' ? p.car + p.tgt : p.tgt);

/** The view's players: right position, over the minimum, both values present, the 40 with the most volume. */
export function viewPool(view: View, stats: PlayerStat[], pos: Pos): PlayerStat[] {
  const ok = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return stats.filter((p) => p.pos === pos && view.min(p) && ok(p[view.x]) && ok(p[view.y])).sort((a, b) => volume(b) - volume(a)).slice(0, 40);
}
```

In the views test, `rUp` has 66 carries + targets (5+5+6+18+20 = 54 carries and 1+1+1+4+5 = 12 targets), and `wA` has 42 targets. `rDown`'s volume is 68 + 14 = 82, more than `rUp`'s 66, so in the `boom` pool `rDown` comes before `rUp`.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players/quadrant.test.ts src/lib/stats/players/views.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/stats/players/views.ts packages/web/src/lib/stats/players/quadrant.ts packages/web/src/lib/stats/players/views.test.ts packages/web/src/lib/stats/players/quadrant.test.ts
git commit -m "Stats players: the 17 quadrant views, pools and chart geometry"
```

---

### Task 6: Web: volume trends

**Files:**
- Create: `packages/web/src/lib/stats/players/trends.ts`
- Test: `packages/web/src/lib/stats/players/trends.test.ts`

**Interfaces:**
- Consumes: `gameStates`, `currentInjury` and `GameState` (Task 3).
- Produces:
  - `type TrendPos = 'RB' | 'WR' | 'TE'`
  - `TrendCell`:
    - `weeks: { week: number; state: GameState; value: number | null }[]`
    - `change: number | null`
  - `TrendRow`:
    - `id: PlayerId`
    - `name: string`
    - `team: string`
    - `cells: Record<string, TrendCell>`
    - `score: number`
  - `Trends`:
    - `weeks: number[]`
    - `columns: { key: string; label: string }[]`
    - `up: TrendRow[]`
    - `down: TrendRow[]`
    - `injured: { id: PlayerId; name: string; team: string; status: string; injury: string }[]`
  - `trends(db: PlayerDb, charts: ChartDb | undefined, pos: TrendPos): Trends`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/lib/stats/players/trends.test.ts`:

```ts
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { trends } from './trends';

describe('trends', () => {
  const t = trends(statsDb(), statsCharts(), 'RB');
  const row = (id: string) => [...t.up, ...t.down].find((r) => r.id === id);
  it('windows the last five scored weeks with the RB columns', () => {
    expect(t.weeks).toEqual([1, 2, 3, 4, 5]);
    expect(t.columns.map((c) => c.key)).toEqual(['snap', 'rush', 'tgt', 'xfp', 'opp']);
  });
  it('a growing role trends up, a shrinking one down', () => {
    expect(t.up[0].id).toBe('rUp');
    expect(t.down[0].id).toBe('rDown');
    expect(row('rUp')!.cells.snap.change).toBeCloseTo((80 + 85) / 2 - 30);
  });
  it('injury-shortened and missed games do not count toward the change', () => {
    // rHurt: healthy weeks 1 and 5 only; one early healthy game is not enough to be ranked
    expect(row('rHurt')).toBeUndefined();
  });
  it('a currently Out player leaves both lists for the Injured line', () => {
    expect(row('rOut')).toBeUndefined();
    expect(t.injured).toEqual([{ id: 'rOut', name: 'Out Back', team: 'BBB', status: 'Out', injury: 'Groin' }]);
  });
  it('a bye shows as a bye cell', () => {
    const r = row('rLast');
    if (r) expect(r.cells.snap.weeks[2]).toEqual({ week: 3, state: 'bye', value: null });
  });
  it('WR columns', () => {
    expect(trends(statsDb(), statsCharts(), 'WR').columns.map((c) => c.key)).toEqual(['snap', 'route', 'tgt', 'ay', 'xfp']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players/trends.test.ts`
Expected: FAIL, because `./trends` can't be resolved.

- [ ] **Step 3: Implement**

Create `packages/web/src/lib/stats/players/trends.ts`:

```ts
import type { ChartDb, PlayerDb, PlayerId, PlayerWeek, TeamWeek } from '@fantasy-dash/core';
import { currentInjury, gameStates, type GameState } from './health';

export type TrendPos = 'RB' | 'WR' | 'TE';
export interface TrendCell { weeks: { week: number; state: GameState; value: number | null }[]; change: number | null }
export interface TrendRow { id: PlayerId; name: string; team: string; cells: Record<string, TrendCell>; score: number }
export interface Trends {
  weeks: number[]; columns: { key: string; label: string }[]; up: TrendRow[]; down: TrendRow[];
  injured: { id: PlayerId; name: string; team: string; status: string; injury: string }[];
}

type Metric = { key: string; label: string; value: (r: PlayerWeek, t: TeamWeek, teamXfp: number) => number | null };
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
const RB_COLS: Metric[] = [
  { key: 'snap', label: 'Snap %', value: (r) => pct(r.snaps ?? 0, r.teamSnaps ?? 0) },
  { key: 'rush', label: 'Rush share', value: (r, t) => pct(r.ru_att ?? 0, t.rushAtt) },
  { key: 'tgt', label: 'Target share', value: (r, t) => pct(r.re_tgt ?? 0, t.passAtt) },
  { key: 'xfp', label: 'xFP share', value: (r, _t, x) => pct(r.xfp ?? 0, x) },
  { key: 'opp', label: 'Opportunities', value: (r) => (r.ru_att ?? 0) + (r.re_tgt ?? 0) },
];
const REC_COLS: Metric[] = [
  { key: 'snap', label: 'Snap %', value: (r) => pct(r.snaps ?? 0, r.teamSnaps ?? 0) },
  { key: 'route', label: 'Route share', value: (r, t) => pct(r.routes ?? r.routesEst ?? 0, t.dropbacks) },
  { key: 'tgt', label: 'Target share', value: (r, t) => pct(r.re_tgt ?? 0, t.passAtt) },
  { key: 'ay', label: 'Air yards share', value: (r) => (r.re_ayShare == null ? null : Math.round(r.re_ayShare * 100)) },
  { key: 'xfp', label: 'xFP share', value: (r, _t, x) => pct(r.xfp ?? 0, x) },
];
const MIN_VOLUME: Record<TrendPos, number> = { RB: 25, WR: 15, TE: 10 };
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Last two weeks against the weeks before, healthy games only, for the season's last five scored weeks. */
export function trends(db: PlayerDb, charts: ChartDb | undefined, pos: TrendPos): Trends {
  const cols = pos === 'RB' ? RB_COLS : REC_COLS;
  const last = db.throughWeek, weeks = Array.from({ length: Math.min(5, last) }, (_, i) => last - Math.min(5, last) + 1 + i);
  const lateWeeks = new Set(weeks.slice(-2));
  const states = gameStates(db, charts?.injuries);
  const tw = new Map(db.teamWeeks.map((t) => [`${t.team}|${t.week}`, t] as const));
  const teamXfp = new Map<string, number>();
  for (const r of db.rows) if (r.gp && r.xfp) teamXfp.set(`${r.team}|${r.week}`, (teamXfp.get(`${r.team}|${r.week}`) ?? 0) + r.xfp);
  const byId = new Map<PlayerId, Map<number, PlayerWeek>>();
  for (const r of db.rows) { let m = byId.get(r.id); if (!m) byId.set(r.id, (m = new Map())); m.set(r.week, r); }

  const rows: TrendRow[] = [];
  const injured: Trends['injured'] = [];
  for (const [id, byWeek] of byId) {
    const p = db.players[id];
    if (!p || p.pos !== pos) continue;
    const st = states.get(id)!;
    const inWindow = weeks.map((w) => byWeek.get(w)).filter((r): r is PlayerWeek => !!r && !!r.gp);
    const vol = inWindow.reduce((s, r) => s + (pos === 'RB' ? (r.ru_att ?? 0) + (r.re_tgt ?? 0) : r.re_tgt ?? 0), 0);
    if (vol < MIN_VOLUME[pos]) continue;
    const team = inWindow[inWindow.length - 1]?.team ?? p.teams[p.teams.length - 1];
    const inj = currentInjury(p.gsisId, charts?.injuries);
    if (inj) { injured.push({ id, name: p.name, team, ...inj }); continue; }
    const healthyLate = weeks.filter((w) => lateWeeks.has(w) && st.get(w) === 'healthy');
    const healthyEarly = weeks.filter((w) => !lateWeeks.has(w) && st.get(w) === 'healthy');
    if (healthyLate.length < 1 || healthyEarly.length < 2) continue;
    const cells: Record<string, TrendCell> = {};
    for (const c of cols) {
      const cellWeeks = weeks.map((w) => {
        const r = byWeek.get(w), t = r ? tw.get(`${r.team}|${w}`) : undefined, state = st.get(w) ?? 'missed';
        return { week: w, state, value: r && r.gp && t ? c.value(r, t, teamXfp.get(`${r.team}|${w}`) ?? 0) : null };
      });
      const val = (ws: number[]) => ws.map((w) => cellWeeks.find((x) => x.week === w)!.value).filter((v): v is number => v != null);
      const late = val(healthyLate), early = val(healthyEarly);
      cells[c.key] = { weeks: cellWeeks, change: late.length && early.length ? avg(late) - avg(early) : null };
    }
    rows.push({ id, name: p.name, team, cells, score: 0 });
  }
  // each change in standard deviations of that column's changes, averaged
  for (const c of cols) {
    const ch = rows.map((r) => r.cells[c.key].change).filter((v): v is number => v != null);
    const mu = ch.length ? avg(ch) : 0, sd = ch.length ? Math.sqrt(avg(ch.map((v) => (v - mu) ** 2))) : 0;
    for (const r of rows) { const v = r.cells[c.key].change; (r as TrendRow & { z?: number[] }).z = [...((r as TrendRow & { z?: number[] }).z ?? []), ...(v != null && sd > 0 ? [v / sd] : [])]; }
  }
  for (const r of rows) { const z = (r as TrendRow & { z?: number[] }).z ?? []; r.score = z.length ? Math.round(avg(z) * 100) / 100 : 0; delete (r as TrendRow & { z?: number[] }).z; }
  rows.sort((a, b) => b.score - a.score);
  return {
    weeks, columns: cols.map(({ key, label }) => ({ key, label })),
    up: rows.slice(0, Math.min(10, rows.length)),
    down: rows.slice(Math.max(Math.min(10, rows.length), rows.length - 6)).reverse(),
    injured,
  };
}
```

The `down` list takes the lowest 6 and never repeats a player who is in `up`. With only a few rows, `down` can be shorter than 6 or empty.

The test's first `down` expectation holds because the fixture has only `rUp`, `rDown` and possibly `rLast` ranked:
- **If `rLast` is ranked** (early 85, 80; late 80): `up` holds all three (at most 10 rows), and `down` is empty, which breaks the test.

So that the test checks the real rule, the fixture needs more RBs. Add these to `LINES` in `statsPlayersFixtures.ts` before writing the test:

```ts
  rF1: { pos: 'RB', team: 'AAA', name: 'Filler One', share: [0.5, 0.5, 0.5, 0.5, 0.5], car: [8, 8, 8, 8, 8], tgt: [2, 2, 2, 2, 2] },
  rF2: { pos: 'RB', team: 'BBB', name: 'Filler Two', share: [0.5, 0.5, 0.5, 0.5, 0.5], car: [8, 8, 8, 8, 8], tgt: [2, 2, 2, 2, 2] },
  rF3: { pos: 'RB', team: 'CCC', name: 'Filler Three', share: [0.5, 0.5, null, 0.5, 0.5], car: [8, 8, 0, 8, 8], tgt: [2, 2, 0, 2, 2] },
  rF4: { pos: 'RB', team: 'AAA', name: 'Filler Four', share: [0.4, 0.4, 0.4, 0.42, 0.42], car: [7, 7, 7, 7, 7], tgt: [2, 2, 2, 2, 2] },
  rF5: { pos: 'RB', team: 'BBB', name: 'Filler Five', share: [0.45, 0.45, 0.45, 0.44, 0.44], car: [7, 7, 7, 7, 7], tgt: [2, 2, 2, 2, 2] },
  rF6: { pos: 'RB', team: 'AAA', name: 'Filler Six', share: [0.5, 0.5, 0.5, 0.49, 0.49], car: [7, 7, 7, 7, 7], tgt: [1, 1, 1, 1, 1] },
  rF7: { pos: 'RB', team: 'BBB', name: 'Filler Seven', share: [0.5, 0.5, 0.5, 0.48, 0.48], car: [7, 7, 7, 7, 7], tgt: [1, 1, 1, 1, 1] },
  rF8: { pos: 'RB', team: 'AAA', name: 'Filler Eight', share: [0.5, 0.5, 0.5, 0.47, 0.47], car: [7, 7, 7, 7, 7], tgt: [1, 1, 1, 1, 1] },
```

That gives at least 10 ranked RBs (rUp, rDown, rLast and 8 fillers), so `rDown` (the steepest drop) is the last row and the first entry of `down`.

Then re-run the Task 3–5 tests. They must still pass:
- The fillers add volume but don't change any existing expectation.
- The views test's `boom` pool is unaffected, because fillers have no play-by-play rushing.
- `rF3` has CCC's bye in week 3.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/stats/players`
Expected: PASS, all files (health, season, views, quadrant, trends).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/stats/players/trends.ts packages/web/src/lib/stats/players/trends.test.ts packages/web/src/test/statsPlayersFixtures.ts
git commit -m "Stats players: injury-aware volume trends"
```

---

### Task 7: Web: team logos and the quadrant chart

**Files:**
- Create:
  - `packages/web/src/components/stats/players/TeamLogo.tsx`
  - `packages/web/src/components/stats/players/QuadrantChart.tsx`
- Test: `packages/web/src/components/stats/players/QuadrantChart.test.tsx`

**Interfaces:**
- Consumes: `View`, `viewPool`, `fitLine`, `extent`, `placeLabels`, `shortName` (Task 5) and `PlayerStat` (Task 4).
- Produces:
  - `TeamLogo({ team, x, y, size })`: an SVG `<image>`, or a fallback circle with the team code
  - `QuadrantChart({ view, pool, note })`: a `<section aria-labelledby>` whose region name is the view label. `note` is shown instead of the chart when set.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/stats/players/QuadrantChart.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from '../../../lib/stats/players/season';
import { VIEWS, viewPool } from '../../../lib/stats/players/views';
import QuadrantChart from './QuadrantChart';

const stats = seasonStats(statsDb(), statsCharts());
const view = VIEWS.find((v) => v.id === 'xfp' && v.pos.includes('RB'))!;
const mount = (note?: string) => render(<MemoryRouter><QuadrantChart view={view} pool={viewPool(view, stats, 'RB')} note={note} /></MemoryRouter>);

describe('QuadrantChart', () => {
  it('draws a logo per player with a short-name label, the four quadrant names and the question', () => {
    mount();
    const card = screen.getByRole('region', { name: /Expected vs actual/ });
    expect(card.querySelectorAll('[data-player]').length).toBe(viewPool(view, stats, 'RB').length);
    expect(within(card).getByText('R. Back')).toBeInTheDocument();
    for (const q of view.quads) expect(within(card).getByText(q.toUpperCase())).toBeInTheDocument();
    expect(within(card).getByText(view.question)).toBeInTheDocument();
  });
  it('a logo that fails to load becomes a circle with the team code', () => {
    mount();
    const card = screen.getByRole('region', { name: /Expected vs actual/ });
    expect(card.querySelectorAll('circle')).toHaveLength(0);
    fireEvent.error(card.querySelector('image')!);
    expect(card.querySelectorAll('circle')).toHaveLength(1);
  });
  it('hovering a logo shows his name and both values', () => {
    mount();
    const card = screen.getByRole('region', { name: /Expected vs actual/ });
    fireEvent.pointerEnter(card.querySelector('[data-player="rUp"]')!, { pointerType: 'mouse' });
    expect(within(card).getByRole('tooltip')).toHaveTextContent('Rising Back');
    expect(within(card).getByRole('tooltip')).toHaveTextContent('Actual fantasy points per game');
  });
  it('the Table toggle lists the same players with both values', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.length).toBe(viewPool(view, stats, 'RB').length + 1);
  });
  it('shows the note instead of the chart', () => {
    mount('Coverage data arrives after the season ends.');
    expect(screen.getByText('Coverage data arrives after the season ends.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Expected vs actual/ }).querySelector('[data-player]')).toBeNull();
  });
});
```

`R. Back` is `shortName('Rising Back')`. Several fixture backs share the surname, so `getAllByText` would also work; if this throws on multiple matches, switch the first assertion to `getAllByText('R. Back').length > 0`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/stats/players/QuadrantChart.test.tsx`
Expected: FAIL, because the module can't be resolved.

- [ ] **Step 3: Implement `TeamLogo.tsx`**

```tsx
import { useState } from 'react';

export const logoUrl = (team: string) => `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;

/** A team logo centred on (x, y); a circle with the team code when there is no team or the image fails. */
export default function TeamLogo({ team, x, y, size = 26 }: { team: string; x: number; y: number; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!team || failed) {
    return (
      <g>
        <circle cx={x} cy={y} r={size / 2 - 1} style={{ fill: 'var(--surface-2)', stroke: 'var(--line)' }} />
        <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={700} style={{ fill: 'var(--muted)' }}>{team || 'FA'}</text>
      </g>
    );
  }
  return <image href={logoUrl(team)} x={x - size / 2} y={y - size / 2} width={size} height={size} onError={() => setFailed(true)} />;
}
```

- [ ] **Step 4: Implement `QuadrantChart.tsx`**

```tsx
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PlayerStat } from '../../../lib/stats/players/season';
import { extent, fitLine, placeLabels, shortName } from '../../../lib/stats/players/quadrant';
import type { View } from '../../../lib/stats/players/views';
import { PlayerLink } from '../../NameLink';
import TeamLogo from './TeamLogo';

const W = 1180, H = 620, M = { l: 62, r: 24, t: 20, b: 52 };
const TINT = ['var(--win)', 'var(--accent)', 'var(--warn)', 'var(--loss)'];
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
function ticks(lo: number, hi: number, n = 6): number[] {
  const st = 10 ** Math.floor(Math.log10((hi - lo) / n || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * st).find((s) => (hi - lo) / s <= n) ?? st * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/** One stat pairing as a quadrant chart of team logos: league-average lines, named quadrants, a trend line or an "equal" diagonal. */
export default function QuadrantChart({ view, pool, note }: { view: View; pool: PlayerStat[]; note?: string }) {
  const [table, setTable] = useState(false);
  const [hot, setHot] = useState<{ p: PlayerStat; x: number; y: number } | null>(null);
  const lastPointer = useRef('mouse');
  const navigate = useNavigate();
  const xv = (p: PlayerStat) => p[view.x] as number, yv = (p: PlayerStat) => p[view.y] as number;
  const geo = useMemo(() => {
    if (!pool.length) return null;
    let [x0, x1] = extent(pool.map(xv)), [y0, y1] = extent(pool.map(yv));
    if (view.diagonal) { const lo = Math.min(x0, y0), hi = Math.max(x1, y1); x0 = y0 = lo; x1 = y1 = hi; }
    const x = lin(x0, x1, M.l, W - M.r), y = lin(y0, y1, H - M.b, M.t);
    const mx = pool.reduce((s, p) => s + xv(p), 0) / pool.length, my = pool.reduce((s, p) => s + yv(p), 0) / pool.length;
    const fit = view.diagonal ? null : fitLine(pool.map(xv), pool.map(yv));
    const labels = placeLabels(pool.map((p) => ({ x: x(xv(p)) + 16, y: y(yv(p)) + 4, text: shortName(p.name) })));
    return { x0, x1, y0, y1, x, y, mx, my, fit, labels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, view]);
  const id = `quad-${view.id}`;

  return (
    <section aria-labelledby={id} className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 id={id} className="text-sm font-semibold uppercase tracking-wide">{view.label}</h2>
        {!note && <button type="button" aria-pressed={table} onClick={() => setTable((t) => !t)} className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:text-ink">Table</button>}
      </div>
      <p className="px-4 text-sm text-muted">{view.question}</p>
      {note ? <p className="px-4 py-16 text-center text-sm text-muted">{note}</p> : table ? (
        <div className="overflow-x-auto px-4 py-3">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Player</th><th>Team</th><th className="text-right">{view.xLabel}</th><th className="text-right">{view.yLabel}</th></tr></thead>
            <tbody>{[...pool].sort((a, b) => yv(b) - yv(a)).map((p) => (
              <tr key={p.id} className="border-t border-line"><td className="py-1"><PlayerLink id={p.id}>{p.name}</PlayerLink></td><td className="text-muted">{p.team}</td><td className="num text-right">{view.fx(xv(p))}</td><td className="num text-right">{view.fy(yv(p))}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : geo && (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${view.label}: ${pool.length} players`}>
            {[[geo.x(geo.mx), M.t, W - M.r - geo.x(geo.mx), geo.y(geo.my) - M.t], [M.l, M.t, geo.x(geo.mx) - M.l, geo.y(geo.my) - M.t], [geo.x(geo.mx), geo.y(geo.my), W - M.r - geo.x(geo.mx), H - M.b - geo.y(geo.my)], [M.l, geo.y(geo.my), geo.x(geo.mx) - M.l, H - M.b - geo.y(geo.my)]].map(([a, b, w, h], i) => (
              <rect key={i} x={a} y={b} width={Math.max(0, w)} height={Math.max(0, h)} style={{ fill: TINT[i], fillOpacity: 0.07 }} />
            ))}
            {ticks(geo.y0, geo.y1).map((t) => <g key={`y${t}`}><line x1={M.l} x2={W - M.r} y1={geo.y(t)} y2={geo.y(t)} style={{ stroke: 'var(--line)' }} /><text x={M.l - 8} y={geo.y(t) + 4} textAnchor="end" fontSize={12} style={{ fill: 'var(--muted)' }}>{view.fy(t)}</text></g>)}
            {ticks(geo.x0, geo.x1).map((t) => <text key={`x${t}`} x={geo.x(t)} y={H - M.b + 18} textAnchor="middle" fontSize={12} style={{ fill: 'var(--muted)' }}>{view.fx(t)}</text>)}
            <text x={(M.l + W - M.r) / 2} y={H - 10} textAnchor="middle" fontSize={13} style={{ fill: 'var(--muted)' }}>{view.xLabel}</text>
            <text x={16} y={(M.t + H - M.b) / 2} textAnchor="middle" fontSize={13} transform={`rotate(-90 16 ${(M.t + H - M.b) / 2})`} style={{ fill: 'var(--muted)' }}>{view.yLabel}</text>
            <line x1={geo.x(geo.mx)} x2={geo.x(geo.mx)} y1={M.t} y2={H - M.b} strokeDasharray="5 5" style={{ stroke: 'var(--muted)' }} />
            <line x1={M.l} x2={W - M.r} y1={geo.y(geo.my)} y2={geo.y(geo.my)} strokeDasharray="5 5" style={{ stroke: 'var(--muted)' }} />
            {view.diagonal
              ? <line x1={geo.x(geo.x0)} y1={geo.y(geo.x0)} x2={geo.x(geo.x1)} y2={geo.y(geo.x1)} strokeDasharray="2 6" strokeWidth={2} style={{ stroke: 'var(--ink)', strokeOpacity: 0.45 }} />
              : geo.fit && <line x1={geo.x(geo.x0)} y1={geo.y(geo.fit.a + geo.fit.b * geo.x0)} x2={geo.x(geo.x1)} y2={geo.y(geo.fit.a + geo.fit.b * geo.x1)} strokeWidth={1.5} style={{ stroke: 'var(--ink)', strokeOpacity: 0.35 }} />}
            {view.quads.map((q, i) => {
              const w = q.length * 7.2 + 22, right = i % 2 === 0, top = i < 2;
              const xx = right ? W - M.r - 10 - w : M.l + 10, yy = top ? M.t + 8 : H - M.b - 32;
              return <g key={q}><rect x={xx} y={yy} width={w} height={24} rx={12} style={{ fill: TINT[i], fillOpacity: 0.9 }} /><text x={xx + w / 2} y={yy + 16} textAnchor="middle" fontSize={12} fontWeight={800} style={{ fill: 'var(--bg)' }}>{q.toUpperCase()}</text></g>;
            })}
            {pool.map((p) => (
              <g key={p.id} data-player={p.id} className="cursor-pointer"
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHot({ p, x: geo.x(xv(p)), y: geo.y(yv(p)) }); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHot(null); }}
                onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
                onClick={() => { if (lastPointer.current === 'mouse') navigate(`/player/${p.id}`); else setHot((h) => (h?.p.id === p.id ? null : { p, x: geo.x(xv(p)), y: geo.y(yv(p)) })); }}>
                <TeamLogo team={p.team} x={geo.x(xv(p))} y={geo.y(yv(p))} />
              </g>
            ))}
            {geo.labels.map((l) => <text key={`${l.text}${l.x}${l.y}`} x={l.x} y={l.y} fontSize={11} style={{ fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{l.text}</text>)}
          </svg>
          {hot && (
            <div role="tooltip" className="pointer-events-auto absolute z-10 rounded-md border border-line bg-bg px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${(hot.x / W) * 100}%`, top: `${(hot.y / H) * 100}%`, transform: 'translate(12px, 12px)' }}>
              <PlayerLink id={hot.p.id} className="font-semibold">{hot.p.name}</PlayerLink> <span className="text-muted">· {hot.p.team}</span>
              <div>{view.xLabel}: <b>{view.fx(xv(hot.p))}</b></div>
              <div>{view.yLabel}: <b>{view.fy(yv(hot.p))}</b></div>
            </div>
          )}
        </div>
      )}
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
        Dashed lines are the league average{view.diagonal ? '; the dotted diagonal is where both are equal' : '; the solid line is the trend across these players'}. The 40 players with the most volume. Hover a logo for his numbers; click to open his page.
      </p>
    </section>
  );
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/stats/players/QuadrantChart.test.tsx`
Expected: PASS, 5 tests.

The pointer tests rely on the `PointerEvent` shim already in `src/test/setup.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/stats/players
git commit -m "Stats players: team logos and the quadrant chart"
```

---

### Task 8: Web: trends table and YPRR visualised

**Files:**
- Create:
  - `packages/web/src/components/stats/players/TrendsTable.tsx`
  - `packages/web/src/components/stats/players/YprrChart.tsx`
- Test: `packages/web/src/components/stats/players/TrendsTable.test.tsx`

**Interfaces:**
- Consumes: `Trends` (Task 6), `PlayerStat` (Task 4), `TeamLogo` (Task 7), `placeLabels` and `shortName` (Task 5).
- Produces:
  - `TrendsTable({ data: Trends; pos: 'RB' | 'WR' | 'TE'; season: number })`: region "{pos} volume trends"
  - `YprrChart({ stats: PlayerStat[]; pos: 'WR' | 'TE'; estimated: boolean })`: region "Yards per route run"

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/stats/players/TrendsTable.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from '../../../lib/stats/players/season';
import { trends } from '../../../lib/stats/players/trends';
import TrendsTable from './TrendsTable';
import YprrChart from './YprrChart';

describe('TrendsTable', () => {
  const data = trends(statsDb(), statsCharts(), 'RB');
  it('trending up and down sections, a row per player with his weekly bars and change', () => {
    render(<MemoryRouter><TrendsTable data={data} pos="RB" season={2026} /></MemoryRouter>);
    const card = screen.getByRole('region', { name: /RB volume trends/ });
    expect(within(card).getByText(/Trending up/)).toBeInTheDocument();
    expect(within(card).getByText(/Trending down/)).toBeInTheDocument();
    const up = within(card).getByText('Rising Back').closest('tr')!;
    expect(up.querySelectorAll('[data-week]').length).toBe(5 * data.columns.length);
    expect(up).toHaveTextContent('+52.5');
  });
  it('the Injured line names who left the lists and why', () => {
    render(<MemoryRouter><TrendsTable data={data} pos="RB" season={2026} /></MemoryRouter>);
    expect(screen.getByText('Injured').closest('p')).toHaveTextContent('Out Back: Out (Groin)');
  });
});

describe('YprrChart', () => {
  it('draws the YPRR rays and says when routes are estimated', () => {
    render(<MemoryRouter><YprrChart stats={seasonStats(statsDb(), statsCharts())} pos="WR" estimated /></MemoryRouter>);
    const card = screen.getByRole('region', { name: /Yards per route run/ });
    expect(within(card).getByText('2.0 YPRR')).toBeInTheDocument();
    expect(within(card).getByText(/routes estimated/)).toBeInTheDocument();
  });
});
```

The `+52.5` is `rUp`'s snap change: (80 + 85) / 2 − 30.

The YPRR fixture WRs have about 150 routes, but the default pool needs 60 routes (40 for TE). The chart still draws its rays when the pool is small, because rays don't depend on players.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/stats/players/TrendsTable.test.tsx`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement `TrendsTable.tsx`**

```tsx
import type { Trends, TrendRow } from '../../../lib/stats/players/trends';
import { PlayerLink } from '../../NameLink';
import { logoUrl } from './TeamLogo';

const sign = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

function Cell({ cell }: { cell: TrendRow['cells'][string] }) {
  const top = Math.max(1, ...cell.weeks.map((w) => w.value ?? 0));
  const lastHealthy = [...cell.weeks].reverse().find((w) => w.state === 'healthy' && w.value != null)?.week;
  const tone = cell.change == null ? '' : cell.change >= 0 ? 'var(--win)' : 'var(--loss)';
  return (
    <td className="border-t border-line px-1.5 py-1.5">
      <div className="flex items-end justify-center gap-1">
        <div className="flex h-9 items-end gap-1">
          {cell.weeks.map((w) => (
            <span key={w.week} data-week={w.week} data-state={w.state} title={w.state === 'short' ? `Week ${w.week}: injury-shortened (${w.value ?? '–'})` : `Week ${w.week}: ${w.value ?? w.state}`}
              className="relative block w-3.5 rounded-t-sm"
              style={w.state === 'bye' ? { height: 2, borderTop: '2px dotted var(--dim)' } : w.value == null ? { height: 2, background: 'var(--line)' }
                : { height: Math.max(2, (w.value / top) * 26), background: w.week === lastHealthy && tone ? tone : 'var(--dim)', opacity: w.state === 'short' ? 0.35 : 1 }}>
              {w.value != null && w.state !== 'bye' && <i className="absolute bottom-full left-1/2 -translate-x-1/2 text-[9px] not-italic text-muted">{w.state === 'short' ? '✚' : w.value}</i>}
            </span>
          ))}
        </div>
        {cell.change != null && <b className="num min-w-[2.6rem] pl-1 text-xs" style={{ color: tone }}>{sign(cell.change)}</b>}
      </div>
    </td>
  );
}

/** Whose role is growing and whose is shrinking: the last two healthy weeks against the earlier ones. */
export default function TrendsTable({ data, pos, season }: { data: Trends; pos: 'RB' | 'WR' | 'TE'; season: number }) {
  const max = Math.max(0.01, ...[...data.up, ...data.down].map((r) => Math.abs(r.score)));
  const id = `trends-${pos}`;
  const row = (r: TrendRow, i: number) => (
    <tr key={r.id}>
      <td className="border-t border-line px-2 text-xs text-muted">{i + 1}</td>
      <td className="border-t border-line px-2 py-1.5">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <img src={logoUrl(r.team)} alt="" className="h-6 w-6" />
          <div><PlayerLink id={r.id} className="font-semibold">{r.name}</PlayerLink><div className="text-[10.5px] text-muted">{r.team}</div></div>
        </div>
      </td>
      {data.columns.map((c) => <Cell key={c.key} cell={r.cells[c.key]} />)}
      <td className="border-t border-line px-2">
        <div className="flex items-center justify-end gap-2">
          <i className="block h-3 rounded-sm" style={{ width: (Math.abs(r.score) / max) * 70, background: r.score >= 0 ? 'var(--win)' : 'var(--loss)' }} />
          <b className="num text-xs" style={{ color: r.score >= 0 ? 'var(--win)' : 'var(--loss)' }}>{sign(r.score, 2)}</b>
        </div>
      </td>
    </tr>
  );
  const band = (text: string, tone: string) => (
    <tr><td colSpan={data.columns.length + 3} className="px-3 py-1.5 text-sm font-extrabold uppercase tracking-wide" style={{ color: tone, background: `color-mix(in srgb, ${tone} 16%, transparent)` }}>{text}</td></tr>
  );
  return (
    <section aria-labelledby={id} className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 id={id} className="text-sm font-semibold uppercase tracking-wide">{pos} volume trends</h2>
        <span className="text-xs text-muted">{season} · weeks {data.weeks[0]}–{data.weeks[data.weeks.length - 1]} · last two weeks against the weeks before</span>
      </div>
      <p className="px-4 text-sm text-muted">Whose role is growing, and whose is shrinking?</p>
      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead><tr>
            <th /><th className="px-2 text-left text-[10.5px] uppercase tracking-wide text-muted">Player</th>
            {data.columns.map((c) => <th key={c.key} className="px-1.5 text-[10.5px] uppercase tracking-wide text-muted">{c.label}<div className="text-[9.5px] normal-case tracking-normal">Wk {data.weeks.join(' · ')}</div></th>)}
            <th className="px-2 text-right text-[10.5px] uppercase tracking-wide text-muted">Trend</th>
          </tr></thead>
          <tbody>
            {band('▲ Trending up', 'var(--win)')}
            {data.up.map(row)}
            {band('▼ Trending down', 'var(--loss)')}
            {data.down.map(row)}
          </tbody>
        </table>
      </div>
      {data.injured.length > 0 && (
        <p className="border-t border-line px-4 py-2 text-xs"><b>Injured</b> <span className="text-muted">(left out of the lists): </span>
          {data.injured.map((p, i) => <span key={p.id}>{i > 0 && ' · '}{p.name}: {p.status}{p.injury ? ` (${p.injury})` : ''}</span>)}
        </p>
      )}
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">Each bar is one week: dotted is a bye, empty is a missed game, faint with ✚ is a game he left injured. Those don&apos;t count toward the change. The coloured bar is his latest healthy week. Trend averages each change, scaled by how much that stat usually moves.</p>
    </section>
  );
}
```

- [ ] **Step 4: Implement `YprrChart.tsx`**

```tsx
import type { PlayerStat } from '../../../lib/stats/players/season';
import { placeLabels, shortName } from '../../../lib/stats/players/quadrant';
import TeamLogo from './TeamLogo';

const W = 1180, H = 460, M = { l: 62, r: 24, t: 20, b: 50 };
const RAYS = [1, 1.5, 2, 2.5, 3];

/** Routes run against receiving yards, with rays at fixed yards per route run. */
export default function YprrChart({ stats, pos, estimated }: { stats: PlayerStat[]; pos: 'WR' | 'TE'; estimated: boolean }) {
  const pool = stats.filter((p) => p.pos === pos && p.routes >= (pos === 'TE' ? 40 : 60));
  const xm = Math.max(100, ...pool.map((p) => p.routes)) * 1.05, ym = Math.max(100, ...pool.map((p) => p.yds)) * 1.08;
  const x = (v: number) => M.l + (v / xm) * (W - M.l - M.r), y = (v: number) => H - M.b - (v / ym) * (H - M.t - M.b);
  const top = [...pool].sort((a, b) => b.yds - a.yds).slice(0, 22);
  const labels = placeLabels(top.map((p) => ({ x: x(p.routes) + 15, y: y(p.yds) + 4, text: shortName(p.name) })));
  return (
    <section aria-labelledby={`yprr-${pos}`} className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 id={`yprr-${pos}`} className="text-sm font-semibold uppercase tracking-wide">Yards per route run, visualised</h2>
        {estimated && <span className="text-xs text-muted">routes estimated until the participation file is out</span>}
      </div>
      <p className="px-4 text-sm text-muted">Volume and efficiency in one picture: further right is more routes, steeper is more yards per route.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Routes run against receiving yards, ${pool.length} players`}>
        {RAYS.map((r) => { const xe = Math.min(xm, ym / r); return (
          <g key={r}><line x1={x(0)} y1={y(0)} x2={x(xe)} y2={y(xe * r)} strokeDasharray="3 5" style={{ stroke: 'var(--muted)', strokeOpacity: 0.4 }} />
            <text x={x(xe) - 4} y={y(xe * r) + (xe < xm ? 12 : -4)} textAnchor="end" fontSize={11} style={{ fill: 'var(--muted)' }}>{r.toFixed(1)} YPRR</text></g>); })}
        <text x={(M.l + W - M.r) / 2} y={H - 10} textAnchor="middle" fontSize={13} style={{ fill: 'var(--muted)' }}>Routes run</text>
        <text x={16} y={(M.t + H - M.b) / 2} textAnchor="middle" fontSize={13} transform={`rotate(-90 16 ${(M.t + H - M.b) / 2})`} style={{ fill: 'var(--muted)' }}>Receiving yards</text>
        {pool.map((p) => <g key={p.id} data-player={p.id}><title>{`${p.name}: ${p.yds} yds on ${Math.round(p.routes)} routes`}</title><TeamLogo team={p.team} x={x(p.routes)} y={y(p.yds)} size={24} /></g>)}
        {labels.map((l) => <text key={`${l.text}${l.y}`} x={l.x} y={l.y} fontSize={11} style={{ fill: 'var(--ink)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{l.text}</text>)}
      </svg>
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">The dashed rays are yards per route run. A player above the 2.5 ray is elite per route, wherever he sits on volume.</p>
    </section>
  );
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/stats/players/TrendsTable.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/stats/players/TrendsTable.tsx packages/web/src/components/stats/players/YprrChart.tsx packages/web/src/components/stats/players/TrendsTable.test.tsx
git commit -m "Stats players: volume trends table and yards per route run, visualised"
```

---

### Task 9: Web: the page, the tab bar, the route and a smoke test

**Files:**
- Create:
  - `packages/web/src/components/stats/players/StatsTabs.tsx`
  - `packages/web/src/components/stats/players/PlayersStats.tsx`
  - `packages/web/src/pages/StatsPlayersPage.tsx`
  - `packages/web/src/lib/stats/players/smoke.test.ts`
- Modify:
  - `packages/web/src/pages/StatsPage.tsx`
  - `packages/web/src/routes.tsx`
- Test: `packages/web/src/components/stats/players/PlayersStats.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `PlayersStats({ dbs: PlayerDb[]; charts: ChartDb[]; currentYear: number })`
  - the route `stats/players` with the loader `statsPlayersLoader` returning `{ dbs, charts }`

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/components/stats/players/PlayersStats.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import PlayersStats from './PlayersStats';
import StatsTabs from './StatsTabs';

const mount = (url = '/stats/players', charts = [statsCharts()]) => render(
  <MemoryRouter initialEntries={[url]}><Routes><Route path="/stats/players" element={<PlayersStats dbs={[statsDb()]} charts={charts} currentYear={2026} />} /></Routes></MemoryRouter>,
);

describe('PlayersStats', () => {
  it('opens on RB with its first view, the trends table and no YPRR chart', () => {
    mount();
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: /Expected vs actual/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /RB volume trends/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Yards per route run/ })).toBeNull();
  });
  it('chips switch views, and the view is kept in the URL', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Success % vs explosive %/ }));
    expect(screen.getByRole('region', { name: /Success % vs explosive %/ })).toBeInTheDocument();
  });
  it('a link with pos and view opens that chart', () => {
    mount('/stats/players?pos=WR&view=role');
    expect(screen.getByRole('region', { name: /Role map/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Yards per route run/ })).toBeInTheDocument();
  });
  it('a participation view in a season without participation shows the note', () => {
    mount('/stats/players?pos=QB&view=press');
    const chip = screen.getByRole('button', { name: /Clean vs pressured/ });
    expect(chip).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/arrives after the season ends/)).toBeInTheDocument();
  });
  it('renders a season with no chart file', () => {
    mount('/stats/players?pos=RB&view=boom', []);
    expect(screen.getByRole('region', { name: /Success % vs explosive %/ })).toHaveTextContent(/No data yet/);
  });
});

describe('StatsTabs', () => {
  it('links Managers and Players, marking the current one', () => {
    render(<MemoryRouter initialEntries={['/stats/players']}><StatsTabs /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Managers' })).toHaveAttribute('href', '/stats');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/stats/players/PlayersStats.test.tsx`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement `StatsTabs.tsx`**

```tsx
import { NavLink } from 'react-router';

/** Managers | Players, at the top of both Stats pages. */
export default function StatsTabs() {
  const cls = ({ isActive }: { isActive: boolean }) => `rounded px-3 py-1 text-sm ${isActive ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`;
  return (
    <nav aria-label="Stats" className="mb-4 inline-flex gap-1 rounded-md bg-surface-2 p-1">
      <NavLink to="/stats" end className={cls}>Managers</NavLink>
      <NavLink to="/stats/players" className={cls}>Players</NavLink>
    </nav>
  );
}
```

- [ ] **Step 4: Implement `PlayersStats.tsx`**

```tsx
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import { seasonStats, type Pos } from '../../../lib/stats/players/season';
import { trends } from '../../../lib/stats/players/trends';
import { viewPool, viewsFor } from '../../../lib/stats/players/views';
import SeasonPicker from '../../SeasonPicker';
import QuadrantChart from './QuadrantChart';
import TrendsTable from './TrendsTable';
import YprrChart from './YprrChart';

const POSITIONS: Pos[] = ['QB', 'RB', 'WR', 'TE'];
const PBP_VIEWS = new Set(['clutch', 'rz', 'boom', 'ryoe']);

/** Players stats: a quadrant view per position, volume trends and yards per route run. */
export default function PlayersStats({ dbs, charts, currentYear }: { dbs: PlayerDb[]; charts: ChartDb[]; currentYear: number }) {
  const [params, setParams] = useSearchParams();
  const years = dbs.map((d) => d.year).sort((a, b) => b - a);
  const season = Number(params.get('season')) || (years.includes(currentYear) ? currentYear : years[0]);
  const pos = (POSITIONS.find((p) => p === params.get('pos')) ?? 'RB') as Pos;
  const views = viewsFor(pos);
  const view = views.find((v) => v.id === params.get('view')) ?? views[0];
  const db = dbs.find((d) => d.year === season) ?? dbs[0];
  const chart = charts.find((c) => c.year === season);
  const stats = useMemo(() => (db ? seasonStats(db, chart) : []), [db, chart]);
  const trend = useMemo(() => (db && pos !== 'QB' ? trends(db, chart, pos) : null), [db, chart, pos]);
  const set = (next: Record<string, string>) => setParams((p) => { const q = new URLSearchParams(p); for (const [k, v] of Object.entries(next)) q.set(k, v); return q; }, { replace: true });
  if (!db) return <p className="text-muted">No player data yet.</p>;

  const noPart = !chart?.participation;
  const note = view.participation && noPart ? 'Coverage and pressure data arrives after the season ends, when nflverse publishes its participation file. Pick an earlier season.'
    : PBP_VIEWS.has(view.id) && !chart ? 'No data yet for this season.' : undefined;

  return (
    <div className="space-y-4">
      <div className="sticky top-12 z-[5] -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <SeasonPicker years={years} value={season} onChange={(v) => { if (v !== 'all') set({ season: String(v) }); }} />
        <div role="group" aria-label="Position" className="inline-flex gap-0.5 rounded-md bg-surface-2 p-0.5">
          {POSITIONS.map((p) => <button key={p} type="button" aria-pressed={p === pos} onClick={() => set({ pos: p, view: viewsFor(p)[0].id })} className={`rounded px-3 py-1 text-sm ${p === pos ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`}>{p}</button>)}
        </div>
      </div>
      <div role="group" aria-label="View" className="flex flex-wrap gap-1.5">
        {views.map((v) => {
          const off = v.participation && noPart;
          return (
            <button key={v.id} type="button" aria-pressed={v.id === view.id} aria-disabled={off || undefined} onClick={() => set({ view: v.id })}
              title={off ? 'Needs the participation file, which arrives after the season ends' : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${v.id === view.id ? 'border-win bg-[color-mix(in_srgb,var(--win)_12%,transparent)] text-ink' : 'border-line text-muted hover:text-ink'} ${off ? 'opacity-50' : ''}`}>
              {v.label}
            </button>
          );
        })}
      </div>
      <QuadrantChart view={view} pool={note ? [] : viewPool(view, stats, pos)} note={note ?? (viewPool(view, stats, pos).length ? undefined : 'No data yet for this season.')} />
      {(pos === 'WR' || pos === 'TE') && <YprrChart stats={stats} pos={pos} estimated={!db.routesReal} />}
      {trend && <TrendsTable data={trend} pos={pos as 'RB' | 'WR' | 'TE'} season={season} />}
    </div>
  );
}
```

- [ ] **Step 5: The page, the tab bar on Managers, and the route**

Create `packages/web/src/pages/StatsPlayersPage.tsx`:

```tsx
import { useLoaderData } from 'react-router';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import PlayersStats from '../components/stats/players/PlayersStats';
import StatsTabs from '../components/stats/players/StatsTabs';
import { currentSeason } from '../data/load';

export interface StatsPlayersData { dbs: PlayerDb[]; charts: ChartDb[] }

export default function StatsPlayersPage() {
  const { dbs, charts } = useLoaderData() as StatsPlayersData;
  return <><StatsTabs /><PlayersStats dbs={dbs} charts={charts} currentYear={currentSeason.year} /></>;
}
```

In `packages/web/src/pages/StatsPage.tsx`:
- Add the import:

```tsx
import StatsTabs from '../components/stats/players/StatsTabs';
```

- Change the return to:

```tsx
  return <><StatsTabs /><ManagersStats seasons={seasons} players={players} years={history.seasons.map((s) => s.year)} currentYear={currentSeason.year} /></>;
```

In `packages/web/src/routes.tsx`:
- Import `StatsPlayersPage` and `type StatsPlayersData`.
- Add the loader:

```tsx
export async function statsPlayersLoader(): Promise<StatsPlayersData> {
  const years = history.seasons.map((s) => s.year);
  const [dbs, charts] = await Promise.all([Promise.all(years.filter(hasPlayerDb).map(loadPlayerDb)), Promise.all(years.filter(hasCharts).map(loadCharts))]);
  return { dbs, charts };
}
```

- Add the route after the `stats` route:

```tsx
      { path: 'stats/players', loader: statsPlayersLoader, element: <StatsPlayersPage /> },
```

- [ ] **Step 6: Smoke test over the committed data**

Create `packages/web/src/lib/stats/players/smoke.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import { seasonStats } from './season';
import { trends } from './trends';
import { VIEWS, viewPool } from './views';

const root = new URL('../../../../../../data/', import.meta.url);
const json = <T,>(p: string) => JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T;
const finite = (o: unknown) => !JSON.stringify(o, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__BAD__' : v)).includes('__BAD__');

describe('players stats over the committed data', () => {
  for (const year of [2025, 2026]) {
    it(`${year}: every view's pool is finite and at most 40; trends exclude the injured`, () => {
      const db = json<PlayerDb>(`playerdb/${year}.json`), ch = json<ChartDb>(`charts/${year}.json`);
      const stats = seasonStats(db, ch);
      expect(finite(stats)).toBe(true);
      for (const v of VIEWS) for (const p of v.pos) { const pool = viewPool(v, stats, p); expect(pool.length).toBeLessThanOrEqual(40); if (!v.participation || ch.participation) expect(pool.length, `${year} ${p} ${v.id}`).toBeGreaterThan(0); }
      for (const pos of ['RB', 'WR', 'TE'] as const) {
        const t = trends(db, ch, pos);
        const injured = new Set(t.injured.map((i) => i.id));
        expect([...t.up, ...t.down].some((r) => injured.has(r.id))).toBe(false);
        expect(t.up.every((r, i) => i === 0 || t.up[i - 1].score >= r.score)).toBe(true);
        expect(finite(t)).toBe(true);
      }
    });
  }
  it('2026 has play-by-play counts without participation', () => {
    const ch = json<ChartDb>('charts/2026.json');
    expect(ch.participation).toBe(false);
    expect(Object.values(ch.players).some((p) => p.plays?.rush)).toBe(true);
  });
});
```

- [ ] **Step 7: Run everything**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/stats/players src/lib/stats/players && pnpm test && pnpm typecheck && pnpm typecheck:scripts && pnpm build`
Expected: all green.

If the existing Managers stats tests query the page's first heading or link count, the tab bar adds two links. Adjust any such assertion to scope within the managers content, and record that as a ruling.

- [ ] **Step 8: Look at it**

1. Build and preview on a free port:

   ```bash
   packages/web/node_modules/.bin/vite preview --port 4215 --strictPort --outDir packages/web/dist --config packages/web/vite.config.ts
   ```

2. Take headless Chrome screenshots of these, in dark and light:
   - `/stats/players`
   - `/stats/players?pos=QB&view=anya`
   - `/stats/players?pos=WR&view=role`
   - `/stats/players?pos=TE`
   - `/stats/players?season=2025&pos=QB&view=press`

3. Check that:
   - logos load
   - labels don't collide badly
   - the trends table matches the mockup
   - the participation note shows for 2026

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/components/stats/players packages/web/src/pages/StatsPlayersPage.tsx packages/web/src/pages/StatsPage.tsx packages/web/src/routes.tsx packages/web/src/lib/stats/players/smoke.test.ts
git commit -m "Stats players: the Players tab with quadrant views, volume trends and YPRR, beside Managers"
```
