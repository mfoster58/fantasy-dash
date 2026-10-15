# Player stats v2: per-section filters, season picker, leaders grid, xFP and draft value

**Date:** 2026-10-14
**Status:** approved in conversation; spec awaiting user review. Amends `2026-10-14-player-stats-design.md`; where the two disagree this one wins.

## Why

After seeing the first Player stats tab on real data the user asked for: position pills before names, kickers and defenses out of the Journeyman and dud boards, championship rosters under Postseason, a toilet bowl board, a position filter per section instead of one for the page, a season picker for League leaders, a 4x3 leaders grid with yardage and touchdown splits plus PPG, FPOE and xFP, a cumulative draft value board, and "Show all" expanding a whole section.

## Scope

All changes are in `packages/web`. No core, schema or sync change. The History tab streak cards are untouched.

## Data additions

`PlayerLine` gains raw opportunity and split fields, all `0` when the stat is absent:

| Field | Source stat |
| --- | --- |
| `targets` | `rec_tgt` |
| `carries` | `rush_att` |
| `passAttempts` | `pass_att` |
| `rushYards`, `recYards`, `passYards` | `rush_yd`, `rec_yd`, `pass_yd` |
| `rushTd`, `recTd`, `passTd` | `rush_td`, `rec_td`, `pass_td` |

`yards` and `touchdowns` stay as the sums. `played`, `postseason` and `position` are unchanged.

`BoardContext` gains:

- `picks: DraftValue[]` where `DraftValue = { year: number; playerId: PlayerId; value: number }`, one per draft pick with a non-null `value`, from every season's `draft.picks`.
- `xfp: XfpModel | null`, fitted once from every season's lines (not the filtered ones) and passed through unchanged by the filters.

New tag set `CONSOLATION_TAGS = {Cons-R1, Toilet Bowl, Cons-7th}`; a line's `consolation` flag is true when its game carries one of them.

## xFP model

`packages/web/src/lib/xfp.ts`.

- Fit one ordinary-least-squares line per position in {QB, RB, WR, TE}: `points = a + b1·targets + b2·carries + b3·passAttempts`, over every **played** line at that position across all seasons, started or benched. Solve the 4x4 normal equations by Gaussian elimination.
- A position with fewer than 20 played lines, or a singular system, has no model. `predict(line)` returns `null` for it and for K, DEF and `?`.
- `predict` returns the fitted value rounded to 2 decimals, not clamped.
- The model is a volume-based approximation: no field position, air yards or down and distance. Board definitions say so.

## Filters and URL state

- Each section has its own position filter under its title, the same `PositionFilter` component and options as before. The page-level filter and sticky bar are removed.
- League leaders also has a season picker listing every season in `history.seasons`, newest first, defaulting to the current season.
- URL parameters: `lead`, `all`, `post`, `extra` hold each section's position (absent means All; an unknown value means All); `season` holds the leaders year (absent or not a known season means current). `setParams` uses `replace: true`.
- Filters narrow lines before aggregation, as before. The xFP model and `picks` are not filtered; boards that use `picks` filter them by the player's directory position.

## Section-wide expand

Each section keeps one `expanded` boolean. Any board's "Show all" button in that section toggles it, so every board in the section shows up to 25 rows or 5 rows together. Button label: "Show all" when collapsed, "Show less" when expanded; it appears on a board only when that board has more than 5 rows. A board with 5 or fewer rows simply shows them all in either state.

## Row layout

Rank, headshot, **position pill, then name**, meta/detail line, value. Everything else as before.

## Boards

Sections and order:

### League leaders (selected season, every rostered line, started or benched)

4x3 grid, three per row on medium screens and up.

| Row | Board | Value | Notes |
| --- | --- | --- | --- |
| 1 | Most points | sum `points` | |
| 1 | Most yards | sum `yards` | |
| 1 | Most touchdowns | sum `touchdowns` | |
| 2 | Rushing yards | sum `rushYards` | |
| 2 | Receiving yards | sum `recYards` | |
| 2 | Passing yards | sum `passYards` | |
| 3 | Rushing TDs | sum `rushTd` | |
| 3 | Receiving TDs | sum `recTd` | |
| 3 | Passing TDs | sum `passTd` | |
| 4 | PPG | sum `points` / played lines, played lines ≥ 3 | 1 decimal; detail "N games" |
| 4 | FPOE | sum over played lines of `points − predict(line)` | signed, 1 decimal; lines with no model are skipped; a player needs ≥ 3 modelled lines; **direction toggle** "Over" (desc, default) / "Under" (asc) in the board header; detail "xFP N" |
| 4 | xFP | sum of `predict(line)` over played lines, ≥ 3 modelled lines | 1 decimal; detail "actual N" |

Rows show the manager who rostered the player most recently that season. A selected season with no lines shows "Season has not started." in place of the grid. A position filter that leaves a board empty shows that board's empty state.

### All-time (started lines unless noted)

Best week by a starter, Best season by a starter, Most career points started, Most weeks started, Biggest bench blunder, Career PPG. Definitions unchanged. Most championship rosters leaves this section.

### Postseason

| Board | Lines | Value |
| --- | --- | --- |
| Most postseason points started | started, `postseason` | sum `points` |
| Most postseason starts | started, `postseason` | count |
| Most postseason touchdowns | started, `postseason` | sum `touchdowns` |
| Most postseason yards | started, `postseason` | sum `yards` |
| Most postseason receptions | started, `postseason` | sum `receptions` |
| Most championship rosters | champion's roster in the game tagged Final, starters and bench | seasons |
| Most toilet bowl starts | started, `consolation` | count; detail "N pts" |

Section note becomes: "Championship bracket unless the board says otherwise."

### Extras (started lines)

| Board | Value | Notes |
| --- | --- | --- |
| Most 30-point starts | count `points ≥ 30` | |
| Most dud starts | count `played && points < 5` | **K and DEF excluded** |
| Journeyman | distinct managers who started the player | **K and DEF excluded** |
| Cumulative draft value | sum of `value` over the player's picks | signed, 1 decimal; detail lists each year "2024 +38.2 · 2025 −12.0"; sorted desc; definition notes the in-progress season's value moves weekly |

Ties and the 25-row cap are as before. Signed values use `fmtSigned(v, 1)`.

## Files

- Modify `lib/playerLines.ts`: new fields, `CONSOLATION_TAGS`, `consolation`.
- Create `lib/xfp.ts`: `fitXfp(lines): XfpModel`, `XfpModel.predict(line): number | null`.
- Modify `lib/playerBoards.ts`: new fields on `BoardContext`; new boards; K/DEF exclusion; section moves; `BoardDef.sortable?: true` for FPOE and a `direction` argument on `compute`.
- Modify `components/players/Board.tsx`: pill before name; `expanded`/`onToggle` props replace internal state; optional direction toggle.
- Create `components/players/Section.tsx`: title, note, position filter, optional season picker (reusing the existing `components/SeasonPicker.tsx`, props `{ years, value, onChange }`), section-wide expand, grid.
- Modify `components/players/PlayersView.tsx`: per-section URL state, xFP fit, picks.
- Modify `pages/PlayersPage.tsx` only if props change.
- Tests alongside each.

## Testing

- `playerLines.test.ts`: new fields derive correctly; `consolation` flag for each consolation tag and not for QF/Final.
- `xfp.test.ts`: a fixture whose points are an exact linear function of opportunities recovers the coefficients; fewer than 20 lines yields no model; K/DEF predict null.
- `playerBoards.test.ts`: each new leaders board; PPG minimum; FPOE both directions and xFP with a fixture where the model is exact; toilet bowl counts only consolation tags; dud starts and Journeyman drop K/DEF; championship rosters under postseason; cumulative draft value sums picks and lists years; registry order per section.
- `Board.test.tsx`: pill precedes name in DOM order; controlled expand; direction toggle fires.
- `Section.test.tsx`: one toggle expands every board; filter narrows the section only.
- `PlayersView.test.tsx`: per-section params in the URL; season picker switches leaders and writes `season`; junk values fall back.
