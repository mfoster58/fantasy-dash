# Multiple leagues on one site — design

Date: 2026-10-29. Revised the same day while planning; the revisions are listed at the end.

## Why

Mathias plays in several Sleeper leagues, each with a different group of league mates, and wants to send each group a link to their own league on this site. Today the site is wired to one league (`league.config.ts`), and the player DB's fantasy points, and the xFP model fitted on them, use that league's scoring.

## Goals

1. Any number of Sleeper leagues on one deployed site, each at its own address: `…/fantasy-dash/<slug>/…`.
2. **Hidden leagues.** Nothing on a league's pages, and nothing on the root page or in the HTML shell, names or links to another league.
3. Fantasy points everywhere (Players page, grades, records, player pages, comparison) use the scoring of the league in the URL. So do projections, xFP and FPOE.
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

`validateLeagues` (core) checks that the slugs are unique and valid, that no slug collides with a top-level route name, and that `defaultLeague` exists. A test runs it on the real config. Mathias adds the other leagues' ids and slugs when they're built.

## Data layout

```
data/
  players.json            shared: every player on any league's rosters
  schedule/*.json         shared
  playerdb/*.json         shared; no pts, proj or xfp
  charts/*.json           shared
  leagues/<slug>/
    history.json
    seasons/*.json
    points/*.json         this league's pts, proj and xfp per player-week, plus its xFP coefficients
```

**Points file** (`points/{year}.json`), new schema `LeaguePointsSchema` in core:

```ts
interface LeaguePoints {
  year: number; leagueId: string; builtAt: string;
  /** builtAt of the shared playerdb file these points were built against */
  dbBuiltAt: string;
  /** this league's xFP model, fitted on its own points */
  xfp: XfpCoefficients;
  /** player id → per-week [week, pts, proj | null, xfp | null] */
  players: Record<PlayerId, [number, number, number | null, number | null][]>;
}
```

- **Shared player DB.** `SharedPlayerDb` is `Omit<PlayerDb, 'xfp'>`, and its rows carry no `pts`, `proj` or `xfp`. `SharedPlayerDbSchema` is `PlayerDbSchema.omit({ xfp: true })`, so old files with those fields still parse. `ppr` and `posRankPpr` stay, because they are league-neutral.
- **Core helpers:**
  - `applyLeaguePoints(shared, points | null): PlayerDb` returns the familiar `PlayerDb`. Rows with an entry get `pts`, plus `proj`/`xfp` when not null, and `xfp` is set from the file (all null when there is no file).
  - `splitLeaguePoints(db, leagueId, builtAt)` is the exact inverse, used by the migration.
- **Web:** everything downstream (`aggregate`, grades, `seasonStats`, records, gameLog, FPOE) keeps reading `row.pts`, `row.proj`, `row.xfp` and `db.xfp` unchanged.
- Rows with no points entry keep those fields absent, and the existing absent-means-null rule applies.

## Sync

**`pnpm sync`**

- Loops over `leagues`. For each one, it walks the chain, fetches the seasons and writes `data/leagues/<slug>/` (history and seasons) through a staging directory and a rename.
- A league that throws is logged as `✗ <slug>: <error>`, and its existing folder is left untouched.
- `players.json` is trimmed to the union of player ids across every league. For a league that failed, the ids come from its existing season files on disk.
- The script no longer replaces all of `data/`. It writes only `players.json` and the league folders, so `playerdb/`, `charts/` and `schedule/` are never touched.
- It exits non-zero only when every league failed.

**`pnpm sync:players`**

1. **NFL years:** the union of every league's chain. For each year, `complete` is true when any league that season is complete. `throughWeek` is 18 when complete, otherwise the maximum `last_scored_leg` (capped at 18). The playerdb, charts and schedule phases run over these years, unchanged except that `buildPlayerDb` no longer scores (no `scoring`/`projections` input, and no pts/proj/xfp), and position overrides come from the shared `positionOverrides`.
2. **Points phase:** for each league, and each of its seasons that has a shared playerdb file, it builds `points/{year}.json` with `buildLeaguePoints`. That function scores each DB row from that week's Sleeper stats and projections with the season's `scoring_settings` (the existing `scoreStats`), then fits and predicts xFP. Sleeper weekly stats and projections are fetched once per year and shared across leagues, including with the playerdb phase.
3. **Skip rule:** a points file is left alone when it parses, its `leagueId` matches, its `dbBuiltAt` equals the shared file's `builtAt`, and the season is complete. Live seasons are always rebuilt.
4. A league that fails in the points phase is logged, and the others continue.

Adding a league scores its old seasons from a fresh Sleeper fetch: about 18 weekly stat requests and 18 projection requests per year. The shared files don't change.

## Web

**The league is the router's basename.**

- `main.tsx` reads the first path segment after `BASE_URL` and calls `resolveLeague(...)`:
  - **A configured slug:** await `initLeague(league)`, set `document.title = league.name`, and mount the existing router with `basename = BASE_URL + slug`. Every existing absolute link and redirect (`/player/123`, `redirect('/standings/2026')`) resolves inside that league with no edits.
  - **Empty** (the root): render `RootPage`, which says "This site hosts private league pages. Use the link your commissioner sent you." It has no league names and no links.
  - **A legacy head**, meaning the first segment of a top-level route (`standings`, `player`, `players`, `records`, `all-time`, etc.), derived from `routes.tsx`: `location.replace(BASE_URL + defaultLeague + the same path, query and hash)`.
  - **Anything else:** render `LeagueNotFound`, which also names no leagues.
- `index.html`'s `<title>` becomes the neutral "Fantasy", so the shell names no league.
- `Nav.tsx` reads the league name from `data/load.ts` instead of importing `league.config`.

**Loading** (`packages/web/src/data/load.ts`):

- Per-league globs: `data/leagues/*/history.json`, `seasons/*.json` and `points/*.json`. All are lazy, so each league is its own chunk and a visitor downloads only theirs.
- `initLeague(league)` loads that league's history once and fills the module's live bindings `export let league`, `export let history` and `export let currentSeason`. Components and loaders that read `history`/`currentSeason` today (about 20 files) are unchanged, since one page load serves one league. Nothing reads them at module scope.
- `loadSeason(year)` and `loadAllSeasons()` read the current league's files.
- `loadPlayerDb(year)` loads the shared file and the league's points file together and returns `applyLeaguePoints(shared, points ?? null)`.
- The test setup calls `initLeague` for `husky` once, so existing tests keep their real data.

**Live:** `LiveProvider` polls with `season.leagueId`, and one page load is one league, so it works unchanged.

## Migration (one time, for Husky)

1. Move `data/history.json` and `data/seasons/` into `data/leagues/husky/` with `git mv`.
2. Run `scripts/migrate-points.ts` for each `data/playerdb/{year}.json`:
   - Run `splitLeaguePoints` with the leagueId of Husky's season that year.
   - **Check:** `applyLeaguePoints(shared, points)` must deep-equal the original file, or the script aborts without writing.
   - Write `leagues/husky/points/{year}.json` and the stripped shared file.

   Run it once, commit, and delete the script in the same branch.
3. All existing web tests must pass unchanged on the migrated data, through the new loaders.

## Deploy

One workflow, one Pages artifact, the same crons. `VITE_BASE` is unchanged. `404.html` still covers deep links, now including `/<slug>/…`. Each new league adds about 2–3 MB to the repo.

## Tests

The repo's conventions apply: Vitest, core tests in `packages/core/test`, web tests colocated.

- **Core:**
  - `buildLeaguePoints`: two scoring settings over the same stats give different pts and xFP.
  - Round trip: `split` then `apply` gives back the original, and a row with no points entry stays without points.
  - The `LeaguePoints` schema.
  - The points skip rule.
  - `buildPlayerDb` writes no pts/proj/xfp.
  - `validateLeagues`.
  - `nflYears` (union, complete-if-any, max throughWeek).
  - `runPerLeague`: continues past a failing league and reports which failed.
- **Web:**
  - `resolveLeague`: league, root, legacy redirect keeping path, query and hash, and unknown.
  - `legacyHeads(routes)`.
  - Loader redirects under a basename stay inside the league (a `createMemoryRouter` with a basename).
  - `RootPage` and `LeagueNotFound` render no league name.
  - `loadPlayerDb` joins points.
  - The real config passes `validateLeagues`.

## Order with other work

This lands before the player comparison tool (spec `3bdb24f`), so the comparison reads per-league points from the start.

## Revisions while planning (2026-10-29)

- **Basename, not a `:league` route.** The web code has 94 absolute app paths in 44 files. Mounting the router under `BASE_URL + slug` keeps all of them working unchanged, and the league globals stay synchronous through live bindings filled at boot. Every visible behaviour in the first draft is kept: per-league URLs, hidden leagues, legacy redirects, and per-league chunks.
- **xFP is per league.** `fitXfpCoefficients` is fitted on league `pts`, so the xFP coefficients and the per-row `xfp` move into the points file along with `pts`/`proj`.
- **`pnpm sync` stops replacing all of `data/`**, and `players.json` covers every league's players.

## Left to the builder

Module and file names, beyond the exported names above.
