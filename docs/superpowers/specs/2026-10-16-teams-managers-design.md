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

**Header card**: avatar (72px), eyebrow `2026 season · All teams`, team name (display name when no team name), handle, badge line `Scoring 2nd of 10 · Points allowed 5th most · Vs. everyone 40–15` (all-play from the standings row). Six tiles: Record, Pts for, Pts against, Finish, Draft slot, FAAB spent. Finish: `1st` / `2nd` / `3rd` / `Last` from honors for complete seasons, else `#rank` with a "regular season" note so a seed is never mistaken for a title; `—` in season. FAAB = sum of `bid` over the manager's completed waiver claims. Footer strip: `Longest win streak N · Left on the bench X · Y% of the best lineup` (over every played game, playoffs included).

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

**Franchise players**: top six players by weeks rostered then points started for this manager, in two columns: headshot, position pill, name, `2023–2025 · 3 seasons`, `40/49 started`, points started, high. Kickers and defenses included.

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

## Nav dropdowns and name links (2026-10-16, later the same day)

Mathias used the index pages once and asked for them to go: "lets instead just have it be a dropdown from the actual top bar tab, so we dont even need this selection page", then "lets have a Rosters tab and Managers tab (both with dropdowns)", and "all the team names in the other pages/manager names in the other pages to link to the respective team & manager page".

- **Top bar.** The Teams tab is now two tabs, **Rosters** and **Managers**, each a button with a chevron (`components/NavMenu.tsx`). Hover opens the panel while the pointer stays; a click pins it until the next click, Escape, a press outside, or navigation. Rosters lists this season's teams in standings order (avatar, team name, manager) linking to `/teams/{year}/{userId}`; Managers lists everyone in all-time order (avatar, name, seasons played) linking to `/managers/{userId}`. The tab is lit for any page under its prefix. The narrow-screen sheet has the same two lists as collapsible groups. Entry lists come from `lib/navMenus.ts`; the Rosters list needs the season file, so `Nav` loads the current season once on mount through the cached loader and shows "Loading…" until it arrives.
- **Index pages gone.** `TeamsPage`, `ManagersPage`, `TeamsTabs`, `IndexRow` and `lib/indexRows` are deleted. `/teams` → `/teams/{currentYear}` → the top team of that season's standings; `/managers` → the all-time number one. The team page lost its "All teams" link; the in-page manager `<select>` on the team and manager pages stays.
- **Name links everywhere.** `components/NameLink.tsx`: `TeamLink` (team name → that season's team page), `ManagerLink` (manager name → career page) and `CoverLink` (an absolutely positioned link filling a `relative` row or card, so the row still opens its game while the names inside sit above it with `relative z-10`; no link ever nests in another). Applied to the standings table, score cards, the box score header, the Ranked list, head-to-head, efficiency, form and position battle blocks, the series summary, the season review honors, bracket, round one and records blocks, the history table, the draft top-PPG list, the grading guide, the team page schedule, best starts, moves and the manager page rivals, and the Records boards. Every single-manager `/h2h?a=` link became a manager-page link; pair links (`/h2h?a=&b=`) stay where the row is about the series.
- **Not linked, on purpose.** Names that are controls: the draft board column headers and team-draft prev/next (highlight toggles), the draft-analysis grade rows (selectors), the head-to-head manager picker and opponent list (selectors), the tooltip text on traded picks.
- **Review fixes.** The bar owns which menu is pinned, so hovering the other tab closes a pinned one and two panels never show together. A failed season load shows "Could not load this season's teams" instead of staying on "Loading…". Score card and bracket cover links are named after the game ("Team A vs Team B box score") so a reader tabbing through can tell the cards apart. The grading guide's example table links its managers too.

## Championship pennant (2026-10-16, later again)

Mathias: "a cool banner on the teams page and manager that show off a championship (says champion and 2026 underneath) pennant shaped. that comes down next to the team name/ manager name (make it big and beautiful)".

`components/teams/Pennant.tsx` draws a hanging pennant in SVG: a 76×128 gold banner with a V-point, two grommets on the top edge, a thin darker inset border, CHAMPION tracked small near the top, the year large in the mono face beneath it, and the trophy glyph by the point. Gold comes from the `--gold` token through `color-mix`, so it reads in both themes. `ProfileHeader` takes `pennants: number[]` (years, newest first) and hangs them to the right of the name, pulled up by the card padding so they drape from the top edge; several titles hang side by side. The team page passes the season year when that manager won it and the season is complete; the manager page passes every title year from the career honors. Runner-up and other finishes get no pennant.
