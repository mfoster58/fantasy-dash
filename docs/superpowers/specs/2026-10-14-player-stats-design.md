# Player stats tab and streaks

**Date:** 2026-10-14
**Status:** approved in conversation; spec awaiting user review.

## Why

The league wants a record book for players, modelled on Leagology's player records page, plus the longest win streaks. The all-time tab covers manager and matchup records; nothing in the app ranks players across seasons.

## Scope

1. A new **Player stats** tab at `/players` with four sections: League leaders, All-time, Postseason, Extras. One position filter applies to the whole page.
2. **Longest win streaks** and **longest losing streaks** cards on the History tab.

Not in scope: Leagology's "Chases" (milestone speed) section, kicker boards by field-goal distance (the data has no distance buckets), defense-only postseason boards, and the "worst lineup call" idea (rejected by the user).

## Data

Everything is computed in the browser. The `/players` route gets the loader head-to-head uses (`loadAllSeasons`) because player lines live only in the season files. Streaks need only game results, which `history.json` already holds for every played game in its head-to-head series, so the History tab stays static. No core, schema or sync change.

The unit of player data is a **line**: one player on one roster in one played week. Lines come from `GameSide.starters[].player` (started) and `GameSide.bench[]` (benched). Each line has `playerId`, `points`, `stats`, and we attach `userId`, `year`, `week`, `gameId`, `matchupId`, `tag`, `started`.

Derived per line:

- `yards = pass_yd + rush_yd + rec_yd` (missing keys are 0).
- `touchdowns = pass_td + rush_td + rec_td` (missing keys are 0). Defensive touchdowns are not counted.
- `receptions = rec`.
- `played = Object.keys(stats).length > 0`. Core uses Sleeper's games-played stat, which the season files do not persist per week; a line with any recorded stat is the proxy.
- `postseason = tag in {QF, SF, Final, 3rd, 5th}`. Championship bracket only; Cons-R1, Toilet Bowl and Cons-7th are excluded.

Position comes from the player directory (`players.json`), not from the slot the player sat in. A player missing from the directory has position `?` and appears only under the All filter.

**Player identity across seasons** is the Sleeper player id. Defenses are ids like `KC`; the directory names them by team.

### Ordering and ties

Every board sorts by its value descending (ascending where noted). Ties break by the most recent occurrence (year desc, week desc), then by player id ascending so output is stable.

### Filter

Options: All, QB, RB, WR, TE, FLEX, K, DEF. FLEX means position in {RB, WR, TE}. The filter narrows the lines before aggregation, so a board's top 5 under RB is the top 5 running backs, not the running backs among the overall top 5.

## Boards

Each board shows 5 rows with a "Show all" toggle that expands to 25. A board with no rows under the current filter shows "No players at this position." A row always shows rank, headshot, name, and position pill; the rest varies.

### League leaders (current season)

Current season through `lastScoredWeek`. Every rostered line counts, started or benched. Each row shows the manager who rostered the player most recently that season.

| Board | Value | Extra columns |
| --- | --- | --- |
| Most points | sum of `points` | manager, points |
| Most yards | sum of `yards` | manager, yards |
| Most touchdowns | sum of `touchdowns` | manager, touchdowns |

Rendered as a three-column row. If the current season has no scored weeks the section shows "Season has not started."

### All-time

Started lines only unless noted. Years active = distinct seasons with at least one qualifying line.

| Board | Unit | Value | Extra columns | Link |
| --- | --- | --- | --- | --- |
| Best week by a starter | one started line | `points` | year · week, manager, points | box score |
| Best season by a starter | player + manager + season | sum of started `points` | year, manager, starts, points | `/scores/{year}` |
| Most career points started | player | sum of started `points` | years active, starts, points | none |
| Most weeks started | player | count of started lines | years active, starts | none |
| Most championship rosters | player | count of seasons where the player was on the champion's roster (starters + bench) in the game tagged Final | years as a list, count | none |
| Biggest bench blunder | one benched line | `points` | year · week, manager, points | box score |
| Career PPG | player | sum of `points` over played lines (started or benched) / count of played lines; minimum 12 played lines | years active, games, PPG (1 decimal) | none |

### Postseason

Started lines with `postseason = true`.

| Board | Value | Extra columns |
| --- | --- | --- |
| Most postseason points started | sum of `points` | years, starts, points |
| Most postseason starts | count | years, points, starts |
| Most postseason touchdowns | sum of `touchdowns` | years, starts, touchdowns |
| Most postseason yards | sum of `yards` | years, starts, yards |
| Most postseason receptions | sum of `receptions` | years, starts, receptions |

Kickers and defenses still appear under All in the points and starts boards. The touchdowns, yards and receptions boards show them only if they happen to have a non-zero value, which for DEF yards and K anything is never.

### Extras

Started lines only.

| Board | Value | Extra columns |
| --- | --- | --- |
| Most 30-point starts | count of started lines with `points >= 30` | years, starts, count |
| Most dud starts | count of started lines with `played && points < 5` | years, starts, count |
| Journeyman | count of distinct `userId` who started the player | years, managers, count |

Dud starts require `played` so a bye-week or injured start (0 points, no stats) does not count as a dud; that is a lineup error, not a player failure.

## Streaks (History tab)

Computed from `history.h2h`: flatten every series' games into per-manager results, sort oldest first (year, then week), playoffs included. A streak carries across seasons. A tie ends a streak. For each manager, walk their results in order and record every run of consecutive wins (and separately losses) with its first game and last game.

Two cards under the seasons table, "Longest win streaks" and "Longest losing streaks", each top 5: rank, manager avatar and name, length, span as "2024 Wk 12 to 2025 Wk 3", and an "active" marker when the run includes the manager's most recent game. Ties break by the most recent end. Manager links go to head-to-head.

## UI

- Nav gains "Player stats" after History. Route `/players`, page `PlayersPage`.
- Page header: title and "Through {year} week {n}" from the current season.
- Position filter: a row of toggle buttons (`aria-pressed`), sticky under the nav on wide screens. The chosen position is kept in the URL as `?pos=RB` so a filtered view can be shared.
- Sections: League leaders, All-time, Postseason, Extras, each with a section label and a jump link row under the filter.
- Boards use the existing `card` surface, a header with the board title and a one-line definition in muted text (also as `title` for hover), rows with the same hover and divider treatment as the all-time records lists. Headshots use `Headshot`, positions use `PosPill`, managers use `Avatar` and link to head-to-head.
- Monospace numbers via `num`. Points two decimals, PPG one decimal, yards and counts as integers.

## Files

- `packages/web/src/lib/playerLines.ts`: flatten seasons into lines; position filter.
- `packages/web/src/lib/playerBoards.ts`: one pure function per board, each `(lines, players, opts) => Row[]`, plus a `boards` registry with id, title, definition, section.
- `packages/web/src/lib/streaks.ts`: `longestStreaks(h2h, kind: 'W' | 'L', limit)`.
- `packages/web/src/components/players/PositionFilter.tsx`, `Board.tsx`, `LeadersRow.tsx`.
- `packages/web/src/components/history/StreaksCard.tsx`.
- `packages/web/src/pages/PlayersPage.tsx`; edits to `App.tsx`, `Nav.tsx`, `HistoryPage.tsx`.

## Testing

- `playerLines.test.ts`: lines carry started/benched, derived yards, touchdowns, played, postseason; FLEX filter; unknown position only under All.
- `playerBoards.test.ts`: a two-season fixture with two managers and a handful of players, asserting each board's top rows and the tie order; championship rosters count bench players; PPG minimum games; dud starts ignore unplayed weeks; postseason excludes consolation.
- `streaks.test.ts`: carry across seasons, tie ends a streak, active marker, top-N and tie order.
- `Board.test.tsx`: show-all toggle; empty state.
- `PlayersPage.test.tsx`: filter changes every board and is reflected in the URL.
- `StreaksCard.test.tsx`: renders span and active marker.
- `Nav.test.tsx`: the new link is present.

## Open points resolved

- Position filter applies before aggregation (user: "sortable by position").
- Streaks include playoffs and carry across seasons, matching the all-time records' "every played game" scope.
- Career PPG counts started and benched weeks: it describes the player, not the lineup.
