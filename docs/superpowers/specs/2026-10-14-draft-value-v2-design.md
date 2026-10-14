# Draft value v2: redraft position, draft capital, production

**Date:** 2026-10-14
**Status:** approved by the user in conversation; supersedes the draft value method in the Phase 4 plan.

## Why

The Phase 4 draft value (positional draft rank minus positional finish rank) has three problems the user raised while reviewing the 2026 board:

1. It is asymmetric. A steal can gain at most its draft rank; a bust can fall 150 ranks. Summed value is negative for every manager.
2. It punishes late-round darts that miss as hard as early-round whiffs. In practice a 14th-round miss costs nothing and a 1st-round miss costs the season.
3. A top pick who dominates (Gibbs, pick 1, RB1 by a mile) scores exactly 0.

## Method

All value math excludes defenses. DEF picks still appear on the board with season points, but every value field is null and they are left out of grades, steals, busts and the PPG list. Kickers stay in. Baseline ranks are unchanged: QB10, RB24, WR24, TE12, K10.

### Contribution

`pointsOverBaseline` (PoB) stays as is: season points minus the points of the last startable player at the position, where the pool is every player in the directory at that position with points > 0. `contribution = max(PoB, 0)`: a player below replacement level is worth nothing because a free agent could replace them.

### Redraft position

Rank every directory player at a valued position by PoB descending (ties: season points desc, then id asc) across all positions together. The rank is `redraftPos`, where the player would go if the league redrafted today on production. Players with 0 points tie at N + 1 where N is the number of ranked players with points > 0.

### Slot value (draft capital)

`capital(pick) = 100 · exp(−(pick − 1) / 45)`. Pick 1 = 100, pick 15 ≈ 73, pick 30 ≈ 52, pick 60 ≈ 27, pick 110 ≈ 9, pick 160 ≈ 3.

`slotValue = capital(redraftPos) − capital(pickNo)`, rounded to 1 decimal.

### Production value

Fit an expected-contribution curve to the season's own draft: `expected(pick) = a · exp(−(pick − 1) / k)`. Choose `k` from the integers 10..120 and `a` by closed-form least squares at each `k` (`a = Σ x·c / Σ x²` with `x = exp(−(pick−1)/k)`), keeping the pair with the smallest squared error over all valued picks. Fit uses `contribution`, not raw PoB.

`productionValue = (contribution − expected(pickNo)) · pace`, rounded to 1 decimal, where `pace = weeks.length / lastScoredWeek` (1.0 for a completed season). Pace keeps the production component on a full-season scale during the year so it is comparable with slot value.

### Total

`value = slotValue + productionValue`, rounded to 1 decimal. Positive is good.

If `lastScoredWeek` is 0 (draft done, no games played) every value field, including PoB and redraftPos, is null.

### Reference results (2026 board, through week 5)

| Player | Pick → redraft | Slot | Production | Total |
|---|---|---|---|---|
| Jaxon Smith-Njigba | 18 → 2 | +29 | +53 | +82 |
| Jahmyr Gibbs | 1 → 1 | 0 | +61 | +61 |
| Matthew Golden | 110 → 35 | +38 | +16 | +54 |
| Parker Washington | 60 → 30 | +25 | +13 | +38 |
| Omarion Hampton | 14 → 70 | −53 | −30 | −83 |
| Saquon Barkley | 11 → 129 | −74 | −32 | −106 |
| De'Von Achane | 8 → 126 | −79 | −35 | −114 |

These were computed with a redraft pool of drafted players only and a 5-week pace of 3.4, so the implementation's exact numbers will differ slightly (the pool is the whole directory). Signs and ordering must match.

### Games played, PPG, healthy

The sync records `gamesPlayed` per player (count of scored weeks whose stat line has `gp ≥ 1`) and `teamGames` per NFL team (count of scored weeks in which at least 25 players on that team have `gp ≥ 1`, team taken from the player directory; the threshold keeps players who have since changed teams from crediting their current team with a game on its bye week). Each pick carries `gamesPlayed`, `ppg = seasonPoints / gamesPlayed` (null when 0 games) and `healthy = gamesPlayed > 0 && gamesPlayed >= teamGames[team]` (false when the player has no team).

### Trades

The sync fetches `/league/{id}/transactions/{week}` for weeks 1..maxWeek and keeps transactions with `type === 'trade'` and `status === 'complete'`. For each `adds[playerId] = rosterId`, the player moved to that roster in that transaction's `leg` (week). A drafted player's `tradedTo` is `{ userId, week }` from the latest such trade by `created`, else null. Waiver moves are not trades and are not marked.

## Data model

`DraftPick` becomes:

```ts
interface DraftPick {
  round: number; pickNo: number; slot: number; userId: UserId; playerId: PlayerId; isKeeper: boolean;
  posDraftRank: number | null;        // unchanged (null for DEF / unknown)
  seasonPoints: number;
  gamesPlayed: number;
  ppg: number | null;
  healthy: boolean;
  pointsOverBaseline: number | null;  // null for DEF / unknown / no games yet
  redraftPos: number | null;
  slotValue: number | null;
  productionValue: number | null;
  value: number | null;               // slotValue + productionValue
  tradedTo: { userId: UserId; week: number } | null;
}
```

`posFinishRank` is removed. `Draft` gains `expectedCurve: { a: number; k: number } | null` so the UI can explain the fit. Zod schema, `satisfies` guards, and the sync's `RawSeasonInput` (`playerGames`, `teamGames`, `trades`) change accordingly. `SleeperClient` gains `getTransactions(leagueId, week)` and a `SleeperTransaction` type (`type`, `status`, `leg`, `created`, `adds`, `drops`, `roster_ids`).

## UI

### Board

- **Value mode colors**: a red → yellow → green diverging scale on `value`. Yellow at 0, full red at ≤ −60, full green at ≥ +60, linear in between, mixed in OKLCH. Stops: red `#d64545`, yellow `#e6c229`, green `#2f9e5f`. Cells in value mode use dark text (`#1a1a1a`) for contrast on both themes. Null value cells are transparent. Position mode is unchanged.
- **Cell content**: in value mode the trailing number is the total `value` (signed, 0 decimals).
- **Tooltip** lines: name · pos · team; `Pick N (round R)`; `Season points[ to date]: X`; `Redraft position[ today]: P (drafted WRk)`; `Slot value: ±S · Production value: ±Q`; `Points over baseline: ±B`; `PPG: x.x over G games`; `Keeper` if keeper; `Traded to NAME in week W` if traded.
- **Keeper marker**: no text. The cell gets an inset accent ring (`ring-1 ring-inset ring-accent`, same treatment the manager highlight uses, which takes precedence when both apply) and a 10px lock icon (inline SVG, `aria-label="Keeper"`) in the top-right corner.
- **Trade marker**: a 10px swap icon (inline SVG, two opposing arrows, `aria-label="Traded"`) followed by the receiving manager's display name, in the cell's second line before the value number. Truncates with the line.

### Analysis

- **Grades table** columns: Manager, Value, Slot, Production, Pts over baseline, Best pick, Worst pick. Sorted by Value desc, tiebreak Pts over baseline desc. Best/worst are by `value`. Methodology note replaces the current one:
  > Value has two parts. Slot value converts the pick taken and the player's redraft position (where they would go if the league redrafted on this season's production) into draft capital on a trade-value curve, so a late dart that misses costs almost nothing and an early whiff costs most of what was spent. Production value is points over the positional baseline minus what a pick in that slot typically returns this season[, on a 17-week pace]. Defenses are excluded.
- **Steals and busts**: 10 each, by `value`. The pick line shows `pick N → redraft P · pick N · manager` and the total value, with PoB as the small trailing number.
- **Top PPG (healthy)**: new card under the analysis grid. Top 10 picks by `ppg` among picks with `healthy === true` and a non-null value. Columns: Player (headshot, name, pos pill, team), Pick, Manager, G, PPG. Label "Top PPG (healthy)" with the in-season "(to date)" suffix. Footnote: "Healthy means the player has played every game their team has played."

### Season review

`DraftRoundOne` shows each round-1 pick's total `value` with the same color/sign treatment it uses today.

## Sync and data

Sync adds the games/team/trade collection (one extra request per week per season for transactions). Regenerate `data/` for all four seasons and commit it, as today.

## Testing

- Core: unit tests for `capital`, `fitExpectedCurve` (recovers a known a/k from synthetic data), `computeDraftValues` (DEF null, redraft ties, slot/production/total on a small fixture, pace, zero-weeks null), trade resolution (latest by created, roster → user mapping), healthy/ppg.
- Web: `valueColor` endpoints and midpoint, `managerDraftSummaries` sort, `leagueExtremes` size 10, `topHealthyPpg` filtering, DraftBoard renders lock/trade markers.
- Screenshot check of `/draft/2026` and `/draft/2025` in both modes at desktop and phone widths.

## Out of scope

Letter grades, keeper-aware baselines, real Sleeper ADP (available per season from `api.sleeper.com/projections/nfl/{year}` as `adp_ppr`, noted for a future "reach vs ADP" view), waiver/drop markers.
