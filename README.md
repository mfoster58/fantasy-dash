# fantasy-dash

Dashboard for Sleeper fantasy leagues, one address per league. Static site, data refreshed daily and after each NFL game block.

## Leagues

Every Sleeper league in `league.config.ts` gets its own address: `https://mfoster58.github.io/fantasy-dash/<slug>/`. Leagues never link to each other, and the site's root page lists none of them. To add one, add `{ slug, leagueId, name, managerNames: {} }` to `leagues` (the slug is lowercase letters, digits and hyphens) and run `pnpm sync && pnpm sync:players`, or wait for the next scheduled run. Its old seasons are scored from Sleeper on that first player sync.

Data: `data/leagues/<slug>/` holds each league's history, seasons and points (its scoring, projections and xFP). `data/players.json`, `schedule/`, `playerdb/` and `charts/` are NFL data shared by every league.

## Layout

- `packages/core` - Sleeper client, normalizer, stats engine, schemas (pure TypeScript)
- `packages/web` - Vite + React app
- `scripts/sync.ts` - pulls every configured league's seasons from Sleeper into `data/leagues/<slug>/`
- `data/` - generated JSON, committed
- `docs/superpowers/specs` - design spec; `docs/superpowers/plans` - implementation plans

## Commands

```bash
pnpm install
pnpm sync          # refresh every league from Sleeper
pnpm sync:dry      # same, but writes to a temp dir
pnpm test          # all packages
pnpm dev           # web dev server
pnpm build         # production build to packages/web/dist
```

`pnpm sync:players` builds `data/playerdb/{year}.json`: every NFL QB/RB/WR/TE's weekly line from Sleeper joined with nflverse (weekly advanced stats, Next Gen Stats, PFR advanced stats, snap counts, and for finished seasons the participation feed for routes run). Finished seasons are skipped once built; pass `--full` to rebuild them, `--season 2026` for one year, `--dry-run` to write to a temp dir. It runs after the Sleeper sync in the sync workflow and may fail without blocking the league data.

## Deploy

`.github/workflows/sync.yml` runs daily and after each NFL game block, on manual dispatch, and on every push to `main`. Scheduled and manual runs sync, test, commit `data/`, build, and deploy to GitHub Pages; push runs skip the sync and only test, build, and deploy. One-time setup in the GitHub repo: Settings, Pages, Source = GitHub Actions.

GitHub disables scheduled workflows after 60 days without repository activity. In the off-season, run the workflow manually once in a while or push a commit to keep the scheduled sync alive.

## Config

`league.config.ts` holds `leagues` (each league's slug, current Sleeper league ID, display name and optional manager display-name overrides), `positionOverrides` shared by every league, and `defaultLeague`, where old single-league links redirect.
