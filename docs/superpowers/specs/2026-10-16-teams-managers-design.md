# Teams and Managers pages — design

Date: 2026-10-16. Inspired by leagology's team page (`/theyard/teams/2026/xxmarcosxx`) and manager page (`/theyard/managers/laackshizzle`). The user approved this design and asked for it to be planned, built and merged without further review.

## Why

The site has standings, scores, draft and records, but no place that is *about one team* in a season or *about one manager* across seasons. The team page is the season roster breakdown; the manager page is the career profile.

## Navigation and routes

- Top nav gains **Teams** (after Standings). The page has a sub-tab row like Records: **Teams** · **Managers**.
- `/teams` → redirect `/teams/{currentYear}`.
- `/teams/:season` — grid of that season's team cards, in standings order, with a season switcher. 404 for unknown seasons.
- `/teams/:season/:userId` — the team page. Season switcher lists only the seasons that manager played; "All teams" link; "Manager page" link.
- `/managers` — every manager who ever played, as cards (name, seasons, record, titles).
- `/managers/:userId` — the manager page.
- All five routes load every season (`loadAllSeasons`), like Records and Head to Head.

## Team page (one manager, one season)

Computed by `lib/teamProfile.ts` `seasonProfile(season, userId, players)`.

**Header card**: avatar (72px), eyebrow `2026 season · All teams`, team name (display name when no team name), handle, badge line `Scoring 2nd of 10 · Points allowed 5th most · Vs. everyone 40–15` (all-play from the standings row). Six tiles: Record, Pts for, Pts against, Finish, Draft slot, FAAB spent. Finish: `1st` / `2nd` / `3rd` / `Last` from honors for complete seasons, else the ordinal regular-season rank; `—` in season. FAAB = sum of `bid` over the manager's completed waiver claims. Footer strip: `Longest win streak N · Left on the bench X · Y% of the best lineup` (over every played game, playoffs included).

**Left column** (1/3 on `lg`):
- **Season shape** — SVG line of points per played week (accent, dots with tooltips) and a dashed league-average line; captions `138.3 a week` / `121.6 league average`.
- **Schedule** — one row per played game: week, opponent name, `149.9–76.3` with the team's own score bold, ▲ on the season high and ▼ on the low, W/L/T pill, playoff tag when present. Row links to the box score.
- **Draft picks** — grade badge (letter from the draft page's rank-based grading) and total value; rows: pick label, position pill, player, keeper mark, signed value chip (green/red). Footer link to `/draft/{year}`. Hidden when the season has no draft.

**Right column** (2/3):
- **Roster** — "Where the points came from": a stacked bar of started points by position (QB, RB, WR, TE, K, DEF, coloured with `--pos-*`), labels inside segments wider than 8%, and a thin bar below with the league's shares. Rank chips `QB 2 · RB 8 …` = rank of started points at that position among the league's teams. Position cards (`sm:grid-cols-2 xl:grid-cols-3`): big coloured position letters, group name, started points; rows: headshot, name, that season's NFL team, started points, starts; players started in at least half of the team's played weeks get a tinted row; a **Never started** sub-list for rostered players with no starts; "Show N more" beyond four rows. Position comes from the player directory (FLEX resolves to the player's position).
- **Transactions** — `N moves`, `Best pickup: Name · pts in starts since W4` (from `waiverClaims`, most started points), filter pills All / Waivers / Free agents / Trades (only those with moves), dated log (date heading, type badge, `+ adds` / `− drops` with position pill and team, `$bid` for waivers, trade partner name).

## Manager page (one manager, every season)

Computed by `lib/teamProfile.ts` `careerProfile(seasons, history, userId)` plus `lib/managerRecords.ts`.

**Header card**: avatar, display name with a `🏆 N` chip when titles > 0, "Fielded as" strip: distinct team names with year ranges (newest first). Six tiles: Record, Win %, Points for, Playoffs `made/seasons`, Best finish, Titles.

**Seasons** table: year, team name, record, PF, PA, finish, draft grade; each row links to `/teams/{year}/{userId}`.

**League records**: every manager board (`boardsFor('managers', sub)` for every Managers sub-tab) computed in an all-time context; keep rows whose `userId` is this manager and whose rank ≤ 3. Group by sub-tab title. Rank 1 rows use the new gold treatment (`--gold` token, gold number and a small crown mark); 2 and 3 plain with the rank shown. Each row links to the board on the Records page (`/records?tab=managers&sub=…`). Count in the card header: `N league records`.

**Rivals**: every opponent from `history.h2h`, sorted by win % desc then games; record and win % green when winning, red when losing, muted when level; PF–PA; current streak (`W3` / `L2`); link to `/h2h?a=&b=`.

**Lineup success**: efficiency over every played game, `points started of possible`, left on the bench, best-set week (highest efficiency, link), the one that got away (most bench points left, link).

**Draft success**: average grade (mean of per-season draft rank → letter), value per draft, best draft (year, grade, value), the steal (best pick by value), the one that hurt (worst), per-season grade chips linking to draft boards. Hidden when no graded draft.

**Franchise players**: top six players by weeks rostered then points started for this manager: headshot, position pill, name, `2023–2025 · 3 seasons`, `40/49 started`, points started, high. Kickers and defenses included.

## Data and helpers

- `lib/teamProfile.ts` — pure, tested: `seasonProfile`, `careerProfile`, `longestWinStreak`, `fieldedAs`, `franchisePlayers`.
- `lib/managerRecords.ts` — pure, tested: `managerRecords(ctx, userId)` → `{ sub, title, boardId, rank, valueLabel, meta }[]`.
- Reuses `teamGamesOf`, `managerSeasonsOf`, `flattenLines`, `waiverClaims`, `managerDraftSummaries`, `letterGrade`, `boardsFor`.
- No core or sync changes.

## Styling

Cards, `section-label`, `num` mono numbers, `PosPill`, `Headshot`, `Avatar` as elsewhere. New `--gold` colour token (light and dark) used only for #1 records. Phone: columns stack, position cards one per row, tiles 2×3.

## Testing

Unit tests for `teamProfile`, `managerRecords`; component tests for the roster bar, schedule, records card and rivals; route test entries; Nav test updated for the new link. Screenshots at 1440 and 400 before merge.

## Out of scope

Cards / Table / Field roster toggle, league rating, Hall of Fame, dues, manager-page tabs, seasons before 2023.
