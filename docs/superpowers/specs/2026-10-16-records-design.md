# Records design

Date: 2026-10-16. Project 1 of 2: this spec covers the Records page. Project 2 (Statistics: league leaders, the manager career table and new volume, efficiency and advanced rankings) gets its own spec after Records merges. Until then the league leaders boards live under Records → Players → Leaders unchanged.

## Goal

Replace the Player stats page and the All-Time page with one record book at `/records`, modelled on Leagology's record book: a Players tab and a Managers tab, each split into sub-tabs of boards. Every existing player board survives, reclassified. The manager side is new as boards but reuses the computations the app already has (all-time rows, streaks, the four record cards, draft values, waiver claims).

Out of scope: Chases (fastest-to-milestone boards) on either tab, the Statistics page, any sync or data-file change. Everything here derives from the committed season JSON.

## Structure

- Route `/records` renders `RecordsPage` → `RecordsView`. `/players` and `/all-time` redirect to `/records`. `AllTimePage`, `AllTimeRecords`, the History `StreaksCard` and `PlayersView` are deleted; `AllTimeTable` and `lib/allTimeRecords.ts` stay in the codebase (unrouted) for project 2 unless their logic is fully absorbed by manager boards, in which case the plan deletes them too.
- Nav: Scores, Standings, Head to Head, Records, History, Draft. "Player stats" and "All-Time" entries go.
- Page header: title "Records", one line under it: "Leaderboards about the players started in this league and the managers who ran them, scored by the league's own rules." Under the header a tablist with two tabs, Players and Managers, then a second tablist with that tab's sub-tabs. Both use the existing `role="tablist"` buttons with `aria-controls`, every panel stays mounted and hidden, and switches use `replace`.
- URL state: `tab=players|managers` (absent = players), `sub=<sub id>` (absent = the tab's first sub-tab; a sub id that does not belong to the current tab is ignored). Each sub-tab keeps its own position param named after its id (players only, e.g. `moments=RB`) and its own season param `<id>Season` (e.g. `momentsSeason=2024`, `mgamesSeason=2025`). Values the sub-tab does not accept fall back to the default, as today.
- Sub-tab ids. Players: `alltime`, `moments`, `streaks`, `postseason`, `leaders`. Managers: `malltime`, `mseasons`, `mgames`, `mstreaks`, `mplayoffs`, `mdraft`, `mtransactions`.
- Each sub-tab is one `Section`: title, note, position filter (players only), optional season picker, a grid of boards (3 columns for Leaders as today, 2 elsewhere), shared expand state per grid row.
- A small count of boards on each sub-tab button, e.g. "Moments 6", so the breadth is visible without scrolling.

## Board engine changes

### Rows

`BoardRow.playerId` becomes `PlayerId | null`. A manager row has `playerId: null` and its manager in `userId`. Other fields stay: `key`, `value`, `valueLabel`, `meta`, `detail`, `userId` (the linked manager for player rows), `to`, `tone`, `managers`. `Board` renders a player row as headshot, position pill and name (as today) and a manager row as avatar and display name linking to `/h2h?a=<userId>`. Rank, value, meta and detail render the same for both.

### Definitions

`BoardDef.section` is replaced by `tab: 'players' | 'managers'` and `sub: string`. The registry (`lib/playerBoards.ts`, renamed `lib/boards/index.ts` with a re-export shim if anything else imports it) lists every board in display order; `boardsFor(tab, sub)` filters it. Files: `lib/boards/players/{alltime,moments,streaks,postseason,leaders}.ts` (today's files reorganised; `extras.ts` dissolves into alltime and moments) and `lib/boards/managers/{alltime,seasons,games,streaks,playoffs,draft,transactions}.ts`.

### Context

`BoardContext` keeps every player input it has (lines already narrowed to position and season, players, champions, lastPlaces, year, currentYear, pos, picks, xfp, transactions, playerSeasons, drafts) and gains manager inputs, built once in `RecordsView` with `useMemo` and narrowed per section by year:

```ts
interface TeamGame {
  year: number; week: number; tag: string | null; gameId: string; matchupId: number;
  userId: UserId; opponentId: UserId;
  points: number; oppPoints: number; ceiling: number; benchPoints: number; projected: number | null;
  result: 'W' | 'L' | 'T';
  isPlayoff: boolean;      // week.isPlayoff
  postseason: boolean;     // tag in POSTSEASON_TAGS (championship bracket)
  consolation: boolean;    // tag in CONSOLATION_TAGS
}
interface ManagerSeason {
  year: number; userId: UserId; complete: boolean;
  row: StandingRow;        // regular season: w l t pf pa ppg maxPoints efficiency allPlay weeklyHighs rank
  games: number;           // regular-season games played
  benchPoints: number;     // sum over all the manager's games of ceiling − points
  champion: boolean; runnerUp: boolean; third: boolean; lastPlace: boolean; playoffBerth: boolean; seed: number | null;
}
```

`benchPoints` on a `TeamGame` is `ceiling − points` (what the optimal lineup would have added), not the raw bench total. `playoffBerth` is true when the manager appears in that season's winners bracket; `seed` is the regular-season standings rank. `complete` is `season.status === 'complete'`. The context also carries `history.allTime` rows, `history.managers`, `history.h2h` (for the existing streak computation) and each season's `draft` and `transactions` keyed by year (already present).

The season picker on a manager sub-tab filters `teamGames` and `managerSeasons` to that year; All-time pools them. Career boards (Managers → All-time, Streaks, Playoffs) have no picker.

### In-progress season rule

Rows that represent a whole season (Seasons, Draft classes, Transactions per season) include the in-progress season only when the picker selects it explicitly; under All-time they use complete seasons only, so "Fewest points" is not won by the current year. Career totals and game rows include the in-progress season as today. Rate boards state their minimums in the definition text.

### Helpers

`lib/boards/shared.ts` gains `managerMomentBoard` (one row per TeamGame or ManagerSeason) and `managerCareerBoard` (one row per manager, aggregated), mirroring `momentBoard`/`careerBoard`, plus `metaOfGame(g)` ("2024 · Wk 5 · Final", linking to the box score), `metaOfSeason(ms)` ("2024", linking to `/standings/2024`) and `metaOfCareer(years)` ("2023–2026 · 4 seasons"). Ties share a rank as today.

## Players tab

Position filter on every sub-tab. Existing boards keep their ids, definitions, modes and minimums.

**All-time** (`alltime`; season picker, All-time default; the picker narrows totals to one season as the Career section does today)
careerPoints (Most points started, Total/PPG), weeksStarted, bestSeason (Total/PPG), championshipRosters, lastPlaceRosters, loyalty, journeyman, benchWarmers, fodder, boomStarts, dudStarts, waiverHeroes, waiverVillains, draftValue, mrIrrelevant, and new **topScorerWeeks** "Most weeks as the league's top scorer": weeks in which the player was the highest-scoring starter across the whole league (ties share the week).

**Moments** (`moments`; season picker, All-time default)
bestWeek, benchBlunder, breakout, fallOff, and new **bestStartInLoss** "Biggest start in a loss": most points by a starter whose team lost that week; **worstStartInWin** "Lowest start in a win": fewest points by a starter who played (gp ≥ 1, K and DEF excluded) on a team that won.

**Streaks** (`streaks`; no picker)
ironman, and new **run15** "Longest run of 15+ point starts", **run20** "Longest run of 20+ point starts", **drought** "Longest scoring drought": consecutive played starts under 5 points (K and DEF excluded), **posTopRun** "Most consecutive weeks as the top scorer at his position": consecutive league weeks in which the player was the highest-scoring starter at his position. Runs for run15, run20 and drought are over the player's started lines in chronological order; a started line that misses the threshold ends the run, weeks he was not started do not. posTopRun counts consecutive league weeks (the way ironman does) and ends on any week he was not the position's top started scorer, including weeks he was not started. Rows show the run length with its span in the meta ("2024 Wk 3 – Wk 11") and the manager who started him most during the run.

**Postseason** (`postseason`; no picker; unchanged)
postPoints, postStarts, postTouchdowns, postYards, postReceptions, bestPlayoffStarts, championshipRosters, postToiletBowl, worstToiletStarts, lastPlaceRosters.

**Leaders** (`leaders`; season picker, current season default; 3 columns; unchanged, temporary until project 2)
leadPoints, leadYards, leadTouchdowns, leadRushYards, leadRecYards, leadPassYards, leadRushTd, leadRecTd, leadPassTd, leadTouches, leadFpoe, leadXfp.

## Managers tab

No position filter. Values use `fmtPts` for points, `fmtWinPct` for percentages, `fmtSigned` where a sign matters, and plain counts otherwise. Minimums: rate boards over a career require at least one complete season; rate boards over a season require the season's games so far ≥ 3.

**All-time** (`malltime`; no picker; one row per manager; from `managerSeasons` and `teamGames`)
- mCareerWins "Most career wins", mWinPct "Best career win %", mWorstWinPct "Worst career win %" (regular season, ties count half)
- mCareerPoints "Most career points", mCareerPpg "Best career points per game", mPointsAgainst "Most points against" (regular season)
- mTitles "Most championships", mFinals "Most title games", mBerths "Most playoff berths", mPlayoffWins "Most playoff wins" (wins in championship-bracket games), mBerthsNoTitle "Most berths without a title" (berths by managers with no championship)
- mLastPlaces "Most last-place finishes", mSeasons "Most seasons played"
- mEfficiency "Best lineup efficiency", mWorstEfficiency "Worst lineup efficiency": career points divided by career optimal points over every game played, playoffs included
- mWeeklyHighs "Most weekly high scores"

**Seasons** (`mseasons`; season picker, All-time default; one row per manager-season; complete seasons unless a year is chosen)
- msPoints "Most points", msFewest "Fewest points", msPpg "Best points per game", msAgainst "Most points against"
- msRecord "Best record", msWorstRecord "Worst record" (by win %, then points), msDiff "Biggest points differential" (pf − pa)
- msAllPlay "Best season vs everyone", msWorstAllPlay "Worst season vs everyone" (all-play win %)
- msLucky "Luckiest season", msUnlucky "Unluckiest season": actual wins (ties half) minus all-play win % × games played, shown signed with one decimal
- msNoTitle "Best team without the title": highest all-play win % among seasons whose manager was not champion
- msEfficiency "Best lineup efficiency", msWorstEfficiency "Worst lineup efficiency", msBench "Most points left on the bench" (sum of ceiling − points over the season, all games)

**Games** (`mgames`; season picker, All-time default; one row per TeamGame, or per game where noted; links to the box score)
- mgHigh "Highest score", mgLow "Lowest score", mgLossHigh "Best score in a loss", mgWinLow "Worst score in a win"
- mgBlowout "Biggest blowout", mgClosest "Closest game" (margin; one row per game, winner as the subject, loser in the detail; ties excluded from Closest)
- mgCombinedHigh "Highest-scoring game", mgCombinedLow "Lowest-scoring game" (combined points; one row per game, both managers named, the higher scorer as the subject)
- mgPerfect "Best-set lineup" (games where points equal the optimal lineup within 0.005, ranked by points), mgBench "Most points left on the bench" (ceiling − points in one game)

**Streaks** (`mstreaks`; no picker)
- mWinStreak "Longest winning streak", mLoseStreak "Longest losing streak": the existing `longestStreaks` computation (every game, chronological), span in the meta
- mPlayoffStreak "Longest playoff streak": consecutive seasons played with a berth
- mDrought "Longest title drought": complete seasons since the manager's last title, or since their first season if they have none; the in-progress season is not counted; detail says "and counting" when the drought is current
- mRun100 "Longest run of 100+ point games": consecutive games (chronological, every game) scoring 100 or more
- mHighRun "Most consecutive weeks as high scorer": consecutive league weeks in which the manager had the week's top score (`week.highScore`)

**Playoffs** (`mplayoffs`; no picker; championship bracket = tag in POSTSEASON_TAGS, consolation = CONSOLATION_TAGS)
- mpHigh "Highest playoff score", mpLow "Lowest playoff score", mpBlowout "Biggest playoff blowout", mpClosest "Closest playoff game" (game rows, as on Games)
- mpLowSeed "Lowest seed to win it all": champions ranked by seed, highest seed number first, meta the season
- mpFinalsLost "Most Finals lost" (runner-up count)
- mpToiletApps "Most Toilet Bowl appearances", mpToiletWins "Most Toilet Bowl wins" (games tagged Toilet Bowl)

**Draft** (`mdraft`; season picker, All-time default; from each season's draft picks with non-null value; complete seasons unless a year is chosen)
- mdBestClass "Best draft class", mdWorstClass "Worst draft class": sum of a manager's pick values in one season (one row per manager-season)
- mdSteal "Biggest steal", mdBust "Biggest bust": one pick by value, player in the detail, link to that season's draft board
- mdLate "Most value from late rounds": sum of values of picks in round 9 or later, per manager-season
- mdFirstRound "Best first-round record": average value of a manager's round-1 picks across complete seasons, minimum 2 seasons, one row per manager

**Transactions** (`mtransactions`; season picker, All-time default; from `season.transactions`; the in-progress season counts only when chosen for per-season boards; career totals include it)
- mtAdds "Most adds", mtDrops "Most drops", mtTrades "Most trades" (a trade counts once for each manager in it), mtBusiest "Busiest season" (adds + drops + trades, one row per manager-season)
- mtFaabSeason "Most FAAB spent, season", mtFaabCareer "Most FAAB spent, career" (sum of winning waiver bids)
- mtBiggestBid "Biggest winning bid" (one row per claim, player in the detail)
- mtCheap "Cheapest points", mtCostly "Costliest points": dollars spent on waiver claims divided by points those players scored while started for that manager, minimum $25 spent, per manager over the chosen scope
- mtBestPickup "Best waiver pickup": most points a single add returned while started for the manager (waiver or free agent, the manager version of Waiver heroes)
- mtQuickCut "Quickest cut": fewest days between an add and the same manager dropping that player, minimum 0, one row per add; detail names the player

## Row presentation

- Player rows: unchanged.
- Manager career rows: avatar, name, meta "2023–2026 · 4 seasons".
- Manager-season rows: avatar, name, meta "2024" linking to `/standings/2024`; detail carries the supporting numbers ("9-5, 1,612.4 pts").
- Game rows: avatar, name, meta "2024 · Wk 5 · Final" linking to the box score; detail names the opponent and the score ("vs bob, 142.3–98.1").
- Streak rows: value is the run length with a unit ("7 wins", "5 seasons"), meta the span.

## Testing

- `lib/boards/managers/*.test.ts`: one file per family on a fixture of three managers over two seasons (one complete, one in progress) with a handful of games including a playoff and a Toilet Bowl, asserting order, ties, the season filter, the in-progress rule, playoff tagging, and the minimums. Streak and luck computations get edge cases: no games, one game, a tie, a streak crossing seasons.
- `lib/boards/players/*.test.ts`: existing tests move with their boards; new boards (topScorerWeeks, bestStartInLoss, worstStartInWin, run15, run20, drought, posTopRun) get tests in the same style.
- Registry test pins tab and sub-tab order and the board ids under each.
- `RecordsView.test.tsx`: default tab and sub-tab, switching both from the tab bars and the URL, junk params, per-sub-tab position and season params surviving tab switches, headshot vs avatar rendering, each sub-tab showing its board headings, the "Season has not started" empty state on Leaders.
- `Nav.test.tsx` and a route test for the two redirects.
- Before merge, the real-data probe walks every tab, sub-tab, position and season and reports empty or suspicious boards.

## Migration

- Deleted: `pages/PlayersPage.tsx`, `pages/AllTimePage.tsx`, `components/players/PlayersView.tsx` and its test, `components/AllTimeRecords.tsx` and test, `components/history/StreaksCard.tsx` and test, `lib/allTimeRecords.ts` and test, `lib/streaks.ts` and test (the manager Games and Streaks boards replaced them). Routes moved to `src/routes.tsx` so they can be tested without creating a browser router.
- Keep: `components/AllTimeTable.tsx` and `lib/records.ts` (used by the season review) for project 2.
- The earlier specs (player stats v1–v3) describe the retired page; this spec supersedes their page structure but not their board definitions.

## Polish round (2026-10-16, after first use)

Changes agreed after the page shipped; where they contradict the sections above, this section wins.

- **Title** is just "Records"; no subtitle.
- **Record row**: on every board the top row, and any row tied with its value, is the league record: gold-tinted background, a crown in place of the rank, the value in gold (gold wins over the win/loss tone). This mirrors the manager profile's record book.
- **Position per board**: every player board, and every manager board whose rows name a player (`BoardDef.positions`), has a position dropdown in its card header. The section's pill row stays as "set all" and stays in the URL; a per-board pick is component state that overrides the section for that card and clears when the section filter changes. Player boards get their lines re-narrowed from the season-scoped, unfiltered lines; manager boards keep every line and apply the position to the named player (`posOk`).
- **Byes**: `PlayerLine.bye` is true when no rostered player from the player's NFL team recorded a stat that league week (`Season.playerTeams`, then the directory team). Ironman, the top-at-position run and the 15+/20+ runs neither extend nor break on a bye week. A started bye line is not a start.
- **Top-at-position run** has a dropdown (`modeSelect`): Top scorer, Top 3, Top 5, Top 10, ranking started lines at the position each week with ties sharing a rank.
- **Playoff scope**: `postseason` is a quarterfinal, semifinal or Final; `consolation` is consolation round 1 or the Toilet Bowl. Third-, fifth- and seventh-place games are placement games and count as neither, on every board on both tabs. The team page is unaffected.
- **Manager rows**: career meta is the year span only; titles, berths, berths without a title and last places list the years underneath. Best and worst record show the record as the value with the win percentage underneath. Efficiency rows show games (career) or the record (season) instead of "x of y possible".
- **Playoffs sub-tab** gains Most consolation bracket appearances (seasons with any consolation-bracket game, years underneath) and takes Best team without the title from Seasons.
- **Draft**: steal, bust and late-round value skip keepers; classes and first-round keep them. Every draft row links to `/draft/<year>?team=<userId>`, which the draft page reads to highlight the column and open the team. Steal and bust rows carry `BoardRow.player` (headshot and name after the manager) and the detail "Rd 9, pick 81 · WR24 → WR4 · 14.2 PPG" (position ranks from `posDraftRank` and the season `posRank`, PPG from the pick, each omitted when unknown).
- **Transactions**: Most FAAB spent in a season and Quickest cut are gone. Best waiver start (one game by a pickup while started for the claimer, linking to the box score), Most waiver starts and Most waiver points (per-manager totals over pickups) are added. Biggest winning bid, best pickup and best start carry `BoardRow.player`. `WaiverClaim.lines` carries the started lines inside the claim window.
- **Manager profile**: `managerRecords` prefixes the detail with the named player, so the record book still says who.
