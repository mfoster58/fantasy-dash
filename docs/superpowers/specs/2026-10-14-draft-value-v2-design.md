# Draft value v2: production on one capital scale

**Date:** 2026-10-14
**Status:** approved by the user in conversation; supersedes the draft value method in the Phase 4 plan. Revised 2026-10-15: the two-part slot + production sum was replaced by a single capital-scale value (see *Earned pick* and *Value*). Revised again the same day: capital for earned picks before 1 is bounded (see *Value*) and the capital decay was steepened from 45 to 40, then to 35.

## Why

The Phase 4 draft value (positional draft rank minus positional finish rank) has three problems the user raised while reviewing the 2026 board:

1. It is asymmetric. A steal can gain at most its draft rank; a bust can fall 150 ranks. Summed value is negative for every manager.
2. It punishes late-round darts that miss as hard as early-round whiffs. In practice a 14th-round miss costs nothing and a 1st-round miss costs the season.
3. A top pick who dominates (Gibbs, pick 1, RB1 by a mile) scores exactly 0.

## Method

All value math excludes kickers and defenses (added K on 2026-10-14 at the user's request; both are streamed). K and DEF picks still appear on the board with season points, but every value field is null and they are left out of grades, steals, busts and the PPG list. Baseline ranks: QB10, RB24, WR24, TE12.

**Positional market weight (added 2026-10-14 as `{ QB: 0.5 }` after review of the 2024 board; refit 2026-10-15):** `POSITION_WEIGHTS = { QB: 0.65, RB: 0.65, TE: 0.5 }`, receivers at 1. A position's points over baseline are scaled before the redraft ranking and before the contribution used for production value. The displayed `pointsOverBaseline` stays unweighted.

The weights are fitted by `scripts/fit-position-weights.ts` against this league's own 2023-2025 drafts (rerun it after a season completes; it exits non-zero when the fit drifts from the constants). For the top K finishers by season points at each position among drafted players (`TOP_K = { QB: 6, RB: 12, WR: 12, TE: 6 }`, roughly what the league starts), compare the capital of the finisher's earned pick with the capital of the pick at which the league took the Nth player at that position; the mean of that difference must be the same for every position. Capital (`earnedCapital` minus `capital`) is the space grades sum in and is bounded before pick 1 and off the board, so nothing is clipped. The top finishers at every position beat their slots on average (they are the realised winners against a curve fitted through the busts), so the fit removes only the difference between positions; receivers are fixed at 1 and the search is coordinate descent over a 0.05-1.5 grid, with a warning if a weight lands on a grid edge. With weight 1 the model put 16 tight ends in its pooled top 36 earned picks against 8 drafted there by the league; at the fitted weights it is 12.

The result is a calibration, not a measurement. A single multiplier cannot match a market that is convex at a position (the league prices TE1 about where the model does but takes TE4-6 three rounds later than their production), so K decides which end dominates: K = 3/6/6/3 gives TE 0.65, RB 0.8; K = baseline ranks gives TE 0.45, RB 0.6. Two-season subsets give TE 0.4-0.55, RB 0.55-0.75, QB 0.55-0.85. The 2026-10-15 refit replaces the earlier QB 0.5, which was calibrated against Sleeper's cross-league next-year ADP rather than this league's own drafts.

### Bye adjustment (added 2026-10-14)

Before any ranking, a player's points are scaled by `maxTeamGames / teamGames[team]`, where `maxTeamGames` is the most games any NFL team has played so far. A team that has had its bye is therefore not behind; games missed while the team played still count as zero. Displayed `seasonPoints` stay raw; `pointsOverBaseline` is bye-adjusted. The factor is applied only while the season is in progress (`byeAdjust = status === 'in_season'`); for a completed season it is skipped entirely, because team games are attributed by players' current teams and a stale team can otherwise inflate a finished year (Achane 2025 briefly showed +320).

### Contribution

`pointsOverBaseline` (PoB) stays as is: season points minus the points of the last startable player at the position, where the pool is every player in the directory at that position with points > 0. `contribution = max(PoB · weight, −benchGap · weight)` where `benchGap` is the baseline minus the pool entry at `BENCH_RANKS = { QB: 14, RB: 40, WR: 40, TE: 16 }` (0 if the pool is shorter). A player below bench level is worth bench level; a bench-level player (DK Metcalf, WR35) is worth more than a useless one (Jonathon Brooks). (Until 2026-10-14 the floor was 0, which made those two look identical.)

### Redraft position

Rank every directory player at a valued position by weighted PoB descending (ties: season points desc, then id asc) across all positions together. The rank is `redraftPos`, where the player would go if the league redrafted today on production. Players with 0 points tie at N + 1 where N is the number of ranked players with points > 0.

### Why one scale (revised 2026-10-15)

The first revision summed a slot value (capital at redraft position minus capital at the pick) and a production value (contribution minus the fitted expectation at the pick, in points). Reviewing it on the 2026 and 2025 boards showed three problems: the two parts measure the same outcome twice, so steals and busts were double counted; production is in raw points and grows all season while slot is capped at ±100, so by week 17 production was 2–3× slot (2025: McCaffrey +165 production vs +22 slot); and a late zero-point dart sat 7–10 points under the curve's late asymptote, so eight bench whiffs cost a full letter grade even though the waiver wire replaces them for free. The user asked for top players to be rewarded for out-producing a typical RB1 without skewing totals, and for late whiffs to be nearly free.

### Earned pick

Fit the expected-contribution curve as before: `expected(pick) = a · exp(−(pick − 1) / k) + c`, `k` searched over the integers 10..120, `a` and `c` by linear regression at each `k`, least squared error over all valued picks, fitted to `contribution`.

Run the curve backwards for each pick: `earnedPick = 1 − k · ln((contribution − c) / a)`. This is the pick at which that much contribution is typically found this season. It is below 1 for a player who out-produces what pick 1 returns (Gibbs 2026 through week 5: −27; McCaffrey 2025: −17.4) and null ("off the board") when `contribution ≤ c` or the fit is degenerate (`a ≤ 0`). If the curve cannot be fitted at all (fewer than two valued picks) the earned pick falls back to `redraftPos`. Stored to 1 decimal.

### Value

`capital(pick) = 100 · exp(−(pick − 1) / 35)` (pick 30 ≈ 44, pick 60 ≈ 19, pick 130 ≈ 2.5).

`earnedCapital(earnedPick)`: for an earned pick ≥ 1 it is `capital(earnedPick)`. For an earned pick before 1 the capital stops compounding: `100 + 50 · (1 − exp(−(1 − earnedPick) / 25))`, so beating pick 1's expectation adds a bonus that approaches a ceiling of 50 (about 32 of it by 25 picks before 1, 150 total at the limit). Off the board is worth 0.

Why bounded: the fitted curve's top is low because first-round picks bust often (2023: pick 1 expected only 61 over baseline, and 18 players beat it), so "before pick 1" is common. Left on the exponential, McCaffrey 2023 (contribution 214, earned pick −45) was worth 278 capital and +181 value, ahead of every late-round steal; the user's intuition was that a 24-ppg season at pick 2 is a good pick, not three first-rounders, and that Mostert in round 15 or Kamara and Evans in round 9 are the real league winners. With the ceiling McCaffrey is +45 and those three are +117, +80 and +95. The decay was steepened at the same time so mid and late hits net a little more while early busts barely move; the user then chose 35 over 40 after seeing a comparison (Pickens 2025, pick 58: +68 → +76; Walker 2026: +76; team totals drift up ~10–30 and the best-to-worst spread narrows slightly).

`gain = earnedCapital(earnedPick) − capital(pickNo)`. **Surplus premium:** a positive gain is multiplied by `1 + 0.25 · (1 − capital(pickNo) / 100)` (×1 at pick 1, ≈ ×1.14 at pick 30, ≈ ×1.24 at pick 100); a negative gain is not scaled. `value` is the result rounded to 1 decimal. Rationale (user, 2026-10-15): late-round top hits are league winners and were structurally capped near 100 because a cheap pick's value is just its earned capital; the premium lifts true late gems 15–30 in proportion to production while a middling late hit moves ~10. Rejected alternative: a flat bonus per round gained (ADP-difference style), which paid a deep mediocre pick as much as a genuine steal and also bumped before-pick-1 stars. Positive is good. The most a pick can lose is the capital spent on it (round 1 whiff ≈ −85 to −100, round 13 dart ≈ −5); hits are judged on production, so a late pick that hits is worth the whole gap, and a dominant early pick scores positive from pick 1 (at most +50 at pick 1).

`redraftPos` is kept as a display statistic only and no longer enters the value.

If `lastScoredWeek` is 0 (draft done, no games played) every value field, including PoB, contribution, earned pick and redraftPos, is null.

### Reference results (2026 board, through week 5)

| Player | Pick | Contribution | Earned pick | Value |
|---|---|---|---|---|
| Javonte Williams | 96 | +45.9 | −1.4 | +121 |
| Chuba Hubbard | 68 | +48.7 | −3.2 | +113 |
| Kenneth Walker | 23 | +87.5 | −21.6 | +85 |
| Jaxon Smith-Njigba | 18 | +77.4 | −17.6 | +70 |
| Jahmyr Gibbs | 1 | +103.6 | −27.0 | +34 |
| Justin Jefferson | 7 | +1.5 | 60.8 | −66 |
| De'Von Achane | 8 | −17.0 | off board | −82 |

Historical anchors: McCaffrey 2023 (pick 2) +45, Mostert 2023 (pick 143) +147, Evans 2023 (pick 84) +121, Kamara 2023 (pick 85) +101, Pickens 2025 (pick 58) +91. 2026 manager totals run about +265 to −150; 2025 final about +248 to −111. Totals shift upward with the premium; grades are rank-based so letters are unaffected.

### Games played, PPG, healthy

The sync records `gamesPlayed` per player (count of scored weeks whose stat line has `gp ≥ 1`) and `teamGames` per NFL team (count of scored weeks in which at least 25 players on that team have `gp ≥ 1`). The team comes from that week's row in `api.sleeper.com/stats/nfl/{season}/{week}?season_type=regular` (`SleeperClient.getWeekStats`), which lists the team the player suited up for that week; the directory's current team is only the fallback when the rows are missing, and the threshold keeps that fallback from crediting a bye-week team. Each pick carries `gamesPlayed`, `ppg = seasonPoints / gamesPlayed` (null when 0 games) and `healthy = gamesPlayed > 0 && gamesPlayed >= teamGames[team]` (false when the player has no team).

### Season teams (added 2026-10-15)

`Season.playerTeams: Record<PlayerId, string>` is the NFL team each player last suited up for in that season (later weeks overwrite earlier ones, so a midseason trade ends on the new team; trimmed to the kept player ids like `playerSeasons`). The draft math (`DraftValueInput.playerTeams`) and every team label in the UI (board cells and tooltips, team panel, round-one list, box score lineups, score card top performers) read `playerTeam(players, id, season.playerTeams)`, falling back to the directory's current team only when the season has no record. So Saquon is NYG on the 2023 pages and PHI on 2024+.

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
  redraftPos: number | null;          // display only
  contribution: number | null;        // weighted PoB floored at bench level
  earnedPick: number | null;          // null = off the board
  value: number | null;               // earnedCapital(earnedPick) − capital(pickNo)
  tradedTo: { userId: UserId; week: number } | null;
}
```

`posFinishRank` is removed. `Draft` gains `expectedCurve: { a: number; k: number; c: number } | null` and `baselines: Record<pos, { baselineRank, baselinePoints, benchRank, benchPoints }>` (empty before week 1) so the grading page can explain the fit with the season's own numbers. Zod schema, `satisfies` guards, and the sync's `RawSeasonInput` (`playerGames`, `teamGames`, `trades`) change accordingly. `SleeperClient` gains `getTransactions(leagueId, week)` and a `SleeperTransaction` type (`type`, `status`, `leg`, `created`, `adds`, `drops`, `roster_ids`).

## UI

### Board

The board opens in value mode (2026-10-15; it opened in position mode before); the Position / Value toggle is unchanged.

- **Value mode colors**: a red → yellow → green diverging scale on `value`. Yellow at 0, full red at ≤ −60, full green at ≥ +60, linear in between, mixed in OKLCH, laid over transparent at 45% (was ±120 and 30%; the user wanted a more drastic gradient with more visible green). Stops: red `#d64545`, yellow `#e6c229`, green `#2f9e5f`. Cells in value mode use dark text (`#1a1a1a`) for contrast on both themes. Null value cells are transparent. Position mode is unchanged.
- **Cell content**: in value mode the trailing number is the total `value` (signed, 0 decimals).
- **Tooltip** lines: name · pos · team; `Pick N (round R)`; `Season points[ to date]: X`; `Redraft position[ today]: P (drafted WRk)`; `Earned pick: E (drafted N)` or `Earned pick: off the board`; `Points over baseline: ±B`; `PPG: x.x over G games`; `Keeper` if keeper; `Traded to NAME in week W` if traded.
- **Keeper marker**: no text. The cell gets an inset accent ring (`ring-1 ring-inset ring-accent`, same treatment the manager highlight uses, which takes precedence when both apply) and a 10px lock icon (inline SVG, `aria-label="Keeper"`) in the top-right corner.
- **Trade marker**: a 10px swap icon (inline SVG, two opposing arrows, `aria-label="Traded"`) followed by the receiving manager's display name, in the cell's second line before the value number. Truncates with the line.

### Analysis

- **Draft grades card**: ranked list (rank badge, avatar, name, bar, total, letter) with the subline `X of Y picks beat their slot · +hits · −misses`. No methodology paragraph; the header carries a "How grading works" link to `/draft/grading`.
- **Best and worst picks row** (below the grades + team panel): a shared position filter (All / QB / RB / WR / TE, by today's directory position) and four `PickList` cards: Top steals and Top busts for the season, All-time best and All-time worst draft values (completed seasons; `history.topDraftValues` / `history.worstDraftValues`, each stored 100 deep so a position filter still fills the list). Each card shows 10 rows with a "Show all 25" / "Show top 10" toggle, and an empty-state line when the filter leaves nothing.
- **Grading page** (`/draft/grading`, `GradingPage.tsx`): walks the method through the latest completed season with a draft. Sections: one-sentence idea; step 1 production over replacement (that season's baseline/bench table from `draft.baselines`, QB weight, K/DEF, bye note); step 2 the expectation curve (SVG scatter of contribution vs pick with the fitted curve, the floor, a shaded "better than pick 1" region, and five highlighted examples with their earned picks traced); step 3 earned pick; step 4 capital (SVG capital curve with reference picks and the dashed 150 ceiling before pick 1, paired spent/earned bars per example, and a worked table: pick, capital spent, contribution, earned pick, capital earned, value); step 5 from picks to grades (that season's totals and letters); fine print. Examples come from `lib/grading.ts` `gradingExamples`: most productive player, biggest steal after pick 50, biggest bust, best late dart (after round 9), a late dart (after round 11) that is off the board.
- **Steals and busts**: 10 each, by `value`. The pick line shows `pick N → redraft P · pick N · manager` and the total value, with PoB as the small trailing number.
- **Top PPG (healthy)**: new card under the analysis grid. Top 10 picks by `ppg` among picks with `healthy === true` and a non-null value. Columns: Player (headshot, name, pos pill, team), Pick, Manager, G, PPG. Label "Top PPG (healthy)" with the in-season "(to date)" suffix. Footnote: "Healthy means the player has played every game their team has played."

### Season review

`DraftRoundOne` shows each round-1 pick's total `value` with the same color/sign treatment it uses today.

## Sync and data

Sync adds the games/team/trade collection (two extra requests per week per season: transactions and the weekly team rows). Regenerate `data/` for all four seasons and commit it, as today.

## Testing

- Core: unit tests for `capital`, `fitExpectedCurve` (recovers a known a/k from synthetic data), `earnedPickFor` (inverts the curve, before-1 for dominance, null at/below the floor), `computeDraftValues` (DEF null, redraft ties, contribution floor, earned pick/value consistency, dominant pick 1 positive, fallback without a curve, baselines, QB weight, zero-weeks null), trade resolution (latest by created, roster → user mapping), healthy/ppg.
- Web: `valueColor` endpoints and midpoint, `managerDraftSummaries` sort, `leagueExtremes` size 10, `topHealthyPpg` filtering, DraftBoard renders lock/trade markers, `gradingExamples`/`gradeTotals`, GradingGuide renders baselines, charts, example table and grades.
- Screenshot check of `/draft/2026` and `/draft/2025` in both modes at desktop and phone widths.

## Out of scope

Letter grades, keeper-aware baselines, real Sleeper ADP (available per season from `api.sleeper.com/projections/nfl/{year}` as `adp_ppr`, noted for a future "reach vs ADP" view), waiver/drop markers.
