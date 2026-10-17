# fantasy-dash

Dashboard for the Husky Fantasy Sleeper league. Static site, data refreshed weekly.

## Layout

- `packages/core` - Sleeper client, normalizer, stats engine, schemas (pure TypeScript)
- `packages/web` - Vite + React app
- `scripts/sync.ts` - pulls every season from Sleeper into `data/`
- `data/` - generated JSON, committed
- `docs/superpowers/specs` - design spec; `docs/superpowers/plans` - implementation plans

## Commands

```bash
pnpm install
pnpm sync          # refresh data/ from Sleeper (about 2 minutes)
pnpm sync:dry      # same, but writes to a temp dir
pnpm test          # all packages
pnpm dev           # web dev server
pnpm build         # production build to packages/web/dist
```

`pnpm sync:players` builds `data/playerdb/{year}.json`: every NFL QB/RB/WR/TE's weekly line from Sleeper joined with nflverse (weekly advanced stats, Next Gen Stats, PFR advanced stats, snap counts, and for finished seasons the participation feed for routes run). Finished seasons are skipped once built; pass `--full` to rebuild them, `--season 2026` for one year, `--dry-run` to write to a temp dir. It runs after the Sleeper sync in the weekly workflow and may fail without blocking the league data.

## Deploy

`.github/workflows/sync.yml` runs every Tuesday morning, on manual dispatch, and on every push to `main`. Scheduled and manual runs sync, test, commit `data/`, build, and deploy to GitHub Pages; push runs skip the sync and only test, build, and deploy. One-time setup in the GitHub repo: Settings, Pages, Source = GitHub Actions.

GitHub disables scheduled workflows after 60 days without repository activity. In the off-season, run the workflow manually once in a while or push a commit to keep the Tuesday sync alive.

## Config

`league.config.ts` holds the league ID, display name, and optional manager display-name overrides.
