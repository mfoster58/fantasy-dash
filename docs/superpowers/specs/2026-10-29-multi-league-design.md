# Multiple leagues on one site — design

Date: 2026-10-29.

## Why

Mathias plays in several Sleeper leagues, each with a different group of league mates, and wants to send each group a link to their own league on this site. Today the site is wired to one league (`league.config.ts`), and the player DB's fantasy points are computed with that league's scoring.

## Goals

1. Any number of Sleeper leagues on one deployed site, each at its own address: `…/fantasy-dash/<slug>/…`.
2. **Hidden leagues.** Nothing on a league's pages links to or lists another league. The root page lists no leagues.
3. Fantasy points everywhere (Players page, grades, records, player pages, comparison) use the scoring of the league in the URL.
4. Shared NFL data (player directory, schedule, player DB, charts) is synced and stored once, not per league.
5. Existing links keep working.

## Non-goals

- A league switcher, logins or private access. The site stays public, and a league's URL can be found by anyone who guesses the slug. Mathias accepted this (2026-10-29).
- ESPN, Yahoo or any non-Sleeper platform.
- Per-league themes or branding beyond the league name.
- Typing in an arbitrary league ID at runtime. Leagues are listed in config and pre-synced.

## Config

`league.config.ts` becomes:

```ts
export interface LeagueConfig {
  /** URL segment: lowercase letters, digits and hyphens; unique */
  slug: string;
  /** the current season's Sleeper league id; earlier seasons come from the previous_league_id chain */
  leagueId: string;
  name: string;
  /** Optional display-name overrides keyed by Sleeper user_id. */
  managerNames: Record<string, string>;
}
export const leagues: LeagueConfig[] = [
  { slug: 'husky', leagueId: '1388299227519537152', name: 'Husky Fantasy', managerNames: {} },
];
/** Position overrides keyed by Sleeper player_id: an NFL fact, shared by every league. */
export const positionOverrides: Record<string, string> = { '12530': 'WR' };
/** Where old single-league URLs redirect to. */
export const defaultLeague = 'husky';
```

A unit test checks that the slugs are unique and valid and that `defaultLeague` exists. Mathias adds the other leagues' ids and slugs when they're built.

## Data layout

```
data/
  players.json            shared
  schedule/*.json         shared
  playerdb/*.json         shared; no longer has pts / proj
  charts/*.json           shared
  leagues/<slug>/
    history.json
    seasons/*.json
    points/*.json         this league's pts and proj per player-week
```

**Points file** (`points/{year}.json`), new schema `LeaguePoints` in core:

```ts
{ year: number; leagueId: string; builtAt: string; throughWeek: number;
  /** player id → per-week [week, pts, proj | null] */
  players: Record<PlayerId, [number, number, number | null][]> }
```

- The shared player DB drops `pts` and `proj` from `PLAYER_WEEK_KEYS`. The schema keeps them optional for one release, so files that haven't been migrated still parse. `ppr` and `posRankPpr` stay, because they are league-neutral.
- The web joins the two on load: `withPoints(db, points)` returns a `PlayerDb` whose rows have `pts` and `proj` filled in from the league's file. Everything downstream (`aggregate`, grades, `seasonStats`, records, gameLog) is unchanged, because it already reads `row.pts` and `row.proj`.
- Rows the league file has no entry for keep `pts`/`proj` absent, and the existing absent-means-null rule applies.
- A league whose history has no season for a playerdb year has no points file for that year. Its Players page lists only its own seasons, using `history.seasons` as it does now.

## Sync

**`pnpm sync`** loops over `leagues` and runs the existing per-league sync for each one, writing to `data/leagues/<slug>/`. A league that throws is logged as `✗ <slug>: <error>`, and the loop continues. The script exits non-zero only when every league failed, so one bad league doesn't block the deploy.

**`pnpm sync:players`**

1. Builds the shared playerdb and charts once, as today, except that `buildPlayerDb` no longer scores anything. Position overrides come from the shared `positionOverrides`.
2. For each league and each of that league's seasons, it writes `points/{year}.json` by scoring the Sleeper weekly stats and projections with that season's `scoring_settings` (the existing `scoreStats`). The Sleeper weekly stats and projections for a year are fetched once and shared across leagues.
3. **Skip rule:** a finished season's points file is left alone when it exists, parses, reaches week 18 and has the same `leagueId`. This mirrors `finishedFileProblem` for the playerdb. Live seasons are rewritten every run.

Since a finished playerdb file is never rebuilt, adding a new league scores its old seasons from a fresh Sleeper fetch, about 18 weekly stat requests and 18 projection requests per year. The shared playerdb doesn't change.

## Web

**Routes** (`packages/web/src/routes.tsx`):

- `/`: `RootPage`, a bare page that says "This site hosts private league pages. Use the link your commissioner sent you." It has no league names and no links.
- `/:league/*`: a `LeagueRoute` loader resolves the slug against `leagues`. An unknown slug renders `LeagueNotFound`. Inside, the existing `Layout` and every existing child route are mounted unchanged, so `/:league/standings`, `/:league/player/:id`, `/:league/players/:season` and so on all work.
- **Legacy redirects:** a path whose first segment is one of the existing top-level route names (`standings`, `player`, `players`, `stats`, `h2h`, `records`, `history`, `draft`, `managers`, `rosters`, `scores`, etc.; the exact list is taken from `routes.tsx`) redirects to `/<defaultLeague>/<same path and query>`.
- **Links:** nav items and in-app links become league-relative. A small helper, `useLeaguePath()` or `leagueHref(slug, path)`, prefixes the current slug, and absolute `to="/…"` links are converted to use it. A test fails if any `to="/` literal remains outside the helper and the root page.

**Current league:** a `LeagueContext` provides the `LeagueConfig` for the URL. The nav title and the document title use `league.name`. `Nav.tsx` stops importing `leagueConfig`.

**Loading** (`packages/web/src/data/load.ts`):

- The per-league globs become `data/leagues/*/history.json`, `seasons/*.json` and `points/*.json`. They are lazy, not eager, so each league is its own chunk and a visitor downloads only the league in the URL.
- **History stays synchronous for components.** About 20 components and pages read the global `history`/`currentSeason` directly: Nav, SeasonTable, JourneyFeed, LiveProvider, the Standings, H2H, Team, Players, BoxScore and SeasonReview pages, and others. The `:league` route's loader awaits `loadHistory(slug)` once, and `LeagueContext` provides `{ config, history, currentSeason }`. Components switch from the module globals to `useLeague()`. Loaders get the slug from `params.league` and call `loadHistory(slug)`, which is cached. The module-level `history` and `currentSeason` exports are removed, so a missed caller fails typecheck.
- Every per-league function takes `slug`: `loadHistory(slug)`, `loadSeason(slug, year)`, `loadAllSeasons(slug)`, `loadPlayerDb(slug, year)`. The last one returns the playerdb with that league's points joined. Caches are keyed by `slug` (and year).
- Shared loaders (`players`, `loadCharts`, schedule) keep their signatures.

**Live:** `LiveProvider` already polls Sleeper with `season.leagueId`, so it works per league once it receives the league's season. Its cache must be keyed by league, so moving from one league to another never shows the other league's scores.

## Migration (one time, for Husky)

1. `git mv data/history.json data/seasons → data/leagues/husky/`.
2. Run `scripts/migrate-points.ts`: for each `data/playerdb/{year}.json`, write `data/leagues/husky/points/{year}.json` from the rows' `pts`/`proj`, then strip those fields from the shared file. Run it once, commit, and delete the script in the same branch.
3. **Check.** Before migrating, a script snapshots, for every season, the Players page aggregates, each player's season `pts` totals, the records tables and the standings. After migrating, it runs again through the new loaders with slug `husky`, and the two snapshots must be identical.

## Deploy

One workflow, one Pages artifact, the same crons. `VITE_BASE` is unchanged. `404.html` still covers deep links, now including `/<slug>/…`. Each new league adds about 2–3 MB to the repo.

## Tests

The repo's conventions apply: Vitest, core tests in `packages/core/test`, web tests colocated.

- **Core:**
  - `buildLeaguePoints` with two different scoring settings over the same stats gives different points.
  - The finished-file skip rule.
  - The `LeaguePoints` schema.
  - `buildPlayerDb` no longer writes `pts`/`proj`.
- **Sync:** the league loop continues past one failing league and exits non-zero only when all fail. The league fetch is injected as a function, so this is testable without the network.
- **Web:**
  - `withPoints` join, including a player missing from the points file.
  - Config validation.
  - The `:league` route resolves, an unknown slug shows not-found, and the root page lists no leagues.
  - Legacy redirects keep the path and query.
  - `leagueHref`.
  - Loaders are called with the slug, and caches don't leak between two slugs.
  - The no-absolute-links check.
- Existing tests that read `data/seasons` or `data/history.json` move to the new paths or fixtures.

## Order with other work

This lands before the player comparison tool (spec `3bdb24f`), so the comparison reads per-league points from the start.

## Left to the builder

Module and file names. The exact compact encoding of the points rows, provided it round-trips. Whether the legacy-redirect list is generated from `routes.tsx` or kept by hand with a test. Whether `useLeague()` reads the route loader data or a React context fed by it.
