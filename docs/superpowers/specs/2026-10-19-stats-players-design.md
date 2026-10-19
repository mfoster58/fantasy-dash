# Stats: Players tab

A Players tab on the Stats page, sitting beside the Managers stats already at `/stats`. It is built on the agreed round 2 mockups, `.superpowers/brainstorm/4167-1792386512/content/players-stats-r2c.html` (git-ignored). They used real 2026 data for weeks 1–5.

The page is positional only: **QB, RB, WR and TE**. Each position has three parts:
1. One quadrant chart that switches between curated stat pairings, drawn with team logos.
2. A volume trends table, for RB, WR and TE.
3. Yards per route run, visualised, for WR and TE.

**Decided out of scope:**
- An All tab (and the age curve that lived there).
- Floor and ceiling.
- Left on the bench.
- Route fingerprints.
- Leaderboards. These stay under Records → Players → Leaders until a future home page.
- Paid-charting metrics: throw-open, first-read share, catchable-target rate, YSOE and TSOE.

## Route and controls

- **URL:** `/stats/players`.
- **Tab bar:** a "Managers | Players" bar at the top of the Stats page switches between `/stats` and `/stats/players`.
- **Toolbar:** sticky, like the Managers toolbar, with:
  - a **season picker** over the league seasons (2023–2026), defaulting to the current season, with no All-time option
  - a **position switch**: QB / RB / WR / TE, defaulting to RB
- **URL state:** the position and the selected view are kept in the query string (`?pos=WR&view=role`), so a link opens the same chart.

## Data

### What the page reads

- **Player database:** `data/playerdb/{year}.json`, loaded through `loadPlayerDb`. Season-to-date totals come from summing the rows, with weekly rows for the trends.
- **Chart file:** `data/charts/{year}.json`, loaded through `loadCharts`. This file gains a play-by-play section that exists even when the participation file doesn't (below).

### Chart file changes

`buildCharts` and the sync charts phase are extended in three ways.

**1. Play-by-play only counts, built for every season that has a play-by-play file,** including the current one. They sit in each `ChartPlayer` under a new `plays` key:

| Key | Tuple | Who |
|---|---|---|
| `rush` | carries, successes, explosive, yards | RBs |
| `rz` | per band (`ra rb rc ta tb tc`): opportunities, fantasy points | RBs |
| `qtr` | dropbacks in quarters 1–3, their EPA, dropbacks in the 4th quarter and overtime, their EPA | QBs |

- A **carry** is `rush_attempt` = 1 that is not a scramble. These are RB carries, the same as the lanes.
- **Success uses the yards-to-go rule.** A carry succeeds when it gains at least:
  - 40% of `ydstogo` on 1st down
  - 60% on 2nd down
  - 100% on 3rd or 4th down
- **Explosive** means 10 or more `yards_gained`.
- **Red zone** opportunities are carries and targets with `yardline_100` from 1 to 20, in three bands:

  | Band | Yards |
  |---|---|
  | `a` | 1–5 |
  | `b` | 6–10 |
  | `c` | 11–20 |

  `r` is a carry and `t` a target.
- **Fantasy points per red-zone play** use league PPR scoring:
  - a carry scores 0.1 × rushing yards + 6 × rushing TD
  - a target scores 1 per catch + 0.1 × receiving yards + 6 × receiving TD
- **Expected red-zone points** are computed in the browser. Each band and type gets the league's average points per opportunity, multiplied by a player's opportunities.

**2. A `participation: boolean` flag on `ChartDb`.** A season built without participation has empty `routes`, `lanes` (box filter), `zones` and `splits`, so the existing player-page cards keep their greyed current season.

**3. The final-file check.** A chart file now counts as final only when its season is complete *and* `participation` is true. So a finished season built before nflverse published participation is rebuilt once it appears. The current season is rebuilt on every sync.

`ChartDbSchema` grows to match. The existing player-page charts are unchanged.

### Injury report

The sync downloads nflverse `injuries_{year}.csv` (`https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_{year}.csv`) for each season it builds. It stores, per player and week, the report status (Out, Doubtful, Questionable, or none) and the primary injury.

- **Where it lives:** the chart file, under `ChartDb.injuries: Record<gsisId, Record<week, [status, injury]>>`, regular season only. A 404 means no injuries (logged, not an error).
- **The latest report** is the highest week in the file. A status of IR counts as Out.

### Healthy games

A **healthy game** is one where `gp` is set and the game was not injury-shortened. A game is **injury-shortened** when both of these hold:
- He played under half his usual snap share. "Usual" is the median snap share of his other games in the window or season.
- He appears with any status on the injury report that week or the next.

For the most recent scored week, when the next week's report isn't published yet, a snap share under a third of his usual counts as shortened on its own, provisionally.

**Per-game averages divide by healthy games only, and count only those games' stats:** PPG, xFP/G and weighted opportunities per game. Rates are unaffected, because a short game adds few plays to them: YPRR, success %, catch rate and the rest.

### Season-to-date stats (from the player database)

All are computed in `packages/web/src/lib/stats/players/`. Per player over the season's scored weeks, counting games with `gp` set:

| Stat | Definition |
|---|---|
| PPG | points ÷ games |
| xFP/G | xFP ÷ games |
| ANY/A | (pass yds + 20 × pass TD − 45 × INT − sack yds) ÷ (attempts + sacks) |
| CPOE | the mean of weekly `pa_cpoe` |
| Tight-window % | the mean of weekly `pa_aggr`, which is NGS aggressiveness |
| EPA per dropback | `pa_epa` ÷ (attempts + sacks) |
| Snap share | snaps ÷ team snaps |
| Weighted opportunities per game | (carries + 1.5 × targets) ÷ games |
| Yards per carry, yards per target | yards ÷ carries, yards ÷ targets |
| RYOE per carry | `ru_ryoe` ÷ carries |
| Routes | `routes` when real, otherwise `routesEst`; the UI says so when estimated |
| YPRR | receiving yards ÷ routes |
| Targets per route | targets ÷ routes |
| First downs per route | `re_fd` ÷ routes |
| aDOT | `re_air` ÷ targets |
| Separation | the mean of weekly `re_sep` |
| Catch rate | receptions ÷ targets |
| Target share | the mean of weekly `re_tgtShare` |

**Coverage and pressure** come from the chart file's existing `splits` (QB) and `routes` (WR/TE), and only exist when `participation` is true:
- EPA per dropback against man, against zone, clean and pressured, with at least 40 dropbacks in each.
- Yards per target against man and against zone, with at least 20 man targets and 30 zone targets.

## The quadrant chart

One component, `QuadrantChart`, draws every view. It's a full-width card containing:
- **View chips:** one per pairing. A chip that needs participation is marked with its data season and greyed in a season without it.
- **The chart:**
  - Logos are **team logos** from `https://sleepercdn.com/images/team_logos/nfl/{team}.png`, about 26 px. A player with no team, or an image that fails to load, falls back to a small circle with the team code.
  - Each logo has a label in the form "F. Lastname". Labels are nudged so they never overlap.
  - **Dashed league-average lines** split the chart into four quadrants. Each quadrant gets a faint tint and a **name pill** in its corner. The tints and pills use `--win` (top-right), `--accent` (top-left), `--warn` (bottom-right) and `--loss` (bottom-left).
  - Either a **least-squares trend line**, or, for "X vs X" views, a **dotted diagonal** where both are equal, with both axes on the same scale.
- **Pool:** players meeting the view's minimum, limited to the **40 with the most volume** (dropbacks for QBs, carries + targets for RBs, targets for WR/TE).
- **Hover or tap** a logo for the player's name, team and both values. **Click** opens his player page.
- **A "Table" toggle** shows the same players as a sortable table of the two values, for accessibility and exact reading.

### Views

The quadrant names run top-right / top-left / bottom-right / bottom-left.

| Pos | View | x | y | Minimum | Quadrants |
|---|---|---|---|---|---|
| QB | ANY/A vs CPOE | CPOE | ANY/A | 80 att | Elite / Big plays, loose accuracy / Accurate, little output / Struggling |
| QB | Tight windows vs EPA | tight-window % | EPA/dropback | 80 att | Gunslinger who wins / Efficient, plays it safe / Forcing it / Struggling |
| QB | Closers: Q1–3 vs Q4 (diagonal) | EPA/db Q1–3 | EPA/db Q4 | 80 att, 15 Q4 dropbacks | Good all game / Closer / Fades late / Struggling |
| QB | Clean vs pressured *(participation)* | clean EPA/db | pressured EPA/db | 40 each | Unflappable / Thrives in chaos / Needs a clean pocket / Struggling |
| QB | vs Zone vs vs Man *(participation, diagonal)* | zone EPA/db | man EPA/db | 40 each | Beats everything / Man beater / Zone beater / Struggling |
| RB | Expected vs actual (diagonal) | xFP/G | PPG | 20 carries | Producing / Overachiever / Underachiever / Low volume |
| RB | Red zone expected vs actual (diagonal) | RZ xFP/G | RZ FP/G | 1.5 RZ xFP/G | Goal-line hammer / Finds the end zone / Wasting chances / Limited role |
| RB | Success % vs explosive % | success % | explosive % | 20 carries | Elite / Boom or bust / Chain mover / Struggling |
| RB | Success % vs RYOE | success % | RYOE/carry | 20 carries | Creates and converts / Creates, inconsistent / System back / Struggling |
| RB | Snap share vs workload | snap share | weighted opp/G | 20 carries | Workhorse / Fed in a small role / On the field, not fed / Committee |
| RB | Yards per carry vs per target | YPC | YPT | 30 carries, 8 targets | Dual threat / Receiving back / Runner / Struggling |
| WR, TE | Expected vs actual (diagonal) | xFP/G | PPG | 15 tgt (TE 12) | Producing / Overachiever / Underachiever / Low volume |
| WR, TE | Role map | aDOT | target share | 15 tgt (TE 12) | Alpha deep threat / Volume underneath / Field stretcher / Gadget / checkdown |
| WR, TE | YPRR vs target rate | targets/route | YPRR | 60 routes (TE 40) | Alpha / Efficient, under-fed / Volume, not efficient / Struggling |
| WR, TE | Separation vs catch rate | separation | catch rate | 15 tgt (TE 12) | Open and reliable / Contested-catch winner / Open, leaves plays out there / Struggling |
| WR, TE | First downs/route vs aDOT | aDOT | FD/route | 60 routes (TE 40) | Downfield chain mover / Underneath chain mover / Field stretcher / Struggling |
| WR, TE | vs Zone vs vs Man *(participation, diagonal)* | zone yds/tgt | man yds/tgt | 20 man, 30 zone tgt | Beats everything / Man beater / Zone beater / Struggling |

Each view has a one-line question under its title, taken from the mockup. Examples: "Who scored more, or less, than his opportunities were worth?" and "Who keeps the offence on schedule, and who breaks the big one?".

## Volume trends (RB, WR, TE)

A table like the mockup and the published RB Volume Trends graphic Mathias shared:

- **Window:** the season's last five scored weeks. For the current season that's weeks 1–N, with N up to 5, or the latest five once more are played.
- **Columns:**

  | Pos | Columns |
  |---|---|
  | RB | Snap %, Rush share (carries ÷ team rush attempts), Target share (targets ÷ team pass attempts), xFP share (his xFP ÷ the team's xFP that week), Opportunities (carries + targets) |
  | WR, TE | Snap %, Route share (routes ÷ team dropbacks), Target share, Air yards share, xFP share |

- **Each cell:**
  - one mini bar per week, with the value above it
  - a bye shown as a dotted stub, a missed game as an empty stub, and an injury-shortened game as a faint bar with a small ✚ (its value shown on hover)
  - the latest bar green if his change is up, red if down
  - the change: the mean of his healthy games in the last two weeks minus the mean of his healthy earlier games; shortened and missed games don't count
- **Trend score:** each column's change divided by that column's standard deviation of change across the pool, then averaged. It's shown as a bar and a signed number.
- **Rows:**
  - "▲ Trending up": the top 10.
  - "▼ Trending down": the bottom 6.
  - Pool: players with at least one healthy game in the last two weeks, at least two healthy earlier games, and minimum volume over the window. That's 25 carries + targets for RB, 15 targets for WR and 10 targets for TE.
  - **Currently injured players are left out of both lists.** Anyone listed Out or Doubtful on the latest injury report is shown instead in an "Injured" line under the table, for example "David Montgomery: Out (groin)", so a drop that is really an injury isn't read as a shrinking role.
- Each row shows the team logo, name and team, and links to the player page.

## Yards per route run, visualised (WR, TE)

- **Axes:** routes run on x, receiving yards on y.
- **Marks:** team logos, with labels for the top 22 by yards.
- **Guides:** dashed rays from the origin at 1.0, 1.5, 2.0, 2.5 and 3.0 YPRR, labelled at their ends.
- **Pool:** 60 routes (TE 40).
- **Estimates:** when routes are estimated for the season, the subtitle says "routes estimated until the participation file is out".

## Layout

The position's quadrant card comes first, then (for WR and TE) yards per route run visualised, then the trends table. All three are full width.

On phones:
- the chips wrap
- the charts scale by their viewBox
- the trends table scrolls sideways, with the player column fixed

## Testing

- **Core:** builder tests for the new `plays` counts.
  - The yards-to-go success rule at each down, including the exact thresholds 40%, 60% and 100%.
  - Explosive at exactly 10 yards.
  - Red-zone bands at 1, 5, 6, 10, 11, 20 and 21.
  - Quarter grouping, with overtime counted in Q4.
  - A season with no participation, which gives `participation: false` and empty split tables.
- **Sync:** the final-file rule. A complete season without participation is not final.
- **Injuries:**
  - the injury-report parse, with IR counting as Out
  - the shortened-game rule, at exactly half and a third of usual snaps, with and without a report
  - healthy-game per-game averages
  - the trend pool's healthy-game minimums
  - currently Out or Doubtful players moving to the Injured line (fixtures modelled on Goedert, Montgomery and Achane in 2026)
- **Web lib:**
  - every season stat on a fixture, including the routes-estimated fallback
  - red-zone expected points from league band averages
  - the 40-by-volume pool
  - the trend change and score, including bye and missed weeks and the standard-deviation scaling
  - quadrant averages and the trend-line fit
- **Components:**
  - chips switch views
  - a participation view greyed in a season without it
  - the logo fallback
  - label nudging that never overlaps on a crowded fixture
  - the table toggle
  - hover and tap
  - query-string state
  - the Managers | Players tab bar
- **Smoke test** on committed 2026 data:
  - the RB trending-up list starts with Braelon Allen, matching the mockup and the published source.
  - Gibbs's red-zone actual is about 14.5 per game.
