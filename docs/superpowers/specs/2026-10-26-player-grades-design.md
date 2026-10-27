# Player grades and the 2026 charts — design

Date: 2026-10-26. Mockups: `.superpowers/brainstorm/93555-1793080845/content/` (`target-map-v3.html`, `player-page-cards.html`; git-ignored, kept for reference).

## Why

Mathias wants more advanced stats, presented so they are easy to digest, and he wants the player-page charts to work for the current season. Routes, man/zone coverage and the participation-based pressure numbers are published by nflverse only after a season ends, so the 2026 route tree cannot exist yet. Several of the 2026 charts are greyed out for no real reason, though. FTN charting, Next Gen Stats, PFR advanced stats, snap counts and play-by-play all publish weekly and support a lot more.

## Goals

1. **Grade cards on the player page.** Each card asks one question and answers it with four tiles. The stat is the big number, and the colour is the player's percentile against his position for that season. The full set is listed below.
2. **Scouting summary** above the cards: his four best and four worst graded tiles, picked automatically.
3. **Target map** for WR/TE/RB in seasons that have no route data (2026 today). It is a glow map of targets by depth and side, with FTN play filters and the numbers always visible.
4. **2026 run lanes and passing zones**: stop gating them on participation.
5. **Credit lines** wherever FTN data is shown: "Data: FTN Data via nflverse". This is required by FTN's licence.

## Non-goals

- Route trees, man/zone or coverage splits for 2026. These arrive with the participation file at season end, and the existing sync already picks it up automatically.
- Scraping NGS pass-chart images (next-gen-scrapy). NFL.com's terms forbid it and the code is dead.
- New columns or views on `/players` or `/stats/players`. That may come later; it is not part of this work.
- Blocking grades, or any paid data source.

## Anti-goals

- Colouring a style stat as good or bad (time to throw, box count, motion rate and similar). Style tiles stay grey.
- Percentiles from tiny samples: a tile under its minimum volume shows the number with "not ranked" and stays grey.
- Showing projections anywhere in the grades.

## Look (decided with Mathias in the mockups)

- **Tile:** big stat; label; one muted detail line (the raw count, e.g. "58 catches vs 48.7 expected"); a percentile line ("96th pct"); a thin bar with a dot at the percentile. Left border and dot are on the existing red → yellow → green percentile scale (`pctColor`). Style tiles have a grey border, a grey dot and "Nth pct · style". There is no headline percentile number.
- **Card:** title, a one-line question in muted text, then a 2×2 tile grid. Cards sit in a responsive grid, about 340px minimum per card.
- **Grouping:** cards sit under three small uppercase headings, **Opportunity → Production → How he plays**.
- **Scouting summary:** a card with two columns, "Best at" and "Weakest at", four rows each. Each row is `label · card` on the left and `value · Nth` (in percentile colour) on the right. Only graded, ranked tiles qualify.
- **Target map:** the glow style of the QB passing-zones card. Numbers are always visible in each zone, with "N tgt" under them on the taller bands. There is no text outline. Hovering a zone gives the full line in the tip row.
- **Dark and light themes:** use the existing theme tokens only.

## Placement on the player page

`PlayerPage.tsx` keeps its order. The **Grades** section goes directly after the chart cards and before GameLog:

1. A section header "Grades" with a season picker (same pill style as the chart cards). It defaults to the current season, or the latest season with data.
2. Scouting summary.
3. The cards, grouped.
4. The credit line ("Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse").

**The PercentileBars card is removed** (Mathias, 2026-10-26). The grade cards and the scouting summary replace it, so the page has one ranking system. `LeagueRecords` stays in the right-hand column beside JourneyFeed. Delete `PercentileBars.tsx`, plus `lib/player/percentiles.ts` and its tests if nothing else uses them. Reuse its aggregation logic for the grades where it fits.

Positions: QB, RB, WR and TE. A TE uses the WR card set but is ranked against TEs only. Kickers and defences get no grades section.

## The cards

"pbp" means play-by-play, REG season, weeks 1–18, two-point plays excluded. "DB" means the existing player DB (`data/playerdb`), aggregated over the season the way `percentileBars` already does. "FTN" means FTN charting joined on (`nflverse_game_id`, `nflverse_play_id`) = (`game_id`, `play_id`). (S) marks a style tile. "low" marks a tile where lower is better (the percentile is flipped).

### WR / TE

**Opportunity**
- *Opportunity: How much of the offence runs through him?* Target share (DB tgtPct) · WOPR (DB) · Snap share (DB) · Targets per route run (DB `tprr`, using the existing route estimate where real routes are missing; the detail line says "est." when estimated, as the `/players` column does).
- *Usage: How is the offence getting him the ball?* Team air-yards share (NGS share of intended air yards, DB) · Average depth of target (S) · Targets after motion % (S, FTN) · Play-action targets % (S, FTN).

**Production**
- *Efficiency: What does a target to him earn?* Yards/target · EPA/target · Success rate · First downs per target (pbp; a first down or TD on a completed target).
- *Beating expectation: Does he do more than the throw gives him?* Catch rate over expected (pbp: (catches − Σcp) ÷ targets with cp) · YAC over expected (NGS, DB) · RACR (DB) · Broken tackles (PFR, DB).
- *Deep threat: What happens when they throw it 20+?* Deep target rate (S) · Deep catches "c / t" (graded on catch %) · Deep yards · EPA per deep target. Deep means air yards ≥ 20.
- *Money downs: Is he there when it matters?* 3rd-down conversion rate on targets · Red-zone target share (his targets inside the 20 ÷ team's) · End-zone targets (air yards ≥ yardline_100) · TD rate per target.

**How he plays**
- *Ball skills & separation: Can he get open and finish the catch?* Drop rate (low; FTN drops ÷ catchable) · Contested catches "c / t" (graded on rate) · Created receptions (FTN) · Separation (NGS, DB).

### QB

**Production**
- *Efficiency: What does a dropback earn?* EPA/dropback · Success rate · ANY/A ((pass yds + 20·TD − 45·INT − sack yds) ÷ (att + sacks)) · Sack rate (low).
- *Accuracy & aggressiveness: Is he putting it where receivers can catch it?* CPOE (NGS, DB) · Catchable-ball % (FTN) · Bad-throw % (low; PFR, DB) · Tight-window throws (S; NGS aggressiveness).
- *Deep ball: Can he hurt you 20+ downfield?* Deep attempt rate (S) · Deep completions "c / a" (graded on %) · EPA per deep attempt · Deep CPOE (pbp mean cpoe).
- *Clutch & situational: Does he deliver when it counts?* 3rd-down conversion rate (dropbacks) · Red-zone TD rate (dropbacks inside the 20 ending in a TD for his team) · 4th-quarter EPA/dropback · EPA/dropback when trailing.

**How he plays**
- *Decision making: Does he protect the ball and take what is there?* Interception-worthy rate (low; FTN) · First-read throws % (S; FTN read_thrown = 1 among throws with a read) · Throwaway rate (S; FTN) · Sacks he caused, per dropback (low; FTN is_qb_fault_sack).
- *Pocket & pressure: How does he handle the rush?* Pressure rate faced (S; PFR, DB) · Time to throw (S; NGS, DB) · EPA/dropback vs blitz (FTN n_blitzers > 0) · EPA/dropback with no blitz.
- *Legs: Does he add anything running?* Scramble rate (S) · Yards per scramble · EPA per designed run · Rushing first downs.
- *Scheme: What does the offence ask of him?* Play-action rate (S; FTN) · EPA on play-action · Air yards past the sticks (S; NGS, DB) · Receivers' drops % (S; FTN drops ÷ attempts).

### RB

**Opportunity**
- *Workload: How much of the backfield is his?* Snap share (DB) · Opportunity share ((carries + targets) ÷ team's) · Carries inside the 10, share of team's · TD rate on carries inside the 5 "TD / carries".

**Production**
- *Efficiency: What does a carry earn?* Yards/carry · EPA/carry · Success rate · First downs per carry.
- *Rushing vs expected: Is he beating what the blocking gives him?* RYOE per carry (NGS, DB) · Carries that beat expected % (NGS) · Explosive runs 10+ % · Stuffed % (low; ≤ 0 yards).
- *After contact: What does he make on his own?* Yards before contact per carry (S; PFR) · Yards after contact per carry (PFR) · Broken tackles (PFR) · Broken-tackle rate per touch (DB btTouch).
- *Receiving back: Does he matter in the passing game?* Target share · Targets per route run (DB `tprr`, "est." as above) · YAC over expected per catch (pbp yards_after_catch − xyac_mean_yardage) · EPA per target.

**How he plays**
- *Fronts faced: How hard is the box he runs into?* Carries vs 8+ in the box % (S; NGS) · Average box count (S; FTN n_defense_box) · Yds/carry vs light box ≤ 6 (FTN) · Yds/carry vs stacked box ≥ 8 (FTN).
- *Running style: How does he get there?* Time to the line (S; NGS) · NGS efficiency, yards run per yard gained (S) · RPO carries % (S; FTN) · Carries outside the tackles % (S; pbp run_location left/right with run_gap end).

A carry excludes QB scrambles. A target is a pass attempt that is not a sack and has a receiver.

## Ranking

- The pool is every player at the same position (TE separate from WR) with at least the minimum volume for that card's denominator in that season. My call on the minimums: they scale with the weeks played so far in the season. Per team game: 4 targets (WR/TE), 7 carries (RB), 15 dropbacks (QB). Smaller denominators inside a card (deep targets, red-zone looks, blitzed dropbacks and similar) need at least 5 events, otherwise "not ranked".
- **Count tiles are ranked per game played.** This covers broken tackles, deep yards, end-zone targets, created receptions and rushing first downs (my call). The big number stays the season total, and the detail line shows the per-game rate. Games played come from the player DB weeks with a snap. The "c / t" tiles (deep catches, contested catches, deep completions, TDs inside the 5) are ranked on their rate.
- Percentiles use the existing average-rank `percentiles()` helper (`lib/playerdb/percentile.ts`). Low tiles are flipped. Style tiles are ranked but shown grey.
- A player under the card's volume minimum still sees his numbers. Every tile shows "not ranked", and the card is left out of the scouting summary.

## Target map

- It replaces `RouteTree` for WR/TE/RB in any season whose chart file has no route data. Seasons that have routes keep the route tree. The year picker on that card lists all seasons. Picking one without routes shows the target map, and a line under the title says "Route tree arrives when the season's route data is published".
- Zones: depth bands behind the line / 0–9 / 10–19 / 20+, by left / middle / right, from pbp `air_yards` and `pass_location`, the same as `zoneOf`.
- Plays filter: All · Play-action · No play-action · Motion · Screen · vs blitz · Contested (all FTN). The All filter works without FTN.
- Metric: Target share (heat scale, 0–25%+) · Catch % · Yds/target · EPA/target. Non-share metrics are coloured by percentile among the same position in that zone. Under 3 targets in the zone shows grey.
- Each zone counts targets, receptions, yards, EPA and TDs.
- Tip row: zone name, targets, rec, yds, TD, % of his targets, EPA/target. Legend and credit line as in the mockup.
- QBs keep their QB route-tree card greyed for seasons without routes, as today.

## 2026 run lanes and passing zones

- `buildCharts` stops gating lanes and zones on `hasPart`.
- Lanes `all` comes from pbp. The light/heavy box split uses participation `defenders_in_box` when present, otherwise FTN `n_defense_box` (≤ 6 light, ≥ 7 heavy, the existing rule).
- Zones `all` comes from pbp. The clean/pressured pocket split stays participation-only, so in 2026 the Pocket filter's Clean and Pressured options are disabled with a "no pressure data yet" tip.
- QB `splits` (PressureCard) and `throws` stay participation-gated. PressureCard keeps its greyed empty state in 2026.

## Data

- **Sync:** the charts phase of `pnpm sync:players` also downloads `ftn_charting/ftn_charting_{year}.csv`. It exists from 2022, and a 404 is logged and skipped, not an error. It is passed to `buildCharts` alongside participation.
- **Chart DB additions** (`packages/core/src/charts`, schema and types), per player:
  - `targets`: target-map zone counts keyed by filter.
  - `grades`: the season count tuples the cards need from pbp and FTN.
  - The `ChartDb` header gains `ftn: boolean`.
  - Bump the schema in a backward-compatible way: the new fields are optional, and old files still parse until the next sync rewrites them.
- **From the player DB:** NGS, PFR, snap and nflverse fields are read from the existing season aggregate (`aggregate()` / `percentileBars` path). Nothing new is fetched for them.
- **Team totals** for share tiles (team targets, carries, red-zone targets, inside-10 carries) come from the same pbp pass, stored per team in the chart DB.
- **Seasons:** grades exist for every season with a chart file. FTN tiles in a season without FTN data show "—" with "no FTN data" and stay out of the summary.

## Tests

Follow the repo's conventions: core tests in `packages/core/test`, web tests colocated as `*.test.ts(x)`, Vitest.

- **Core:** `buildCharts` with small fixture rows covers:
  - FTN join and filters
  - lanes and zones without participation
  - box fallback
  - deep, red-zone, end-zone and inside-10 counts
  - catch rate over expected
  - two-point exclusion
- **Web:** tile percentile and style colouring, plus "not ranked" under the minimum. Also the scouting summary picks (style and unranked excluded), the target map's switch to and from the route tree, and the credit line rendering.

## Left to the builder

File and module names; how grade tile definitions are expressed (a spec table like `lib/charts/specs.ts` is the natural fit); exact count-tuple layout; card grid breakpoints; how the season picker shares code with `useChartSeason`.
