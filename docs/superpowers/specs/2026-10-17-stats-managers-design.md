# Stats page, Managers tab — design

Date: 2026-10-17. Project 2 after Records. Brainstormed over four rounds of chart mockups drawn from the real 2025 season (kept under `.superpowers/brainstorm/`). Mathias approved the chart set below and asked to build; the structural decisions in this spec were made by Claude with the reasoning stated, for his review before planning.

## Goal

A `/stats` section that is visual and interactive rather than boards of rows: one page of charts and one sortable table about the managers, with a season picker and a "pin a manager" control that lights that manager up in every chart while the rest go quiet. It should feel like the team and manager pages (cards, section eyebrows, the site's gold, red and green), not like Records.

The Players tab (league leaders moved over from Records, plus efficiency, consistency, expected points and journeymen) is a follow-up spec; it is not built here. Until it exists the Stats page has no tab bar, only the Managers content.

## Navigation and routes

- Top bar gains **Stats** between Records and History.
- `/stats` → the Managers stats page. Query params: `season` (a year, or `all`; default the current season), `pin` (a manager id; default none). Both survive reloads and are shareable.
- `/stats/managers` is accepted and redirects to `/stats` with the params kept, so the Players follow-up can add `/stats/players` without moving anything.

## Page structure

A toolbar, then five sections of cards, then the table. Everything scrolls; no sub-tabs.

**Toolbar** (sticky under the nav on wide screens): the season picker (`SeasonPicker` with the All-time option) and the pin row: one pill per manager (avatar + name) in standings order; clicking pins, clicking again unpins; the pinned pill is gold. On a phone the pin row scrolls horizontally.

**Sections** (each a titled group of cards, the card having an eyebrow, a title and a one-line caption under the chart):

1. **The season** — Standings race · Form guide · Scoring calendar · Weekly finishes.
2. **Strength** — Power rating · Consistency · Schedule luck · Strength of schedule · Head to head · Postseason form.
3. **Roster** — Draft returns by round · Where the points came from · Roster age · Wire activity.
4. **Moments** — Robbed · Stolen · Flattened · Close calls (one card with four short lists).
5. **The numbers** — the sortable table.

Grid: two cards per row from `lg`, one below; the wide ones (form guide, scoring calendar, head to head, draft returns, wire activity) span both columns.

## Pin and hover

- `pin` is the one piece of page state besides the season. Every chart takes `pin: UserId | null`.
- Unpinned: managers are drawn in the site's muted tones (lines in `--dim`, bars in muted colours, names in `--ink`). Red and green always mean bad and good, gold always means the pinned manager or a best-of-week mark.
- Pinned: that manager's marks turn `--gold` and come to the front; everyone else drops to 35–45 % opacity. His row in the table gets the record-row gold tint.
- Hovering a manager's name or mark in any chart previews the same highlight without pinning; moving away restores. Hover is per chart, pin is page-wide.
- Tooltips: SVG `<title>` on every mark, the way the site's charts already do it. No custom tooltip layer in v1.

## Season versus all-time

The season picker lists every season plus All-time. Charts fall into three kinds:

- **Per-week charts** (standings race, form guide, scoring calendar, weekly finishes, draft returns, wire activity, postseason form): drawn for one season. In All-time they are hidden and the section shows the one-line note "Pick a season for the week-by-week charts."
- **Aggregate charts** (consistency, schedule luck, strength of schedule, head to head, where the points came from, roster age, moments, the table): in a season they use that season's games; in All-time they use every game, with the table adding a Seasons column.
- **Power rating**: in a season it runs from that season's week 1; in All-time it is one continuous line per manager across every season, with the offseason regression visible as a step, and season boundaries marked. This is the headline all-time chart.

The current season behaves like any other: charts use the weeks played so far, the table says "through week N" in its caption, and anything postseason is empty until the playoffs start.

## The charts

All hand-drawn SVG, one component each under `components/stats/`, each taking its numbers from a pure function in `lib/stats/` so the maths is unit-tested without the DOM. Responsive via `viewBox` and `width="100%"`, the way `SeasonShape` works. Managers are named by display name; rows show the avatar at 20px where there is room.

**Standings race** — line per manager: table position (wins, then points for) after every regular-season week. Dashed green line at the playoff cut. Names at the right edge. Pinned line is gold and three pixels; the rest grey.

**Form guide** — grid, managers × weeks played (regular and postseason), a rounded square per game: green W, red L, grey T, empty when the manager had no game (bye week in the playoffs). A dashed gold vertical line down the whole chart between the last regular week and the first playoff week. A small gold dot in the corner of the week's top score. Title: score, opponent, opponent score.

**Scoring calendar** — grid, managers × regular-season weeks: cell colour is the score against that week's league average, green above, red below, intensity up to 45 points; the score printed in the cell.

**Weekly finishes** — per manager a bar split into weeks finished in the top three scorers (green), the middle (grey) and the bottom three (red), counts printed; sorted by top-three count then fewest bottom-three.

**Power rating** — Elo. Everyone starts at 1500. Before a game the expected score is `1 / (1 + 10^((opp − me) / 400))`. After it, each side moves by `K × (actual − expected)` with `K = 32 × min(2, 1 + margin / 40)`, actual 1, 0 or 0.5. Regular season and playoffs both count; consolation games too. Between seasons every rating is pulled a third of the way back to 1500 (`r = 1500 + (r − 1500) × 2/3`), and a manager's first season starts at 1500. Chart: one line per manager by week (by season-week in All-time), the 1500 line dashed, playoff weeks shaded, the current rating printed at the right for the pinned manager (or the leader when nobody is pinned). The definition appears in the card's "?" popover like the Records boards.

**Consistency** — per manager a strip from the worst to the best week (thin line), a box from the second-worst to the second-best week, a tick at the median; sorted by median. Regular season only.

**Schedule luck** — dumbbell per manager: hollow dot at the record against the weekly median (wins = weeks scoring above the league median that week), filled dot at the real record; the bar green when the schedule helped, red when it hurt, no third colour. Sorted by the gap.

**Strength of schedule** — bar per manager: average points opponents scored against him minus the league's average weekly score; red to the right (hard), green to the left (soft). Regular season only.

**Head to head** — grid, managers × managers: cell `a-b` where a is the weeks the row outscored the column across every week both played (the all-play record by opponent), green when winning the pair, red when losing, grey at 50 %. The caption says in words that every week counts as if they had played, not only the real matchups. Title on the cell: the real matchup record between the two as well, so the actual games are one hover away.

**Postseason form** — dumbbell per manager who played a postseason game: hollow dot at regular-season points per game, filled dot at postseason points per game (consolation included), green when up, red when down, the difference printed. Hidden until the playoffs start.

**Draft returns by round** — grid, managers × draft rounds: cell brightness is the started points the manager got from the player he drafted in that round, the number printed when 60 or more; title names the player and his points. Sorted by total started points from the draft.

**Where the points came from** — stacked bar per manager of started points by how the player was acquired: draft (green), waivers and free agents together (gold), trade (purple); percentages printed; sorted by the non-draft share. Legend under the chart.

**Roster age** — a spectrum from ROOK (green) to UNC (red): a dot per manager placed at the average age of the players behind his started points, weighted by those points, names staggered above and below. Age comes from the player's birth date as of 1 September of the season; where the birth date is missing it is estimated as 22 + NFL seasons and the caption says "estimated". Title: average age, share of points from rookies and from players 30 and over.

**Wire activity** — grid, managers × weeks: pickups (waiver and free agent adds) per week, blue intensity, count printed; the season's total pickups and FAAB spent at the right. Sorted by total.

**Moments** — four lists of four: Robbed (highest score in a loss), Stolen (lowest score in a win), Flattened (biggest margins), Close calls (smallest margins); each row the value in gold mono, the manager, and "wk N · score–score vs opponent" linking to the box score.

## The numbers (sortable table)

One row per manager, every column sortable by clicking its header (first click descending for the "more is better" columns, ascending for the rest; a second click flips), default sort PPG descending. Column groups with a group header row:

- **Record**: Rec · All-play · xW · Luck · vs median · Streaks
- **Scoring**: PPG · PA/G · High weeks · Top-3 · Bottom-3 · SD · Floor · Ceiling
- **Games**: Close (≤10) · Blowouts (≥30) · SOS · Postseason rec · Postseason PPG
- **Lineups**: Eff · Bench left · Proj+ · Δproj
- **Roster**: FAAB · Pickups · Waiver share · Draft value

Definitions (regular season unless said): xW = all-play win rate × games; Luck = W − xW; vs median = wins over the weekly league median; Streaks = longest win and loss streaks as `W5 / L3`; PA/G = points against per game; High weeks = weeks as the top scorer; SD = standard deviation of weekly score; Floor and Ceiling = second-worst and second-best week; Close = record in games decided by ten or fewer; Blowouts = record in games decided by thirty or more; SOS = opponents' average score against him minus the league average; Postseason = playoff and consolation games; Eff = points / optimal lineup points; Bench left = optimal minus actual, total; Proj+ = share of weeks over Sleeper's projection; Δproj = average points over projection; FAAB = dollars bid on won waivers; Pickups = waiver and free-agent adds; Waiver share = share of started points from non-draft pickups; Draft value = sum of pick values from the draft grading. A "?" popover on the card holds this list. All-time adds a Seasons column after the manager.

Phone: the table scrolls horizontally with the manager column sticky.

## Data and helpers

- `lib/stats/managerStats.ts` — pure: `managerStats(seasons: Season[], scope: number | 'all', players, history)` → `{ rows: StatRow[]; weekly: WeeklyTable; … }`, one function per chart's numbers (`standingsRace`, `formGuide`, `scoringCalendar`, `weeklyFinishes`, `consistency`, `scheduleLuck`, `strengthOfSchedule`, `allPlayGrid`, `postseasonForm`, `draftReturns`, `pointOrigins`, `rosterAge`, `wireActivity`, `moments`, `statTable`). Each takes the shared `ManagerSeasonData` built once per scope.
- `lib/stats/elo.ts` — pure: `eloHistory(seasons)` → per manager, per (year, week) rating, with the constants exported for the popover text.
- `lib/stats/ownership.ts` — pure: who owned a player in a given week and how he was acquired, from the draft and the transaction log (draft at week 0, then adds and drops in created order; an add in week w counts from week w). Shared by draft returns, point origins and the waiver-share column. Also fixes the rough edge the mockup had: a drafted player dropped and re-added is a pickup from the re-add on.
- Reuses `teamGamesOf`, `managerSeasonsOf`, `waiverClaims`, `managerDraftSummaries`, `finishOf`, `computeStandings` where they fit.
- **Core and sync change**: `PlayerInfo` gains `birthDate: string | null` (Sleeper's `birth_date`), `toPlayerDirectory` copies it, and `pnpm sync` refreshes `data/players.json`. If the sync cannot run before merge, roster age falls back to the estimate and says so; nothing else depends on it.

## Styling

Cards, `section-label` eyebrows, `num` mono numbers, `Avatar`, the `--gold`, `--win`, `--loss`, `--muted` tokens, a new `--dim` token for unpinned chart lines (dark and light values). The "?" popover from `Board.tsx` is lifted into a small shared `About` component so cards here can use it. Charts never use the ten-colour per-manager palette from the mockups; identity comes from names, avatars and the pin.

## Testing

- Unit tests for every function in `lib/stats/` with small hand-built seasons (two or three managers, four to six weeks, one playoff week, a draft and a few transactions), including Elo's expected-score and margin maths, the offseason regression, ownership across a drop and re-add, the median record, close and blowout counts, and the table's sort keys.
- Component tests for the toolbar (season and pin in the URL, pin toggling, pills), the table (sort by a column both ways, sticky manager column present, Seasons column only in All-time), and one test per chart that the right marks exist and the pinned manager is gold (`data-pinned` on the mark) with the others dimmed.
- Route and nav tests for `/stats`, the `/stats/managers` redirect, and the new tab.
- Real-data smoke test: `managerStats` over the committed seasons produces one row per manager for every season and All-time without throwing.
- Screenshots in headless Chrome at 1280 and 400 before merge, dark and light.

## Out of scope

The Players tab, custom tooltips, animation, exporting images, per-manager deep-dive pages (the manager page already exists), the "what if" standings table, the trade ledger, and any change to the Records page.

## Built (2026-10-17)

Shipped as planned in `docs/superpowers/plans/2026-10-17-stats-managers.md`: `/stats` with the toolbar, five groups of cards and the table, pure maths under `lib/stats/`, components under `components/stats/`, the Stats nav tab, the `/stats/managers` alias, and `birthDate` on every player (the sync ran; 411 of 443 players have one, the rest are estimated from NFL seasons and the roster-age caption says so).

Decisions made while building:
- The season view of the power rating shows that season's weeks with ratings carried in from earlier seasons (after the offseason pull toward 1500), not a fresh 1500 start, so it agrees with the all-time line.
- The head-to-head grid counts regular-season weeks only, matching the league's all-play record; the real matchups (any week) are in the hover.
- Weekly finishes for a small league: top = rank 3 or better, bottom = rank below max(3, n − 3), so four managers split into a top three and a bottom one.
- Ownership: an add counts from its week; a drop takes effect the week after it is logged (Sleeper logs a drop against the just-played week), so the drop week still belongs to the dropper. A player neither drafted nor logged counts as "unknown" origin and is drawn grey in the points-origin bars.
- Line charts and the age spectrum size their SVG to the card so text stays 10px in a wide card; dense week labels are thinned to about twelve, sparse year labels all show.
- Known: at phone widths the whole site, not only this page, is wider than the viewport (the nav's Menu button is clipped on /standings and /records too); left for a separate fix.
