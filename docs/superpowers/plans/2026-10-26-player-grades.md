# Player Grades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add grade cards, a scouting summary and a target map to the player page. Turn on 2026 run lanes and passing zones. Remove the PercentileBars card.

**Architecture:** The chart build (`packages/core/src/charts/build.ts`) joins FTN charting onto play-by-play. Per player it adds named season sums (`grades`) and target-map zone counts (`targets`). Lanes and zones stop requiring participation. The web side defines every card and tile in one table (`lib/grades/defs.ts`). One engine (`lib/grades/grade.ts`) reads those sums together with the existing player-DB aggregate (`aggregate()`), ranks each tile within the position, and picks the scouting summary. The components render the result.

**Tech Stack:** TypeScript, React 19, react-router, Tailwind, zod, Vitest + Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-26-player-grades-design.md`. Read it first. The card and tile lists there are the source of truth for labels, questions, sources, style (S) and lower-is-better (low) flags.

## Global Constraints

- The credit line must read exactly `Data: FTN Data via nflverse`. It appears on the target map legend and, as part of the section credit, under the grades: `Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse`.
- Colours: use the theme tokens and the helpers `pctColor`, `heatColor` and `ordinal` from `lib/charts/scale.ts` only. Never use raw hex in components.
- Style tiles are grey (`var(--dim)` border and dot), with the text `Nth pct · style`. Graded tiles use `pctColor(pct)`.
- Below-minimum tiles show their value with `not ranked`, and are grey.
- Volume minimums scale by weeks played: 4 targets (WR/TE), 7 carries (RB), 15 dropbacks (QB) per week of `Agg.weeks`. Any smaller denominator a tile names must be at least 5.
- Count tiles (broken tackles, deep yards, end-zone targets, created receptions, rushing first downs) show the season total and are ranked per game (`Agg.games`). "c / t" tiles are ranked on their rate.
- Card groups, in order: `Opportunity`, `Production`, `How he plays`.
- No projections anywhere in the grades.
- Work on a branch `player-grades` off `main`. Commit after every task. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **FTN lags play-by-play by a few days.** A target with no FTN row must not count as "not a drop" or "not contested". FTN rates divide by FTN-covered events (`ftnTgt`, `ftnDb`, `ftnCar`), never by all events. Test in Task 2.
2. **A player traded mid-season.** Red-zone target share and inside-10 share divide by his teams' totals in the games he played for them, not by his final team's season total. Test in Task 2.
3. **A zero denominator.** For example, a QB with no scrambles must show `—` with the detail `none`, never `NaN`, `Infinity` or `0.0`. That tile is unranked and stays out of the summary. Test in Task 3.
4. **A player in the player DB with no gsis id, or no chart entry** (a rookie with a few snaps). The page must still render: the grades section is omitted, and nothing crashes. Test in Task 4.
5. **Phones at 360px and light mode.** Cards drop to one column with no horizontal scroll, and the tile colours stay readable in light mode. Checked by eye in Task 6.

---

### Task 1: FTN join, 2026 lanes and zones, sync download

**Files:**
- Modify: `packages/core/src/charts/types.ts`, `packages/core/src/charts/schema.ts`, `packages/core/src/charts/build.ts`
- Modify: `scripts/syncPlayers.ts` (URLS, `chartsPhase`, `chartFileFinal`)
- Test: `packages/core/test/charts/build.test.ts`

**Interfaces:**
- Produces: `buildCharts(pbp, participation, posOf, year, builtAt, injuries = [], ftn: Iterable<Row> = []): ChartDb`.
- Produces: `ChartDb.ftn: boolean`, which is optional in the schema so old files still parse. It is true when the FTN rows were non-empty.
- Produces: an internal helper `ftnKey(game, play)`, which matches `playKey`. FTN rows are keyed by `nflverse_game_id` and `nflverse_play_id`.

- [ ] **Step 1: Write failing tests** in `build.test.ts`. Add a helper `ftnRow(p: Row, f: Row): Row => ({ nflverse_game_id: p.game_id, nflverse_play_id: String(Math.trunc(Number(p.play_id))), ...f })`. Cases:
  - `'without participation, lanes and zones are built from play-by-play under all'`: there is no participation. RB `left/tackle` carry gives `db.players.R.lanes!.all.LT![0] === 1`. QB attempt at air 5, left gives `db.players.Q.zones!.all['short|left']![0] === 1`, with `clean` and `pressured` empty. `db.players.Q.splits` is undefined and `db.players.W` has no `routes`.
  - `'the box split falls back to FTN n_defense_box'`: two carries with no participation and FTN boxes `6` and `8`. Expect `lanes.light.LT[0] === 1` and `lanes.heavy.LT[0] === 1`. A carry whose FTN box is `0` goes only into `all`.
  - `'participation box wins over FTN'`: the participation row has `defenders_in_box: '8'` and FTN has `6`, so the carry is filed under heavy.
  - `'ftn flag'`: `build(..., ftn=[])` gives `ftn: false`, and one FTN row gives `ftn: true`. Old JSON without `ftn` still parses with `ChartDbSchema`.
  - Update the existing test `'with no participation file: … no routes, lanes, zones or splits'` so it expects lanes and zones to exist, and keeps the expectations that routes, splits and throws are absent.

- [ ] **Step 2: Run** `pnpm --filter @fantasy-dash/core test -- charts`. Expected: the new cases FAIL.

- [ ] **Step 3: Implement.**
  - Build an FTN map the same way as `parts`.
  - Lanes: drop `hasPart` from the guard. The box comes from `x.defenders_in_box` when present, otherwise from FTN `n_defense_box` when it is > 0.
  - Zones: drop `hasPart`. Pocket splits still come only from `x`.
  - `splits` and `throws` and `routes` keep `hasPart`.
  - Set `ftn` on the result.
  - Update the `ChartDb.participation` doc comment: routes, splits and throws need it; lanes and zones don't.

- [ ] **Step 4: Sync.**
  - Add `ftn: (y) => \`${NFLVERSE}/ftn_charting/ftn_charting_${y}.csv\`` to `URLS`.
  - Fetch it in `chartsPhase`. On a 404, log `${year}: no FTN charting file` and pass `[]`.
  - Pass it as the 7th argument.
  - `chartFileFinal` must return false for a file without an `ftn` key, so finished seasons rebuild once.

- [ ] **Step 5: Run** `pnpm --filter @fantasy-dash/core test && pnpm typecheck && pnpm typecheck:scripts`. Expected: PASS.

- [ ] **Step 6: Commit** with the message `Charts: FTN join; run lanes and passing zones without participation; FTN box fallback; sync downloads FTN`.

---

### Task 2: Grade sums, team shares and target-map counts in the chart DB

**Files:**
- Modify: `packages/core/src/charts/types.ts`, `schema.ts`, `build.ts` (`roundAll` too)
- Modify: `packages/core/src/playerdb/sources/ngs.ts`, `packages/core/src/playerdb/types.ts`, `packages/web/src/lib/playerdb/aggregate.ts` (WEIGHTED)
- Test: `packages/core/test/charts/build.test.ts`, plus the existing NGS source test in `packages/core/test/playerdb/`

**Interfaces:**
- Produces in `types.ts`:
  - `export const TARGET_FILTERS = ['all', 'pa', 'nopa', 'motion', 'screen', 'blitz', 'contested'] as const; export type TargetFilter`.
  - `ChartPlayer.targets?: Partial<Record<TargetFilter, Partial<Record<Zone, Counts>>>>`. The tuple order matches routes: targets, catches, yards, epa, tds.
  - `export const GRADE_KEYS = [...] as const; export type GradeKey; ChartPlayer.grades?: Partial<Record<GradeKey, number>>`. These are season sums, keyed by name rather than tuple. The exact keys and their definitions are below.
- Produces in the player DB: a new NGS rushing field `ru_pctOe`, from `rush_pct_over_expected`, weighted by `ru_att` in `WEIGHTED`.

`GRADE_KEYS`. "tgt" is a target as defined in the spec. `fd` means a first down or a TD on the play. "ftn*" counts only events that have an FTN row, and every FTN rate divides by its ftn* count.

| Group | Keys | Definition |
|---|---|---|
| receiver | `tgt rec yds epa succ fd td` | per target; `fd` and `succ` from pbp `first_down`/`touchdown` and `success` |
| receiver | `cpN cpSum cpRec` | targets with `cp`, Σcp, catches on those targets |
| receiver | `yacN yacOe` | catches with `xyac_mean_yardage`; Σ(yards_after_catch − xyac_mean_yardage) |
| receiver | `deep deepRec deepYds deepEpa` | air_yards ≥ 20 |
| receiver | `t3 t3Conv rzTgt ezTgt` | 3rd down; yardline_100 ≤ 20; air_yards ≥ yardline_100 |
| receiver | `teamRzTgt teamIn10` | team totals over the (game, team) pairs he appeared in |
| receiver FTN | `ftnTgt catchable drops contested contestedRec created motionTgt paTgt screenTgt` | `drops` uses `is_drop`; contestedRec is a catch on a contested target |
| QB | `db dbEpa dbSucc att sacks sackYds passYds passTd int` | dropbacks; `sackYds` is the positive yards lost |
| QB | `deepAtt deepCmp deepEpa deepCpoeSum deepCpoeN` | attempts with air ≥ 20 |
| QB | `t3Db t3Conv rzDb rzTd q4Db q4Epa trailDb trailEpa` | `rzTd` is a TD by his team; q4 is qtr ≥ 4; trailing is score_differential < 0 |
| QB | `scr scrYds drun drunEpa rushFd` | scrambles; designed runs (rush_attempt, not a scramble); first downs on either |
| QB FTN | `ftnDb ftnAtt iw readN firstRead throwaway faultSack catchableThrown recDrops paDb paEpa blitzDb blitzEpa noBlitzDb noBlitzEpa` | `readN` counts attempts with `read_thrown` ≠ 0; `firstRead` counts `read_thrown` = 1; blitz is n_blitzers > 0 |
| rusher | `car carYds carEpa carSucc carFd explosive stuffed in10 in5 in5Td outside` | `explosive` is yards ≥ 10; `stuffed` is ≤ 0; `outside` is run_location left/right with run_gap `end` |
| rusher FTN | `ftnCar boxN boxSum lightCar lightYds heavyCar heavyYds rpo` | light is box ≤ 6, heavy is box ≥ 8 (the spec's stacked box); box 0 is ignored |

A player can collect keys from several groups. For example, an RB's targets fill the receiver keys. Two-point plays are excluded. Round the EPA keys to 2 places and everything else to 1.

- [ ] **Step 1: Write failing tests:**
  - `'grades: receiver sums, deep, money downs, catch over expected'`: fixture plays with cp, air yards, down and yardline. Assert the exact sums.
  - `'grades: FTN rates count only FTN-covered targets'`: two targets, one with an FTN `is_drop: TRUE` row and one with no FTN row. Expect `tgt 2, ftnTgt 1, drops 1`.
  - `'grades: team red-zone share follows the games he played, across a trade'`: the receiver plays game 1 for AAA and game 2 for CCC. Team RZ targets are AAA 3 in game 1 and CCC 2 in game 2, and CCC has 5 more in a game he missed. Expect `teamRzTgt === 5`.
  - `'grades: QB situational, deep, legs and FTN keys'`, and `'grades: rusher keys incl. box split and outside runs'`.
  - `'targets: zones by filter'`: a play-action target lands in `all` and `pa` but not `nopa`. A target with no FTN row lands only in `all`.
  - `'old chart JSON without grades or targets still parses'`.
  - NGS source test: `rush_pct_over_expected` 0.32 maps to `ru_pctOe: 0.32`.

- [ ] **Step 2: Run** the core tests. Expected: FAIL.

- [ ] **Step 3: Implement.** Add the types, then the schema (`grades: z.record(z.enum(GRADE_KEYS), z.number()).optional()`, `targets` built like `zones`). Then do the build pass. Team totals need a first pass (or a post-pass) over `(game_id, posteam)` → `{rzTgt, in10}`, and a per-player set of the `game|team` pairs he appeared in.

- [ ] **Step 4: Run** `pnpm --filter @fantasy-dash/core test && pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** with the message `Charts: grade sums, team red-zone shares across trades, target-map zones by FTN filter; NGS % of carries over expected`.

---

### Task 3: Grade definitions and ranking engine

**Files:**
- Create: `packages/web/src/lib/grades/defs.ts` (the cards and tiles for QB, RB and WR; TE uses WR)
- Create: `packages/web/src/lib/grades/grade.ts` (the engine and the summary)
- Test: `packages/web/src/lib/grades/grade.test.ts`. Fixtures: extend `src/test/chartFixtures.ts` (a `miniGradeCharts()`), and `src/test/playerDbFixtures.ts` if needed.

**Interfaces:**
- Consumes: `aggregate(db, 1, db.throughWeek)` → `Agg[]`; `COLUMNS`, `columnValue`; `percentiles`; `ChartDb.players[gsis].grades`; `PlayerDb.players[id].gsisId`.
- Produces in `defs.ts`:
  ```ts
  export type Group = 'Opportunity' | 'Production' | 'How he plays';
  export interface GradeInput { agg: Agg; g: Partial<Record<GradeKey, number>>; ftn: boolean }
  export interface TileDef {
    key: string; label: string;
    value: (x: GradeInput) => number | null;      // the ranked quantity (a rate for "c / t" tiles)
    text: (x: GradeInput) => string;              // the big number, e.g. '10 / 12', '4.7%', '+0.75'
    detail: (x: GradeInput) => string;            // the muted line, e.g. '3 of 64 catchable'
    denom?: (x: GradeInput) => number;            // the tile's own sample; under 5 → not ranked
    perGame?: true; style?: true; low?: true; ftnOnly?: true; est?: (x: GradeInput) => boolean;
  }
  export interface CardDef { key: string; title: string; question: string; group: Group; tiles: [TileDef, TileDef, TileDef, TileDef] }
  export const CARDS: Record<'QB' | 'RB' | 'WR', CardDef[]>;   // in the spec's order
  ```
- Produces in `grade.ts`:
  ```ts
  export interface GradedTile { key: string; label: string; text: string; detail: string; pct: number | null; style: boolean; status: 'ranked' | 'small' | 'noFtn' | 'none' }
  export interface GradedCard { key: string; title: string; question: string; group: Group; tiles: GradedTile[] }
  export function gradeCards(db: PlayerDb, chart: ChartDb | undefined, id: PlayerId): GradedCard[] | null;
  export interface SummaryRow { label: string; card: string; text: string; pct: number }
  export function scoutingSummary(cards: GradedCard[]): { best: SummaryRow[]; worst: SummaryRow[] };
  ```

Rules:
- `gradeCards` returns null when the position is not QB/RB/WR/TE, when there is no gsis id, or when `chart?.players[gsis]?.grades` is missing.
- The pool is the same-position Aggs (TE separate from WR) that have grades and reach the volume minimum. Volume: WR/TE use `re_tgt`; RB uses `ru_att`; QB uses `pa_att + pa_sack`.
- Percentile: `percentiles()` over the pool's values. Flip it when `low`, round to 0–100, and for `perGame` divide the value by `agg.games` before ranking.
- Status:
  - `small`: he is under the volume minimum, or `denom` < 5.
  - `noFtn`: the tile is `ftnOnly` and `chart.ftn` is false, or `g.ftn*` is 0. The text is `—` and the detail is `no FTN data`.
  - `none`: the value is null. The text is `—` and the detail says `none`.
- DB-sourced tiles read the existing columns through `columnValue(COLUMNS[key], agg, 'total')`: `tgtPct`, `wopr`, `snapPct`, `tprr` (with `est` from `agg.routesEst`), `yacoe`, `racr`, `sep`, `cpoe`, `badPct`, `aggr`, `pressPct`, `ttt`, `ryoeAtt`, `box8`, `ybc`, `yacAtt`, `bt`, `btTouch`, `oppPct`. Note that `oppPct` is the spec's opportunity share. Read `adotRe` as well. NGS "air yards past the sticks" and "% carries over expected" read `agg.w.pa_ays` and `agg.w.ru_pctOe`. Team air-yards share reads `agg.w.re_iayShare`.
- `scoutingSummary` takes only tiles with `status === 'ranked'` and not `style`. Best: the top 4 by pct, ties broken by card order. Worst: the bottom 4. A tile can't appear in both lists. With fewer than 8 eligible tiles, split them by pct ≥ 50 vs < 50.

- [ ] **Step 1: Write failing tests** in `grade.test.ts`:
  - `'WR cards come in the spec order and groups'`: the titles are `['Opportunity','Usage','Efficiency','Beating expectation','Deep threat','Money downs','Ball skills & separation']`, and the groups follow.
  - `'a TE is ranked against TEs only'`.
  - `'style tile: ranked but flagged style'`. Example: average depth of target, where `style === true` and `pct` is a number.
  - `'low tile flips the percentile'`. Example: in a pool of 3, the lowest drop rate gets pct 100.
  - `'count tile ranks per game but shows the total'`. Example: deep yards 300 in 6 games vs 280 in 4 games, where the second ranks higher and the text is `'300'`.
  - `'under the volume minimum every tile is small and the summary is empty'`.
  - `'deep tile with 4 deep targets is small'`.
  - `'QB with no scrambles: yards per scramble is — / none, unranked'` (Review Focus 3).
  - `'FTN tile in a chart without FTN reads — / no FTN data'`.
  - `'summary: top and bottom 4 graded tiles, style and unranked excluded, no tile in both'`.
  - `'returns null with no gsis or no grades'`.

- [ ] **Step 2: Run** `pnpm --filter web test -- grades`. Expected: FAIL.

- [ ] **Step 3: Implement** `defs.ts`, copying labels, questions, details and flags from the spec. Implement `grade.ts`. Use the formatters in `lib/charts/scale.ts` (`fmtPct`, `fmtDec1`, `fmtSigned`).

- [ ] **Step 4: Run** `pnpm --filter web test && pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** with the message `Grades: card and tile definitions per position, ranking within the position, scouting summary`.

---

### Task 4: Grades section on the player page; PercentileBars removed

**Files:**
- Create: `packages/web/src/components/player/grades/GradesSection.tsx`, `GradeCard.tsx`, `ScoutingSummary.tsx`
- Modify: `packages/web/src/pages/PlayerPage.tsx`
- Delete: `packages/web/src/components/player/PercentileBars.tsx`, `packages/web/src/lib/player/percentiles.ts`, `percentiles.test.ts`. Also remove any reference in `lib/player/smoke.test.ts`.
- Test: `packages/web/src/components/player/grades/GradesSection.test.tsx`. Also the player page test that covered PercentileBars, if one exists (`grep -rn PercentileBars packages/web/src`).

**Interfaces:**
- Consumes: `gradeCards` and `scoutingSummary` (Task 3), and `SeasonPicker`.
- Produces: `<GradesSection id={id} dbs={myDbs} charts={charts} current={current} />`. It renders nothing when no season yields cards.

Layout, matching the mockup `player-page-cards.html`:
- A `card` header row titled `Grades`, with a SeasonPicker. The seasons offered are the ones where `gradeCards` is non-null, newest first. The default is the newest.
- Then the ScoutingSummary card: "Best at" and "Weakest at", each row `label · card` on the left and `text · Nth` in `pctColor` on the right.
- Then, per group, a small uppercase muted heading and a grid `grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]`.
- GradeCard: title, the question in muted text, and a 2×2 tile grid. Each tile has a 4px left border, the big text, the label, a muted detail line, and the percentile line (`96th pct` or `61st pct · style`, or `not ranked`). The bar is 4px with an 8px dot at `left: max(2%, pct%)`. Give each tile a `data-tile={key}` and a `data-pct={pct ?? ''}`.
- Below that, the credit line from Global Constraints.
- PlayerPage: render it after the chart cards and before GameLog. Delete `pctYear`, `bars` and the PercentileBars import. The right column now holds only LeagueRecords. When it's absent, JourneyFeed takes the full width (keep the existing grid only when both exist).

- [ ] **Step 1: Write failing tests:**
  - `'renders the summary, groups in order and four tiles per card'`.
  - `'a style tile shows "pct · style" and a graded tile a pct line'`.
  - `'season picker switches the cards'`.
  - `'credit line reads "Data: FTN Data via nflverse …"'`.
  - `'renders nothing for a player with no gsis id'` (Review Focus 4).
  - PlayerPage: `'no Percentiles card'` (`queryByText(/Percentiles/)` is null).

- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Player page: grades section with scouting summary; Percentiles card removed`.

---

### Task 5: Target map card, receiver card switch, pocket filter in 2026

**Files:**
- Create: `packages/web/src/components/charts/TargetMap.tsx`, `TargetMap.test.tsx`
- Modify: `packages/web/src/lib/charts/specs.ts` (`TARGET_SPEC`), `components/charts/Field.tsx` (`useChartSeason` controlled mode, `Seg` disabled options), `RouteTree.tsx`, `PassingZones.tsx`, `pages/PlayerPage.tsx`
- Test: extend `RouteTree.test.tsx` and `PassingZones.test.tsx`; add target data to `src/test/chartFixtures.ts`

**Interfaces:**
- Produces:
  - `TARGET_SPEC: ChartSpec<Zone, TargetFilter>` = `{ keys: ZONES, table: p => p.targets, min: 3, sharePool: { all: 20, pa: 5, nopa: 5, motion: 5, screen: 3, blitz: 5, contested: 3 }, shareMax: 0.25, unit: 'tgt', metrics: catch (per(1,0), fmtPct), ypt (per(2,0), fmtDec1), epa (per(3,0), fmtSigned 2) }`.
  - `useChartSeason(charts, has, current, control?: { years: number[]; year: number; onYear: (y: number) => void })`. When `control` is given, it uses those years and that year instead of its own state.
  - `Seg` gets `disabled?: T[]`: disabled options render with `disabled` and a `title`.
  - `<ReceiverChart charts gsis pos current />`, exported from `TargetMap.tsx`. It holds the year. The years are every chart year where he has routes or targets, plus `current` when it's newer. A year with routes for him renders `RouteTree`; any other year renders `TargetMap`. Both get the same `control`.

TargetMap rendering follows `PassingZones` (the same field geometry: W 460, depth −7 to 35, three columns, blur filter).
- Ellipse opacity follows the share or the percentile, as in PassingZones.
- Each zone always shows its number (18px, bold, `fill: var(--ink)` on dark and theme-aware via a token), with `N tgt` (10.5px, muted) when the band is taller than 50px. There is no stroke or outline on the text.
- Each zone group gets `data-zone={key}` and `data-pct`.
- Title: `Target map`. Under the title, a muted line: `Route tree arrives when the season's route data is published`.
- Controls:
  - `Plays`, with the options `All · Play-action · No play-action · Motion · Screen · vs blitz · Contested`. The FTN filters are disabled when `!db.ftn`.
  - `Metric`, with the options `Target share · Catch % · Yds/target · EPA/target`.
- Tip: `{band label} {side} · N targets, N rec, N yds, N TD · N% of his targets · EPA/target X`.
- Legend: `Share of his targets, 0% to 25%+ · depth is air yards, drawn to scale`, or the percentile wording when another metric is picked. Then `Data: FTN Data via nflverse`.

PassingZones: when `!db.participation`, the Clean and Pressured pocket options are disabled with the title `No pressure data for this season yet`, and the pocket resets to All. Its empty-state check becomes "no zones" rather than "no participation". The existing `hasChart` already does this once Task 1 lands. Verify it.

- [ ] **Step 1: Write failing tests:**
  - TargetMap:
    - `'shows each zone's share and target count without hovering'`.
    - `'Play-action filter narrows the zones'`.
    - `'Catch % colours by percentile; a 2-target zone is unranked'`.
    - `'FTN filters are disabled when the season has no FTN'`.
    - `'credit line present'`.
  - ReceiverChart:
    - `'a season with routes shows the route tree, one without shows the target map, from one picker'`.
  - PassingZones:
    - `'without participation, Clean and Pressured are disabled and All shows zones'`.

- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** In PlayerPage, swap `RouteTree` for `ReceiverChart` for WR, TE and RB. QB keeps `RouteTree pos="QB"`.
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Target map for seasons without routes, one picker with the route tree; passing zones in 2026 with pocket splits disabled`.

---

### Task 6: Rebuild data and check it in the app

**Files:**
- Modify: `data/charts/*.json` (rebuilt) and `data/playerdb/2026.json` (the new NGS field). Rebuild the other seasons' player DBs only if the sync does so on its own.

- [ ] **Step 1:** Run `pnpm sync:players --charts-only`. Expected log: each season fetches `ftn_charting`, and 2023–2026 rebuild. Run `pnpm sync:players --season 2026` for `ru_pctOe`. Then check the data:
  ```bash
  node -e "const d=require('./data/charts/2026.json');const p=d.players['00-0038543'];console.log(d.ftn,p.grades.tgt,p.grades.ftnTgt,Object.keys(p.targets))"
  ```
  Expected: `true`, roughly 78 or more targets, a positive `ftnTgt`, and filter keys that include `all` and `pa`.

- [ ] **Step 2:** Run `pnpm test && pnpm typecheck && pnpm build`. Expected: all PASS.

- [ ] **Step 3:** Run `pnpm dev`. Open the pages for Jaxon Smith-Njigba, Jacoby Brissett, Derrick Henry and one TE, at 1280px and 360px, in dark and light themes. Check:
  - The values match the mockup's ballpark: JSN target share about 36%, and EPA/target about +0.75.
  - 2026 run lanes and passing zones render, and 2025 still shows the route tree.
  - Nothing scrolls horizontally at 360px (Review Focus 5).

- [ ] **Step 4: Commit** with the message `Data: charts rebuilt with FTN grades and target maps; 2026 NGS % over expected`.
