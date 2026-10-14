# Draft value v2: redraft position, draft capital, production

**Date:** 2026-10-14
**Status:** approved by the user in conversation; supersedes the draft value method in the Phase 4 plan.

## Why

The Phase 4 draft value (positional draft rank minus positional finish rank) has three problems the user raised while reviewing the 2026 board:

1. It is asymmetric. A steal can gain at most its draft rank; a bust can fall 150 ranks. Summed value is negative for every manager.
2. It punishes late-round darts that miss as hard as early-round whiffs. In practice a 14th-round miss costs nothing and a 1st-round miss costs the season.
3. A top pick who dominates (Gibbs, pick 1, RB1 by a mile) scores exactly 0.

## Method

All value math excludes kickers and defenses (added K on 2026-10-14 at the user's request; both are streamed). K and DEF picks still appear on the board with season points, but every value field is null and they are left out of grades, steals, busts and the PPG list. Baseline ranks: QB10, RB24, WR24, TE12.

**Positional scarcity weight (added 2026-10-14 after review of the 2024 board):** `POSITION_WEIGHTS = { QB: 0.5 }`. A quarterback's points over baseline are halved before the redraft ranking and before the contribution used for production value. The displayed `pointsOverBaseline` stays unweighted. 0.5 was calibrated against Sleeper's real next-year ADP for 2023→2024, 2024→2025 and 2025→2026: with weight 1, Lamar Jackson's 2024 season ranked him redraft 6 against a real 2025 ADP of 21.9; with 0.5 he ranks 21.

### Bye adjustment (added 2026-10-14)

Before any ranking, a player's points are scaled by `maxTeamGames / teamGames[team]`, where `maxTeamGames` is the most games any NFL team has played so far. A team that has had its bye is therefore not behind; games missed while the team played still count as zero. Displayed `seasonPoints` stay raw; `pointsOverBaseline` is bye-adjusted. The factor is applied only while the season is in progress (`byeAdjust = status === 'in_season'`); for a completed season it is skipped entirely, because team games are attributed by players' current teams and a stale team can otherwise inflate a finished year (Achane 2025 briefly showed +320).

### Contribution

`pointsOverBaseline` (PoB) stays as is: season points minus the points of the last startable player at the position, where the pool is every player in the directory at that position with points > 0. `contribution = max(PoB · weight, −benchGap · weight)` where `benchGap` is the baseline minus the pool entry at `BENCH_RANKS = { QB: 14, RB: 40, WR: 40, TE: 16 }` (0 if the pool is shorter). A player below bench level is worth bench level; a bench-level player (DK Metcalf, WR35) is worth more than a useless one (Jonathon Brooks). (Until 2026-10-14 the floor was 0, which made those two look identical.)

### Redraft position

Rank every directory player at a valued position by weighted PoB descending (ties: season points desc, then id asc) across all positions together. The rank is `redraftPos`, where the player would go if the league redrafted today on production. Players with 0 points tie at N + 1 where N is the number of ranked players with points > 0.

### Slot value (draft capital)

`capital(pick) = 100 · exp(−(pick − 1) / 45)`. Pick 1 = 100, pick 15 ≈ 73, pick 30 ≈ 52, pick 60 ≈ 27, pick 110 ≈ 9, pick 160 ≈ 3.

`slotValue = capital(redraftPos) − capital(pickNo)`, rounded to 1 decimal.

### Production value

Fit an expected-contribution curve to the season's own draft: `expected(pick) = a · exp(−(pick − 1) / k) + c`. Choose `k` from the integers 10..120 and `a`, `c` by simple linear regression on `x = exp(−(pick−1)/k)` at each `k`, keeping the triple with the smallest squared error over all valued picks. The offset `c` lets late-pick expectation sit below replacement, so a late dart that scores nothing is near expectation. Fit uses `contribution`, not raw PoB.

`productionValue = contribution − expected(pickNo)`, rounded to 1 decimal, in points to date. (An earlier revision multiplied by a full-season pace `weeks.length / lastScoredWeek`; it was removed on 2026-10-14 because five weeks × 3.4 let production swamp slot value early in the season. Without it, production grows naturally as the season fills in and the two parts are on comparable scales by season's end.)

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

These were computed with a redraft pool of drafted players only, before the QB weight, and without a pace factor (which matches the final method). The implementation uses the whole directory as the redraft pool. Signs and ordering must match; magnitudes differ slightly.

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

`posFinishRank` is removed. `Draft` gains `expectedCurve: { a: number; k: number; c: number } | null` so the UI can explain the fit. Zod schema, `satisfies` guards, and the sync's `RawSeasonInput` (`playerGames`, `teamGames`, `trades`) change accordingly. `SleeperClient` gains `getTransactions(leagueId, week)` and a `SleeperTransaction` type (`type`, `status`, `leg`, `created`, `adds`, `drops`, `roster_ids`).

## UI

### Board

- **Value mode colors**: a red → yellow → green diverging scale on `value`. Yellow at 0, full red at ≤ −120, full green at ≥ +120, linear in between, mixed in OKLCH. Stops: red `#d64545`, yellow `#e6c229`, green `#2f9e5f`. Cells in value mode use dark text (`#1a1a1a`) for contrast on both themes. Null value cells are transparent. Position mode is unchanged.
- **Cell content**: in value mode the trailing number is the total `value` (signed, 0 decimals).
- **Tooltip** lines: name · pos · team; `Pick N (round R)`; `Season points[ to date]: X`; `Redraft position[ today]: P (drafted WRk)`; `Slot value: ±S · Production value: ±Q`; `Points over baseline: ±B`; `PPG: x.x over G games`; `Keeper` if keeper; `Traded to NAME in week W` if traded.
- **Keeper marker**: no text. The cell gets an inset accent ring (`ring-1 ring-inset ring-accent`, same treatment the manager highlight uses, which takes precedence when both apply) and a 10px lock icon (inline SVG, `aria-label="Keeper"`) in the top-right corner.
- **Trade marker**: a 10px swap icon (inline SVG, two opposing arrows, `aria-label="Traded"`) followed by the receiving manager's display name, in the cell's second line before the value number. Truncates with the line.

### Analysis

- **Grades table** columns: Manager, Value, Slot, Production, Pts over baseline, Best pick, Worst pick. Sorted by Value desc, tiebreak Pts over baseline desc. Best/worst are by `value`. Methodology note replaces the current one:
  > Value has two parts. Slot value converts the pick taken and the player's redraft position (where they would go if the league redrafted on this season's production) into draft capital on a trade-value curve, so a late dart that misses costs almost nothing and an early whiff costs most of what was spent. Production value is points over the positional baseline minus what a pick in that slot typically returns this season[, to date]. Quarterback points count at half weight, matching how a one-QB league actually prices them. Kickers and defenses are excluded.
- **Steals and busts**: 10 each, by `value`. The pick line shows `pick N → redraft P · pick N · manager` and the total value, with PoB as the small trailing number.
- **Top PPG (healthy)**: new card under the analysis grid. Top 10 picks by `ppg` among picks with `healthy === true` and a non-null value. Columns: Player (headshot, name, pos pill, team), Pick, Manager, G, PPG. Label "Top PPG (healthy)" with the in-season "(to date)" suffix. Footnote: "Healthy means the player has played every game their team has played."

### Season review

`DraftRoundOne` shows each round-1 pick's total `value` with the same color/sign treatment it uses today.

## Sync and data

Sync adds the games/team/trade collection (one extra request per week per season for transactions). Regenerate `data/` for all four seasons and commit it, as today.

## Testing

- Core: unit tests for `capital`, `fitExpectedCurve` (recovers a known a/k from synthetic data), `computeDraftValues` (DEF null, redraft ties, slot/production/total on a small fixture, QB weight, zero-weeks null), trade resolution (latest by created, roster → user mapping), healthy/ppg.
- Web: `valueColor` endpoints and midpoint, `managerDraftSummaries` sort, `leagueExtremes` size 10, `topHealthyPpg` filtering, DraftBoard renders lock/trade markers.
- Screenshot check of `/draft/2026` and `/draft/2025` in both modes at desktop and phone widths.

## Out of scope

Letter grades, keeper-aware baselines, real Sleeper ADP (available per season from `api.sleeper.com/projections/nfl/{year}` as `adp_ppr`, noted for a future "reach vs ADP" view), waiver/drop markers.
