# Player Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Players → Compare tab that compares up to four same-position players in one season, with player cards, the grade stats with leaders highlighted, and full-size charts driven by one set of filters.

**Architecture:**
- A new schedule data file (`data/schedule/{year}.json`), written by the player sync from nflverse `games.csv`, gives the next-5 opponents.
- Pure functions in `packages/web/src/lib/compare/` turn the existing player DB, grade cards (`gradeCards`), defence ranks (`defenseRanks`) and schedule into everything the page shows.
- `ComparePage` lays it out. The existing chart components gain a controlled mode, so one shared control bar drives every player's chart.

**Tech Stack:** TypeScript, React 19, react-router (data router loaders), Tailwind, zod, Vitest + Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-27-player-compare-design.md`. Read it first; it is the source of truth for layout, copy and rules.

## Global Constraints

- No verdict, no projections, no scoring-format switch, no sliders anywhere on the page.
- Position groups: `QB`, `RB`, `WRTE` (WR and TE together). URL: `/players/compare?season=2026&pos=RB&p=9509,3198`, where `pos` is `QB|RB|WRTE`, and `p` is up to 4 Sleeper ids in slot order with no duplicates.
- **Leaders:**
  - Floor, Average and Ceiling: the highest value leads. CV: the lowest leads ("▲ steadiest").
  - Graded tiles: the highest percentile leads. This only applies when at least two players are ranked, and never on style tiles. Ties all lead.
  - Nothing leads when fewer than two players are picked.
- **Floor and ceiling:** with 5 or more games played, the 2nd-lowest and 2nd-highest weekly points. With fewer, the min and max. Only games with `gp ≥ 1` count.
- **Histogram:** 5-point bins `[0,5) … [40,45)` and `45+`, so 10 bins. Negative scores go into the first bin.
- **Next 5:**
  - Covers the schedule weeks after `db.throughWeek`, up to week 18; a bye shows as `BYE`.
  - Hidden when no schedule week remains, or when there is no schedule file.
  - Opponent colour comes from `defenseRanks(db)(opp, pos)`.
- **Credit line under the charts, exactly:** `Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse`.
- **Slot colours** are new theme tokens `--slot-0..3`, with dark and light values in `index.css`. Never use raw hex in components.
- Work in a worktree branch. Commit after every task. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A picked player with no games played in the season** (on IR or a healthy scratch). The card must show `0G`, `—` for floor, average, ceiling and CV, an empty histogram, and no NaN. He leads nothing. Test in Task 2.
2. **Stale or hand-edited URLs.** An unknown id, a player of another position group, a duplicate id, or more than 4 ids are dropped silently. An unknown `pos` falls back to `RB`, and an unknown season falls back to the newest. Test in Task 2.
3. **A player traded mid-season.** Next 5 uses his latest team, which is the `team` of his latest row that season. Last 5 shows the opponent and home/away for the team he was on that week. Test in Task 2.
4. **Picking the same player twice.** The combobox never offers players who are already in another slot. Test in Task 3.
5. **Four players on a 360px phone.** Cards stack, the Advanced table scrolls inside its own box with the stat column pinned, and charts go one per row, with no horizontal page scroll. Checked by eye and with the iframe probe in Task 7.

---

### Task 1: NFL schedule data

**Files:**
- Create: `packages/core/src/schedule.ts` (types, zod schema, parser), export from `packages/core/src/index.ts`
- Modify: `scripts/syncPlayers.ts` (new `schedulePhase`, run after `chartsPhase` in `main`), `packages/web/src/data/load.ts` (`hasSchedule`, `loadSchedule`)
- Test: `packages/core/test/schedule.test.ts`

**Interfaces:**
- Produces in core:
  - `interface ScheduleGame { week: number; home: string; away: string }`
  - `interface Schedule { year: number; games: ScheduleGame[] }`
  - `ScheduleSchema`
  - `parseSchedule(rows: Iterable<Record<string, string>>, year: number): Schedule`. It keeps rows where `season === String(year)` and `game_type === 'REG'`, and puts team codes through `normalizeTeam`.
- Produces in web: `hasSchedule(year): boolean` and `loadSchedule(year): Promise<Schedule>`. These are glob-imported and cached the same way as `loadCharts`.

- [ ] **Step 1: Write failing tests:**
  - `'parses regular-season games of the year, normalising team codes'`: rows for 2026 REG week 8 `LA` at `SF`, 2026 POST, and 2025 REG. Expect `{ year: 2026, games: [{ week: 8, home: 'SF', away: 'LAR' }] }`.
  - `'the result parses with ScheduleSchema'`.
- [ ] **Step 2: Run** `pnpm --filter @fantasy-dash/core test -- schedule`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `schedule.ts`.
  - Sync `schedulePhase(leagues)`: fetch `https://github.com/nflverse/nfldata/raw/master/data/games.csv` once. For each league season, write `data/schedule/{year}.json` through the same staging pattern `chartsPhase` uses.
  - A download failure logs and keeps the old files.
  - `--dry-run` writes to a temporary directory.
  - Add the web loader.
- [ ] **Step 4: Run** `pnpm --filter @fantasy-dash/core test && pnpm typecheck && pnpm typecheck:scripts`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Schedule: nflverse regular-season games per season, synced with the players`.

---

### Task 2: Compare maths (pure functions)

**Files:**
- Create in `packages/web/src/lib/compare/`:
  - `url.ts`
  - `summary.ts`
  - `leaders.ts`
  - `advanced.ts`
- Test: one colocated test file per module above.

**Interfaces:**
- Consumes: `PlayerDb`, `Schedule` (Task 1), `GradedCard` / `GradedTile` (`lib/grades/grade.ts`), `Group` / `GROUPS` (`lib/grades/defs.ts`), `defenseRanks` (`lib/matchups/difficulty.ts`).
- Produces:
  ```ts
  // url.ts
  export type PosGroup = 'QB' | 'RB' | 'WRTE';
  export const groupOf: (pos: string) => PosGroup | null;            // WR and TE both map to 'WRTE'; K/DEF map to null
  export interface CompareState { season: number; pos: PosGroup; ids: string[] }
  export function parseCompare(search: URLSearchParams, seasons: number[], db: PlayerDb | null): CompareState;
  export function compareHref(s: CompareState): string;              // '/players/compare?season=…&pos=…&p=…' (p omitted when empty)
  // summary.ts
  export interface GameRow { week: number; opp: string; home: boolean | null; pts: number }
  export interface PlayerSummary { games: number; total: number; avg: number | null; floor: number | null; ceil: number | null; cv: number | null; bins: number[]; last5: GameRow[]; team: string }
  export function playerSummary(db: PlayerDb, id: string, schedule: Schedule | null): PlayerSummary;
  export interface NextGame { week: number; opp: string | null; home: boolean; tone: 'easy' | 'mid' | 'hard' | null; rank: number | null; of: number | null }
  export function nextFive(db: PlayerDb, schedule: Schedule | null, team: string, pos: string): NextGame[] | null;  // null = hide the row
  // leaders.ts
  export function leaders(values: (number | null)[], lowerIsBetter?: boolean): boolean[];  // all false when fewer than 2 non-null; ties all true
  // advanced.ts
  export type Bucket = 'All' | Group | string;                       // a Group or a card title
  export interface AdvancedRow { card: string; key: string; label: string; style: boolean; cells: GradedTile[]; lead: boolean[] }
  export function advancedRows(cardsPerPlayer: (GradedCard[] | null)[], bucket: Bucket): { rows: AdvancedRow[]; leads: number[]; contested: number };
  export function bucketsFor(cards: GradedCard[]): Bucket[];         // ['All', ...GROUPS present, ...card titles]
  ```
- Rules:
  - `parseCompare` drops unknown ids, ids not in `db.players`, ids whose `groupOf(pos)` differs, and duplicates, then keeps the first 4.
  - `advancedRows` uses the first non-null card set to define the rows.
  - `leads[i]` counts the rows where player *i* leads. `contested` counts rows where a leader exists.
  - A row's `lead` comes from `leaders(cells.map(t => t.status === 'ranked' && !t.style ? t.pct : null))`.

- [ ] **Step 1: Write failing tests:**
  - `url.test.ts`:
    - `'round-trips state'`
    - `'drops unknown, wrong-position, duplicate ids and keeps four'`
    - `'falls back to RB and the newest season'`
    - `'WR and TE share a group'`
  - `summary.test.ts`:
    - `'floor and ceiling are 2nd lowest and 2nd highest with 5+ games'` (scores 3, 8, 12, 20, 31 → floor 8, ceil 20, avg 14.8)
    - `'min and max under 5 games'`
    - `'only games played count'`
    - `'bins: 5-point, 45+ last, negatives first'`
    - `'cv = sd / avg'`
    - `'no games: zeros and nulls, no NaN'` (Review Focus 1)
    - `'last5 newest first with home/away from the schedule'`
    - `'team is his latest row's team after a trade'` (Review Focus 3)
  - `nextFive` tests:
    - `'five weeks after throughWeek with a bye'`
    - `'stops at week 18'`
    - `'null when no week is left or no schedule'`
    - `'tone and rank from defenseRanks'`
  - `leaders.test.ts`:
    - `'highest leads, ties all lead'`
    - `'lower is better'`
    - `'fewer than two values: nobody leads'`
  - `advanced.test.ts`:
    - `'rows follow card order and the bucket'`
    - `'style rows never lead'`
    - `'unranked cells are ignored for the lead'`
    - `'leads and contested count visible rows only'`
    - `'buckets list All, the groups present, then card titles'`
- [ ] **Step 2: Run** `pnpm --filter web test -- compare`. Expected: FAIL.
- [ ] **Step 3: Implement** the four modules.
- [ ] **Step 4: Run** `pnpm --filter web test -- compare && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Compare: URL state, player summaries, next five, leaders and advanced rows`.

---

### Task 3: Player picker combobox

**Files:**
- Create: `packages/web/src/components/compare/PlayerSlot.tsx`
- Test: `packages/web/src/components/compare/PlayerSlot.test.tsx`

**Interfaces:**
- Produces: `<PlayerSlot index={0..3} db={PlayerDb} pos={PosGroup} value={string | null} taken={string[]} onPick={(id: string | null) => void} />`.
- Behaviour:
  - Label `Player A–D`, with a colour dot `var(--slot-i)`.
  - Empty: an `input` with `role="combobox"`, `aria-expanded` and `aria-controls` pointing to a `listbox`. It suggests up to 8 players in the group who have rows that season, excluding `taken`.
    - Sorted by season points, highest first, and filtered by a case-insensitive substring of the name.
    - Each option shows `Headshot`, name, `PosPill`, team and points.
    - Keys: ArrowDown/ArrowUp move, Enter picks, Escape closes.
  - Filled: shows the name and team with a ✕ button (`aria-label="Remove <name>"`), which calls `onPick(null)`.

- [ ] **Step 1: Write failing tests:**
  - `'suggests the group's players by points, excluding taken'`
  - `'typing filters by name'`
  - `'arrow keys and Enter pick'`
  - `'Escape closes'`
  - `'✕ clears'`
  - `'a TE is offered in WR/TE'`

  Use `miniDb()` from `src/test/playerDbFixtures.ts`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter web test -- PlayerSlot`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Compare: accessible player picker`.

---

### Task 4: Controlled chart cards

**Files:**
- Create: `packages/web/src/lib/charts/controls.ts`
- Modify: `components/charts/Field.tsx` (`ChartCard` gets `bare?: boolean`, which hides the season picker and controls), and `RunLanes.tsx`, `RouteTree.tsx`, `TargetMap.tsx`, `PassingZones.tsx`, `PressureCard.tsx`
- Test: extend each chart's test file with one controlled-mode case

**Interfaces:**
- Produces in `controls.ts`:
  ```ts
  export type ChartKind = 'lanes' | 'routes' | 'targets' | 'zones' | 'pressure' | 'throws';
  export interface ChartControls { label: string; filterLabel: string | null; filters: [string, string][]; metrics: [string, string][] }
  export const CHART_CONTROLS: Record<ChartKind, ChartControls>;   // the option lists the components use today, moved here
  export const CHARTS_BY_GROUP: Record<PosGroup, ChartKind[]>;     // QB: zones, pressure, throws · RB: lanes, routes, targets · WRTE: routes, targets
  export interface ChartControl { year: number; filter: string; metric: string }
  ```
- Each chart component gets an optional `control?: ChartControl` prop.
  - When it's set: the year, filter and metric come from props, `ChartCard` renders `bare`, and the card still shows the greyed empty state when that year has no data for him.
  - `throws` is `RouteTree` with `pos="QB"`.
  - The components import their option lists from `CHART_CONTROLS`, so the shared bar and the cards can't drift apart.

- [ ] **Step 1: Write failing tests.** For each of the five components, add `'controlled: no season picker or controls, props drive the filter and metric'`. For example, RunLanes with `control={{ year: 2025, filter: 'heavy', metric: 'ypc' }}` has no combobox, and only shows the heavy-box lanes with Yds/carry values. Add `'controlled to a year with no data shows the empty note'`.
- [ ] **Step 2: Run** `pnpm --filter web test -- charts`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter web test && pnpm typecheck`. Expected: PASS, and the existing chart tests are unchanged.
- [ ] **Step 5: Commit** with the message `Charts: controlled mode and a shared registry of chart controls`.

---

### Task 5: Compare page

**Files:**
- Create: `packages/web/src/pages/ComparePage.tsx`, and in `packages/web/src/components/compare/`:
  - `PlayersTabs.tsx`
  - `CompareCard.tsx`
  - `ScoreHistogram.tsx`
  - `AdvancedTable.tsx`
  - `CompareCharts.tsx`
- Modify:
  - `packages/web/src/routes.tsx`: add `players/compare` with `compareLoader`, before `players/:season`.
  - `pages/PlayersPage.tsx`: render `PlayersTabs` at the top.
  - `index.css`: add `--slot-0..3` for dark and light, and the Tailwind colour aliases.
- Test: `packages/web/src/pages/ComparePage.test.tsx`, plus a test for each component in `components/compare/`.

**Interfaces:**
- Consumes everything from Tasks 1–4, plus `gradeCards` (`lib/grades/grade.ts`), `defenseRanks`, `Headshot` and `PosPill`.
- Loader data:
  `compareLoader({ request }): Promise<{ years: number[]; season: number; db: PlayerDb | null; chart: ChartDb | null; schedule: Schedule | null }>`
  - `years` are the seasons that pass `hasPlayerDb`.
  - `season` comes from `?season=`, falling back to the newest.
- Page state lives in the URL. Picks, removals, position and season changes all call `navigate(compareHref(...), { replace: true })`. Bucket and chart choice are local state.
- **Layout, in order** (see the spec and the mockup `compare-v2.html`):
  1. `PlayersTabs`: `Database` links to `/players/<season>`, `Compare` to `/players/compare`, styled like `StatsTabs`.
  2. Position pills (QB · RB · WR/TE) and the season `SeasonPicker`.
  3. Four `PlayerSlot`s.
  4. An empty prompt when no slot is filled: "Pick up to four players to compare".
  5. `CompareCard` × n. Grid of 4/2/1 columns at xl/md/base. Each has its slot-colour gradient, Floor/Average/Ceiling with leader boxes, a `ScoreHistogram`, CV, Last 5 and Next 5.
  6. `AdvancedTable`: bucket pills, the leads line, and a table with the stat column `sticky left-0` inside an `overflow-x-auto` box. Cells have the percentile fill gradient and the `84th` text, and leaders get a gold outline and ▲.
  7. `CompareCharts`: chart-kind pills (`CHARTS_BY_GROUP`) and a shared bar built from `CHART_CONTROLS`. Below that, each player's chart in a header strip in his colour. Run lanes go one per row, the others two per row from `lg`. Then the credit line.

- [ ] **Step 1: Write failing tests:**
  - ComparePage:
    - `'empty slots show the prompt and no sections'`
    - `'two players render two cards, the advanced table and the charts'`
    - `'picking a player updates the URL'`
    - `'changing position clears the players'`
  - CompareCard:
    - `'floor/avg/ceiling leaders get the gold box'`
    - `'next five hidden for a finished season'`
    - `'0G card shows dashes'`
  - AdvancedTable:
    - `'bucket pills filter rows and the leads line follows'`
    - `'leader cell has the gold outline and ▲'`
    - `'percentile text reads 84th'`
  - CompareCharts:
    - `'kinds follow the position group'`
    - `'one filter change reaches every player's chart'`
    - `'credit line present'`
  - PlayersPage: `'shows Database and Compare tabs'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Players: Compare tab with player cards, advanced leaders and side-by-side charts`.

---

### Task 6: Player-page touches

**Files:**
- Modify:
  - `components/player/grades/GradeCard.tsx`: drop the question line.
  - `lib/grades/defs.ts`: drop the `question` field from `CardDef` and every card. Relabel `in10Share` to `'Team carries inside the 10'`.
  - `lib/grades/grade.ts`: drop `question` from `GradedCard`.
  - `components/player/PlayerHeader.tsx`: add an optional `compareHref` prop that renders a "Compare" link button.
  - `pages/PlayerPage.tsx`: pass `compareHref({ season: <his newest db year>, pos: groupOf(bio.pos)!, ids: [id] })` when `groupOf(bio.pos)` is set.
- Test: update `GradesSection.test.tsx` and `grade.test.ts` where they reference questions. Add to `PlayerPage.test.tsx`.

- [ ] **Step 1: Write failing tests:**
  - `'grade cards show no question line'`: `queryByText('What does a carry earn?')` is null.
  - `'RB in10 tile reads Team carries inside the 10'`.
  - PlayerPage:
    - `'a WR page links to Compare with him in slot A'`: the href equals `/players/compare?season=2026&pos=WRTE&p=w1`.
    - `'a kicker page has no Compare button'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Player page: Compare button; grade cards lose their questions; clearer inside-10 label`.

---

### Task 7: Data and visual check

- [ ] **Step 1:** Run `pnpm sync:players --charts-only`. Expected: the log shows the schedule phase writing `data/schedule/2023.json`…`2026.json`. Then check the data:
  ```bash
  node -e "const s=require('./data/schedule/2026.json'); console.log(s.games.length, s.games.find(g=>g.week===8&&(g.home==='ATL'||g.away==='ATL')))"
  ```
  Expected: 272 games, and ATL's week-8 game against TB.
- [ ] **Step 2:** Run `pnpm test && pnpm typecheck && pnpm build`. Expected: all PASS.
- [ ] **Step 3:** Run the dev server. Open `/players/compare?season=2026&pos=RB&p=9509,3198,4034,9221` at 1440px and 360px. Check:
  - The numbers match the mockup: Henry's average is about 17.5, and Bijan's next 5 is @TB, CIN, KC, BYE, @MIN.
  - The probe confirms no horizontal page scroll at 360px (Review Focus 5).
  - A 2025 comparison shows route trees.
  - The QB group shows passing zones.
- [ ] **Step 4: Commit** with the message `Data: NFL schedules`.
