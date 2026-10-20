# Live scores

The site syncs once a week, on Tuesday morning. During games, the current week's numbers now come live from the browser.

**Where it shows:**
- a **scores ticker** above the top bar on every page
- the **Scores page**
- **box scores**, which also get **live projected finals** and **win % bars**

The home page (project 3) will reuse the same live data.

There's no server: the browser calls Sleeper's and ESPN's public APIs directly. Both send `Access-Control-Allow-Origin: *`, which was checked on 2026-10-20.

## Sources

| Source | URL | Used for |
|---|---|---|
| Sleeper NFL state | `https://api.sleeper.app/v1/state/nfl` | the current season and `week` |
| Sleeper matchups | `https://api.sleeper.app/v1/league/{leagueId}/matchups/{week}` | live points per roster (`points`), per starter (`starters`, `starters_points`) and per player (`players_points`) |
| Sleeper weekly stats | `https://api.sleeper.app/v1/stats/nfl/regular/{season}/{week}` | live stat lines in the box score only; about 75 KB gzipped, fetched only while a box score is open |
| ESPN scoreboard | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` | each NFL game's state (`pre`, `in`, `post`), quarter, clock and kickoff time, keyed by team abbreviation; unofficial |

**Which week is live:**
- The league is the current season's `leagueId`.
- The live week is Sleeper's `state.week`, but only when that week exists in the synced season with games.
- Otherwise nothing is live and every page shows the synced data, as it does today.

**Matching players to games:** the ESPN team abbreviation is matched to each player's NFL team for that season (`season.playerTeams`, falling back to the player directory). ESPN's codes are normalized to Sleeper's, for example `WSH` to `WAS`.

## Refreshing

A single provider at the layout level runs one poller for the whole app.

**At page load:** it fetches the state, the matchups for the live week, and the ESPN scoreboard, once.

**It polls every 60 seconds while:**
- the tab is visible (`document.visibilityState === 'visible'`), and
- an NFL game in the ESPN scoreboard is in progress, or a game kicks off within the next 15 minutes.

**If ESPN fails,** it polls inside fixed windows (Eastern time) instead:
- Thursday 20:00–24:00
- Sunday 09:00–24:00
- Monday 20:00–24:00
- Saturday 13:00–24:00 in December

**When hidden or idle:**
- A hidden tab stops polling. Becoming visible fetches once, then resumes.
- Outside polling, nothing refetches until the next page load.

**Box score stats:** the stats feed is polled on the same 60-second rhythm, but only while a box score page for the live week is mounted.

**Failures:**
- A failed request keeps the last good live data, or the synced data if there is none.
- After three failures in a row, it stops polling until the next page load.
- Nothing is shown as an error to the user.

## The live overlay

`liveWeek(season, week, live): Week` returns the synced week with live numbers laid over it, so existing components (ScoreCard, WeekScores, LineupTable) render it unchanged.

**What it changes:**
- Each side's `points` comes from its Sleeper roster's `points`. Rosters are mapped to managers by `rosterId`.
- Each starter's `player.points` comes from `starters_points`, by slot position.
- Bench `points` come from `players_points`.
- If live stats are loaded, each player's `stats` is replaced by the live stat line, trimmed to the keys `pickStats` already keeps.

**What it keeps:** projections, lineup slots, rosters and the game list all come from the sync.

**Edge cases:**
- A roster with no lineup set (`starters` empty) keeps the synced starters, with 0 points.
- The week's `played` flag stays as synced. The UI shows "live" or "final" from the game states below, not from `played`.

## Game states, projections and win %

**Game state for each starter:**

| State | When |
|---|---|
| `final` | his NFL team's ESPN game is `post` |
| `live` | his team's game is `in`; carries the quarter and clock |
| `upcoming` | his team's game is `pre`; carries the kickoff time |
| `bye` | his team has no game this week |
| `unknown` | ESPN is unavailable |

**Fraction of the game left:**
- quarters 1–4: `((4 − quarter) × 15 + minutesLeftInQuarter) ÷ 60`
- overtime: `0`
- `final`: `0`
- `upcoming` and `unknown`: `1`

**Each starter's live projection:**
- `points + projected × fractionLeft` when `live`
- `points` when `final` or `bye`
- `projected` when `upcoming`
- `max(points, projected)` when `unknown`: before any points he's at his projection, and an unknown state never lowers it

**A side's projected final** is the sum of its starters' live projections.

**Win %:**
- `P(A wins) = Φ((projA − projB) ÷ σ)`, where `σ² = K × (remaining projected points, both teams)`.
- A starter's remaining projected points are `projected × fractionLeft`, or `projected` when `upcoming`.
- **`K = 4.4`.** In this league over 2023–2025 (420 team-weeks), actual minus projected had an SD of 24.1 against a mean projection of 130.7, and 24.1² ÷ 130.7 ≈ 4.4.
- When σ is 0, every game is final: 100% to the leader, or 50/50 on a tie.
- Φ is the standard normal CDF; an erf approximation is accurate enough.
- Shown rounded to whole percents and clamped to 1–99% while anything remains.

## The ticker

`ScoreTicker` sits above the top bar on every page.

**Left label:** "{season} · Week {n}", plus a "LIVE" dot while polling.

**One card per matchup**, in the synced game order:
- both teams' photos (team photos, from the team-photos change) and their names
- each team's record going into the week
- each team's score, with the leader in bold
- a "FINAL" mark once every starter on both sides is `final` or `bye`
- before any points, the projected scores in muted text with "proj"

**Behaviour:**
- Clicking a card opens that box score.
- On wide screens the row scrolls with arrow buttons; on phones you swipe.
- It is hidden when the live week can't be resolved and the synced season has no current week with games, for example in the offseason.

## Scores page and box score

**Scores page:** for the live week, the scoreboard and its cards use `liveWeek(...)`, and the header shows the LIVE dot while polling. Other weeks are unchanged.

**Box score**, for the live week:
- Points and stat lines are live.
- Each starter row shows his game state:
  - "Q3 4:12" for a game in progress
  - "Final"
  - "Sun 1:00 PM" for a kickoff
  - "Bye"
- **Projection bar:** each side's projected final, a bar per side scaled to the larger, with the pre-game projection as a faint marker.
- **Win % bar:** one two-colour bar split at team A's win %, labelled with both percents.
- Both bars update on every refresh.
- Past weeks keep today's box score, with no bars. Their result is known.

## Testing

**The overlay:**
- rosters mapped by `rosterId`
- starters' points by slot
- bench points
- a roster with no lineup
- live stats replacing the stat lines with trimmed keys
- synced projections kept

**Game state and fraction left:** all five states, quarter and clock parsing ("4:12" in Q3 is (1 × 15 + 4.2) ÷ 60), overtime, and normalizing ESPN abbreviations.

**Projections and win %:**
- a starter's live projection in each state
- a side's projected final
- win % at kickoff equals Φ(diff ÷ σ)
- a big lead with almost nothing left gives near 99%
- all final gives 100, 0 or 50
- clamping to 1–99%

**The poller** (fake timers, mocked `fetch`):
- one fetch at load
- polls while a game is `in`
- polls 15 minutes before a kickoff
- stops when the tab is hidden and fetches again when it's visible
- the ESPN-failure fallback windows, at fixed instants in both daylight and standard time
- three failures stop it
- the stats feed only while a box score is mounted

**Components:**
- the ticker renders cards and links, shows LIVE, and hides with no current week
- the Scores page uses live points for the live week only
- the box score shows the bars, game-state labels and live stat lines

All tests mock the network. Nothing calls Sleeper or ESPN.

## Open check

During Thursday night's game (2026-10-22), check whether Sleeper's undocumented `https://api.sleeper.app/projections/nfl/{season}/{week}` and `/stats/nfl/{season}/{week}` fill a per-player game `status`, or update projections in-game.

If they do, use Sleeper for game state and drop ESPN, keeping everything on Sleeper. This spec stands either way.

## Out of scope

- Sleeper's private GraphQL API, which is what the Sleeper app uses for its win % and projections.
- Live data for past weeks.
- Push notifications.
- Live scores on the home page; that's project 3, which reuses this provider.
