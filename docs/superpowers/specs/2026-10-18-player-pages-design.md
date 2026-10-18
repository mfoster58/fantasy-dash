# Player pages

A page per player at `/player/:id`, modelled on Leagology's player page (theyard/players/christian-mccaffrey) and the mockups agreed in brainstorming (`.superpowers/brainstorm/21888-1792319379/content/player-page-v2.html`, `player-journey-v3.html`).

The page answers three questions:
1. What did he mean in this league?
2. How did he move through it?
3. How good was he, by the advanced numbers?

## Who gets a page

- Every player in any season's player database (QB, RB, WR, TE).
- Every player ever rostered in the league, including kickers and defenses.

A section is hidden when it has no data:
- Kickers and defenses have no player-database rows, so they have no percentile bars, Advanced by season or game log.
- A player never rostered in the league has no season table, path or records. His header tiles show "Never rostered in this league".
- An id in neither set returns a 404 through the existing ErrorPage.

## Data

Load in the browser, through the existing cached loaders (approach 1):
- `loadAllSeasons()` for league seasons.
- `loadPlayerDb(year)` for every year where `hasPlayerDb(year)`.
- The `players` directory.

The route loader returns `{ seasons, dbs }`. Everything else is pure functions in `packages/web/src/lib/player/`, one file per section, each tested on fixtures:

| File | Produces |
|---|---|
| `bio.ts` | Age (from `birthDate`, as of today), height in ft-in, weight, college, NFL draft. Taken from the newest player-database entry, falling back to the directory. |
| `summary.ts` | The header tiles: points started, points per start, starts out of rostered weeks, best week (started or not), team W–L in weeks he started, number of managers, title seasons. |
| `seasons.ts` | One row per league season he was rostered: manager(s) in order, starts, rostered weeks, Bench+ (points while benched), total points started, PPG (per start), best week, position rank and overall rank (from `playerSeasons` and the season's lines), team W–L when started, playoff points (winners bracket only), and title season (his manager won the title while he was rostered that season). Plus a career row, and the best value per column for gold highlighting. |
| `journey.ts` | Stints and moves, described below. |
| `percentiles.ts` | For a season: his percentile among same-position players for a fixed metric list per position, reusing `aggregate`, `columnValue`, `belowMin` and the `percentiles` helper. Players under a column's minimum are left out of the ranking. If he is under it himself, the bar shows greyed with "small sample". |
| `gameLog.ts` | For a season: one `Agg` per week (`aggregateWeeks` on his row), bye weeks as gap rows, and the fantasy context per week from his `PlayerLine` (manager, started or benched, points, result with score). Tints compare his value with every same-position player that week. |
| `records.ts` | `playerRecords(ctx, id, pos)`: every players-tab board where his row ranks 3rd or better (ties share a rank). It runs once with `pos: 'All'` and once with his position; position-board titles get the position appended, and a board already listed under All is not repeated. Same shape as `ManagerRecord`. |

### Stints and moves (`journey.ts`)

A **stint** is an unbroken run of weeks on one manager's roster, read from `PlayerLine`s. Lines exist for every rostered week, started or benched.
- A stint ends when the next rostered week is with another manager, or after a gap of unrostered weeks.
- A new season with the same manager continues the stint when he was kept or never left.
- Each stint has: manager and team name (from that season's managers), start and end ("now" if he is on a roster in the newest week), starts, points started, points per start, W–L when started, and a title flag.

**Moves** are attached to the stint they start or end, newest first:

| Move | Source | Sentence |
|---|---|---|
| Drafted | `draft.picks` where not `isKeeper` | "Drafted R{round} #{pickNo}" |
| Kept | `draft.picks` where `isKeeper` | "Kept at an R{round} price" |
| Traded | a `trade` transaction adding him | "Traded from {manager}, who got {other players in the deal}". Transactions carry players only, so draft picks in a trade are not named. A trade with nothing else recorded reads "Traded from {manager}". |
| Waiver claim | `waiver` adds | "Waiver claim · ${bid} FAAB", or no FAAB text when the bid is 0 |
| Free-agent add | `free_agent` adds | "Free-agent add" |
| Dropped | any `drops` of him | "Dropped" |
| Commissioner | `commissioner` adds and drops | "Moved by the commissioner" |

When a trade both drops and adds him, it shows once, as Traded, on the receiving stint.

## Page layout (`pages/PlayerPage.tsx`)

Sections in order:

1. **Header**
   - Headshot (existing `Headshot`), name, the gold `FinishIcon kind="champion"` once per title season he was on, `PosPill`, and NFL team.
   - The line under the name: "On {team} ({manager})" or "Free agent", plus "{years} champion" when he has titles.
   - Bio fields as small uppercase labels over values: Age, Height, Weight, College, NFL draft. A missing field is left out.
   - Six tiles with labels: Points started, Points / start, Starts (n / rostered), Best week, Team W–L started, Managers.
2. **In this league** (card)
   - Grouped headers: Starts (Starts, Rostered, Bench+), Points (Total, PPG, Best), Rank (Pos, Overall), Team (W–L started, Playoff pts).
   - Manager cells use the manager avatar and name, linking to the manager page. Several managers in one season read "A → B".
   - A title season gets a trophy after the year and a gold-tinted row with a gold left edge.
   - Each column's career best is in gold.
   - A career row closes the table.
3. **Among {POS}** (card, left) and **Advanced by season** (card, right)
   - Percentile bars:
     - Bars are coloured red / yellow / green at the 33rd and 66th percentiles, using the site's loss / warn / win tokens.
     - Each bar shows its number, and a season picker defaults to his newest season with rows.
     - Metric lists:
       - QB: Pass yds/g, Cmp%, Y/A, TD rate, INT rate (lower is better), aDOT, CPOE, EPA/db, Rush yds/g, xFP/g, FPOE/g.
       - RB: Snap%, Carry share, Tgt share, YPC, RYOE/att, Broken tackles/touch, YPRR, Opp share, xFP/g, FPOE/g.
       - WR/TE: Snap%, Route%, Tgt share, YPRR, aDOT, Separation, Catch%, YAC/rec, Drop% (lower is better), xFP/g, FPOE/g.
     - The plan maps each label to its `COLUMNS` key. A label with no matching column is dropped, never invented.
   - Advanced by season: the Players table's column groups for his position, one row per season, a career row, and tints against that season's position peers.
4. **Game log** (card)
   - A season picker, defaulting to the newest season with rows.
   - `PlayerDbTable` reused for a weekly table. Leading sticky columns: Wk, Opp, Manager (avatar or "FA"), Started / Bench, Pts, Result ("W 121–104", or "+31.2 left" when benched in a loss his points would have swung).
   - The position's column groups follow, with collapsible groups and Total / Per game, as on the Players table.
   - A bye is a single muted row. Week order is ascending.
   - The Players table is restructured into a shared table body that both pages use. It is not copied.
5. **Path through the league** (card, left) and **League records** (card, right)
   - The path is a feed of stints, newest first. Each stint has a manager avatar, name and team, a gold trophy if he won the title in that stint, the date range, and a stats line (starts, pts, per start, W–L started). Its moves follow, each with an icon and a date ("2024 Wk 9", "2023 draft").
   - Icons are new minimal line glyphs added to `components/Icons.tsx`, drawn in the existing icon style:
     - draft ticket (ink)
     - padlock for Kept (gold)
     - opposed arrows for Traded (accent)
     - coin for Waiver claim (win)
     - plus for Free-agent add (win)
     - minus for Dropped (loss)
   - League records reuses `LeagueRecords` unchanged. Its rows link to the players tab of /records with the board's sub-tab.

Phone width: cards stack to one column, the header tiles wrap three across, and tables scroll inside their own card.

## Links into the page

Player names link to `/player/:id` in:
- the Players table. The name becomes a link, and a chevron button keeps the expand-weeks control.
- box scores
- team roster lists
- the draft board
- Records page rows

The plan lists the exact components after a grep. Links never replace an existing control.

## Testing

- Each `lib/player/*` function gets unit tests on small fixtures, covering:
  - a mid-season trade
  - a drop and re-add to the same manager (two stints)
  - a keeper across seasons (one stint)
  - a never-rostered player
  - a kicker with no database rows
  - a bye week
  - a title season
  - ties in records
- A page test renders a fixture player and asserts each section's presence or absence for the three coverage cases (full, kicker, never rostered).
- The smoke test runs `seasons`, `journey`, `percentiles` and `gameLog` for every player in the committed data without throwing or producing NaN.
- Before merge: `pnpm test`, `pnpm build`, `tsc --noEmit`, and headless screenshots of a WR, a QB, a kicker and a free agent at desktop and phone widths.

## Out of scope

Hall of Fame ballot, this week's projection, score histogram, every-week strip, and news.
