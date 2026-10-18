# Player Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page per player at `/player/:id`. It shows his fantasy impact in this league, his path through the league, percentile bars, advanced numbers by season, a weekly game log and his league records. Player names across the site link to it.

**Architecture:**
- The route loader loads every league season and every player database through the existing cached loaders.
- Pure functions in `packages/web/src/lib/player/` derive each section. Each is tested on fixtures.
- Presentational components in `packages/web/src/components/player/` render the sections.
- The Players table's header and cell rendering is extracted into shared parts, so the game log and Advanced by season reuse it instead of copying it.

**Tech Stack:** React 18, react-router v7 (data router, loaders), Tailwind v4, Vitest + Testing Library, pnpm monorepo (`packages/core`, `packages/web`).

**Spec:** `docs/superpowers/specs/2026-10-18-player-pages-design.md`

## Global Constraints

- Route: `/player/:id`, where `id` is the Sleeper player id. This is the same key as `players.json` and `PlayerDb.players`.
- Load everything in the browser through `loadAllSeasons()`, `hasPlayerDb(year)` and `loadPlayerDb(year)`. No new data files and no sync changes.
- An id that is neither in any player database nor ever rostered returns `throw new Response(..., { status: 404 })` from the loader, which the existing ErrorPage renders.
- Sections with no data are omitted, not shown empty:
  - kicker or defense: no percentile bars, Advanced by season or game log
  - never rostered: no season table, path or records
- Counting rules for league numbers:
  - Consolation games (`line.consolation`) are excluded everywhere.
  - Winners-bracket games (`line.postseason`) count, and also feed "Playoff pts".
- Move dates read `"{year} draft"` for draft and keeper picks and `"{year} Wk {week}"` otherwise. A stint end of `null` reads `"now"`.
- Gold uses `var(--gold)` / `text-gold`. Titles use `FinishIcon kind="champion"`. Rank-one records use the existing `LeagueRecords` styling.
- Percentile bar colours: `var(--win)` at 66 or higher, `var(--warn)` at 33 or higher, otherwise `var(--loss)`. A small sample shows `bg-surface-2` with the text "small sample".
- Ruling (deviation from the spec): the game log has no Total / Per game toggle. One week is one game, so the two modes show the same numbers. Mathias is told at handoff.
- Phone width: cards stack, header tiles go 3 across, and tables scroll inside their card (`overflow-auto`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every task runs from `packages/web` unless stated: `npx vitest run <file>` for one file, `pnpm test` from the repo root for all.

## Review Focus

1. **A player traded twice in one week, or dropped and re-added in the same week.** He should end up on the right roster, with no zero-length stint that shows "Wk 5 → Wk 4". The Task 4 test "a drop and re-add in the same week keeps one stint" pins this.
2. **A player on a roster in the newest season whose newest stint began in an earlier season and was kept.** It should read "→ now". Pinned by the Task 4 keeper test.
3. **Season rows for a player only ever on a roster during consolation weeks.** He should get no row, and no NaN in PPG. Pinned by the Task 3 test "consolation-only lines make no row".
4. **A defense (team id like `KC`) or kicker.** The page renders the header, season table, path and records, with no database sections and no crash. Pinned by the Task 9 page test "kicker shows league sections only".
5. **A player whose database rows exist only in a season with no league data yet.** His game log and percentile bars still work with `season` undefined, and the season table is empty. Pinned by the Task 5 test "works without a league season".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/test/playerPageFixtures.ts` (create) | League seasons fixture for one traded, kept, title-winning WR (`w1`) plus a dropped and re-added RB (`r1`). |
| `src/lib/player/coverage.ts` (create) | `isRostered(seasons, id)` and `dbYearsOf(dbs, id)`. |
| `src/lib/player/bio.ts` (create) | `bioOf(...)`: name, position, NFL team, age, height, weight, college, NFL draft. |
| `src/lib/player/seasons.ts` (create) | `seasonTable(...)` and `summaryOf(...)`. |
| `src/lib/player/journey.ts` (create) | `journeyOf(...)`, `whenLabel(...)` and `stintRange(...)`. |
| `src/lib/player/percentiles.ts` (create) | `METRICS` and `percentileBars(...)`. |
| `src/lib/player/gameLog.ts` (create) | `gameLog(...)` and `weekTints(...)`. |
| `src/lib/player/records.ts` (create) | `playerRecords(...)`. |
| `src/components/players/db/GridParts.tsx` (create) | `HeaderCell`, `GroupHeaderCells`, `ColumnHeaderCells` and `StatCells`, shared by the Players table and the player page. |
| `src/components/players/db/PlayerDbTable.tsx` (modify) | Uses GridParts. The name becomes a link and the chevron expands. |
| `src/components/Icons.tsx` (modify) | `MoveIcon` with ticket, lock, swap, coin, plus and minus shapes. |
| `src/components/NameLink.tsx` (modify) | `PlayerLink`. |
| `src/components/teams/LeagueRecords.tsx` (modify) | A `tab` prop for the records link. |
| `src/components/player/*.tsx` (create) | `PlayerHeader`, `SeasonTable`, `PercentileBars`, `AdvancedBySeason`, `GameLog` and `JourneyFeed`. |
| `src/pages/PlayerPage.tsx` (create) | Section assembly. |
| `src/routes.tsx` (modify) | `playerLoader` and the `player/:id` route. |
| `src/lib/player/smoke.test.ts` (create) | Runs every lib function over the committed data. |
| Name-link sites (modify) | `boxscore/LineupTable.tsx`, `teams/RosterBreakdown.tsx`, `draft/DraftBoard.tsx`, `players/Board.tsx`. |

---

### Task 1: Fixtures, coverage, and the route

**Files:**
- Create: `packages/web/src/test/playerPageFixtures.ts`
- Create: `packages/web/src/lib/player/coverage.ts`
- Test: `packages/web/src/lib/player/coverage.test.ts`
- Modify: `packages/web/src/routes.tsx`
- Create: `packages/web/src/pages/PlayerPage.tsx` (a placeholder heading, replaced in Task 9)

**Interfaces:**
- Produces:
  - `leagueSeasons(): Season[]`, the fixture used by Tasks 3, 4, 5, 6 and 9
  - `isRostered(seasons: Season[], id: PlayerId): boolean`
  - `dbYearsOf(dbs: PlayerDb[], id: PlayerId): number[]`, ascending
  - `interface PlayerPageData { id: PlayerId; seasons: Season[]; dbs: PlayerDb[] }`, exported from `pages/PlayerPage.tsx`
  - `playerLoader`, exported from `routes.tsx`

- [ ] **Step 1: Write the fixture**

```ts
// packages/web/src/test/playerPageFixtures.ts
import type { Draft, DraftPick, Season, Transaction } from '@fantasy-dash/core';
import { game, line, season, side, week } from './playerFixtures';

const mgrs = { A: { userId: 'A', displayName: 'Alice', teamName: 'Team A', avatar: null, rosterId: 1 }, B: { userId: 'B', displayName: 'Bob', teamName: null, avatar: null, rosterId: 2 } };
export const pick = (round: number, pickNo: number, userId: string, playerId: string, isKeeper: boolean): DraftPick =>
  ({ round, pickNo, slot: 1, userId, playerId, isKeeper, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: true, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null, tradedTo: null });
export const draft = (picks: DraftPick[]): Draft => ({ draftId: 'd', type: 'snake', rounds: 15, slotOrder: ['A', 'B'], picks, expectedCurve: null, baselines: {} });
export const tx = (type: Transaction['type'], week: number, created: number, adds: [string, string][], drops: [string, string][], bid: number | null = null): Transaction =>
  ({ id: `t${created}`, type, week, created, adds: adds.map(([playerId, userId]) => ({ playerId, userId })), drops: drops.map(([playerId, userId]) => ({ playerId, userId })), bid });

/**
 * w1 (WR): drafted by Alice (A) in 2025 R3 #25, started wk1 (W), benched wk2 in a 5-point loss scoring 30,
 * traded to Bob (B) in wk3 for r1, started for Bob in the wk3 Final (Bob wins the title), kept by Bob in 2026, started wk1 (W).
 * r1 (RB): drafted by Bob 2025 R1 #2, traded to Alice wk3; in 2026 Alice drops him wk2 and re-adds him off waivers ($5) the same week.
 * k1 (K): on Bob's 2026 week-1 bench, so a kicker has league lines and no database rows.
 */
export function leagueSeasons(): Season[] {
  const s25 = season(2025, [
    week(1, [game(2025, 1, 1, side('A', 110, [line('w1', 20)]), side('B', 90, [line('r1', 12)]))]),
    week(2, [game(2025, 2, 1, side('A', 95, [line('q1', 18)], [line('w1', 30)]), side('B', 100, [line('r1', 25)]))]),
    week(3, [game(2025, 3, 1, side('A', 120, [line('r1', 22)]), side('B', 125, [line('w1', 8)]), 'Final')], true),
  ], 'B');
  s25.managers = mgrs;
  s25.draft = draft([pick(1, 2, 'B', 'r1', false), pick(3, 25, 'A', 'w1', false)]);
  s25.transactions = [tx('trade', 3, 300, [['w1', 'B'], ['r1', 'A']], [['w1', 'A'], ['r1', 'B']])];
  s25.playerSeasons = { r1: { points: 59, games: 3, posRank: 1 }, w1: { points: 58, games: 3, posRank: 2 }, q1: { points: 18, games: 1, posRank: 1 } };

  const s26 = season(2026, [
    week(1, [game(2026, 1, 1, side('A', 100, [line('r1', 10)]), side('B', 105, [line('w1', 15)], [line('k1', 7)]))]),
    week(2, [game(2026, 2, 1, side('A', 90, [line('r1', 9)]), side('B', 80, [line('w1', 4)]))]),
  ], null);
  s26.status = 'in_season';
  s26.managers = mgrs;
  s26.draft = draft([pick(2, 14, 'B', 'w1', true), pick(1, 1, 'A', 'r1', true)]);
  s26.transactions = [tx('free_agent', 2, 500, [], [['r1', 'A']]), tx('waiver', 2, 510, [['r1', 'A']], [], 5)];
  s26.playerSeasons = { w1: { points: 19, games: 2, posRank: 1 }, r1: { points: 19, games: 2, posRank: 1 } };
  return [s25, s26];
}
```

- [ ] **Step 2: Write the failing coverage test**

```ts
// packages/web/src/lib/player/coverage.test.ts
import { dbYearsOf, isRostered } from './coverage';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { miniDb } from '../../test/playerDbFixtures';

describe('coverage', () => {
  it('knows who was ever on a roster, starter or bench', () => {
    const s = leagueSeasons();
    expect(isRostered(s, 'w1')).toBe(true);
    expect(isRostered(s, 'q1')).toBe(true);
    expect(isRostered(s, 'k1')).toBe(true);
    expect(isRostered(s, 't1')).toBe(false);
  });
  it('lists the database years a player has rows in, oldest first', () => {
    const older = { ...miniDb(), year: 2025 };
    expect(dbYearsOf([miniDb(), older], 'w1')).toEqual([2025, 2026]);
    expect(dbYearsOf([miniDb()], 'nobody')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/lib/player/coverage.test.ts`
Expected: FAIL with `Failed to resolve import "./coverage"`.

- [ ] **Step 4: Implement coverage**

```ts
// packages/web/src/lib/player/coverage.ts
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';

/** Whether the player was ever on a league roster, as a starter or on the bench. */
export function isRostered(seasons: Season[], id: PlayerId): boolean {
  return seasons.some((s) => s.weeks.some((w) => w.games.some((g) => g.sides.some((sd) =>
    sd.starters.some((e) => e.player?.playerId === id) || sd.bench.some((b) => b.playerId === id)))));
}

/** Seasons of player-database rows for the player, oldest first. */
export function dbYearsOf(dbs: PlayerDb[], id: PlayerId): number[] {
  return dbs.filter((d) => d.rows.some((r) => r.id === id)).map((d) => d.year).sort((a, b) => a - b);
}
```

- [ ] **Step 5: Run it to confirm it passes**

Run: `npx vitest run src/lib/player/coverage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Add the placeholder page and the route**

```tsx
// packages/web/src/pages/PlayerPage.tsx
import { useLoaderData } from 'react-router';
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import { players } from '../data/load';
import { playerName } from '../lib/players';

export interface PlayerPageData { id: PlayerId; seasons: Season[]; dbs: PlayerDb[] }

export default function PlayerPage() {
  const { id } = useLoaderData() as PlayerPageData;
  return <h1 className="text-2xl font-semibold tracking-tight">{playerName(players, id)}</h1>;
}
```

In `routes.tsx`, import `PlayerPage, { type PlayerPageData }` and `isRostered` (from `./lib/player/coverage`). Add the loader under `playersLoader`:

```ts
export async function playerLoader({ params }: LoaderFunctionArgs): Promise<PlayerPageData> {
  const id = params.id ?? '';
  const years = history.seasons.map((s) => s.year).filter(hasPlayerDb);
  const [seasons, dbs] = await Promise.all([loadAllSeasons(), Promise.all(years.map(loadPlayerDb))]);
  if (!dbs.some((d) => Object.hasOwn(d.players, id)) && !isRostered(seasons, id)) throw new Response(`No player ${id}`, { status: 404 });
  return { id, seasons, dbs };
}
```

Then add the route after `players/:season`: `{ path: 'player/:id', loader: playerLoader, element: <PlayerPage /> },`

- [ ] **Step 7: Type check and build**

Run: `npx tsc --noEmit -p tsconfig.json && cd ../.. && pnpm build`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/test/playerPageFixtures.ts packages/web/src/lib/player packages/web/src/pages/PlayerPage.tsx packages/web/src/routes.tsx
git commit -m "Player pages: fixture, coverage helpers and the /player/:id route"
```

---

### Task 2: Bio

**Files:**
- Create: `packages/web/src/lib/player/bio.ts`
- Test: `packages/web/src/lib/player/bio.test.ts`

**Interfaces:**
- Consumes: `PlayerDirectory` (the `players` export of `data/load`) and `PlayerDb[]`.
- Produces:
  - `interface Bio { name: string; pos: string; nflTeam: string; age: number | null; height: string | null; weight: number | null; college: string | null; nflDraft: string | null }`
  - `bioOf(id: PlayerId, players: PlayerDirectory, dbs: PlayerDb[], today: Date): Bio`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/lib/player/bio.test.ts
import { bioOf } from './bio';
import { players } from '../../test/playerFixtures';
import { miniDb } from '../../test/playerDbFixtures';

const today = new Date('2026-10-18T12:00:00Z');
const withBio = () => {
  const db = miniDb();
  db.players.w1 = { ...db.players.w1, birthDate: '2001-05-29', height: 74, weight: 210, college: 'BYU', draft: { year: 2023, round: 5, pick: 177 } };
  return db;
};

describe('bioOf', () => {
  it('reads the newest database entry: age on the day, feet and inches, NFL draft', () => {
    expect(bioOf('w1', players, [withBio()], today)).toMatchObject({ name: 'Wide One', pos: 'WR', age: 25, height: `6'2"`, weight: 210, college: 'BYU', nflDraft: '2023 · R5 #177' });
  });
  it('falls back to the directory for a kicker, leaving unknown fields null', () => {
    expect(bioOf('k1', players, [miniDb()], today)).toEqual({ name: 'Kick One', pos: 'K', nflTeam: 'BAL', age: null, height: null, weight: null, college: null, nflDraft: null });
  });
  it('counts a birthday later in the year as not yet reached', () => {
    const db = withBio();
    db.players.w1 = { ...db.players.w1, birthDate: '2001-12-01' };
    expect(bioOf('w1', players, [db], today).age).toBe(24);
  });
});
```

If `miniDb().players.w1` has no `height`, `weight`, `college` or `draft` field in its type, read `packages/core/src/playerdb/types.ts` (`DbPlayer`) and match its field names. The test's values stay the same. Record any rename as a ruling.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/player/bio.test.ts`
Expected: FAIL with `Failed to resolve import "./bio"`.

- [ ] **Step 3: Implement**

```ts
// packages/web/src/lib/player/bio.ts
import type { PlayerDb, PlayerDirectory, PlayerId } from '@fantasy-dash/core';

export interface Bio { name: string; pos: string; nflTeam: string; age: number | null; height: string | null; weight: number | null; college: string | null; nflDraft: string | null }

const ageOn = (birth: string, today: Date): number => {
  const b = new Date(`${birth}T00:00:00Z`);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
};

/** Who he is: the newest player-database entry first, the league's player directory as the fallback. */
export function bioOf(id: PlayerId, players: PlayerDirectory, dbs: PlayerDb[], today: Date): Bio {
  const entry = [...dbs].sort((a, b) => b.year - a.year).map((d) => d.players[id]).find(Boolean);
  const dir = players[id];
  const birth = entry?.birthDate ?? dir?.birthDate ?? null;
  return {
    name: entry?.name ?? dir?.name ?? id,
    pos: entry?.pos ?? dir?.position ?? '?',
    nflTeam: dir?.team ?? entry?.teams.at(-1) ?? '',
    age: birth ? ageOn(birth, today) : null,
    height: entry?.height ? `${Math.floor(entry.height / 12)}'${entry.height % 12}"` : null,
    weight: entry?.weight ?? null,
    college: entry?.college ?? null,
    nflDraft: entry?.draft ? `${entry.draft.year} · R${entry.draft.round} #${entry.draft.pick}` : null,
  };
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/lib/player/bio.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/player/bio.ts packages/web/src/lib/player/bio.test.ts
git commit -m "Player pages: bio"
```

---

### Task 3: Season table and summary

**Files:**
- Create: `packages/web/src/lib/player/seasons.ts`
- Test: `packages/web/src/lib/player/seasons.test.ts`

**Interfaces:**
- Consumes: `PlayerLine[]` (his lines only, from `flattenLines`), `Season[]`, and `leagueSeasons()`.
- Produces:
  - `interface SeasonRow { year: number; managers: UserId[]; starts: number; rostered: number; benchPts: number; pts: number; ppg: number | null; best: number | null; posRank: number | null; overallRank: number | null; w: number; l: number; t: number; playoffPts: number | null; title: boolean }`
  - `type BestKey = 'starts' | 'pts' | 'ppg' | 'best' | 'posRank' | 'overallRank' | 'playoffPts'`
  - `interface SeasonTable { rows: SeasonRow[]; career: Omit<SeasonRow, 'year' | 'managers' | 'posRank' | 'overallRank' | 'title'> & { managers: number }; best: Partial<Record<BestKey, number>> }`
  - `seasonTable(lines: PlayerLine[], seasons: Season[], id: PlayerId): SeasonTable`. Rows are oldest first. `best` is empty when there are fewer than 2 rows.
  - `interface Summary { ptsStarted: number; perStart: number | null; starts: number; rostered: number; best: number | null; w: number; l: number; t: number; managers: number; titles: number[] }`
  - `summaryOf(table: SeasonTable): Summary`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/lib/player/seasons.test.ts
import { flattenLines } from '../playerLines';
import { seasonTable, summaryOf } from './seasons';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';

const of = (id: string) => { const s = leagueSeasons(); return seasonTable(flattenLines(s, players).filter((l) => l.playerId === id), s, id); };

describe('seasonTable', () => {
  it('rows a traded title season with both managers, bench points and playoff points', () => {
    expect(of('w1').rows[0]).toEqual({ year: 2025, managers: ['A', 'B'], starts: 2, rostered: 3, benchPts: 30, pts: 28, ppg: 14, best: 30, posRank: 2, overallRank: 2, w: 2, l: 0, t: 0, playoffPts: 8, title: true });
  });
  it('rows a season with no winners-bracket game as playoffPts null', () => {
    expect(of('w1').rows[1]).toMatchObject({ year: 2026, managers: ['B'], starts: 2, pts: 19, w: 1, l: 1, playoffPts: null, title: false });
  });
  it('closes with a career row and marks each column best only when there is more than one season', () => {
    const t = of('w1');
    expect(t.career).toEqual({ managers: 2, starts: 4, rostered: 5, benchPts: 30, pts: 47, ppg: 11.75, best: 30, w: 3, l: 1, t: 0, playoffPts: 8 });
    expect(t.best).toMatchObject({ pts: 28, best: 30, posRank: 1, overallRank: 1 });
  });
  it('makes no row for a season where every line is a consolation game', () => {
    const s = leagueSeasons();
    for (const g of s[1].weeks.flatMap((w) => w.games)) g.tag = 'Toilet Bowl';
    const t = seasonTable(flattenLines(s, players).filter((l) => l.playerId === 'w1'), s, 'w1');
    expect(t.rows.map((r) => r.year)).toEqual([2025]);
    expect(t.best).toEqual({});
  });
});

describe('summaryOf', () => {
  it('turns the career row into header tiles with title years', () => {
    expect(summaryOf(of('w1'))).toEqual({ ptsStarted: 47, perStart: 11.75, starts: 4, rostered: 5, best: 30, w: 3, l: 1, t: 0, managers: 2, titles: [2025] });
  });
  it('is all zeros and nulls for a player never rostered', () => {
    expect(summaryOf(of('t1'))).toEqual({ ptsStarted: 0, perStart: null, starts: 0, rostered: 0, best: null, w: 0, l: 0, t: 0, managers: 0, titles: [] });
  });
});
```

How the numbers come out of the fixture:
- In 2026, w1 starts week 1 (15 pts, Bob wins 105–100) and week 2 (4 pts, Bob loses 80–90).
- In 2026, w1 and r1 tie on 19 season points. Ties share the better rank, so his 2026 overall rank is 1.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/player/seasons.test.ts`
Expected: FAIL with `Failed to resolve import "./seasons"`.

- [ ] **Step 3: Implement**

```ts
// packages/web/src/lib/player/seasons.ts
import type { PlayerId, Season, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from '../playerLines';

export interface SeasonRow { year: number; managers: UserId[]; starts: number; rostered: number; benchPts: number; pts: number; ppg: number | null; best: number | null; posRank: number | null; overallRank: number | null; w: number; l: number; t: number; playoffPts: number | null; title: boolean }
export type BestKey = 'starts' | 'pts' | 'ppg' | 'best' | 'posRank' | 'overallRank' | 'playoffPts';
export interface SeasonTable { rows: SeasonRow[]; career: Omit<SeasonRow, 'year' | 'managers' | 'posRank' | 'overallRank' | 'title'> & { managers: number }; best: Partial<Record<BestKey, number>> }
export interface Summary { ptsStarted: number; perStart: number | null; starts: number; rostered: number; best: number | null; w: number; l: number; t: number; managers: number; titles: number[] }

const LOWER_BETTER: ReadonlySet<BestKey> = new Set(['posRank', 'overallRank']);

/** rank by season points among every player that season; ties share the better rank */
function overallRank(season: Season, id: PlayerId): number | null {
  const mine = season.playerSeasons[id]?.points;
  if (mine === undefined) return null;
  return Object.values(season.playerSeasons).filter((p) => p.points > mine).length + 1;
}

function tally(lines: PlayerLine[]) {
  const started = lines.filter((l) => l.started);
  const po = started.filter((l) => l.postseason);
  const pts = started.reduce((n, l) => n + l.points, 0);
  return {
    starts: started.length, rostered: lines.length,
    benchPts: lines.filter((l) => !l.started).reduce((n, l) => n + l.points, 0),
    pts, ppg: started.length ? pts / started.length : null,
    best: lines.length ? Math.max(...lines.map((l) => l.points)) : null,
    w: started.filter((l) => l.result === 'W').length, l: started.filter((l) => l.result === 'L').length, t: started.filter((l) => l.result === 'T').length,
    playoffPts: po.length ? po.reduce((n, l) => n + l.points, 0) : null,
  };
}

/** One row per league season he was rostered in (consolation games excluded), a career row, and each column's best when there are two or more seasons. */
export function seasonTable(lines: PlayerLine[], seasons: Season[], id: PlayerId): SeasonTable {
  const counted = lines.filter((l) => !l.consolation);
  const rows: SeasonRow[] = [];
  for (const s of [...seasons].sort((a, b) => a.year - b.year)) {
    const mine = counted.filter((l) => l.year === s.year).sort((a, b) => a.week - b.week);
    if (!mine.length) continue;
    const managers = [...new Set(mine.map((l) => l.userId))];
    const champ = s.honors.champion;
    rows.push({
      year: s.year, managers, ...tally(mine),
      posRank: s.playerSeasons[id]?.posRank ?? null, overallRank: overallRank(s, id),
      title: champ !== null && mine.some((l) => l.postseason && l.userId === champ),
    });
  }
  const best: SeasonTable['best'] = {};
  if (rows.length > 1) {
    for (const k of ['starts', 'pts', 'ppg', 'best', 'posRank', 'overallRank', 'playoffPts'] as BestKey[]) {
      const vals = rows.map((r) => r[k]).filter((v): v is number => v !== null);
      if (vals.length) best[k] = LOWER_BETTER.has(k) ? Math.min(...vals) : Math.max(...vals);
    }
  }
  return { rows, career: { managers: new Set(rows.flatMap((r) => r.managers)).size, ...tally(counted) }, best };
}

export function summaryOf(table: SeasonTable): Summary {
  const c = table.career;
  return { ptsStarted: c.pts, perStart: c.ppg, starts: c.starts, rostered: c.rostered, best: c.best, w: c.w, l: c.l, t: c.t, managers: c.managers, titles: table.rows.filter((r) => r.title).map((r) => r.year) };
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/lib/player/seasons.test.ts`
Expected: PASS (6 tests). If a number differs, recheck it against the fixture by hand before changing code. The fixture is the source of truth, and a corrected expectation is a ruling.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/player/seasons.ts packages/web/src/lib/player/seasons.test.ts
git commit -m "Player pages: season table and summary"
```

---

### Task 4: Journey (stints and moves)

**Files:**
- Create: `packages/web/src/lib/player/journey.ts`
- Test: `packages/web/src/lib/player/journey.test.ts`

**Interfaces:**
- Consumes: his `PlayerLine[]`, `Season[]`, and `PlayerDirectory` (for traded-for player names, via `playerName`).
- Produces:
  - `type MoveKind = 'drafted' | 'kept' | 'traded' | 'waiver' | 'freeAgent' | 'dropped' | 'commissioner'`
  - `interface At { year: number; week: number }`, where week 0 is the draft
  - `interface Move { kind: MoveKind; at: At; created: number; text: string }`
  - `interface Stint { userId: UserId; teamName: string; lastYear: number; from: At; to: At | null; starts: number; pts: number; perStart: number | null; w: number; l: number; t: number; title: boolean; moves: Move[] }`
  - `journeyOf(lines: PlayerLine[], seasons: Season[], players: PlayerDirectory, id: PlayerId): Stint[]`. Newest first, and moves are newest first within a stint.
  - `whenLabel(at: At): string`: `"2025 draft"` or `"2025 Wk 3"`
  - `stintRange(s: Stint): string`: `"2025 draft → 2025 Wk 2"` or `"2025 Wk 3 → now"`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/lib/player/journey.test.ts
import { flattenLines } from '../playerLines';
import { journeyOf, stintRange } from './journey';
import { leagueSeasons, tx } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';

const of = (id: string, s = leagueSeasons()) => journeyOf(flattenLines(s, players).filter((l) => l.playerId === id), s, players, id);

describe('journeyOf', () => {
  it('splits a drafted player at the trade and carries the keeper into the next season, newest first', () => {
    const [bob, alice] = of('w1');
    expect(bob).toMatchObject({ userId: 'B', teamName: 'Bob', from: { year: 2025, week: 3 }, to: null, starts: 3, pts: 27, w: 2, l: 1, title: true });
    expect(bob.moves.map((m) => [m.kind, m.text])).toEqual([['kept', 'Kept at an R2 price'], ['traded', 'Traded from Alice, who got Ricky One']]);
    expect(alice).toMatchObject({ userId: 'A', teamName: 'Team A', from: { year: 2025, week: 0 }, to: { year: 2025, week: 2 }, starts: 1, pts: 20, title: false });
    expect(alice.moves.map((m) => m.text)).toEqual(['Drafted R3 #25']);
    expect(stintRange(bob)).toBe('2025 Wk 3 → now');
    expect(stintRange(alice)).toBe('2025 draft → 2025 Wk 2');
  });
  it('a drop and re-add in the same week keeps one stint, listing both moves', () => {
    const [alice] = of('r1');
    expect(alice.userId).toBe('A');
    expect(alice.to).toBeNull();
    expect(alice.moves.map((m) => [m.kind, m.text])).toEqual([['waiver', 'Waiver claim · $5 FAAB'], ['dropped', 'Dropped'], ['kept', 'Kept at an R1 price'], ['traded', 'Traded from Bob, who got Wally One']]);
  });
  it('a drop and a re-add in a later week makes two stints', () => {
    const s = leagueSeasons();
    s[1].transactions = [tx('free_agent', 2, 500, [], [['r1', 'A']]), tx('free_agent', 3, 600, [['r1', 'A']], [])];
    const st = of('r1', s);
    expect(st.map((x) => [x.userId, x.from, x.to])).toEqual([['A', { year: 2026, week: 3 }, null], ['A', { year: 2025, week: 3 }, { year: 2026, week: 1 }], ['B', { year: 2025, week: 0 }, { year: 2025, week: 2 }]]);
    expect(st[0].moves.map((m) => m.text)).toEqual(['Free-agent add']);
  });
  it('ends a stint at the season it was not kept into', () => {
    const s = leagueSeasons();
    s[1].draft!.picks = s[1].draft!.picks.filter((p) => p.playerId !== 'w1');
    s[1].weeks = s[1].weeks.map((w) => ({ ...w, games: w.games.map((g) => ({ ...g, sides: g.sides.map((sd) => ({ ...sd, starters: sd.starters.filter((e) => e.player?.playerId !== 'w1') })) as typeof g.sides })) }));
    const [bob] = of('w1', s);
    expect(bob.to).toEqual({ year: 2025, week: 3 });
  });
  it('is empty for a player never rostered', () => {
    expect(of('t1')).toEqual([]);
  });
});
```

How the r1 expectations come out of the fixture:
- Bob drafts r1 in 2025.
- In the 2025 wk3 trade Alice gets r1 and Bob gets w1, so the move reads "Traded from Bob, who got Wally One".
- Alice keeps r1 in 2026 (R1 price).
- In 2026 wk2 Alice drops him and re-claims him off waivers in the same week. That keeps one stint, because a re-add in the same week as the drop reopens the stint it closed. So Alice's stint runs from 2025 Wk 3 to now, with moves newest first: waiver, dropped, kept, traded.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/player/journey.test.ts`
Expected: FAIL with `Failed to resolve import "./journey"`.

- [ ] **Step 3: Implement**

```ts
// packages/web/src/lib/player/journey.ts
import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from '../playerLines';
import { playerName } from '../players';

export type MoveKind = 'drafted' | 'kept' | 'traded' | 'waiver' | 'freeAgent' | 'dropped' | 'commissioner';
export interface At { year: number; week: number }
export interface Move { kind: MoveKind; at: At; created: number; text: string }
export interface Stint { userId: UserId; teamName: string; lastYear: number; from: At; to: At | null; starts: number; pts: number; perStart: number | null; w: number; l: number; t: number; title: boolean; moves: Move[] }

interface Ev { at: At; created: number; kind: MoveKind; userId: UserId; acquire: boolean; text: string }

const cmp = (a: At, b: At) => a.year - b.year || a.week - b.week;
export const whenLabel = (at: At): string => (at.week === 0 ? `${at.year} draft` : `${at.year} Wk ${at.week}`);
export const stintRange = (s: Stint): string => `${whenLabel(s.from)} → ${s.to ? whenLabel(s.to) : 'now'}`;
const lastWeekOf = (s: Season) => Math.max(0, ...s.weeks.filter((w) => w.played).map((w) => w.week));

function eventsOf(seasons: Season[], players: PlayerDirectory, id: PlayerId): Ev[] {
  const name = (y: number, u: UserId) => { const m = seasons.find((s) => s.year === y)?.managers[u]; return m?.displayName ?? u; };
  const out: Ev[] = [];
  for (const s of seasons) {
    for (const p of s.draft?.picks ?? []) {
      if (p.playerId !== id) continue;
      out.push({ at: { year: s.year, week: 0 }, created: 0, kind: p.isKeeper ? 'kept' : 'drafted', userId: p.userId, acquire: true, text: p.isKeeper ? `Kept at an R${p.round} price` : `Drafted R${p.round} #${p.pickNo}` });
    }
    for (const t of s.transactions) {
      const at = { year: s.year, week: t.week };
      const add = t.adds.find((m) => m.playerId === id);
      const drop = t.drops.find((m) => m.playerId === id);
      if (t.type === 'trade' && add) {
        const from = drop?.userId;
        const got = from ? t.adds.filter((m) => m.userId === from).map((m) => playerName(players, m.playerId)) : [];
        out.push({ at, created: t.created, kind: 'traded', userId: add.userId, acquire: true, text: from ? `Traded from ${name(s.year, from)}${got.length ? `, who got ${got.join(' + ')}` : ''}` : 'Traded' });
        continue;
      }
      if (drop) out.push({ at, created: t.created, kind: t.type === 'commissioner' ? 'commissioner' : 'dropped', userId: drop.userId, acquire: false, text: t.type === 'commissioner' ? 'Moved by the commissioner' : 'Dropped' });
      if (add) {
        const kind: MoveKind = t.type === 'waiver' ? 'waiver' : t.type === 'free_agent' ? 'freeAgent' : 'commissioner';
        const text = kind === 'waiver' ? `Waiver claim${t.bid ? ` · $${t.bid} FAAB` : ''}` : kind === 'freeAgent' ? 'Free-agent add' : 'Moved by the commissioner';
        out.push({ at, created: t.created + 0.5, kind, userId: add.userId, acquire: true, text });
      }
    }
  }
  return out.sort((a, b) => cmp(a.at, b.at) || a.created - b.created);
}

/** Every unbroken spell on one roster, newest first, with the moves that opened and closed it. */
export function journeyOf(lines: PlayerLine[], seasons: Season[], players: PlayerDirectory, id: PlayerId): Stint[] {
  if (!lines.length) return [];
  const sorted = [...seasons].sort((a, b) => a.year - b.year);
  const newest = sorted.at(-1)!.year;
  const evs = eventsOf(sorted, players, id);
  type Open = { userId: UserId; from: At; moves: Move[] };
  const done: { userId: UserId; from: At; to: At | null; moves: Move[] }[] = [];
  let open: Open | null = null;
  const close = (to: At) => { if (open) { done.push({ ...open, to }); open = null; } };
  const move = (e: Ev): Move => ({ kind: e.kind, at: e.at, created: e.created, text: e.text });

  for (const s of sorted) {
    if (open && (open as Open).from.year < s.year) {
      // a roster carries over only on a keeper pick, or in a season with no draft while he is still on that roster
      const o = open as Open;
      const kept = s.draft?.picks.some((p) => p.playerId === id && p.isKeeper && p.userId === o.userId);
      const stayed = !s.draft && lines.some((l) => l.year === s.year && l.userId === o.userId);
      const prev = sorted.find((x) => x.year === s.year - 1) ?? s;
      if (!kept && !stayed) close({ year: prev.year, week: lastWeekOf(prev) });
    }
    for (const e of evs.filter((x) => x.at.year === s.year)) {
      const o = open as Open | null;
      if (e.acquire) {
        if (o && o.userId === e.userId) { o.moves.push(move(e)); continue; }
        if (o) close({ year: e.at.year, week: Math.max(0, e.at.week - 1) });
        // a re-add in the very week of the drop reopens the stint it closed
        const last = done.at(-1);
        if (last && last.userId === e.userId && last.to && last.to.year === e.at.year && last.to.week === e.at.week - 1 && last.moves.at(-1)?.kind === 'dropped' && last.moves.at(-1)!.at.week === e.at.week) {
          done.pop(); open = { userId: last.userId, from: last.from, moves: [...last.moves, move(e)] }; continue;
        }
        open = { userId: e.userId, from: e.at, moves: [move(e)] };
      } else if (o && o.userId === e.userId) {
        o.moves.push(move(e));
        close({ year: e.at.year, week: Math.max(0, e.at.week - 1) });
      }
    }
  }
  if (open) { const o = open as Open; if (o.from.year === newest || lines.some((l) => l.year === newest && l.userId === o.userId)) done.push({ ...o, to: null }); else { const last = sorted.find((x) => x.year === Math.max(...lines.filter((l) => l.userId === o.userId).map((l) => l.year)))!; done.push({ ...o, to: { year: last.year, week: lastWeekOf(last) } }); } }

  const inside = (l: PlayerLine, d: { from: At; to: At | null }) => cmp({ year: l.year, week: l.week }, d.from) >= 0 && (d.to === null || cmp({ year: l.year, week: l.week }, d.to) <= 0);
  return done.map((d) => {
    const mine = lines.filter((l) => !l.consolation && l.userId === d.userId && inside(l, d));
    const started = mine.filter((l) => l.started);
    const pts = started.reduce((n, l) => n + l.points, 0);
    const lastYear = d.to?.year ?? newest;
    const champs = sorted.filter((s) => s.honors.champion === d.userId).map((s) => s.year);
    const m = sorted.find((s) => s.year === lastYear)?.managers[d.userId];
    return {
      userId: d.userId, teamName: m?.teamName ?? m?.displayName ?? d.userId, lastYear, from: d.from, to: d.to,
      starts: started.length, pts, perStart: started.length ? pts / started.length : null,
      w: started.filter((l) => l.result === 'W').length, l: started.filter((l) => l.result === 'L').length, t: started.filter((l) => l.result === 'T').length,
      title: mine.some((l) => l.postseason && champs.includes(l.year)),
      moves: [...d.moves].sort((a, b) => cmp(b.at, a.at) || b.created - a.created),
    };
  }).sort((a, b) => cmp(b.from, a.from));
}
```

Note on "Traded from Alice, who got Ricky One": the trade's other adds to the old owner are the players he got. The fixture's trade gives r1 to A, so for w1 the text names Ricky One.

Note on the `teamName` expectation for Bob: Bob's `teamName` is null, so the display name `'Bob'` is used.

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run src/lib/player/journey.test.ts`
Expected: PASS (5 tests). The w1 Bob stint covers 2025 Wk 3 (8 pts, W) and 2026 Wk 1 (15, W) and Wk 2 (4, L). That is `starts: 3, pts: 27, w: 2, l: 1`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/player/journey.ts packages/web/src/lib/player/journey.test.ts
git commit -m "Player pages: path through the league (stints and moves)"
```

---

### Task 5: Percentile bars and game log

**Files:**
- Create: `packages/web/src/lib/player/percentiles.ts`
- Create: `packages/web/src/lib/player/gameLog.ts`
- Test: `packages/web/src/lib/player/percentiles.test.ts`, `packages/web/src/lib/player/gameLog.test.ts`

**Interfaces:**
- Consumes:
  - `aggregate(db, from, to)` and `aggregateWeeks(db, rows, weeks)` from `lib/playerdb/aggregate`
  - `COLUMNS`, `columnValue`, `belowMin`, `type Mode` and `type ColumnDef` from `lib/playerdb/columns`
  - `percentiles` and `columnTints` from `lib/playerdb/percentile`
  - his `PlayerLine[]` for the season, and `Season | undefined`
- Produces:
  - `interface Metric { key: string; mode: Mode; label: string }`
  - `const METRICS: Record<'QB' | 'RB' | 'WR' | 'TE', Metric[]>`
  - `interface Bar { key: string; label: string; mode: Mode; value: number | null; pct: number | null; small: boolean }`
  - `percentileBars(db: PlayerDb, id: PlayerId): Bar[] | null`. It returns null when he has no rows in `db` or his position has no metrics.
  - `interface LogRow { week: number; agg: Agg | null; bye: boolean; opp: string; line: PlayerLine | null; score: { mine: number; theirs: number } | null; swing: number | null }`
  - `gameLog(db: PlayerDb, id: PlayerId, lines: PlayerLine[], season: Season | undefined): LogRow[]`. Weeks run 1..`db.throughWeek`.
  - `weekTints(db: PlayerDb, rows: LogRow[], cols: ColumnDef[], pos: string): Map<string, string[]>`. The map is keyed by column; each value is indexed like `rows` (untinted `'transparent'` where `agg` is null).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/src/lib/player/percentiles.test.ts
import { METRICS, percentileBars } from './percentiles';
import { COLUMNS } from '../playerdb/columns';
import { miniDb } from '../../test/playerDbFixtures';

describe('percentileBars', () => {
  it('only lists metrics that exist as Players-table columns', () => {
    for (const list of Object.values(METRICS)) for (const m of list) expect(COLUMNS[m.key], m.key).toBeDefined();
  });
  it('gives a WR one bar per WR metric', () => {
    expect(percentileBars(miniDb(), 'w1')!.map((b) => b.key)).toEqual(METRICS.WR.map((m) => m.key));
  });
  it('ranks among peers over the sample minimum: a lone qualifier sits at 50', () => {
    expect(percentileBars(miniDb(), 'w1')!.find((b) => b.key === 'tgtPct')).toMatchObject({ pct: 50, small: false });
  });
  it('greys a bar he is under the minimum for', () => {
    expect(percentileBars(miniDb(), 'w2')!.find((b) => b.key === 'tgtPct')).toMatchObject({ pct: null, small: true });
  });
  it('is null for a player with no rows', () => {
    expect(percentileBars(miniDb(), 'k1')).toBeNull();
  });
});
```

The `tgtPct` cases assume w1 clears the target minimum (3 targets × 3 weeks) and w2 does not. If `miniDb` says otherwise, pick a metric where it holds by reading `src/test/playerDbFixtures.ts`, and ledger the swap.

```ts
// packages/web/src/lib/player/gameLog.test.ts
import { flattenLines } from '../playerLines';
import { COLUMNS } from '../playerdb/columns';
import { gameLog, weekTints } from './gameLog';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';
import { miniDb } from '../../test/playerDbFixtures';

const s26 = () => leagueSeasons()[1];
const linesOf = (id: string) => { const s = leagueSeasons(); return flattenLines(s, players).filter((l) => l.playerId === id && l.year === 2026); };

describe('gameLog', () => {
  it('has a row per database week, with the league week alongside when rostered', () => {
    const rows = gameLog(miniDb(), 'w1', linesOf('w1'), s26());
    expect(rows.map((r) => r.week)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ line: { userId: 'B', started: true }, score: { mine: 105, theirs: 100 }, swing: null });
    expect(rows[0].agg?.s.pts).toBeDefined();
    expect(rows[2].line).toBeNull();
  });
  it('separates a bye from a missed game', () => {
    const db = miniDb();
    const wk2 = db.rows.find((r) => r.id === 'w1' && r.week === 2)!;
    db.rows = db.rows.filter((r) => r !== wk2);
    expect(gameLog(db, 'w1', [], undefined)[1]).toMatchObject({ agg: null, bye: false });
    const teams = new Set(db.rows.filter((r) => r.id === 'w1').map((r) => r.team));
    db.teamWeeks = db.teamWeeks.filter((t) => !(t.week === 2 && teams.has(t.team)));
    expect(gameLog(db, 'w1', [], undefined)[1]).toMatchObject({ agg: null, bye: true });
  });
  it('works without a league season', () => {
    expect(gameLog(miniDb(), 'w1', [], undefined).every((r) => r.line === null && r.score === null)).toBe(true);
  });
  it('marks points left on the bench in a loss they would have swung', () => {
    const s = leagueSeasons();
    const lines = flattenLines(s, players).filter((l) => l.playerId === 'w1' && l.year === 2025);
    const db = { ...miniDb(), year: 2025 };
    expect(gameLog(db, 'w1', lines, s[0])[1]).toMatchObject({ line: { started: false }, score: { mine: 95, theirs: 100 }, swing: 30 });
  });
  it('tints each week against his position that week', () => {
    const db = miniDb();
    const rows = gameLog(db, 'w1', [], undefined);
    const t = weekTints(db, rows, [COLUMNS.tgt], 'WR');
    expect(t.get('tgt')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run src/lib/player/percentiles.test.ts src/lib/player/gameLog.test.ts`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Implement percentiles**

```ts
// packages/web/src/lib/player/percentiles.ts
import type { PlayerDb, PlayerId } from '@fantasy-dash/core';
import { aggregate } from '../playerdb/aggregate';
import { COLUMNS, belowMin, columnValue, type Mode } from '../playerdb/columns';
import { percentiles } from '../playerdb/percentile';

export interface Metric { key: string; mode: Mode; label: string }
export interface Bar { key: string; label: string; mode: Mode; value: number | null; pct: number | null; small: boolean }

const m = (key: string, label: string, mode: Mode = 'total'): Metric => ({ key, label, mode });
const WR_TE = [m('snapPct', 'Snap%'), m('routePct', 'Route%'), m('tgtPct', 'Tgt share'), m('yprr', 'YPRR'), m('adotRe', 'aDOT'), m('sep', 'Separation'), m('catchPct', 'Catch%'), m('yacRec', 'YAC/rec'), m('dropPct', 'Drop%'), m('xfpPg', 'xFP/g'), m('fpoePg', 'FPOE/g')];
/** The spec's lists, each label mapped to a Players-table column; a label with no column was dropped (QB TD rate and INT rate become TD/g and INT/g). */
export const METRICS: Record<'QB' | 'RB' | 'WR' | 'TE', Metric[]> = {
  QB: [m('paYds', 'Pass yds/g', 'pg'), m('cmpPct', 'Cmp%'), m('ya', 'Y/A'), m('paTd', 'Pass TD/g', 'pg'), m('int', 'INT/g', 'pg'), m('adot', 'aDOT'), m('cpoe', 'CPOE'), m('epaDb', 'EPA/db'), m('ruYds', 'Rush yds/g', 'pg'), m('xfpPg', 'xFP/g'), m('fpoePg', 'FPOE/g')],
  RB: [m('snapPct', 'Snap%'), m('carryPct', 'Carry share'), m('tgtPct', 'Tgt share'), m('ypc', 'YPC'), m('ryoeAtt', 'RYOE/att'), m('btTouch', 'BT/touch'), m('yprr', 'YPRR'), m('oppPct', 'Opp share'), m('xfpPg', 'xFP/g'), m('fpoePg', 'FPOE/g')],
  WR: WR_TE,
  TE: WR_TE,
};

/** Where he ranks among his position's qualifiers this season, 0–100; null and small when he is under a column's minimum. */
export function percentileBars(db: PlayerDb, id: PlayerId): Bar[] | null {
  const pos = db.players[id]?.pos as keyof typeof METRICS | undefined;
  const metrics = pos ? METRICS[pos] : undefined;
  if (!metrics) return null;
  const aggs = aggregate(db, 1, Math.max(1, db.throughWeek));
  const me = aggs.find((a) => a.id === id);
  if (!me) return null;
  const peers = aggs.filter((a) => db.players[a.id]?.pos === pos);
  const idx = peers.indexOf(me);
  return metrics.map((mt) => {
    const col = COLUMNS[mt.key];
    const value = columnValue(col, me, mt.mode);
    if (belowMin(col, me) || value === null) return { key: mt.key, label: mt.label, mode: mt.mode, value, pct: null, small: belowMin(col, me) };
    const p = percentiles(peers.map((a) => (belowMin(col, a) ? null : columnValue(col, a, mt.mode))))[idx];
    const pct = p === null ? null : Math.round((col.lowerIsBetter ? 1 - p : p) * 100);
    return { key: mt.key, label: mt.label, mode: mt.mode, value, pct, small: false };
  });
}
```

- [ ] **Step 4: Implement the game log**

```ts
// packages/web/src/lib/player/gameLog.ts
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import { aggregate, aggregateWeeks, type Agg } from '../playerdb/aggregate';
import type { ColumnDef } from '../playerdb/columns';
import { columnTints } from '../playerdb/percentile';
import type { PlayerLine } from '../playerLines';

export interface LogRow { week: number; agg: Agg | null; bye: boolean; opp: string; line: PlayerLine | null; score: { mine: number; theirs: number } | null; swing: number | null }

/** One row per database week, his advanced numbers beside the league week he spent on a roster (if any). */
export function gameLog(db: PlayerDb, id: PlayerId, lines: PlayerLine[], season: Season | undefined): LogRow[] {
  const mine = db.rows.filter((r) => r.id === id).sort((a, b) => a.week - b.week);
  const hasTeamWeek = (team: string, w: number) => db.teamWeeks.some((t) => t.team === team && t.week === w);
  return Array.from({ length: Math.max(0, db.throughWeek) }, (_, i) => i + 1).map((week) => {
    const row = mine.find((r) => r.week === week);
    const line = lines.find((l) => l.week === week && !l.consolation) ?? null;
    const g = line && season?.weeks[week - 1]?.games.find((x) => x.id === line.gameId);
    const me = g?.sides.find((s) => s.userId === line!.userId), them = g?.sides.find((s) => s.userId !== line!.userId);
    const score = me && them ? { mine: me.points, theirs: them.points } : null;
    const swing = line && score && !line.started && line.result === 'L' && line.points > score.theirs - score.mine ? line.points : null;
    if (row) return { week, agg: aggregateWeeks(db, [row], 1), bye: false, opp: row.opp ?? '', line, score, swing };
    const prev = [...mine].reverse().find((r) => r.week < week), next = mine.find((r) => r.week > week);
    const teams = [prev?.team, next?.team].filter((t): t is string => Boolean(t));
    return { week, agg: null, bye: line?.bye ?? (teams.length > 0 && teams.every((t) => !hasTeamWeek(t, week))), opp: '', line, score, swing };
  });
}

/** Per column, a tint for each row: his value against every same-position player that week. */
export function weekTints(db: PlayerDb, rows: LogRow[], cols: ColumnDef[], pos: string): Map<string, string[]> {
  const out = new Map(cols.map((c) => [c.key, rows.map(() => 'transparent')] as const));
  rows.forEach((r, i) => {
    if (!r.agg) return;
    const peers = aggregate(db, r.week, r.week).filter((a) => db.players[a.id]?.pos === pos);
    const idx = peers.findIndex((a) => a.id === r.agg!.id);
    if (idx < 0) return;
    for (const c of cols) out.get(c.key)![i] = columnTints(c, peers, 'total')[idx];
  });
  return out;
}
```

If `PlayerWeek` has no `opp` field, use `''` and ledger it. `WeekRows.tsx` reads `row.opp`, so it is expected to exist.

- [ ] **Step 5: Run them to confirm they pass**

Run: `npx vitest run src/lib/player/percentiles.test.ts src/lib/player/gameLog.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/player/percentiles.* packages/web/src/lib/player/gameLog.*
git commit -m "Player pages: percentile bars and the weekly game log"
```

---

### Task 6: Player records

**Files:**
- Create: `packages/web/src/lib/player/records.ts`
- Test: `packages/web/src/lib/player/records.test.ts`
- Modify: `packages/web/src/components/teams/LeagueRecords.tsx` (add the `tab` prop)

**Interfaces:**
- Consumes:
  - `allTimeContext(seasons, players, managers)` and `type ManagerRecord` from `lib/managerRecords`
  - `boardsFor` from `lib/playerBoards`
  - `subTabsOf` from `lib/boards/tabs`
  - `filterLines` and `isPosFilter` from `lib/playerLines`
- Produces:
  - `playerRecords(ctx: BoardContext, id: PlayerId, pos: string, maxRank = 3): ManagerRecord[]`
  - `LeagueRecords` gains `tab?: 'players' | 'managers'`, defaulting to `'managers'`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/lib/player/records.test.ts
import { allTimeContext } from '../managerRecords';
import { playerRecords } from './records';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';

const ctx = () => allTimeContext(leagueSeasons(), players, { A: { displayName: 'Alice', avatar: null, seasons: [2025, 2026] }, B: { displayName: 'Bob', avatar: null, seasons: [2025, 2026] } });

describe('playerRecords', () => {
  it('lists boards where he ranks in the top three, each once', () => {
    const recs = playerRecords(ctx(), 'w1', 'WR');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.rank >= 1 && r.rank <= 3)).toBe(true);
    expect(new Set(recs.map((r) => r.boardId)).size).toBe(recs.length);
  });
  it('labels a position-board placing with the position and skips boards already listed under All', () => {
    const recs = playerRecords(ctx(), 'w1', 'WR');
    const all = new Set(recs.filter((r) => !r.title.endsWith(' · WR')).map((r) => r.boardId));
    for (const r of recs.filter((x) => x.title.endsWith(' · WR'))) expect(all.has(r.boardId.replace(/:WR$/, ''))).toBe(false);
  });
  it('is empty for a player with no league lines', () => {
    expect(playerRecords(ctx(), 't1', 'TE')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/player/records.test.ts`
Expected: FAIL with `Failed to resolve import "./records"`.

- [ ] **Step 3: Implement**

```ts
// packages/web/src/lib/player/records.ts
import type { PlayerId } from '@fantasy-dash/core';
import type { BoardContext } from '../boards/shared';
import { subTabsOf } from '../boards/tabs';
import type { ManagerRecord } from '../managerRecords';
import { boardsFor } from '../playerBoards';
import { filterLines, isPosFilter } from '../playerLines';

/** Every players-tab record board (Leaders excepted: those are this season's tables, not records) where his row ranks ≤ maxRank, over all positions and then his own. */
export function playerRecords(ctx: BoardContext, id: PlayerId, pos: string, maxRank = 3): ManagerRecord[] {
  const out: ManagerRecord[] = [];
  const seen = new Set<string>();
  const passes: { ctx: BoardContext; suffix: string }[] = [{ ctx: { ...ctx, pos: 'All' }, suffix: '' }];
  if (isPosFilter(pos) && pos !== 'All') passes.push({ ctx: { ...ctx, pos, lines: filterLines(ctx.lines, pos), allLines: ctx.allLines ?? ctx.lines }, suffix: pos });
  for (const pass of passes) {
    for (const sub of subTabsOf('players')) {
      if (sub.id === 'leaders') continue;
      for (const def of boardsFor('players', sub.id)) {
        if (pass.suffix && seen.has(def.id)) continue;
        const rows = def.compute(pass.ctx);
        const r = rows.find((x) => x.playerId === id);
        if (!r) continue;
        const rank = rows.findIndex((o) => o.value === r.value) + 1;
        if (rank > maxRank) continue;
        seen.add(def.id);
        out.push({ sub: sub.id, subTitle: sub.title, boardId: pass.suffix ? `${def.id}:${pass.suffix}` : def.id, title: pass.suffix ? `${def.title} · ${pass.suffix}` : def.title, rank, valueLabel: r.valueLabel, meta: r.meta, detail: r.detail });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Add the `tab` prop to LeagueRecords**

In `components/teams/LeagueRecords.tsx`:
- Change `interface Props { records: ManagerRecord[] }` to `interface Props { records: ManagerRecord[]; tab?: 'players' | 'managers' }`.
- Change the signature to `({ records, tab = 'managers' }: Props)`.
- Change the link to ``to={`/records?${tab === 'managers' ? 'tab=managers&' : ''}sub=${r.sub}`}``.

The existing LeagueRecords tests keep passing, because the default is unchanged.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/player/records.test.ts src/components/teams`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/lib/player/records.* packages/web/src/components/teams/LeagueRecords.tsx
git commit -m "Player pages: league records for a player"
```

---

### Task 7: Shared grid parts for the Players table

A refactor with no behaviour change. The existing `PlayerDbTable` and `PlayersPage` tests are the safety net. They must pass before and after.

**Files:**
- Create: `packages/web/src/components/players/db/GridParts.tsx`
- Test: `packages/web/src/components/players/db/GridParts.test.tsx`
- Modify: `packages/web/src/components/players/db/PlayerDbTable.tsx`

**Interfaces:**
- Produces, exported from `GridParts.tsx`:
  - `th` (class string)
  - `HeaderCell({ col, title, arrow?, onSort?, first? })`: without `onSort` it renders a plain label
  - `GroupHeaderCells({ groups, collapsed, onToggleGroup })`: the group-title `<th>`s
  - `ColumnHeaderCells({ groups, collapsed, title, arrow?, onSort? })`: column `<th>`s, with a single `…` cell for a collapsed group
  - `StatCells({ groups, collapsed, agg, mode, tint })`: body `<td>`s, with one blank cell per collapsed group. `tint` has type `(key: string) => string`.
  - `type Group = { group: string; cols: ColumnDef[] }`

- [ ] **Step 1: Run the existing table tests to record the baseline**

Run: `npx vitest run src/components/players/db src/pages/PlayersPage.test.tsx`
Expected: PASS (note the count).

- [ ] **Step 2: Write the failing test for the parts**

```tsx
// packages/web/src/components/players/db/GridParts.test.tsx
import { render, screen } from '@testing-library/react';
import { ColumnHeaderCells, GroupHeaderCells, StatCells } from './GridParts';
import { groupsFor } from '../../../lib/playerdb/columns';
import { aggregate } from '../../../lib/playerdb/aggregate';
import { miniDb } from '../../../test/playerDbFixtures';

const body = groupsFor('wr').slice(1);
const agg = aggregate(miniDb(), 1, 3).find((a) => a.id === 'w1')!;

describe('GridParts', () => {
  it('collapses a group to one header cell and one body cell', () => {
    const collapsed = new Set([body[0].group]);
    render(<table><thead><tr><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={() => {}} /></tr><tr><ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} /></tr></thead>
      <tbody><tr><StatCells groups={body} collapsed={collapsed} agg={agg} mode="total" tint={() => 'transparent'} /></tr></tbody></table>);
    expect(screen.getByRole('button', { name: `Expand ${body[0].group}` })).toBeInTheDocument();
    const cells = screen.getAllByRole('row')[2].querySelectorAll('td');
    expect(cells.length).toBe(1 + body.slice(1).reduce((n, g) => n + g.cols.length, 0));
  });
  it('renders plain header labels when there is no sort', () => {
    render(<table><thead><tr><ColumnHeaderCells groups={body.slice(0, 1)} collapsed={new Set()} title={(c) => c.def} /></tr></thead></table>);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/components/players/db/GridParts.test.tsx`
Expected: FAIL with `Failed to resolve import "./GridParts"`.

- [ ] **Step 4: Implement GridParts, then use it in PlayerDbTable**

```tsx
// packages/web/src/components/players/db/GridParts.tsx
import type { Agg } from '../../../lib/playerdb/aggregate';
import { belowMin, columnValue, type ColumnDef, type Mode } from '../../../lib/playerdb/columns';
import TintCell from './TintCell';

export type Group = { group: string; cols: ColumnDef[] };
export const th = 'section-label whitespace-nowrap px-2 py-2 text-center';

export function HeaderCell({ col, title, arrow = '', onSort, first = false }: { col: ColumnDef; title: string; arrow?: string; onSort?: (key: string) => void; first?: boolean }) {
  return (
    <th scope="col" title={title} className={`${th} border-b border-line ${first ? 'border-l' : ''}`}>
      {onSort ? <button type="button" onClick={() => onSort(col.key)} className="hover:text-ink">{col.label}{arrow}</button> : col.label}
    </th>
  );
}

export function GroupHeaderCells({ groups, collapsed, onToggleGroup }: { groups: Group[]; collapsed: ReadonlySet<string>; onToggleGroup: (g: string) => void }) {
  return <>{groups.map((g) => {
    const off = collapsed.has(g.group);
    return (
      <th key={g.group} colSpan={off ? 1 : g.cols.length} className="section-label border-b border-l border-line px-2 py-1 text-left">
        <button type="button" aria-label={`${off ? 'Expand' : 'Collapse'} ${g.group}`} onClick={() => onToggleGroup(g.group)} className="hover:text-ink">{off ? '▸ ' : '▾ '}{g.group}</button>
      </th>
    );
  })}</>;
}

export function ColumnHeaderCells({ groups, collapsed, title, arrow, onSort }: { groups: Group[]; collapsed: ReadonlySet<string>; title: (c: ColumnDef) => string; arrow?: (key: string) => string; onSort?: (key: string) => void }) {
  return <>{groups.map((g) => (collapsed.has(g.group)
    ? <th key={g.group} className={`${th} border-b border-l border-line text-muted`}>…</th>
    : g.cols.map((c, i) => <HeaderCell key={c.key} col={c} title={title(c)} arrow={arrow?.(c.key)} onSort={onSort} first={i === 0} />)))}</>;
}

export function StatCells({ groups, collapsed, agg, mode, tint }: { groups: Group[]; collapsed: ReadonlySet<string>; agg: Agg; mode: Mode; tint: (key: string) => string }) {
  return <>{groups.map((g) => (collapsed.has(g.group)
    ? <td key={g.group} className="border-b border-l border-line" />
    : g.cols.map((c) => <TintCell key={c.key} value={columnValue(c, agg, mode)} col={c} mode={mode} tint={tint(c.key)} dim={belowMin(c, agg)} est={Boolean(c.est) && agg.routesEst} />)))}</>;
}
```

In `PlayerDbTable.tsx`:
- Delete the local `HeaderCell` and the `th` constant, and import them from `./GridParts` along with `GroupHeaderCells`, `ColumnHeaderCells` and `StatCells`.
- Replace the inline `bodyGroups.map(...)` blocks in the two header rows with:
  - `<GroupHeaderCells groups={bodyGroups} collapsed={collapsed} onToggleGroup={onToggleGroup} />`
  - `<ColumnHeaderCells groups={bodyGroups} collapsed={collapsed} title={headerTitle} arrow={sortArrow} onSort={onSort} />`
- Replace the inline body-group cells with `<StatCells groups={bodyGroups} collapsed={collapsed} agg={a} mode={state.mode} tint={(k) => tints.get(k)?.[i] ?? 'transparent'} />`. Keep the leading-column `cell(...)` for `leadCols`.

- [ ] **Step 5: Run the new test and the baseline**

Run: `npx vitest run src/components/players/db src/pages/PlayersPage.test.tsx`
Expected: PASS, with the baseline count plus 2.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/players/db
git commit -m "Players table: header and cell parts shared with the player page"
```

---

### Task 8: Icons and PlayerLink

**Files:**
- Modify: `packages/web/src/components/Icons.tsx`
- Modify: `packages/web/src/components/NameLink.tsx`
- Test: `packages/web/src/components/NameLink.test.tsx` (append), `packages/web/src/components/Icons.test.tsx` (create)

**Interfaces:**
- Consumes: `type MoveKind` from `lib/player/journey`.
- Produces:
  - `MoveIcon({ kind }: { kind: MoveKind })`. It returns a 22px rounded `bg-surface-2` chip with a 14px line glyph, tinted as follows:
    - drafted: ink
    - kept: gold
    - traded: accent
    - waiver and freeAgent: win
    - dropped: loss
    - commissioner: muted
  - `PlayerLink({ id, className?, children })`, linking to `/player/${id}`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/components/Icons.test.tsx
import { render, screen } from '@testing-library/react';
import { MoveIcon } from './Icons';

describe('MoveIcon', () => {
  it.each([['drafted', 'Drafted'], ['kept', 'Kept'], ['traded', 'Traded'], ['waiver', 'Waiver claim'], ['freeAgent', 'Free-agent add'], ['dropped', 'Dropped'], ['commissioner', 'Commissioner move']] as const)('draws %s with its title', (kind, title) => {
    render(<MoveIcon kind={kind} />);
    expect(screen.getByTitle(title)).toBeInTheDocument();
  });
});
```

Append to `NameLink.test.tsx` (it already renders inside a `MemoryRouter`; follow its existing pattern):

```tsx
it('PlayerLink opens the player page', () => {
  render(<MemoryRouter><PlayerLink id="4034">Christian McCaffrey</PlayerLink></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Christian McCaffrey' })).toHaveAttribute('href', '/player/4034');
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run src/components/Icons.test.tsx src/components/NameLink.test.tsx`
Expected: FAIL (`MoveIcon` and `PlayerLink` are not exported).

- [ ] **Step 3: Implement**

In `Icons.tsx`, add these shapes to `SHAPES`:

```tsx
  ticket: <><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M10 5v12" strokeDasharray="2 2" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  swap: <><path d="M4 8h14l-3-3" /><path d="M20 16H6l3 3" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
```

Then add below `FinishGlyph`:

```tsx
import type { MoveKind } from '../lib/player/journey';

const MOVE: Record<MoveKind, { shape: keyof typeof SHAPES; className: string; title: string }> = {
  drafted: { shape: 'ticket', className: 'text-ink', title: 'Drafted' },
  kept: { shape: 'lock', className: 'text-gold', title: 'Kept' },
  traded: { shape: 'swap', className: 'text-accent', title: 'Traded' },
  waiver: { shape: 'coin', className: 'text-win', title: 'Waiver claim' },
  freeAgent: { shape: 'plus', className: 'text-win', title: 'Free-agent add' },
  dropped: { shape: 'minus', className: 'text-loss', title: 'Dropped' },
  commissioner: { shape: 'swap', className: 'text-muted', title: 'Commissioner move' },
};

/** A transaction's glyph on a small chip, for the player page's path through the league. */
export function MoveIcon({ kind }: { kind: MoveKind }) {
  const { shape, className, title } = MOVE[kind];
  return <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-surface-2 ${className}`}><Icon shape={shape} title={title} width="14" height="14" /></span>;
}
```

(Put the `import type` at the top of the file with the other imports.)

In `NameLink.tsx`:

```tsx
/** A player's name, opening his player page. */
export function PlayerLink({ id, className = '', children, ...rest }: { id: string; className?: string; children: ReactNode } & Rest) {
  return <Link to={`/player/${id}`} className={`hover:text-accent ${className}`} {...rest}>{children}</Link>;
}
```

- [ ] **Step 4: Run them to confirm they pass**

Run: `npx vitest run src/components/Icons.test.tsx src/components/NameLink.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/Icons.tsx packages/web/src/components/Icons.test.tsx packages/web/src/components/NameLink.tsx packages/web/src/components/NameLink.test.tsx
git commit -m "Icons for league moves; PlayerLink"
```

---

### Task 9: The player page

**Files:**
- Create:
  - `packages/web/src/components/player/PlayerHeader.tsx`
  - `packages/web/src/components/player/SeasonTable.tsx`
  - `packages/web/src/components/player/PercentileBars.tsx`
  - `packages/web/src/components/player/AdvancedBySeason.tsx`
  - `packages/web/src/components/player/GameLog.tsx`
  - `packages/web/src/components/player/JourneyFeed.tsx`
- Modify: `packages/web/src/pages/PlayerPage.tsx` (replace the placeholder)
- Test: `packages/web/src/pages/PlayerPage.test.tsx`

**Interfaces:**
- Consumes everything from Tasks 1–8:
  - `bioOf`, `seasonTable`, `summaryOf`, `journeyOf`, `stintRange`, `whenLabel`
  - `percentileBars`, `gameLog`, `weekTints`, `playerRecords`
  - `dbYearsOf`, `allTimeContext`
  - `GridParts`, `MoveIcon`, `PlayerLink`, `LeagueRecords` (`tab="players"`)
  - `useCollapsedGroups(tab)` from `PlayerDbTable`
  - `aggregate`, `aggregateAllTime` and `mergeSeasons`
- Produces: the page.

- [ ] **Step 1: Write the failing page test**

```tsx
// packages/web/src/pages/PlayerPage.test.tsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import PlayerPage from './PlayerPage';
import { leagueSeasons } from '../test/playerPageFixtures';
import { players } from '../test/playerFixtures';
import { miniDb } from '../test/playerDbFixtures';

let loaded: unknown;
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => loaded }));
vi.mock('../data/load', async (orig) => ({ ...(await orig<typeof import('../data/load')>()), players, history: { seasons: [], managers: { A: { displayName: 'Alice', avatar: null, seasons: [2025, 2026] }, B: { displayName: 'Bob', avatar: null, seasons: [2025, 2026] } }, h2h: {}, allTime: [], topDraftValues: [], worstDraftValues: [] } }));

function mount(id: string) {
  loaded = { id, seasons: leagueSeasons(), dbs: [miniDb()] };
  render(<MemoryRouter initialEntries={[`/player/${id}`]}><Routes><Route path="/player/:id" element={<PlayerPage />} /></Routes></MemoryRouter>);
}
const section = (name: RegExp) => screen.queryByRole('region', { name });

describe('PlayerPage', () => {
  it('shows every section for a rostered WR with database rows, a trophy for his title season', () => {
    mount('w1');
    expect(screen.getByRole('heading', { level: 1, name: /Wally One/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('finish-champion').length).toBeGreaterThan(0);
    for (const name of [/In this league/, /Among WRs/, /Advanced by season/, /Game log/, /Path through the league/, /League records/]) expect(section(name), String(name)).toBeInTheDocument();
    const gold = within(section(/In this league/)!).getAllByRole('row').find((r) => r.getAttribute('data-title') === 'true');
    expect(gold).toHaveTextContent('2025');
    expect(within(section(/Path through the league/)!).getByText('Traded from Alice, who got Ricky One')).toBeInTheDocument();
  });
  it('kicker shows league sections only', () => {
    mount('k1');
    expect(section(/Among/)).toBeNull();
    expect(section(/Game log/)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /Kick One/ })).toBeInTheDocument();
  });
  it('a never-rostered database player shows the advanced sections only', () => {
    mount('t1');
    expect(section(/In this league/)).toBeNull();
    expect(section(/Path through the league/)).toBeNull();
    expect(section(/Game log/)).toBeInTheDocument();
    expect(screen.getByText('Never rostered in this league')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/pages/PlayerPage.test.tsx`
Expected: FAIL (the placeholder page has no sections).

- [ ] **Step 3: Implement the components**

Each section is a `<section aria-labelledby>` card with an `<h2 id>`, so the test can find it by role. Use the existing `card` class and the CardHeader look: `section-label` for the small label, and `text-sm font-semibold uppercase tracking-wide` for the title.

```tsx
// packages/web/src/components/player/PlayerHeader.tsx
import type { PlayerId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { FinishIcon } from '../Icons';
import { ManagerLink } from '../NameLink';
import { players } from '../../data/load';
import type { Bio } from '../../lib/player/bio';
import type { Summary } from '../../lib/player/seasons';
import type { Stint } from '../../lib/player/journey';
import { fmtPts } from '../../lib/format';

const Field = ({ label, value }: { label: string; value: string }) => (
  <div><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="text-sm">{value}</div></div>
);
const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg bg-surface-2 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className="num text-xl font-semibold">{value}{sub && <span className="text-sm font-normal text-muted"> {sub}</span>}</div>
  </div>
);

export default function PlayerHeader({ id, bio, summary, now, managerName, rostered }: { id: PlayerId; bio: Bio; summary: Summary; now: Stint | null; managerName: string; rostered: boolean }) {
  const fields: [string, string | null][] = [['Age', bio.age === null ? null : String(bio.age)], ['Height', bio.height], ['Weight', bio.weight === null ? null : `${bio.weight} lb`], ['College', bio.college], ['NFL draft', bio.nflDraft]];
  return (
    <header className="space-y-4">
      <div className="flex items-center gap-4">
        <Headshot players={players} id={id} size={84} />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {bio.name}
            {summary.titles.map((y) => <FinishIcon key={y} kind="champion" size="0.9em" />)}
            <PosPill pos={bio.pos} />
            {bio.nflTeam && <span className="text-base font-medium text-muted">{bio.nflTeam}</span>}
          </h1>
          <p className="text-sm text-muted">
            {now ? <>On <span className="text-ink">{now.teamName}</span> (<ManagerLink userId={now.userId}>{managerName}</ManagerLink>)</> : rostered ? 'Free agent' : 'Never rostered in this league'}
            {summary.titles.length > 0 && ` · ${summary.titles.join(', ')} champion`}
          </p>
        </div>
      </div>
      {fields.some(([, v]) => v) && <div className="flex flex-wrap gap-x-8 gap-y-2">{fields.filter(([, v]) => v).map(([l, v]) => <Field key={l} label={l} value={v!} />)}</div>}
      {rostered && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Tile label="Points started" value={fmtPts(summary.ptsStarted)} />
          <Tile label="Points / start" value={summary.perStart === null ? '–' : summary.perStart.toFixed(1)} />
          <Tile label="Starts" value={String(summary.starts)} sub={`/ ${summary.rostered}`} />
          <Tile label="Best week" value={summary.best === null ? '–' : summary.best.toFixed(1)} />
          <Tile label="Team W–L started" value={`${summary.w}–${summary.l}${summary.t ? `–${summary.t}` : ''}`} />
          <Tile label="Managers" value={String(summary.managers)} />
        </div>
      )}
    </header>
  );
}
```

```tsx
// packages/web/src/components/player/SeasonTable.tsx
import { FinishIcon } from '../Icons';
import Avatar from '../Avatar';
import { ManagerLink } from '../NameLink';
import { history } from '../../data/load';
import type { BestKey, SeasonRow, SeasonTable as Table } from '../../lib/player/seasons';

const f1 = (v: number | null) => (v === null ? '–' : v.toFixed(1));
const rec = (r: { w: number; l: number; t: number }) => `${r.w}–${r.l}${r.t ? `–${r.t}` : ''}`;

export default function SeasonTable({ table, pos }: { table: Table; pos: string }) {
  const gold = (k: BestKey, v: number | null) => (v !== null && table.best[k] === v ? 'font-semibold text-gold' : '');
  const name = (u: string) => history.managers[u]?.displayName ?? u;
  const cell = 'num px-2 py-2 text-center';
  return (
    <section aria-labelledby="pp-league" className="card overflow-auto">
      <div className="flex items-baseline justify-between border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-league" className="text-sm font-semibold uppercase tracking-wide">In this league</h2>
        <span className="text-xs text-muted">Gold row: title season · gold number: career best</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="section-label text-[10px]"><th colSpan={2} /><th colSpan={3} className="border-b border-line px-2 py-1">Starts</th><th colSpan={3} className="border-b border-line px-2 py-1">Points</th><th colSpan={2} className="border-b border-line px-2 py-1">Rank</th><th colSpan={2} className="border-b border-line px-2 py-1">Team</th></tr>
          <tr className="section-label text-[11px]">{['Season', 'Manager', 'Starts', 'Rostered', 'Bench+', 'Total', 'PPG', 'Best', 'Pos', 'Overall', 'W–L started', 'Playoff pts'].map((h, i) => <th key={h} className={`px-2 py-2 ${i < 2 ? 'text-left' : 'text-center'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((r: SeasonRow) => (
            <tr key={r.year} data-title={r.title ? 'true' : undefined} className={`border-t border-line ${r.title ? 'bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] shadow-[inset_3px_0_0_var(--gold)]' : ''}`}>
              <td className="num px-3 py-2">{r.year} {r.title && <FinishIcon kind="champion" size="1em" />}</td>
              <td className="px-2 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap">{r.managers.map((u, i) => <span key={u} className="flex items-center gap-1.5">{i > 0 && <span className="text-muted">→</span>}<Avatar avatar={history.managers[u]?.avatar ?? null} name={name(u)} size={20} /><ManagerLink userId={u}>{name(u)}</ManagerLink></span>)}</span></td>
              <td className={`${cell} ${gold('starts', r.starts)}`}>{r.starts}</td><td className={cell}>{r.rostered}</td><td className={cell}>{f1(r.benchPts)}</td>
              <td className={`${cell} ${gold('pts', r.pts)}`}>{f1(r.pts)}</td><td className={`${cell} ${gold('ppg', r.ppg)}`}>{f1(r.ppg)}</td><td className={`${cell} ${gold('best', r.best)}`}>{f1(r.best)}</td>
              <td className={`${cell} ${gold('posRank', r.posRank)}`}>{r.posRank === null ? '–' : `${pos}${r.posRank}`}</td><td className={`${cell} ${gold('overallRank', r.overallRank)}`}>{r.overallRank ?? '–'}</td>
              <td className={cell}>{rec(r)}</td><td className={`${cell} ${gold('playoffPts', r.playoffPts)}`}>{f1(r.playoffPts)}</td>
            </tr>
          ))}
          <tr className="border-t border-line bg-surface-2 font-semibold">
            <td className="px-3 py-2">Career</td><td className="px-2 py-2 text-muted">{table.career.managers} manager{table.career.managers === 1 ? '' : 's'}</td>
            <td className={cell}>{table.career.starts}</td><td className={cell}>{table.career.rostered}</td><td className={cell}>{f1(table.career.benchPts)}</td>
            <td className={cell}>{f1(table.career.pts)}</td><td className={cell}>{f1(table.career.ppg)}</td><td className={cell}>{f1(table.career.best)}</td>
            <td className={cell} /><td className={cell} /><td className={cell}>{rec(table.career)}</td><td className={cell}>{f1(table.career.playoffPts)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
```

```tsx
// packages/web/src/components/player/PercentileBars.tsx
import SeasonPicker from '../SeasonPicker';
import { COLUMNS, fmtValue } from '../../lib/playerdb/columns';
import type { Bar } from '../../lib/player/percentiles';

const tone = (p: number) => (p >= 66 ? 'var(--win)' : p >= 33 ? 'var(--warn)' : 'var(--loss)');

export default function PercentileBars({ pos, bars, years, year, onYear }: { pos: string; bars: Bar[]; years: number[]; year: number; onYear: (y: number) => void }) {
  return (
    <section aria-labelledby="pp-pct" className="card">
      <div className="flex items-center justify-between border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-pct" className="text-sm font-semibold uppercase tracking-wide">Among {pos}s</h2>
        <SeasonPicker years={years} value={year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
      </div>
      <ul className="space-y-2 px-4 py-3">
        {bars.map((b) => (
          <li key={b.key} className="grid grid-cols-[6.5rem_1fr_3.5rem_2rem] items-center gap-3 text-sm" title={COLUMNS[b.key].def}>
            <span className="truncate text-muted">{b.label}</span>
            <span className="relative h-2 rounded-full bg-surface-2">{b.pct !== null && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, b.pct)}%`, background: tone(b.pct) }} />}</span>
            <span className="num text-right text-xs text-muted">{fmtValue(b.value, COLUMNS[b.key].fmt, b.mode)}</span>
            <span className="num text-right font-semibold">{b.small ? <span className="text-[10px] font-normal text-muted">small sample</span> : b.pct ?? '–'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

```tsx
// packages/web/src/components/player/AdvancedBySeason.tsx
import type { PlayerDb, PlayerId } from '@fantasy-dash/core';
import { aggregate, type Agg } from '../../lib/playerdb/aggregate';
import { aggregateAllTime, mergeSeasons } from '../../lib/playerdb/merge';
import { columnTints } from '../../lib/playerdb/percentile';
import { columnValue, groupsFor, type Tab } from '../../lib/playerdb/columns';
import { ColumnHeaderCells, GroupHeaderCells, HeaderCell, StatCells, th } from '../players/db/GridParts';
import TintCell from '../players/db/TintCell';
import { useCollapsedGroups } from '../players/db/PlayerDbTable';

export default function AdvancedBySeason({ id, dbs, tab }: { id: PlayerId; dbs: PlayerDb[]; tab: Tab }) {
  const [collapsed, toggle] = useCollapsedGroups(tab);
  const groups = groupsFor(tab);
  const lead = groups[0].cols, body = groups.slice(1);
  const rows = dbs.map((db) => {
    const all = aggregate(db, 1, Math.max(1, db.throughWeek));
    const pos = db.players[id]?.pos;
    const peers = all.filter((a) => db.players[a.id]?.pos === pos);
    const me = peers.find((a) => a.id === id);
    if (!me) return null;
    const idx = peers.indexOf(me);
    const byKey = new Map(groups.flatMap((g) => g.cols).map((c) => [c.key, columnTints(c, peers, 'total')[idx]] as const));
    const tint = (k: string) => byKey.get(k) ?? 'transparent';
    return { year: db.year, agg: me, tint };
  }).filter((r): r is { year: number; agg: Agg; tint: (k: string) => string } => r !== null);
  const career = dbs.length > 1 ? aggregateAllTime(mergeSeasons(dbs)).find((a) => a.id === id) ?? null : null;
  return (
    <section aria-labelledby="pp-adv" className="card overflow-auto">
      <div className="border-b border-line px-4 pb-2 pt-3"><h2 id="pp-adv" className="text-sm font-semibold uppercase tracking-wide">Advanced by season</h2></div>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr><th colSpan={1 + lead.length} className="border-b border-line" /><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={toggle} /></tr>
          <tr><th className={`${th} border-b border-line text-left`}>Season</th>{lead.map((c) => <HeaderCell key={c.key} col={c} title={c.def} />)}<ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} /></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <td className="num border-b border-line px-3 py-1.5">{r.year}</td>
              {lead.map((c) => <TintCell key={c.key} value={columnValue(c, r.agg, 'total')} col={c} mode="total" tint={r.tint(c.key)} dim={false} est={false} />)}
              <StatCells groups={body} collapsed={collapsed} agg={r.agg} mode="total" tint={r.tint} />
            </tr>
          ))}
          {career && <tr className="bg-surface-2 font-semibold"><td className="px-3 py-1.5">Career</td>{lead.map((c) => <TintCell key={c.key} value={c.key === 'posRank' ? null : columnValue(c, career, 'total')} col={c} mode="total" tint="transparent" dim={false} est={false} />)}<StatCells groups={body} collapsed={collapsed} agg={career} mode="total" tint={() => 'transparent'} /></tr>}
        </tbody>
      </table>
    </section>
  );
}
```

```tsx
// packages/web/src/components/player/GameLog.tsx
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import SeasonPicker from '../SeasonPicker';
import Avatar from '../Avatar';
import { ManagerLink } from '../NameLink';
import { history } from '../../data/load';
import { COLUMNS, columnValue, groupsFor, type Tab } from '../../lib/playerdb/columns';
import { gameLog, weekTints } from '../../lib/player/gameLog';
import type { PlayerLine } from '../../lib/playerLines';
import { ColumnHeaderCells, GroupHeaderCells, HeaderCell, StatCells, th } from '../players/db/GridParts';
import TintCell from '../players/db/TintCell';
import { useCollapsedGroups } from '../players/db/PlayerDbTable';

const LEAD = ['pts', 'projPlus'];

export default function GameLog({ id, db, lines, season, tab, pos, years, onYear }: { id: PlayerId; db: PlayerDb; lines: PlayerLine[]; season: Season | undefined; tab: Tab; pos: string; years: number[]; onYear: (y: number) => void }) {
  const [collapsed, toggle] = useCollapsedGroups(tab);
  const body = groupsFor(tab).slice(1);
  const lead = LEAD.map((k) => COLUMNS[k]);
  const rows = gameLog(db, id, lines, season);
  const tints = weekTints(db, rows, [...lead, ...body.flatMap((g) => g.cols)], pos);
  const fixed = ['Wk', 'Opp', 'Manager', '', 'Result'];
  const span = fixed.length + lead.length + body.reduce((n, g) => n + (collapsed.has(g.group) ? 1 : g.cols.length), 0);
  return (
    <section aria-labelledby="pp-log" className="card overflow-auto">
      <div className="flex items-center justify-between border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-log" className="text-sm font-semibold uppercase tracking-wide">Game log</h2>
        <SeasonPicker years={years} value={db.year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
      </div>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr><th colSpan={fixed.length + lead.length} className="border-b border-line" /><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={toggle} /></tr>
          <tr>{fixed.map((h) => <th key={h || 'status'} className={`${th} border-b border-line text-left`}>{h}</th>)}{lead.map((c) => <HeaderCell key={c.key} col={c} title={c.def} />)}<ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} /></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const l = r.line;
            const name = l ? history.managers[l.userId]?.displayName ?? l.userId : null;
            const result = l && r.score ? `${l.result} ${r.score.mine.toFixed(1)}–${r.score.theirs.toFixed(1)}` : '';
            const fixedCells = (
              <>
                <td className="num border-b border-line px-2 py-1.5">{r.week}</td>
                <td className="whitespace-nowrap border-b border-line px-2 py-1.5 text-muted">{r.opp}</td>
                <td className="whitespace-nowrap border-b border-line px-2 py-1.5">{l ? <span className="flex items-center gap-1.5"><Avatar avatar={history.managers[l.userId]?.avatar ?? null} name={name!} size={18} /><ManagerLink userId={l.userId}>{name}</ManagerLink></span> : <span className="text-muted">FA</span>}</td>
                <td className={`border-b border-line px-2 py-1.5 text-xs ${l?.started ? '' : 'text-muted'}`}>{l ? (l.started ? 'Started' : 'Bench') : ''}</td>
                <td className={`num whitespace-nowrap border-b border-line px-2 py-1.5 text-xs ${l?.result === 'W' ? 'text-win' : l?.result === 'L' ? 'text-loss' : ''}`}>{result}{r.swing !== null && <span className="ml-1 text-muted">+{r.swing.toFixed(1)} left</span>}</td>
              </>
            );
            if (!r.agg) return <tr key={r.week} className="text-muted">{fixedCells}<td colSpan={span - fixed.length} className="border-b border-line px-2 py-1.5 text-xs">{r.bye ? 'Bye' : 'Did not play'}</td></tr>;
            return (
              <tr key={r.week}>
                {fixedCells}
                {lead.map((c) => <TintCell key={c.key} value={columnValue(c, r.agg!, 'total')} col={c} mode="total" tint={tints.get(c.key)![i]} dim={false} est={Boolean(c.est) && r.agg!.routesEst} />)}
                <StatCells groups={body} collapsed={collapsed} agg={r.agg} mode="total" tint={(k) => tints.get(k)?.[i] ?? 'transparent'} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

```tsx
// packages/web/src/components/player/JourneyFeed.tsx
import Avatar from '../Avatar';
import { FinishIcon, MoveIcon } from '../Icons';
import { ManagerLink, TeamLink } from '../NameLink';
import { history } from '../../data/load';
import { stintRange, whenLabel, type Stint } from '../../lib/player/journey';

export default function JourneyFeed({ stints, seasons }: { stints: Stint[]; seasons: number }) {
  const managers = new Set(stints.map((s) => s.userId)).size;
  const moves = stints.reduce((n, s) => n + s.moves.length, 0);
  return (
    <section aria-labelledby="pp-path" className="card">
      <div className="flex items-baseline justify-between border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-path" className="text-sm font-semibold uppercase tracking-wide">Path through the league</h2>
        <span className="text-xs text-muted">{managers} manager{managers === 1 ? '' : 's'} · {seasons} season{seasons === 1 ? '' : 's'} · {moves} move{moves === 1 ? '' : 's'}</span>
      </div>
      <ol className="divide-y divide-line">
        {stints.map((s) => {
          const m = history.managers[s.userId];
          return (
            <li key={`${s.userId}-${s.from.year}-${s.from.week}`} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? s.userId} size={22} />
                <ManagerLink userId={s.userId} className="font-semibold">{m?.displayName ?? s.userId}</ManagerLink>
                <TeamLink userId={s.userId} year={s.lastYear} className="text-sm text-muted">{s.teamName}</TeamLink>
                {s.title && <FinishIcon kind="champion" size="1em" />}
                <span className="ml-auto text-xs text-muted">{stintRange(s)}</span>
              </div>
              <div className="num ml-8 mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
                <span><b className="text-ink">{s.starts}</b> starts</span><span><b className="text-ink">{s.pts.toFixed(1)}</b> pts</span>
                {s.perStart !== null && <span><b className="text-ink">{s.perStart.toFixed(1)}</b> / start</span>}
                <span><b className="text-ink">{s.w}–{s.l}{s.t ? `–${s.t}` : ''}</b> started</span>
              </div>
              <ul className="ml-8 mt-2">
                {s.moves.map((mv) => (
                  <li key={`${mv.kind}-${mv.created}`} className="flex items-center gap-2 border-t border-dashed border-line py-1.5 text-sm first:border-t-0">
                    <MoveIcon kind={mv.kind} /><span className="min-w-0 flex-1">{mv.text}</span><span className="text-xs text-muted">{whenLabel(mv.at)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

- [ ] **Step 4: Assemble the page**

```tsx
// packages/web/src/pages/PlayerPage.tsx
import { useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import AdvancedBySeason from '../components/player/AdvancedBySeason';
import GameLog from '../components/player/GameLog';
import JourneyFeed from '../components/player/JourneyFeed';
import PercentileBars from '../components/player/PercentileBars';
import PlayerHeader from '../components/player/PlayerHeader';
import SeasonTable from '../components/player/SeasonTable';
import LeagueRecords from '../components/teams/LeagueRecords';
import { history, players } from '../data/load';
import { allTimeContext } from '../lib/managerRecords';
import { bioOf } from '../lib/player/bio';
import { dbYearsOf } from '../lib/player/coverage';
import { journeyOf } from '../lib/player/journey';
import { percentileBars } from '../lib/player/percentiles';
import { playerRecords } from '../lib/player/records';
import { seasonTable, summaryOf } from '../lib/player/seasons';
import type { Tab } from '../lib/playerdb/columns';
import { flattenLines } from '../lib/playerLines';

export interface PlayerPageData { id: PlayerId; seasons: Season[]; dbs: PlayerDb[] }
const DB_TABS: Record<string, Tab> = { QB: 'qb', RB: 'rb', WR: 'wr', TE: 'te' };

export default function PlayerPage() {
  const { id, seasons, dbs } = useLoaderData() as PlayerPageData;
  const allLines = useMemo(() => flattenLines(seasons, players), [seasons]);
  const lines = useMemo(() => allLines.filter((l) => l.playerId === id).sort((a, b) => a.year - b.year || a.week - b.week), [allLines, id]);
  const bio = useMemo(() => bioOf(id, players, dbs, new Date()), [id, dbs]);
  const table = useMemo(() => seasonTable(lines, seasons, id), [lines, seasons, id]);
  const stints = useMemo(() => journeyOf(lines, seasons, players, id), [lines, seasons, id]);
  const records = useMemo(() => playerRecords(allTimeContext(seasons, players, history.managers), id, bio.pos), [seasons, id, bio.pos]);
  const dbYears = dbYearsOf(dbs, id);
  const tab = DB_TABS[bio.pos];
  const [pctYear, setPctYear] = useState(dbYears.at(-1) ?? 0);
  const [logYear, setLogYear] = useState(dbYears.at(-1) ?? 0);
  const dbOf = (y: number) => dbs.find((d) => d.year === y);
  const bars = useMemo(() => { const d = dbOf(pctYear); return d ? percentileBars(d, id) : null; }, [pctYear, id, dbs]);
  const logDb = dbOf(logYear);
  const rostered = lines.length > 0;
  const now = stints[0]?.to === null ? stints[0] : null;

  return (
    <div className="space-y-6">
      <PlayerHeader id={id} bio={bio} summary={summaryOf(table)} now={now} managerName={now ? history.managers[now.userId]?.displayName ?? now.userId : ''} rostered={rostered} />
      {table.rows.length > 0 && <SeasonTable table={table} pos={bio.pos} />}
      {tab && dbYears.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          {bars && <PercentileBars pos={bio.pos} bars={bars} years={dbYears} year={pctYear} onYear={setPctYear} />}
          <AdvancedBySeason id={id} dbs={dbs.filter((d) => dbYears.includes(d.year)).sort((a, b) => a.year - b.year)} tab={tab} />
        </div>
      )}
      {tab && logDb && <GameLog id={id} db={logDb} lines={lines.filter((l) => l.year === logYear)} season={seasons.find((s) => s.year === logYear)} tab={tab} pos={bio.pos} years={dbYears} onYear={setLogYear} />}
      {rostered && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <JourneyFeed stints={stints} seasons={new Set(lines.map((l) => l.year)).size} />
          <LeagueRecords records={records} tab="players" />
        </div>
      )}
    </div>
  );
}
```

`LeagueRecords` must expose a region named "League records" for the test. If its `<section>` has no `aria-labelledby`, add `aria-label="League records"` to it in this task. That is a one-attribute change, and its own tests still pass.

Update `routes.tsx` if Task 1 imported `PlayerPageData` from the placeholder. The export name is unchanged, so no edit should be needed.

- [ ] **Step 5: Run the page test and the full suite**

Run: `npx vitest run src/pages/PlayerPage.test.tsx`, then `cd ../.. && pnpm test`
Expected: PASS. If a section heading's text differs (for example "Among WRs"), make the test and the heading agree on the spec's wording.

- [ ] **Step 6: Type check, build, and commit**

Run: `npx tsc --noEmit -p tsconfig.json && cd ../.. && pnpm build`
Expected: exit 0.

```bash
git add packages/web/src/components/player packages/web/src/pages/PlayerPage.tsx packages/web/src/pages/PlayerPage.test.tsx packages/web/src/test/playerPageFixtures.ts packages/web/src/components/teams/LeagueRecords.tsx
git commit -m "Player pages: header, season table, percentile bars, advanced by season, game log, path and records"
```

---

### Task 10: Link player names to the page

**Files:**
- Modify:
  - `packages/web/src/components/players/db/PlayerDbTable.tsx`
  - `packages/web/src/components/boxscore/LineupTable.tsx:20`
  - `packages/web/src/components/teams/RosterBreakdown.tsx:54`
  - `packages/web/src/components/draft/DraftBoard.tsx:109`
  - `packages/web/src/components/players/Board.tsx:115` and `:161`
- Test: append to `PlayerDbTable.test.tsx`, `LineupTable` tests (or `BoxScorePage.test.tsx`), and `Board.test.tsx`. Update any test that clicks `db-name` to expand.

**Interfaces:**
- Consumes: `PlayerLink` (Task 8).

- [ ] **Step 1: Write the failing tests**

Append to `PlayerDbTable.test.tsx`, following its existing render helper:

```tsx
it('links the name to the player page and expands weeks from the chevron', () => {
  // render as the file's other tests do, for player w1
  expect(screen.getAllByRole('link', { name: 'Wide One' })[0]).toHaveAttribute('href', '/player/w1');
  fireEvent.click(screen.getByRole('button', { name: 'Show weeks for Wide One' }));
  expect(screen.getByTestId('db-weeks')).toBeInTheDocument();
});
```

Append to `Board.test.tsx` (inside its router wrapper):

```tsx
it('links a player row name to the player page', () => {
  // render a player board as the file's other tests do
  expect(screen.getAllByRole('link').some((a) => a.getAttribute('href')?.startsWith('/player/'))).toBe(true);
});
```

Append an equivalent `href^="/player/"` assertion to the box score test that renders `LineupTable`.

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run src/components/players src/pages/BoxScorePage.test.tsx`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement**

Make these changes:
- **PlayerDbTable:**
  - Keep the `<button aria-expanded>` and give it `aria-label={`Show weeks for ${p?.name ?? a.id}`}`. Its content becomes a `▸` / `▾` chevron followed by the headshot.
  - Move the name `<span data-testid="db-name">` out of the button into `<PlayerLink id={a.id} className="font-medium"><span data-testid="db-name">…</span></PlayerLink>`.
  - Keep the team and FA tag after it, in the same flex row.
- **LineupTable line 20:** wrap `{playerName(players, line.playerId)}` in `<PlayerLink id={line.playerId}>…</PlayerLink>`.
- **RosterBreakdown line 54:** wrap the name span's text in `PlayerLink`.
- **DraftBoard line 109:** wrap the name in `<PlayerLink id={p.playerId} onClick={(e) => e.stopPropagation()}>`, so it does not trigger the column filter.
- **Board lines 115 and 161:** wrap the name text in `PlayerLink` with `className="truncate"`.

Then run `grep -rn "getByTestId('db-name')\|getAllByTestId('db-name')" src` and change any test that *clicks* `db-name` to expand, so it clicks the chevron button instead. `PlayersPage.test.tsx`'s All-time test is one of them.

- [ ] **Step 4: Run the full suite**

Run: `cd ../.. && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components packages/web/src/pages
git commit -m "Player names link to the player page"
```

---

### Task 11: Smoke over real data and visual check

**Files:**
- Create: `packages/web/src/lib/player/smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

```ts
// packages/web/src/lib/player/smoke.test.ts
// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import type { PlayerDb, PlayerDirectory, Season } from '@fantasy-dash/core';
import { flattenLines } from '../playerLines';
import { gameLog } from './gameLog';
import { journeyOf } from './journey';
import { percentileBars } from './percentiles';
import { seasonTable } from './seasons';

const root = new URL('../../../../../data/', import.meta.url);
const json = <T,>(rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as T;
const seasons = readdirSync(new URL('seasons/', root)).filter((f) => f.endsWith('.json')).map((f) => json<Season>(`seasons/${f}`));
const dbs = readdirSync(new URL('playerdb/', root)).filter((f) => f.endsWith('.json')).map((f) => json<PlayerDb>(`playerdb/${f}`));
const players = json<PlayerDirectory>('players.json');
const lines = flattenLines(seasons, players);
const finite = (o: unknown): boolean => JSON.stringify(o, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__BAD__' : v)).includes('__BAD__') === false;

describe('player pages over the committed data', () => {
  it('builds a season table and a path for every rostered player, with no NaN and no backwards stint', () => {
    for (const id of new Set(lines.map((l) => l.playerId))) {
      const mine = lines.filter((l) => l.playerId === id);
      const t = seasonTable(mine, seasons, id);
      expect(finite(t), `${id} table`).toBe(true);
      for (const s of journeyOf(mine, seasons, players, id)) {
        expect(finite(s), `${id} stint`).toBe(true);
        if (s.to) expect(s.to.year * 100 + s.to.week >= s.from.year * 100 + s.from.week, `${id} ${s.userId} ${JSON.stringify(s.from)}→${JSON.stringify(s.to)}`).toBe(true);
      }
    }
  });
  it('builds percentile bars and a game log for a sample of each season\'s players', () => {
    for (const db of dbs) {
      const ids = Object.keys(db.players).filter((_, i) => i % 25 === 0);
      for (const id of ids) {
        expect(finite(percentileBars(db, id)), `${db.year} ${id} bars`).toBe(true);
        expect(finite(gameLog(db, id, lines.filter((l) => l.playerId === id && l.year === db.year), seasons.find((s) => s.year === db.year)).map((r) => ({ ...r, agg: null }))), `${db.year} ${id} log`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/player/smoke.test.ts`
Expected: PASS. If a stint runs backwards, the real data has a pattern the fixtures missed:
- Add that pattern to `journey.test.ts` as a failing test.
- Fix `journeyOf`.
- Ledger it.

- [ ] **Step 3: Full checks**

Run, from the repo root: `pnpm test && pnpm build && (cd packages/web && npx tsc --noEmit -p tsconfig.json)`
Expected: all exit 0.

- [ ] **Step 4: Screenshots**

Serve `packages/web/dist` with `vite preview` on a free port, using the absolute vite binary with `--outDir`. Take headless Chrome screenshots at 1500×2600 and 420×2600 of:
- a WR on a title roster (pick one from `history` champions' rosters)
- a QB
- a kicker
- a never-rostered database player

Check:
- the gold title row, the trophy and the gold career bests
- the bars, the game log groups, and the feed icons
- the records card
- no horizontal page scroll on the phone

Fix anything off, re-run the checks, and stop the server.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/player/smoke.test.ts
git commit -m "Player pages: smoke over the committed data"
```
