# Player comparison tool — design

Date: 2026-10-27. Mockups: `.superpowers/brainstorm/93555-1793080845/content/compare-v2.html` (git-ignored; the chart images beside it are real captures).

## Why

Mathias wants a straight stats comparison between players: no start/sit advice and no verdict. The viewer decides. It should look like the comparison tool he shared (dark cards per player, floor, centre and ceiling numbers, a score histogram, recent games), with gradients. It should add two things from this app: the grade stats we just built, with a leader highlighted, and the full-size player charts, side by side.

## Goals

1. A **Compare** tab beside the existing players **Database** under Players, comparing **up to 4 players** at **one position** for **one season**.
2. **Player cards**: floor, **average** (not median) and ceiling, a histogram of weekly league-scoring points, consistency, the last 5 games and the **next 5 matchups**.
3. **Advanced**: every grade tile for the position, one column per player, filterable by **bucket**, with the **leader highlighted** on each graded stat.
4. **Charts**: the full-size chart cards for each player, driven by one shared set of filters.
5. Small change elsewhere: grade cards on player pages **drop their question line**, and "Carries inside the 10" is relabelled.

## Non-goals and anti-goals

- No verdict, no "who scores more" percentage, no lean, no projections in the comparison.
- No comparing across positions. WR and TE count as one group (see Positions).
- No scoring-format switch: league scoring only, as everywhere else in the app.
- No sliders.

## Where it lives

- The `Players` top-bar link keeps going to `/players/<current season>`. The page now has two tabs at the top: **Database** (today's PlayersPage, unchanged) and **Compare**.
- Compare's route is `/players/compare`. React Router ranks a static segment above `players/:season`, but check that this ordering holds.
- The comparison is in the URL: `/players/compare?season=2026&pos=RB&p=9509,3198,4034,9221`, with Sleeper player ids in slot order. A link reopens the same comparison.
- Every player page (QB, RB, WR, TE) gets a **Compare** button in its header. It opens `/players/compare?season=<his own newest player-database season>&pos=<his group>&p=<id>` (my call), so the link always shows him. That covers retired players and players out all year.

## Controls (top of the page)

- **Position**: QB · RB · WR/TE. Changing it clears the slots.
- **Season**: one picker for the page, listing seasons that have a player database. Changing it keeps players who have rows that season and drops the rest.
- **Four slots**, Player A–D, each with its own colour that is used everywhere on the page.
  - Each slot is a search box with suggestions. It suggests players in the position group with rows that season, showing headshot, name, team and season points, highest first. Typing filters by name.
  - Each filled slot has a ✕.
  - The page opens with empty slots and a short prompt. Nothing else renders until at least one slot is filled. Leaders only appear with two or more.
  - Use the existing `Headshot`, `PosPill` and player-directory helpers. There is no combobox in the app yet, so build an accessible one: keyboard up/down, enter, escape, `role="combobox"` / `listbox`.

## Player cards (one per player, in slot order)

- **Header**: avatar, name, position and team, then `NG · X pts` (games played, season points).
- **Floor · Average · Ceiling**, in three boxes.
  - Average is points per game played.
  - Floor and ceiling are his lowest and highest weekly scores (changed 2026-10-27 at Mathias's request; they first skipped one game at each end).
  - Only games played count (`gp ≥ 1`).
- **Histogram** of weekly scores in 5-point bins from 0 to 45+, in the player's colour, with a dashed line at his average.
- **Consistency**: coefficient of variation (SD ÷ average) as a percentage, labelled "CV".
- **Last 5 games**: week, opponent (with @ for away games) and points. Points at or above his average are tinted green.
- **Next 5**:
  - Shows the five weeks after the latest week of the season with any game played. A bye week reads "BYE".
  - The opponent is coloured by that season's defence rank against his position, using the existing `defenseRanks` (easy green, mid grey, hard red), with a tooltip "#N of 32 in points allowed to RBs".
  - It only lists schedule weeks up to 18. The row is hidden when no schedule week is left after the season's `throughWeek` (my call): "finished" comes from the schedule and the player database, not from the fantasy league's status. A season with no schedule file also hides the row.
- **Leaders**: whoever is highest on Floor, Average and Ceiling gets a gold-gradient box and a ▲. The lowest CV gets "▲ steadiest". Ties all get it. These only show with two or more players.
- **Look**: each card has a gradient from the player's colour at the top-left, fading into the surface by about 40%. The stat boxes have a subtle vertical gradient. Use theme tokens, and make it work in light mode too.

## Advanced

- **Rows** are the grade tiles for the position, from `lib/grades/defs.ts` and `gradeCards()`, grouped under each card's title (with no question line). **Columns** are one per player.
- **Buckets** are pills: All · Opportunity · Production · How he plays, followed by one pill per card title (for example Efficiency, Deep threat). The default is All.
- **Cell**:
  - The tile's value text, then the percentile written as "84th" in small muted type. An unranked tile reads "n/r", and an FTN tile in a season without FTN reads "no FTN data".
  - Behind the cell is a horizontal fill from the left edge to the percentile, in `pctColor`, light (about 30% fading to 14%).
  - Style tiles get a neutral grey fill. Unranked cells get no fill.
- **Leader**:
  - On each graded (non-style) tile where at least two players are ranked, the highest percentile gets a gold outline, gold value text and a ▲.
  - "Highest percentile" already accounts for lower-is-better tiles.
  - Ties all get it.
- **Leads line** above the table: "● B. Robinson leads 9 of 24", one per player, counting only the rows currently visible. "Of M" counts the visible rows where a leader can exist: graded tiles with at least two ranked players. The slot colours are four distinct theme tokens (blue, orange, violet, gold-yellow, as in the mockup), with light-mode variants.
- **Phones**: the table scrolls sideways, with the stat column pinned.

## Charts

- **Chart pills by position**:
  - QB: Passing zones · Under pressure · Throws by route
  - RB: Run lanes · Route tree · Target map
  - WR/TE: Route tree · Target map
- **Each player** gets the real full-size chart card, captioned with his name in a header strip in his colour.
  - Run lanes go one per row (it is wide).
  - The others go two per row on wide screens and one per row on phones.
- **One shared control bar** above the charts holds that chart's filter and metric, and drives every player's chart. The individual cards hide their own controls and season picker and use the page season.
  - The chart components need a "controlled" mode: filter, metric and season passed in, with their own controls hidden. Hover and tap highlighting stay per card.
- **A season without a chart's data** (for example 2026 routes) shows each card's existing greyed note.
- **Credit line** under the charts: "Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse".

## Positions

- **QB, RB**: compared with their own position.
- **WR/TE**: one group, so a WR and a TE can be compared. Each player's percentiles still come from his own position, because `gradeCards` already ranks TEs against TEs. A WR and a TE ranked on the same stat can still be compared for the leader, since both are percentiles.

## Data

- **New: NFL schedule.**
  - The daily player sync downloads nflverse's `games.csv` (`https://github.com/nflverse/nfldata/raw/master/data/games.csv`). It keeps regular-season games for the league's seasons and writes `data/schedule/{year}.json` as `{ year, games: [{ week, home, away }] }`.
  - Team codes go through the existing `normalizeTeam` (LA → LAR).
  - Validate with zod like the other data files. A failed download keeps the old file.
- **Everything else already exists**: weekly `pts`, `opp` and `gp` (player DB), grade cards (`gradeCards`), defence ranks (`defenseRanks`), and the chart DBs.

## Small changes elsewhere

- `GradeCard` drops the question line. The `question` field can go from the defs entirely.
- RB tile "Carries inside the 10" becomes **"Team carries inside the 10"**, with the detail line "23 of 26".

## Tests

Follow the repo's conventions: Vitest, web tests colocated, core tests in `packages/core/test`.

- **Maths:** floor, average and ceiling at 4 and 5 games; CV; histogram bins including 45+; and the next-5 window, which covers byes, the week-18 end, finished seasons and a traded player using his current team.
- **Leaders:** ties, the minimum of two ranked players, lower-is-better tiles, style tiles excluded, and the leads count following the bucket.
- **URL state:** reading, writing and dropping players who have no rows when the season changes.
- **Combobox:** keyboard behaviour, and filtering to the position group.
- **Charts:** controlled mode for each chart component (controls hidden, props drive the filter).
- **Schedule sync:** parsing and team normalisation.
- **Player page:** the Compare button link, and grade cards without questions.

## Left to the builder

File and module names; the combobox implementation; the exact gradient stops; how the shared chart control bar is built (one component per chart type, or a generic one); the histogram's SVG details.
