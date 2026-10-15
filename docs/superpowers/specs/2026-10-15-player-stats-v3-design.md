# Player stats v3: season pickers, per-game modes, postseason moments, Extras expansion

Date: 2026-10-15. Builds on `2026-10-14-player-stats-v2-design.md` and the row-scoped expand / mode toggle work merged as `1a73621`.

## Goal

Let every section of the Player stats page be read for one season or for all time, add per-game readings to volume boards, add best and worst single-week postseason starts, and grow Extras into a set of story boards (loyalty, trades, waivers, breakouts) backed by two new per-season data sets: league transactions and NFL-wide player season totals.

## Data (sync, core, schema)

### `Season.transactions`

The sync already downloads every week's transactions but keeps only trades. It now keeps every transaction with `status === 'complete'`, resolved to managers:

```ts
export type TransactionType = 'trade' | 'waiver' | 'free_agent' | 'commissioner';
export interface TransactionMove { playerId: PlayerId; userId: UserId }
export interface Transaction {
  id: string;
  type: TransactionType;   // any other Sleeper type is kept as 'commissioner'
  week: number;            // Sleeper `leg`
  created: number;         // epoch ms
  adds: TransactionMove[]; // player -> receiving manager
  drops: TransactionMove[];// player -> releasing manager
  /** FAAB dollars for a waiver claim; null otherwise */
  bid: number | null;
}
```

- `SleeperTransaction` gains `settings: { waiver_bid?: number; seq?: number } | null`.
- Core: `transactionsOf(raw: SleeperTransaction[], rosterToUser): Transaction[]`, sorted by `created` then `id`. Roster ids with no user are dropped from adds/drops; a transaction left with no adds and no drops is dropped.
- `RawSeasonInput.trades` is replaced by `transactions: SleeperTransaction[]`; `tradesFromTransactions` keeps working from the same input (trades filtered inside `buildSeason`).
- Zod schema and `Season` type gain `transactions: Transaction[]`.

### `Season.playerSeasons`

NFL-wide season totals under league scoring, for every player with at least one game, so breakout and fall-off boards can see players in weeks they were unrostered.

```ts
export interface PlayerSeasonLine {
  points: number;   // weeks 1..lastScoredWeek, league scoring
  games: number;    // weeks with gp >= 1
  /** rank among players at the same position by points, 1 = best; null for position '?' */
  posRank: number | null;
}
// Season.playerSeasons: Record<PlayerId, PlayerSeasonLine>
```

- Built in `buildSeason` from `playerSeasonPoints` and `playerGames` (already in `RawSeasonInput`), position from the directory with the same override used for draft grading.
- `posRank` ties: equal points share the higher rank by `playerId` asc (deterministic).
- Zod schema and `Season` type gain the field.

### Re-sync

Run `pnpm sync` for 2023–2026 after the core change; commit the regenerated `data/seasons/*.json`. The sync's completeness assertions stay. Fixture helper `season()` in `packages/web/src/test/playerFixtures.ts` defaults `transactions: []` and `playerSeasons: {}`.

## Page structure

### Sections

| id | title | picker | default | URL params |
|----|-------|--------|---------|------------|
| `leaders` | League leaders | years + All-time | current season | `lead` (pos), `season` |
| `career` | Career | years + All-time | All-time | `career` (pos), `careerSeason` |
| `postseason` | Postseason | none | — | `post` (pos) |
| `extras` | Extras | years + All-time | All-time | `extra` (pos), `extrasSeason` |

- The All-time section is renamed **Career**; its id, anchor and position param change from `allTime`/`all` to `career`. Old `?all=` links are ignored.
- `SeasonPicker` accepts `years`, `value: number | 'all'`, `onChange`, and `allTime?: boolean` which adds an "All-time" option at the top. Existing callers are unchanged.
- URL: a year param is omitted when it equals the section default; `all` is written as `all`. Junk falls back to the default.
- Section note under the title reflects the choice: "2025 season" or "Every season".

### BoardContext

```ts
export interface BoardContext {
  lines: PlayerLine[];       // already narrowed to the section's position AND season
  players: PlayerDirectory;
  champions: Record<number, UserId | null>;
  lastPlaces: Record<number, UserId | null>;
  /** chosen season, or null for All-time */
  year: number | null;
  /** newest season in the data; for in-season notes */
  currentYear: number;
  pos: PosFilter;
  picks: DraftValue[];                 // all seasons; boards filter by `year`
  xfp: XfpModel | null;
  transactions: SeasonTransactions[];  // { year, transactions } for every season
  playerSeasons: Record<number, Record<PlayerId, PlayerSeasonLine>>;
  drafts: Record<number, Draft | null>;
}
```

- `leaderBoard` no longer filters by `currentYear`; it ranks whatever lines it is given. Manager shown is the latest roster across the lines.
- Row meta for aggregate rows: `String(ctx.year)` when a year is chosen, else `seasonsOf(lines)` ("3 seasons"). Postseason boards keep the years list.
- Per-game minimum: `minGames(ctx) = ctx.year === null ? 12 : 3`. Every per-game or PPG mode uses it; `empty` copy says the number. Postseason PPG keeps 3.

### Modes and toggles

| board | modes | headers |
|-------|-------|---------|
| Most points (leaders) | Total / PPG | Pts / PPG |
| Most yards | Total / Per game | Yds / Yds/G |
| Most touches | Both / Rec / Car, plus Total / Per game | Touches, Rec, Car; `/G` suffix per game |
| xFP | Total / Per game | xFP / xFP/G |
| Best season by a starter | Total / PPG | Pts / PPG (PPG over played starts, min 3) |
| Most career points started | Total / PPG | unchanged |
| Draft value (Extras) | sortable: **+** / **−** | Value |

- A board may carry two independent toggles: `modes` (first group) and `modes2` (second group). `compute(ctx, direction, mode, mode2)`. Section stores both per board. Only Most touches uses `modes2`.
- Per-game value = total / played games (lines with `played`), rounded to 1 dp, `fmtPpg`.
- Direction toggle labels come from `BoardDef.directionLabels?: [string, string]` (default Over / Under; draft value uses `['+', '−']`, FPOE keeps Over / Under).

### Colour coding

`BoardRow.tone?: 'win' | 'loss'`. Board renders the value with `text-win` or `text-loss` when set. Set by FPOE (sign of value) and draft value (sign of value); zero has no tone.

### Championship rosters ordering

Count stays the value. Ties break by postseason points scored while on that champion's roster that year (starters and bench, bracket games), descending, then newest year, then playerId. That points total is the row detail: "187.70 pts". `careerBoard` gains an optional `secondary: (ls) => number` used by `rank` before the year tiebreak.

## New boards

### Postseason

Grid order: Most postseason points started · Most postseason starts / Most postseason touchdowns · Most postseason yards / Most postseason receptions · **Best playoff starts** / Most championship rosters · Most toilet bowl starts / **Worst toilet bowl starts** · Most last place rosters.

- **Best playoff starts**: one row per started line in bracket games (QF, SF, Final, 3rd, 5th), highest points first, meta "2025 · Wk 17 · Championship", manager and box-score link. Modes: All rounds / Final (Final only).
- **Worst toilet bowl starts**: one row per started, played line in consolation games (Cons-R1, Toilet Bowl, Cons-7th), lowest points first. Modes: All consolation / Toilet Bowl (the last-place game only). Header "Pts".

### Extras

Grid (2 columns): Most 30-point starts · Most dud starts / **Biggest bench blunder** (moved from Career) · **Bench warmers** / Journeyman · **Loyalty** / **Ironman** · **Fodder** / **Trade bait** · **Waiver heroes** / **Waiver villains** · **Draft value** / **Mr. Irrelevant** · **Biggest breakout** / **Biggest fall-off**.

Every Extras board respects the section's season (lines, picks, transactions and playerSeasons narrowed to the year; All-time uses everything). Boards that compare two seasons (breakout, fall-off) treat the chosen year as the *later* season.

- **Bench warmers**: career points scored while benched (`!started`), detail "N weeks benched". Header Pts.
- **Loyalty**: most starts for a single manager. Value = max starts with one manager; `userId` = that manager (shown with avatar); detail "of N starts". Kickers and defenses excluded.
- **Ironman**: longest run of consecutive league weeks started, any manager, carrying across seasons (week after the last played week of a season continues into week 1 of the next); a week not started, or on no roster, ends the run. Value = weeks; meta the span "2024 Wk 3 – 2025 Wk 9"; detail "active" when the run reaches the latest scored week. Kickers and defenses excluded.
- **Trade bait**: number of completed trades that moved the player. Detail "N managers" (distinct receiving managers). Header Trades.
- **Fodder**: number of times dropped (any transaction type with the player in `drops`). Detail "picked up N times". Header Drops.
- **Waiver heroes**: points started for the claiming manager after a waiver claim, per claim; value = points, detail "$bid · N starts", meta "2025 · Wk 4", userId the claimer. One row per claim; started lines are those by the claiming manager from the claim week until the player leaves that roster (next drop/trade by that manager, or season end). Header Pts. Minimum bid $1.
- **Waiver villains**: FAAB dollars per started point for the same claims, highest first; value = `bid / max(points, 1)` rounded 1 dp, label "$12.5/pt"; detail "$bid · points pts · N starts". Claims with bid ≥ $10 only.
- **Draft value**: year chosen → that draft's `value` per pick (meta year, detail "Rd 3, pick 28"). All-time → each player's best single-season value, meta that year, same detail. Sortable + / −, tone by sign.
- **Mr. Irrelevant**: the last QB/RB/WR/TE pick of each draft. Value = that season's points (from `playerSeasons`), label fmtPts, meta year, detail "QB18 · 11.2 ppg · Rd 15, pick 150", userId the drafter. Sorted by points desc. All-time lists every season; a year lists that season's pick. A season with no draft is skipped.
- **Biggest breakout**: players with ≥ 10 games in both season Y−1 and Y (from `playerSeasons`), QB/RB/WR/TE only, ranked by PPG gain `ppg(Y) − ppg(Y−1)`. Value = gain, label `fmtSigned(v, 1)`, meta "2024 → 2025", detail "WR41 · 8.1 ppg → WR6 · 17.9 ppg · 268.5 pts". All-time considers every consecutive pair; a year uses the pair ending in that year. Rows need no league roster history.
- **Biggest fall-off**: same population, ranked by PPG loss (most negative first), value negative, label `fmtSigned`.

Journeyman stays as is (distinct managers who started the player).

## Components

- `Section`: owns `mode2` state like `mode`; passes picker `allTime` flag; shows the season note.
- `Board`: second `Toggle` for `modes2`; value tone; direction labels from def; the box-score link and manager row unchanged.
- `PlayersView`: three pickers, URL params per the table, narrows lines/picks/transactions/playerSeasons per section before building `ctx`.
- `SeasonPicker`: `allTime` option.
- `lib/playerBoards.ts` grows past 400 lines; split: `lib/boards/{shared,leaders,career,postseason,extras}.ts` with `lib/playerBoards.ts` re-exporting `BOARDS` and types. Tests follow the files.
- New `lib/ironman.ts` (streak over lines) and `lib/waivers.ts` (claim windows from transactions and lines) with their own tests.

## Testing

- Core: `transactionsOf` (types, bid, unresolved roster, empty), `playerSeasons` (rank ties, position override, zero-game exclusion), schema round-trip of a season with both new fields.
- Web lib: every new board on the shared fixture plus small fixtures for transactions and playerSeasons; per-game minimum switching with `year`; championship tiebreak; draft value by year vs all-time; direction labels; tone.
- Components: picker with All-time, URL round-trip for the three season params, second toggle, tone classes, Career rename and anchor.
- Real-data probe script in the scratchpad after re-sync, before review.

## Out of scope

Journeyman path graphic (dropped), transactions on any page other than Player stats, Postseason season picker.
