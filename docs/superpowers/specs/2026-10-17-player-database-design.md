# Player database — design

Date: 2026-10-17. Brainstormed with Mathias; every section below was approved in conversation. Sits beside the Stats page work (`2026-10-17-stats-managers-design.md`), which is being built in another branch and will later gain a visual Players tab that reads the data this spec creates.

## Goal

A **Players** tab: one dense, sortable, colour-coded table of every fantasy-relevant NFL player (QB, RB, WR, TE) for a season and week range, with basic counting stats and the advanced usage and efficiency metrics (snap share, route share, YPRR, target share, air yards, EPA, CPOE, separation, RYOE, xFP, FPOE and more). It is a raw reference table, not a chart page. Its second purpose is to build the per-player weekly data set that the Stats page will draw from later.

Today the app keeps ~28 Sleeper stat keys per rostered player-week and nothing for unrostered players. The sync already downloads every NFL player's weekly Sleeper row and discards most of it.

## Decisions made in brainstorming

- **Sources**: Sleeper weekly stats as the base, nflverse data files layered on top, downloaded straight from GitHub releases. No API keys, no new runtime dependency. nfldata.org (a one-person JSON mirror of nflverse) was considered and rejected as a dependency.
- **Placement**: own top-level nav tab **Players** at `/players`, not a tab of the Stats page.
- **Population**: every NFL QB/RB/WR/TE with a stat line that season (~600 players), with the league manager who rosters him, or FA. Kickers and defenses are out of scope.
- **Granularity**: one row per player per week stored; the table shows any week range, totals or per game.
- **Pipeline**: a separate `scripts/syncPlayers.ts` run after the Sleeper sync in the same workflow, so a nflverse failure can never block league data.
- **Routes run** are not published for the current season by any free source (the NFL releases its participation feed after the season: the 2025 file was last updated 2026-02-10). Past seasons get real routes; the current season gets an estimate from snap share, marked as such.
- **xFP / FPOE** added at Mathias's request, as a new per-position opportunity model fitted on the full NFL population.

## Data sources

All per season, 2023 to the current year (the league's seasons). Files are fetched with plain `fetch` and streamed through a small CSV parser in core; gzip files are inflated with `node:zlib`.

| Source | URL pattern | Key | Fields used |
|---|---|---|---|
| Sleeper weekly stats | `https://api.sleeper.com/stats/nfl/{year}/{week}?season_type=regular` (already called by the Sleeper sync) | Sleeper `player_id` | `gp gs off_snp tm_off_snp pass_att pass_cmp pass_yd pass_td pass_int pass_sack pass_sack_yds pass_air_yd pass_fd pass_rz_att pass_cmp_40p pass_rtg pass_ypa pass_2pt rush_att rush_yd rush_td rush_fd rush_rz_att rush_btkl rush_yac rush_tkl_loss rush_40p rush_2pt rec rec_tgt rec_yd rec_td rec_fd rec_air_yd rec_yar rec_drop rec_rz_tgt rec_40p rec_20_29 rec_30_39 rec_2pt fum fum_lost pts_ppr pos_rank_ppr`; the `player` block for name, position, team and `team`/`opponent` per row |
| Sleeper projections | `https://api.sleeper.app/v1/projections/nfl/regular/{year}/{week}` (already called) | Sleeper id | projected points under league scoring |
| nflverse weekly stats | `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{year}.csv` | `player_id` = gsis | `passing_epa passing_cpoe pacr passing_yards_after_catch sacks_suffered rushing_epa receiving_epa receiving_yards_after_catch racr target_share air_yards_share wopr receiving_first_downs rushing_first_downs passing_first_downs` |
| Next Gen Stats receiving | `.../nextgen_stats/ngs_receiving.csv.gz` (all seasons in one file; week 0 rows are season totals and are skipped) | `player_gsis_id` | `avg_cushion avg_separation avg_intended_air_yards percent_share_of_intended_air_yards avg_yac avg_expected_yac avg_yac_above_expectation` |
| Next Gen Stats rushing | `.../nextgen_stats/ngs_rushing.csv.gz` | gsis | `efficiency percent_attempts_gte_eight_defenders avg_time_to_los expected_rush_yards rush_yards_over_expected rush_yards_over_expected_per_att rush_pct_over_expected` |
| Next Gen Stats passing | `.../nextgen_stats/ngs_passing.csv.gz` | gsis | `avg_time_to_throw avg_completed_air_yards avg_intended_air_yards avg_air_yards_differential aggressiveness avg_air_yards_to_sticks expected_completion_percentage completion_percentage_above_expectation` |
| PFR advanced receiving | `.../pfr_advstats/advstats_week_rec_{year}.csv` | `pfr_player_id` | `receiving_broken_tackles receiving_drop receiving_drop_pct receiving_int receiving_rat` |
| PFR advanced rushing | `.../pfr_advstats/advstats_week_rush_{year}.csv` | pfr | `rushing_yards_before_contact rushing_yards_after_contact rushing_broken_tackles` |
| PFR advanced passing | `.../pfr_advstats/advstats_week_pass_{year}.csv` | pfr | `passing_bad_throws passing_bad_throw_pct times_pressured times_pressured_pct times_blitzed times_hurried times_hit passing_drops passing_drop_pct` |
| Snap counts | `.../snap_counts/snap_counts_{year}.csv` | pfr | `offense_snaps offense_pct` (fallback when Sleeper has no `off_snp`) |
| Participation | `.../pbp_participation/{year}.csv` (finished seasons only; 50 MB each) | gsis ids in `offense_players` | routes run: a pass play is a row with a non-empty `time_to_throw`; a player ran a route when his gsis id is in `offense_players` on such a play and his position is RB, WR or TE. Team dropbacks come from the weekly stats instead (see below) so the number is defined for every season. |
| nflverse players | `.../players/players.csv` | gsis | `birth_date draft_year draft_round draft_pick college_name height weight rookie_season headshot` |
| DynastyProcess ids | `https://github.com/dynastyprocess/data/raw/master/files/db_playerids.csv` | `sleeper_id` → `gsis_id`, `pfr_id` | the crosswalk |

**Crosswalk**: every row starts from a Sleeper id. `db_playerids.csv` resolves it to gsis and pfr ids for every fantasy-relevant player (checked 2026-10-17: 5,405 QB/RB/WR/TE rows, all with both ids; the 73 active Sleeper players it lacks are practice-squad names). Fallback for a missing id: match `normalize(name) + position + team` against `players.csv` (gsis) and the snap-count file (pfr), where `normalize` lower-cases, strips punctuation and the suffixes Jr, Sr, II, III, IV. A player who still has no gsis id keeps his Sleeper fields and gets `null` for every nflverse field; the sync logs the count.

**Week scope**: weeks 1..`lastScoredWeek` of the Sleeper league season for the current year; weeks 1..18 of the regular season for finished years (the league's fantasy weeks never go past 18, and NGS/PFR files are regular season only). Postseason NFL games are excluded everywhere.

## Output file: `data/playerdb/{year}.json`

Validated with zod (`PlayerDbSchema`) like the season files. Nulls are omitted from rows to keep the file small (about 10k rows, 1.5–2.5 MB per season before gzip). Loaded lazily by the Players page only.

```ts
export type DbPos = 'QB' | 'RB' | 'WR' | 'TE';

export interface PlayerDb {
  year: number;
  /** last week with rows; equals the league's lastScoredWeek in season, 18 when finished */
  throughWeek: number;
  /** true once routes come from the participation feed; false while they are estimated */
  routesReal: boolean;
  /** ISO timestamp of the build */
  builtAt: string;
  players: Record<PlayerId, DbPlayer>;
  teamWeeks: TeamWeek[];
  xfp: XfpCoefficients;
  rows: PlayerWeek[];
}

export interface DbPlayer {
  id: PlayerId;               // Sleeper id (the key used everywhere else in the app)
  gsisId: string | null;
  pfrId: string | null;
  name: string;
  pos: DbPos;                 // Sleeper position with league.config positionOverrides applied
  teams: string[];            // every team he had a row for this season, in week order
  birthDate: string | null;   // YYYY-MM-DD
  yearsExp: number | null;
  draft: { year: number; round: number; pick: number } | null;
  college: string | null;
  height: number | null;      // inches
  weight: number | null;      // pounds
}

/** One NFL team's offensive volume in one week, summed from every player's row for that team. */
export interface TeamWeek {
  team: string; week: number; opp: string;
  offSnaps: number;           // max tm_off_snp over the team's players
  passAtt: number; rushAtt: number;
  dropbacks: number;          // passAtt + sacks taken
  rzLooks: number;            // rush_rz_att + rec_rz_tgt summed over players
  airYds: number;             // pass_air_yd summed over the team's passers
  passPlays: number | null;   // from participation when real, else null
}

/** Per-position OLS coefficients, feature order documented in `XFP_FEATURES` */
export type XfpCoefficients = Record<DbPos, number[] | null>;
```

`PlayerWeek` is flat with prefixed short keys. Every field but `id`, `week`, `team`, `gp` is optional (absent = null).

| Key | Source | Meaning |
|---|---|---|
| `id week team opp gp gs` | Sleeper | identity; `gp` games played (0/1), `gs` started |
| `pts proj ppr posRankPpr` | Sleeper + league scoring | league points via `scoreStats`, Sleeper projection scored the same way, Sleeper's PPR points and PPR position rank |
| `xfp` | model | expected league points from opportunity (below) |
| `snaps teamSnaps` | Sleeper (`off_snp`, `tm_off_snp`), snap counts fallback | offensive snaps, team offensive snaps |
| `routes routesEst` | participation / estimate | real routes when `routesReal`; otherwise `routesEst = round(snaps / teamSnaps × dropbacks)` and `routes` is absent |
| `pa_att pa_cmp pa_yds pa_td pa_int pa_sack pa_sackYds pa_air pa_fd pa_rz pa_cmp40 pa_rtg pa_2pt` | Sleeper | passing counting stats |
| `pa_epa pa_cpoe pa_pacr pa_yac` | nflverse | passing EPA, completion % over expected, passing air conversion ratio, passing yards after catch |
| `pa_ttt pa_iay pa_cay pa_aggr pa_ays pa_xcmp` | NGS passing | time to throw, intended air yards/att, completed air yards/att, aggressiveness %, air yards to sticks, expected completion % |
| `pa_bad pa_badPct pa_press pa_pressPct pa_blitz pa_hurry pa_hit pa_drops` | PFR passing | bad throws, pressure counts and rates, drops by receivers |
| `ru_att ru_yds ru_td ru_fd ru_rz ru_bt ru_yac ru_tfl ru_40 ru_2pt` | Sleeper | rushing counting stats; `ru_bt` broken tackles, `ru_yac` yards after contact (Sleeper), `ru_tfl` tackled for loss |
| `ru_epa ru_10 ru_20` | nflverse | rushing EPA, carries of 10+ and 20+ yards |
| `ru_ybc ru_yacPfr` | PFR rushing | yards before contact, yards after contact (PFR's count, kept for seasons where Sleeper's is empty) |
| `ru_xyds ru_ryoe ru_ryoeAtt ru_eff ru_box8 ru_tlos` | NGS rushing | expected yards, yards over expected, per attempt, efficiency, % of carries vs 8+ in box, time to line of scrimmage |
| `re_tgt re_rec re_yds re_td re_fd re_air re_yac re_drop re_rz re_20 re_40 re_2pt` | Sleeper (+ nflverse `receiving_yards_after_catch` when Sleeper's `rec_yar` is absent) | receiving counting stats; `re_20` = receptions of 20+ (`rec_20_29 + rec_30_39 + rec_40p`) |
| `re_epa re_racr re_tgtShare re_ayShare re_wopr` | nflverse | receiving EPA, RACR, nflverse's own shares and WOPR (kept for cross-checking; the table uses the sync's own shares) |
| `re_cush re_sep re_iay re_iayShare re_xyac re_yacoe` | NGS receiving | cushion, separation, intended air yards/target, share of team intended air yards, expected YAC/rec, YAC over expected/rec |
| `re_bt re_dropPfr re_dropPct re_int re_rtg` | PFR receiving | broken tackles after catch, drops, drop %, interceptions on targets, passer rating when targeted |
| `fum fumLost` | Sleeper | fumbles |

NGS rows exist only for weeks where the player met the NFL's qualifying minimum; those fields are absent otherwise. PFR rows exist for every player who appeared in the box score.

**Team weeks** are summed from the Sleeper rows of every player on the team that week (all positions, not only the four in the table), so `passAtt`, `rushAtt`, `rzLooks` and `airYds` are complete. `dropbacks = passAtt + Σ pa_sack`.

### xFP model

One ordinary-least-squares fit per position per season over every player-week with `gp = 1` and at least one opportunity, target = `pts`. Features (`XFP_FEATURES`):

- QB: `[1, pa_att, pa_air, pa_rz, ru_att, ru_rz]`
- RB, WR, TE: `[1, re_tgt, re_air, re_rz, ru_att, ru_rz]`

Missing features count as 0. The solver is the Gaussian elimination already in `packages/web/src/lib/xfp.ts`, moved into core (`packages/core/src/playerdb/ols.ts`) and shared; the web `xfp.ts` keeps its API by importing it. A position with fewer than 50 rows gets `null` coefficients and no `xfp` on its rows. `xfp` is stored per row rounded to 2 dp; `FPOE = pts − xfp`. The current season's model is refitted every sync, so early-season values move until the sample settles; the page's "?" popover says so.

## Derived metrics (computed in the browser over the selected week range)

All rates are **summed numerators over summed denominators** across the range, never averages of weekly rates. NGS per-game averages are weighted by that week's targets (receiving), carries (rushing) or attempts (passing), using only weeks where the field is present. Per game divides counting stats by weeks with `gp = 1` in the range.

| Column | Formula |
|---|---|
| Pts, PPG, Pos rank | Σ pts; Σ pts / G; rank of Σ pts within the tab's position and the same range |
| Proj± | Σ (pts − proj) over weeks with a projection |
| xFP, xFP/g, FPOE, FPOE/g | Σ xfp; / G; Σ (pts − xfp); / G |
| Snap % | Σ snaps / Σ teamSnaps |
| Routes, Route % | Σ routes (or routesEst); / Σ team dropbacks for the player's team-weeks |
| YPRR, TPRR, FDRR | Σ re_yds / routes; Σ re_tgt / routes; Σ re_fd / routes |
| Tgt %, Carry %, Opp % | Σ re_tgt / Σ team passAtt; Σ ru_att / Σ team rushAtt; (Σ re_tgt + Σ ru_att) / Σ (passAtt + rushAtt) |
| Air-yds %, WOPR | Σ re_air / Σ team airYds; 1.5 × Tgt % + 0.7 × Air-yds % |
| Dropbacks/g | Σ (pa_att + pa_sack) / G |
| RZ %, RZ touches | (Σ ru_rz + Σ re_rz) / Σ team rzLooks; Σ ru_rz + Σ re_rz |
| Catch %, YPT, YPR, aDOT, YAC/rec | rec/tgt; yds/tgt; yds/rec; air/tgt; yac/rec |
| Drop % | drops / (tgt) using Sleeper drops, PFR when Sleeper's is absent |
| YPC, YBC/att, YAC/att, BT/touch, Stuff % | yds/att; ybc/att; yac/att; (ru_bt + re_bt) / (att + rec); tfl/att |
| RYOE/att, 8+ box %, Separation, Cushion, YACOE | weighted averages as above |
| Cmp %, Y/A, aDOT (QB), CPOE, EPA/dropback, PACR, Bad throw %, Pressure %, Time to throw, Aggr % | cmp/att; yds/att; pa_air/att; weighted; Σ pa_epa / Σ (att + sacks); weighted; Σ bad / att; Σ press / Σ (att + sacks); weighted; weighted |
| EPA/tgt, Rush EPA, Rec EPA, Total EPA | Σ re_epa / Σ tgt; Σ ru_epa; Σ re_epa; Σ (pa_epa + ru_epa + re_epa) |
| Touches, Total yds, Total TD, FP/touch, FP/snap, FP/tgt, FP/route | ru_att + rec; pa_yds + ru_yds + re_yds; pa_td + ru_td + re_td; pts/touches; pts/snaps; pts/tgt; pts/routes |

**Sample minimums** (a rate cell below its minimum is dimmed and untinted; the minimum scales with the number of weeks in the range, `W`): targets 3·W, carries 5·W, routes 10·W, dropbacks 12·W, snaps 10·W. Columns with no denominator (counting stats, Σ EPA) have no minimum.

**Estimated routes** (`routesReal = false`): Routes, Route %, YPRR, TPRR, FDRR and FP/route cells show a ° mark after the number, and the column header tooltip reads "Estimated from snap share × team dropbacks until the NFL publishes participation data."

## Column sets

Every tab starts with the sticky lead block: `#` · headshot, name, team, position pill · manager avatar or "FA" · G · Pts · PPG · Pos rank · Proj±. Then the groups below, in this order. Column keys, labels, definitions, number formats, sort direction and the "lower is better" flag live in `lib/playerdb/columns.ts`.

**QB**
- Passing: Cmp, Att, Cmp %, Yds, Y/A, TD, INT, Sacks, Rtg
- Advanced: aDOT, Air yds, YAC, CPOE, EPA/db, PACR, Bad %, Press %, TTT, Aggr %, Deep (40+), RZ att
- Rushing: Car, Yds, TD, RZ car, Rush EPA
- Usage: Snaps, Snap %, Dropbacks/g
- Fantasy: xFP, xFP/g, FPOE, FPOE/g

**RB**
- Rushing: Car, Yds, YPC, TD, FD, 10+ (nflverse `rushing_10`), 20+, YBC/att, YAC/att, BT, BT/touch, RYOE/att, 8+ box %, Stuff %, Rush EPA, Fum
- Receiving: Tgt, Rec, Yds, TD, YPT, YAC/rec, Routes, Route %, YPRR, TPRR
- Usage: Snaps, Snap %, Carry %, Tgt %, Opp, Opp %, RZ touches, RZ %, WOPR, Touches/g
- Fantasy: xFP, xFP/g, FPOE, FPOE/g, FP/touch, FP/snap

**WR and TE** (one definition, shown on both tabs)
- Receiving: Tgt, Rec, Yds, TD, FD, Catch %, YPT, YPR, aDOT, Air yds, YAC, YAC/rec, YACOE, Drops, Drop %, 20+, Sep, Cush, RACR, Rec EPA, EPA/tgt
- Usage: Snaps, Snap %, Routes, Route %, Tgt %, AY %, WOPR, YPRR, TPRR, FDRR, RZ tgt, RZ tgt %
- Rushing: Car, Yds, TD
- Fantasy: xFP, xFP/g, FPOE, FPOE/g, FP/tgt, FP/route

**All**: lead block, then Touches, Total yds, Total TD, Snap %, Opp %, Total EPA, xFP, FPOE.

Lower-is-better columns (tint reversed): INT, Sacks, Bad %, Press %, Drops, Drop %, Stuff %, Fum, TTT, Cushion.

## Page

### Route and nav

- Nav: **Players** between Managers and Head to Head.
- `/players` → redirect to `/players/{currentSeason.year}`. `/players/:season` is the page. The `players` entry in `RETIRED_PATHS` is removed.
- Query params, all optional, omitted when at their default: `tab` (all|qb|rb|wr|te, default all), `from`, `to` (weeks, default 1 and `throughWeek`), `mode` (total|pg, default total), `roster` (all|rostered|fa|{userId}, default all), `sort` (column key), `dir` (asc|desc), `q` (search). Junk falls back to the default.
- Loader: `loadPlayerDb(year)` in `data/load.ts` (same `import.meta.glob` lazy pattern and cache as seasons) plus `loadSeason(year)` for managers, rosters and scoring. A year with no playerdb file renders "No player data yet for {year}" with the season picker still usable; an unknown year 404s like the team pages.

### Toolbar (sticky under the nav from `lg`)

Position tabs (All · QB · RB · WR · TE, the `PositionFilter` style) · `SeasonPicker` · week range: two selects From / To bounded by 1..`throughWeek`, plus chips **Last 4** and **Season** · Total / Per game toggle · roster filter select (All players, Rostered, Free agents, then one entry per manager in standings order) · search input (matches name, case-insensitive, debounced). On a phone the toolbar wraps onto several lines.

### Table

- Card with `overflow-x: auto`; lead block sticky left (`position: sticky` on the first cells, surface background), header rows sticky top. Headshots hidden below `sm`.
- Two header rows: group names spanning their columns, then column headers. A column header has `title` = its definition. Clicking sorts; first click descending for "more is better" columns and ascending for lower-is-better ones; second click flips. Default sort Pts descending. The sorted header carries an arrow.
- Clicking a group header collapses that group to a single narrow "▸ Passing" column; click again to expand. Collapsed groups are remembered per tab in `localStorage` (`playerdb.collapsed.{tab}`), wrapped in try/catch.
- 25 rows at a time with a **Show 25 more** button; the count line reads "Showing 25 of 212 · weeks 3–6 · 2026".
- Rows: `#` is the position in the current sort. Name cell: `Headshot`, name, team (the team of the last week in the range), `PosPill`. Manager cell: `Avatar` + `TeamLink` to `/teams/{year}/{userId}`, or muted "FA".
- Clicking a row toggles an expansion under it: a nested table of his weeks in the range with the same visible columns, week and opponent first, plus a totals row. Only one row expands at a time.
- Empty states: no rows under the filter → "No players match."; week range with `from > to` is clamped.

### Colour coding

For each tinted numeric column, the cell's percentile among the **visible rows** (same tab, range, mode, roster filter and search) sets a tint from `--loss` through transparent to `--win` at 45 % strength over the row surface (the draft board's value-tint approach), with normal ink on top. Lower-is-better columns reverse the gradient. Cells under their sample minimum, and absent values, get no tint and `text-muted`. Pts, PPG, Pos rank, G and the `#` column are never tinted. FPOE adds a sign-coloured number (`text-win` / `text-loss`) like the Extras boards. Dark and light tokens come from `index.css`.

### Roster attribution

`lib/playerdb/rosters.ts`: `rosterMap(season, throughWeek)` → `Record<PlayerId, UserId>`. Start from every starter and bench player in the last played week's games, then apply every transaction with `week` greater than that week, in `created` order (adds assign, drops remove). Sleeper stamps a waiver run with the upcoming week, so this picks up moves made after the last games. The result labels each row's manager for the whole range (the table shows who holds him now, not who held him in week 3).

## Build order

The implementation plan builds the data first (core module, script, committed `data/playerdb/` files for every season) and the page second, so the table is developed and screenshotted against real files. The two halves could be separate PRs if the first grows large.

## Code layout

**Core, `packages/core/src/playerdb/`** (pure, every file with a test):
- `types.ts`, `schema.ts` (zod `PlayerDbSchema`)
- `csv.ts` — streaming RFC-4180 parser: `parseCsv(stream): AsyncIterable<Record<string, string>>`; handles quoted commas and newlines
- `crosswalk.ts` — `buildCrosswalk(idsCsvRows, playersCsvRows, snapRows)` → `{ gsisOf(sleeperId, hint), pfrOf(sleeperId, hint) }` with the name fallback
- `sources/sleeper.ts`, `sources/nflverseWeekly.ts`, `sources/ngs.ts`, `sources/pfr.ts`, `sources/snaps.ts`, `sources/participation.ts`, `sources/players.ts` — each maps raw rows to `Partial<PlayerWeek>` keyed by `(gsis|pfr|sleeper id, week)` or to `DbPlayer` fields
- `teamWeeks.ts` — `teamWeeksOf(sleeperRows, participationPassPlays?)`
- `derive.ts` — per-row `routesEst`, `re_20`, scoring via `scoreStats`
- `ols.ts` — the solver (moved from web), `xfp.ts` — `fitXfp(rows)`, `predictXfp(coef, row)`, `XFP_FEATURES`
- `build.ts` — `buildPlayerDb(input: PlayerDbInput): PlayerDb`, the only entry point the script calls
- `index.ts` re-exports

**Script, `scripts/syncPlayers.ts`**: walks the league chain for the season list, downloads each file (with the Sleeper client's retry/backoff pattern, 3 retries), calls `buildPlayerDb`, validates with `PlayerDbSchema`, writes `.tmp/playerdb/{year}.json` then renames into `data/playerdb/` atomically. Flags: `--full` (rebuild finished seasons), `--season 2026` (one season), `--dry-run` (write to a temp dir). Finished seasons are skipped when their file exists and `--full` is absent; the log says so. The Sleeper weekly rows and projections are fetched again here rather than shared with `sync.ts`, keeping the two scripts independent.

**Sleeper directory**: `PlayerInfo` gains `birthDate: string | null` (`SleeperPlayer.birth_date`), copied by `toPlayerDirectory`, zod updated, `pnpm sync` re-run. The Stats branch makes the same change; whichever lands second merges it.

**Workflow** `.github/workflows/sync.yml`: after "Sync Sleeper data", a step "Sync player database" running `pnpm sync:players` with `continue-on-error: true`, and `git add data` already picks up `data/playerdb`. `package.json` gains `"sync:players": "tsx scripts/syncPlayers.ts"`.

**Web**
- `src/data/load.ts`: `loadPlayerDb(year)`, `hasPlayerDb(year)`
- `src/lib/playerdb/`: `aggregate.ts` (range totals, per game, rates, minimums, weighted NGS), `columns.ts` (tab → groups → columns with key, label, group, definition, format, lowerIsBetter, minimum, tinted), `percentile.ts` (tint from rank among visible values), `rosters.ts`, `url.ts` (param parse/serialize), `search.ts`
- `src/components/players/db/`: `PlayerDbToolbar.tsx`, `PlayerDbTable.tsx`, `GroupHeader.tsx`, `WeekRows.tsx`, `TintCell.tsx`
- `src/pages/PlayersPage.tsx`
- Nav and routes updated; `RETIRED_PATHS` loses `players`.

## Testing

- **Core**: each source adapter on 3–5 row fixtures cut from the real files (committed under `packages/core/test/fixtures/playerdb/`); the CSV parser on quoted commas, embedded newlines and CRLF; crosswalk direct hit, name fallback with a suffix, and a miss; team-week sums including sacks and red-zone looks; `routesEst` rounding; participation route counting (player on a pass play, on a run play, not on the field); xFP fit on synthetic rows with known coefficients recovered to 1e-6, and the under-50-rows null; `buildPlayerDb` end to end on the fixtures; schema accepts the output and rejects a row missing `week`.
- **Web**: aggregation (summed-rate rule, per-game division by `gp` weeks, weighted NGS averages, minimums scaling with weeks, estimated flag); percentile tints including a lower-is-better column and ties; roster attribution across a drop and an add after the last played week; URL round-trip for every param with junk fallback; `columns.ts` has no duplicate keys and every key resolves to an aggregate.
- **Components**: toolbar changes update the URL; sorting a column both ways; the lead block has the sticky class; group collapse hides its columns and persists; row click expands one row and collapses the previous; Show more; the "No player data yet" and "No players match" states.
- **Routes**: `/players` redirects to the current year; nav shows Players; `/players/1999` 404s.
- **Real data**: a smoke test aggregates every committed `playerdb` file for every tab over the full range without throwing and with at least 20 rows per position.
- Screenshots in headless Chrome at 1280 and 400, dark and light, with a collapsed group and an expanded row, before merge.

## Out of scope

A per-player page; FTN charting fields (catchable, contested, created receptions need a play-by-play join); kicker and defense tables; the Stats page's Players tab and its charts; switching the Extras boards to the new xFP; seasons before 2023; postseason NFL weeks; in-season updates between Tuesday syncs; column reordering or user-defined column sets; CSV export.
