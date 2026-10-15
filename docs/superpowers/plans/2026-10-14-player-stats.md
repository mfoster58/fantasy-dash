# Player Stats Tab and Streaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new Player stats tab ranking players across every season behind one position filter, plus longest win and losing streak cards on the History tab.

**Architecture:** Pure lib modules in `packages/web/src/lib` flatten the season files into per-player "lines" and compute every board from them; a generic `Board` component renders any board's rows. The `/players` route loads all seasons with the existing `loadAllSeasons` loader. Streaks come from `history.h2h`, so the History tab stays static. No core, schema or sync change.

**Tech Stack:** TypeScript, React 18, react-router v7 (data router), Vite, Vitest + Testing Library, Tailwind v4 utility classes plus the project's `card`, `section-label`, `num`, `pos-pill` classes.

**Spec:** `docs/superpowers/specs/2026-10-14-player-stats-design.md`

## Global Constraints

- Everything is computed in the browser; no edits under `packages/core` or `scripts/`, no data regeneration.
- Position comes from `players.json` (`PlayerDirectory`), never from the lineup slot. Unknown position is `?` and only appears under the All filter.
- FLEX filter = position in {RB, WR, TE}. The filter narrows lines before aggregation.
- Postseason = game tag in {QF, SF, Final, 3rd, 5th}. Cons-R1, Toilet Bowl, Cons-7th never count.
- `played` = the line's `stats` object has at least one key.
- Ties: value desc, then most recent occurrence (year desc, week desc), then playerId asc.
- Points two decimals (`fmtPts`), PPG one decimal (`fmtPpg`), yards and counts as integers.
- Each board shows 5 rows; "Show all" expands to 25.
- Career PPG requires at least 12 played lines.
- Run tests from `packages/web` with `npx vitest run <file>`; run the whole repo with `pnpm test` from the root; `pnpm build` runs `tsc --noEmit` and the Vite build.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A player id missing from `players.json` (cut player, old defense id): rows must still render with the id as the name and `?` as the position, and the FLEX/position filters must exclude it without throwing. Pinned in Task 1.
2. An unplayed week (`stats = {}`, 0 points): must not count as a dud start and must not count toward PPG games. Pinned in Tasks 1 and 2.
3. A season in progress with zero scored weeks (preseason): League leaders must show "Season has not started." rather than empty boards or a crash. Pinned in Task 3.
4. A manager whose only games are ties, or a manager with no games: streaks must return nothing for them and not produce a zero-length streak. Pinned in Task 4.
5. `?pos=XYZ` in the URL (bad or stale value): the filter must fall back to All, not render an empty page. Pinned in Task 6.

---

### Task 1: Player lines

**Files:**
- Create: `packages/web/src/lib/playerLines.ts`
- Create: `packages/web/src/test/playerFixtures.ts` (shared season/game/line builders used by Tasks 1, 2, 3 and 6)
- Test: `packages/web/src/lib/playerLines.test.ts`

**Interfaces:**
- Consumes: `Season`, `PlayerDirectory`, `PlayoffTag`, `PlayerId`, `UserId` from `@fantasy-dash/core`.
- Produces:
  ```ts
  export type PosFilter = 'All' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF';
  export const POS_FILTERS: readonly PosFilter[];
  export function isPosFilter(v: string | null | undefined): v is PosFilter;
  export interface PlayerLine {
    playerId: PlayerId; userId: UserId; year: number; week: number; gameId: string; matchupId: number;
    tag: PlayoffTag | null; started: boolean; points: number; yards: number; touchdowns: number; receptions: number;
    played: boolean; postseason: boolean; position: string;
  }
  export const POSTSEASON_TAGS: ReadonlySet<string>;
  export function flattenLines(seasons: Season[], players: PlayerDirectory): PlayerLine[];
  export function filterLines(lines: PlayerLine[], pos: PosFilter): PlayerLine[];
  ```

- [ ] **Step 1: Write the fixtures and the failing test**

Fixtures live in a plain module, not a test file, so other tests can import them without re-registering this file's tests.

```ts
// packages/web/src/test/playerFixtures.ts
import type { Game, GameSide, PlayerDirectory, PlayerLine as CoreLine, Season, Week } from '@fantasy-dash/core';

export const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3 },
  r1: { id: 'r1', name: 'Ricky One', firstName: 'Ricky', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 2 },
  w1: { id: 'w1', name: 'Wally One', firstName: 'Wally', lastName: 'One', position: 'WR', team: 'MIA', yearsExp: 4 },
  t1: { id: 't1', name: 'Tony One', firstName: 'Tony', lastName: 'One', position: 'TE', team: 'KC', yearsExp: 6 },
  k1: { id: 'k1', name: 'Kick One', firstName: 'Kick', lastName: 'One', position: 'K', team: 'BAL', yearsExp: 8 },
  KC: { id: 'KC', name: 'Kansas City Chiefs', firstName: 'Kansas City', lastName: 'Chiefs', position: 'DEF', team: 'KC', yearsExp: null },
};

export const line = (playerId: string, points: number, stats: Record<string, number> = { rec: 1 }): CoreLine => ({ playerId, points, projected: null, stats });

export const side = (userId: string, points: number, starters: CoreLine[], bench: CoreLine[] = []): GameSide => ({
  userId, points, projected: 100, ceiling: points + 10, efficiency: 0.9,
  starters: starters.map((p) => ({ slot: 'FLEX', player: p })),
  bench, optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 100,
});

export const game = (year: number, week: number, matchupId: number, a: GameSide, b: GameSide, tag: Game['tag'] = null): Game => ({
  id: `${year}-${week}-${matchupId}`, matchupId, week, tag, sides: [a, b],
  winner: a.points > b.points ? a.userId : b.points > a.points ? b.userId : null, margin: Math.abs(a.points - b.points),
});

export const week = (n: number, games: Game[], isPlayoff = false): Week => ({ week: n, isPlayoff, played: games.length > 0, games, highScore: null });

export const season = (year: number, weeks: Week[], champion: string | null = null, lastScoredWeek = weeks.length): Season => ({
  year, leagueId: 'L', status: 'complete', lastScoredWeek, playoffWeekStart: 3, playoffTeams: 2,
  rosterSlots: [], scoring: {}, managers: {}, brackets: { winners: [], consolation: [] }, standings: [],
  honors: { champion, runnerUp: null, third: null, pointsTitle: null, lastPlace: null }, draft: null,
  weeks,
} as Season);
```

```ts
// packages/web/src/lib/playerLines.test.ts
import { describe, it, expect } from 'vitest';
import { game, line, players, season, side, week } from '../test/playerFixtures';
import { filterLines, flattenLines, isPosFilter, POS_FILTERS } from './playerLines';

describe('flattenLines', () => {
  const s = season(2025, [
    week(1, [game(2025, 1, 1,
      side('a', 50, [line('q1', 30, { pass_yd: 300, pass_td: 2, rush_yd: 10 }), line('ghost', 0, {})], [line('r1', 20, { rush_yd: 80, rec: 4, rec_yd: 40, rec_td: 1 })]),
      side('b', 10, [line('KC', 10, { sack: 3, def_td: 1 })]))]),
    week(3, [game(2025, 3, 1, side('a', 20, [line('q1', 20, { pass_yd: 200 })]), side('b', 5, [line('k1', 5, { fgm: 1 })]), 'Final')], true),
    week(4, [game(2025, 4, 1, side('a', 1, [line('t1', 1, { rec: 1 })]), side('b', 0, [line('w1', 0, { rec_tgt: 1 })]), 'Toilet Bowl')], true),
  ]);
  const lines = flattenLines([s], players);

  it('emits one line per started or benched player with derived stats', () => {
    const q1 = lines.find((l) => l.playerId === 'q1' && l.week === 1)!;
    expect(q1).toEqual({
      playerId: 'q1', userId: 'a', year: 2025, week: 1, gameId: '2025-1-1', matchupId: 1, tag: null, started: true,
      points: 30, yards: 310, touchdowns: 2, receptions: 0, played: true, postseason: false, position: 'QB',
    });
    const r1 = lines.find((l) => l.playerId === 'r1')!;
    expect(r1).toMatchObject({ started: false, yards: 120, touchdowns: 1, receptions: 4, played: true });
  });

  it('marks unplayed weeks and unknown players', () => {
    const ghost = lines.find((l) => l.playerId === 'ghost')!;
    expect(ghost).toMatchObject({ played: false, points: 0, position: '?' });
  });

  it('does not count defensive touchdowns as touchdowns', () => {
    expect(lines.find((l) => l.playerId === 'KC')!.touchdowns).toBe(0);
  });

  it('flags championship-bracket games as postseason and consolation games as not', () => {
    expect(lines.find((l) => l.week === 3 && l.playerId === 'q1')!.postseason).toBe(true);
    expect(lines.find((l) => l.week === 4 && l.playerId === 't1')!.postseason).toBe(false);
  });

  it('skips weeks that have not been played', () => {
    const unplayed = season(2026, [week(1, [])]);
    expect(flattenLines([unplayed], players)).toEqual([]);
  });

  describe('filterLines', () => {
    it('keeps everything under All, including unknown positions', () => {
      expect(filterLines(lines, 'All')).toHaveLength(lines.length);
    });
    it('narrows to one position', () => {
      expect(filterLines(lines, 'QB').map((l) => l.playerId)).toEqual(['q1', 'q1']);
      expect(filterLines(lines, 'DEF').map((l) => l.playerId)).toEqual(['KC']);
    });
    it('FLEX means RB, WR or TE and drops unknown positions', () => {
      expect(new Set(filterLines(lines, 'FLEX').map((l) => l.playerId))).toEqual(new Set(['r1', 't1', 'w1']));
    });
  });

  it('exposes the filter list and a guard', () => {
    expect(POS_FILTERS).toEqual(['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF']);
    expect(isPosFilter('RB')).toBe(true);
    expect(isPosFilter('XYZ')).toBe(false);
    expect(isPosFilter(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/lib/playerLines.test.ts`
Expected: FAIL, "Failed to resolve import ./playerLines".

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/src/lib/playerLines.ts
import type { PlayerDirectory, PlayerId, PlayerLine as CoreLine, PlayoffTag, Season, UserId } from '@fantasy-dash/core';

export type PosFilter = 'All' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF';
export const POS_FILTERS: readonly PosFilter[] = ['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
export function isPosFilter(v: string | null | undefined): v is PosFilter {
  return (POS_FILTERS as readonly string[]).includes(v ?? '');
}

/** One player on one roster in one played week. */
export interface PlayerLine {
  playerId: PlayerId;
  userId: UserId;
  year: number;
  week: number;
  gameId: string;
  matchupId: number;
  tag: PlayoffTag | null;
  started: boolean;
  points: number;
  yards: number;
  touchdowns: number;
  receptions: number;
  /** true when the line carries any recorded stat; the per-week games-played flag is not persisted */
  played: boolean;
  /** championship bracket only */
  postseason: boolean;
  /** from the player directory; '?' when unknown */
  position: string;
}

export const POSTSEASON_TAGS: ReadonlySet<string> = new Set(['QF', 'SF', 'Final', '3rd', '5th']);

const n = (stats: Record<string, number>, key: string) => stats[key] ?? 0;

export function flattenLines(seasons: Season[], players: PlayerDirectory): PlayerLine[] {
  const out: PlayerLine[] = [];
  for (const s of seasons) {
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        const postseason = g.tag !== null && POSTSEASON_TAGS.has(g.tag);
        for (const sideOf of g.sides) {
          const push = (p: CoreLine, started: boolean) => {
            const st = p.stats ?? {};
            out.push({
              playerId: p.playerId, userId: sideOf.userId, year: s.year, week: wk.week, gameId: g.id, matchupId: g.matchupId,
              tag: g.tag, started, points: p.points,
              yards: n(st, 'pass_yd') + n(st, 'rush_yd') + n(st, 'rec_yd'),
              touchdowns: n(st, 'pass_td') + n(st, 'rush_td') + n(st, 'rec_td'),
              receptions: n(st, 'rec'),
              played: Object.keys(st).length > 0,
              postseason,
              position: players[p.playerId]?.position ?? '?',
            });
          };
          for (const e of sideOf.starters) if (e.player) push(e.player, true);
          for (const b of sideOf.bench) push(b, false);
        }
      }
    }
  }
  return out;
}

const FLEX = new Set(['RB', 'WR', 'TE']);

export function filterLines(lines: PlayerLine[], pos: PosFilter): PlayerLine[] {
  if (pos === 'All') return lines;
  if (pos === 'FLEX') return lines.filter((l) => FLEX.has(l.position));
  return lines.filter((l) => l.position === pos);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/lib/playerLines.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/playerLines.ts packages/web/src/lib/playerLines.test.ts packages/web/src/test/playerFixtures.ts
git commit -m "feat(web): flatten seasons into player lines with position filter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: All-time boards

**Files:**
- Create: `packages/web/src/lib/playerBoards.ts`
- Test: `packages/web/src/lib/playerBoards.test.ts`

**Interfaces:**
- Consumes: `PlayerLine`, `flattenLines` from Task 1; `fmtPts`, `fmtPpg` from `./format`.
- Produces:
  ```ts
  export type Section = 'leaders' | 'allTime' | 'postseason' | 'extras';
  export interface BoardRow {
    key: string; playerId: PlayerId; value: number; valueLabel: string;
    meta: string;              // "2025 · Wk 7" for a moment, years list for a career row
    detail: string | null;     // "15 starts", "12 games", "3 managers"; null when nothing to add
    userId: UserId | null;     // manager to show, when the row is about one manager
    to: string | null;         // link target
  }
  export interface BoardContext {
    lines: PlayerLine[]; players: PlayerDirectory; champions: Record<number, UserId | null>; currentYear: number;
  }
  export interface BoardDef { id: string; section: Section; title: string; definition: string; valueHeader: string; compute: (ctx: BoardContext) => BoardRow[] }
  export const BOARDS: BoardDef[];           // filled across Tasks 2 and 3
  export const MAX_ROWS = 25;
  export function championsOf(seasons: Season[]): Record<number, UserId | null>;
  // individual boards, all (ctx) => BoardRow[]:
  export const bestWeek, bestSeason, careerPoints, weeksStarted, championshipRosters, benchBlunder, careerPpg;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/lib/playerBoards.test.ts
import { describe, it, expect } from 'vitest';
import { flattenLines } from './playerLines';
import { game, line, players, season, side, week } from '../test/playerFixtures';
import {
  BOARDS, bestSeason, bestWeek, benchBlunder, careerPoints, careerPpg, championshipRosters, championsOf, weeksStarted,
  type BoardContext,
} from './playerBoards';

// Two seasons, managers a and b. q1 is the star QB, r1 a steady RB, w1 a benched boom, t1 unplayed often.
const s2024 = season(2024, [
  week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40), line('r1', 20)]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
  week(2, [game(2024, 2, 1, side('a', 25, [line('q1', 25)], [line('w1', 44, { rec: 9 })]), side('b', 12, [line('r1', 12)]))]),
  week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
], 'a');
const s2025 = season(2025, [
  week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35), line('t1', 0, {})]), side('a', 9, [line('r1', 9)]))]),
  week(2, [game(2025, 2, 1, side('b', 18, [line('q1', 18)]), side('a', 11, [line('r1', 11)]))]),
  week(3, [game(2025, 3, 1, side('b', 22, [line('r1', 22)], [line('q1', 50)]), side('a', 4, [line('w1', 4)]), 'Final')], true),
], 'b');
const seasons = [s2024, s2025];
const ctx: BoardContext = { lines: flattenLines(seasons, players), players, champions: championsOf(seasons), currentYear: 2025 };

describe('championsOf', () => {
  it('maps year to champion', () => {
    expect(championsOf(seasons)).toEqual({ 2024: 'a', 2025: 'b' });
  });
});

describe('bestWeek', () => {
  it('ranks started lines by points, newest first on ties, with a box score link', () => {
    const rows = bestWeek(ctx);
    expect(rows.slice(0, 3).map((r) => [r.playerId, r.value, r.meta, r.userId])).toEqual([
      ['q1', 40, '2024 · Wk 1', 'a'],
      ['q1', 35, '2025 · Wk 1', 'b'],
      ['q1', 31, '2024 · Wk 3 · Championship', 'a'],
    ]);
    expect(rows[0]).toMatchObject({ valueLabel: '40.00', to: '/scores/2024/1/1', detail: null });
    expect(rows.some((r) => r.playerId === 'w1' && r.value === 44)).toBe(false); // benched
  });
});

describe('bestSeason', () => {
  it('sums started points per player, manager and season with a starts count', () => {
    const rows = bestSeason(ctx);
    expect(rows[0]).toMatchObject({ playerId: 'q1', value: 96, valueLabel: '96.00', meta: '2024', detail: '3 starts', userId: 'a', to: '/scores/2024' });
    expect(rows[1]).toMatchObject({ playerId: 'q1', value: 53, meta: '2025', userId: 'b', detail: '2 starts' });
  });
});

describe('careerPoints and weeksStarted', () => {
  it('aggregates across seasons and managers', () => {
    const pts = careerPoints(ctx);
    expect(pts[0]).toMatchObject({ playerId: 'q1', value: 149, valueLabel: '149.00', meta: '2024, 2025', detail: '5 starts', userId: null, to: null });
    expect(pts[1]).toMatchObject({ playerId: 'r1', value: 81 });
    const wk = weeksStarted(ctx);
    expect(wk[0]).toMatchObject({ playerId: 'r1', value: 6, valueLabel: '6' });
    expect(wk[1]).toMatchObject({ playerId: 'q1', value: 5 });
  });
});

describe('championshipRosters', () => {
  it('counts seasons on the champion roster in the final, bench included, and lists the years', () => {
    const rows = championshipRosters(ctx);
    // 2024 final: a (champion) started q1, benched t1. 2025 final: b (champion) started r1, benched q1.
    expect(rows[0]).toMatchObject({ playerId: 'q1', value: 2, valueLabel: '2', meta: '2024, 2025' });
    expect(rows.map((r) => r.playerId).sort()).toEqual(['q1', 'r1', 't1']);
    expect(rows.find((r) => r.playerId === 'r1')).toMatchObject({ value: 1, meta: '2025' });
  });
});

describe('benchBlunder', () => {
  it('ranks benched lines by points with the manager and game', () => {
    const rows = benchBlunder(ctx);
    expect(rows[0]).toMatchObject({ playerId: 'q1', value: 50, meta: '2025 · Wk 3 · Championship', userId: 'b', to: '/scores/2025/3/1' });
    expect(rows[1]).toMatchObject({ playerId: 'w1', value: 44, userId: 'a' });
  });
});

describe('careerPpg', () => {
  it('averages points over played lines, started or benched, with a minimum of games', () => {
    expect(careerPpg(ctx)).toEqual([]); // nobody has 12 played games in the fixture
    const many = Array.from({ length: 12 }, (_, i) => week(i + 1, [game(2023, i + 1, 1, side('a', 10, [line('r1', 10)]), side('b', 1, [line('t1', 0, {})]))]));
    const big = { ...ctx, lines: flattenLines([season(2023, many), ...seasons], players) };
    const r1 = careerPpg(big).find((r) => r.playerId === 'r1')!;
    // 12 × 10 in 2023 + 20, 12, 7, 9, 11, 22 = 201 over 18 played games
    expect(r1).toMatchObject({ value: 11.17, valueLabel: '11.2', detail: '18 games', meta: '2023, 2024, 2025' });
    expect(careerPpg(big).find((r) => r.playerId === 't1')).toBeUndefined(); // 12 unplayed weeks do not count
  });
});

describe('BOARDS registry', () => {
  it('lists the all-time boards in order with sections', () => {
    const allTime = BOARDS.filter((b) => b.section === 'allTime').map((b) => b.id);
    expect(allTime).toEqual(['bestWeek', 'bestSeason', 'careerPoints', 'weeksStarted', 'championshipRosters', 'benchBlunder', 'careerPpg']);
    for (const b of BOARDS) expect(b.definition.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: FAIL, "Failed to resolve import ./playerBoards".

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/src/lib/playerBoards.ts
import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtTag } from './format';
import type { PlayerLine } from './playerLines';

export type Section = 'leaders' | 'allTime' | 'postseason' | 'extras';

export interface BoardRow {
  key: string;
  playerId: PlayerId;
  value: number;
  valueLabel: string;
  /** "2025 · Wk 7" for a single game, the years list for a career row */
  meta: string;
  detail: string | null;
  userId: UserId | null;
  to: string | null;
}

export interface BoardContext {
  lines: PlayerLine[];
  players: PlayerDirectory;
  champions: Record<number, UserId | null>;
  currentYear: number;
}

export interface BoardDef {
  id: string;
  section: Section;
  title: string;
  definition: string;
  valueHeader: string;
  compute: (ctx: BoardContext) => BoardRow[];
}

export const MAX_ROWS = 25;
const MIN_PPG_GAMES = 12;

export function championsOf(seasons: Season[]): Record<number, UserId | null> {
  return Object.fromEntries(seasons.map((s) => [s.year, s.honors.champion]));
}

const when = (l: { year: number; week: number; tag: PlayerLine['tag'] }) => `${l.year} · Wk ${l.week}${l.tag ? ` · ${fmtTag(l.tag)}` : ''}`;
const boxScore = (l: PlayerLine) => `/scores/${l.year}/${l.week}/${l.matchupId}`;
const yearsOf = (lines: PlayerLine[]) => [...new Set(lines.map((l) => l.year))].sort((a, b) => a - b).join(', ');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sort by value desc, newest (year, week) desc, playerId asc, then cap at MAX_ROWS. */
function rank<T extends { value: number; latestYear: number; latestWeek: number; playerId: string }>(items: T[], asc = false): T[] {
  return [...items]
    .sort((x, y) => (asc ? x.value - y.value : y.value - x.value) || y.latestYear - x.latestYear || y.latestWeek - x.latestWeek || (x.playerId < y.playerId ? -1 : x.playerId > y.playerId ? 1 : 0))
    .slice(0, MAX_ROWS);
}

/** Group lines by a key, remembering the newest line in each group. */
function groupBy(lines: PlayerLine[], keyOf: (l: PlayerLine) => string): Map<string, { lines: PlayerLine[]; latestYear: number; latestWeek: number }> {
  const groups = new Map<string, { lines: PlayerLine[]; latestYear: number; latestWeek: number }>();
  for (const l of lines) {
    const k = keyOf(l);
    const g = groups.get(k) ?? { lines: [], latestYear: 0, latestWeek: 0 };
    g.lines.push(l);
    if (l.year > g.latestYear || (l.year === g.latestYear && l.week > g.latestWeek)) { g.latestYear = l.year; g.latestWeek = l.week; }
    groups.set(k, g);
  }
  return groups;
}

/** One row per line (a "moment"). */
function momentBoard(lines: PlayerLine[], value: (l: PlayerLine) => number, label: (v: number) => string): BoardRow[] {
  const items = lines.map((l) => ({ ...l, value: value(l), latestYear: l.year, latestWeek: l.week }));
  return rank(items).map((l) => ({
    key: `${l.gameId}-${l.playerId}`, playerId: l.playerId, value: l.value, valueLabel: label(l.value),
    meta: when(l), detail: null, userId: l.userId, to: boxScore(l),
  }));
}

/** One row per player, aggregated over every season. */
function careerBoard(lines: PlayerLine[], value: (ls: PlayerLine[]) => number, label: (v: number) => string, detail: (ls: PlayerLine[]) => string | null): BoardRow[] {
  const items = [...groupBy(lines, (l) => l.playerId).entries()].map(([playerId, g]) => ({ playerId, value: value(g.lines), latestYear: g.latestYear, latestWeek: g.latestWeek, lines: g.lines }));
  return rank(items.filter((i) => i.value > 0)).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value),
    meta: yearsOf(i.lines), detail: detail(i.lines), userId: null, to: null,
  }));
}

const sum = (ls: PlayerLine[], f: (l: PlayerLine) => number) => round2(ls.reduce((s, l) => s + f(l), 0));
const started = (ctx: BoardContext) => ctx.lines.filter((l) => l.started);

export const bestWeek = (ctx: BoardContext): BoardRow[] => momentBoard(started(ctx), (l) => l.points, fmtPts);

export const bestSeason = (ctx: BoardContext): BoardRow[] => {
  const groups = groupBy(started(ctx), (l) => `${l.playerId}|${l.userId}|${l.year}`);
  const items = [...groups.entries()].map(([k, g]) => {
    const [playerId, userId, year] = k.split('|');
    return { playerId, userId, year: Number(year), value: sum(g.lines, (l) => l.points), starts: g.lines.length, latestYear: g.latestYear, latestWeek: g.latestWeek };
  });
  return rank(items).map((i) => ({
    key: `${i.playerId}-${i.userId}-${i.year}`, playerId: i.playerId, value: i.value, valueLabel: fmtPts(i.value),
    meta: String(i.year), detail: plural(i.starts, 'start'), userId: i.userId, to: `/scores/${i.year}`,
  }));
};

export const careerPoints = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => plural(ls.length, 'start'));

export const weeksStarted = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.length, String, (ls) => plural(ls.length, 'start'));

export const championshipRosters = (ctx: BoardContext): BoardRow[] => {
  const onChampion = ctx.lines.filter((l) => l.tag === 'Final' && ctx.champions[l.year] === l.userId);
  // one line per player per year, bench included
  const seen = new Set<string>();
  const unique = onChampion.filter((l) => { const k = `${l.playerId}|${l.year}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return careerBoard(unique, (ls) => ls.length, String, () => null);
};

export const benchBlunder = (ctx: BoardContext): BoardRow[] => momentBoard(ctx.lines.filter((l) => !l.started), (l) => l.points, fmtPts);

export const careerPpg = (ctx: BoardContext): BoardRow[] => {
  const played = ctx.lines.filter((l) => l.played);
  const items = [...groupBy(played, (l) => l.playerId).entries()]
    .filter(([, g]) => g.lines.length >= MIN_PPG_GAMES)
    .map(([playerId, g]) => ({ playerId, value: round2(sum(g.lines, (l) => l.points) / g.lines.length), games: g.lines.length, lines: g.lines, latestYear: g.latestYear, latestWeek: g.latestWeek }));
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: fmtPpg(i.value),
    meta: yearsOf(i.lines), detail: plural(i.games, 'game'), userId: null, to: null,
  }));
};

export const BOARDS: BoardDef[] = [
  { id: 'bestWeek', section: 'allTime', title: 'Best week by a starter', definition: 'Most points by a player in one week while in a starting lineup.', valueHeader: 'Pts', compute: bestWeek },
  { id: 'bestSeason', section: 'allTime', title: 'Best season by a starter', definition: 'Most points a player scored for one manager in one season while started.', valueHeader: 'Pts', compute: bestSeason },
  { id: 'careerPoints', section: 'allTime', title: 'Most career points started', definition: 'Total points scored while in a starting lineup, every season and manager.', valueHeader: 'Pts', compute: careerPoints },
  { id: 'weeksStarted', section: 'allTime', title: 'Most weeks started', definition: 'Weeks in a starting lineup across every season.', valueHeader: 'Starts', compute: weeksStarted },
  { id: 'championshipRosters', section: 'allTime', title: 'Most championship rosters', definition: "Seasons on the champion's roster, starters and bench, in the championship game.", valueHeader: 'Titles', compute: championshipRosters },
  { id: 'benchBlunder', section: 'allTime', title: 'Biggest bench blunder', definition: 'Most points by a player left on the bench in one week.', valueHeader: 'Pts', compute: benchBlunder },
  { id: 'careerPpg', section: 'allTime', title: 'Career PPG', definition: `Points per game over weeks the player actually played, started or benched. At least ${MIN_PPG_GAMES} games.`, valueHeader: 'PPG', compute: careerPpg },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: PASS, 8 tests. If `careerPpg` for r1 is off by rounding, check the arithmetic in the comment: 201 / 18 = 11.1667 → 11.17 → "11.2".

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/playerBoards.ts packages/web/src/lib/playerBoards.test.ts
git commit -m "feat(web): all-time player boards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Postseason, extras and league leader boards

**Files:**
- Modify: `packages/web/src/lib/playerBoards.ts`
- Test: `packages/web/src/lib/playerBoards.test.ts`

**Interfaces:**
- Produces, appended to `BOARDS` and exported:
  ```ts
  export const postPoints, postStarts, postTouchdowns, postYards, postReceptions;   // section 'postseason'
  export const boomStarts, dudStarts, journeyman;                                    // section 'extras'
  export const leadPoints, leadYards, leadTouchdowns;                                // section 'leaders', current season only
  ```

- [ ] **Step 1: Write the failing test**

Append to `packages/web/src/lib/playerBoards.test.ts`:

```ts
import { boomStarts, dudStarts, journeyman, leadPoints, leadTouchdowns, leadYards, postPoints, postReceptions, postStarts, postTouchdowns, postYards } from './playerBoards';

describe('postseason boards', () => {
  // Finals: 2024 wk3 a: q1 31 (bench t1 3) vs b: r1 7 ; 2025 wk3 b: r1 22 (bench q1 50) vs a: w1 4. Toilet bowls never appear here.
  it('count only started lines in championship-bracket games', () => {
    expect(postPoints(ctx).slice(0, 2)).toEqual([
      expect.objectContaining({ playerId: 'q1', value: 31, valueLabel: '31.00', meta: '2024', detail: '1 start' }),
      expect.objectContaining({ playerId: 'r1', value: 29, meta: '2024, 2025', detail: '2 starts' }),
    ]);
    expect(postStarts(ctx)[0]).toMatchObject({ playerId: 'r1', value: 2, valueLabel: '2', detail: '29.00 pts' });
  });
  it('sum touchdowns, yards and receptions from the stats', () => {
    const rich = season(2023, [week(3, [game(2023, 3, 1,
      side('a', 40, [line('w1', 25, { rec: 8, rec_yd: 120, rec_td: 2 }), line('r1', 15, { rush_yd: 60, rush_td: 1, rec: 2, rec_yd: 10 })]),
      side('b', 5, [line('q1', 5, { pass_yd: 150, pass_td: 1 })]), 'SF')], true)]);
    const c = { ...ctx, lines: flattenLines([rich], players) };
    expect(postTouchdowns(c)[0]).toMatchObject({ playerId: 'w1', value: 2, valueLabel: '2', detail: '1 start' });
    expect(postYards(c)[0]).toMatchObject({ playerId: 'q1', value: 150, valueLabel: '150' });
    expect(postReceptions(c).map((r) => [r.playerId, r.value])).toEqual([['w1', 8], ['r1', 2]]);
  });
});

describe('extras', () => {
  it('boom starts count started lines of 30 or more', () => {
    expect(boomStarts(ctx)[0]).toMatchObject({ playerId: 'q1', value: 3, valueLabel: '3', detail: '5 starts' }); // 40, 35, 31
    expect(boomStarts(ctx)).toHaveLength(1);
  });
  it('dud starts count played starts under 5 and ignore unplayed weeks', () => {
    // started under 5 and played: t1 3? no, t1 3 was benched. w1 4 (2025 wk3) yes. t1 0 unplayed (2025 wk1) excluded.
    expect(dudStarts(ctx)).toEqual([expect.objectContaining({ playerId: 'w1', value: 1 })]);
  });
  it('journeyman counts distinct managers who started the player', () => {
    const rows = journeyman(ctx);
    expect(rows.find((r) => r.playerId === 'q1')).toMatchObject({ value: 2, valueLabel: '2', detail: '5 starts' }); // a in 2024, b in 2025
    expect(rows.find((r) => r.playerId === 'w1')).toMatchObject({ value: 2 }); // b in 2024, a in 2025
    expect(rows.find((r) => r.playerId === 't1')).toMatchObject({ value: 1 }); // only b
    // q1, r1 and w1 all tie at 2; r1 and w1 share the newest start (2025 wk 3) so playerId breaks it, then q1 (newest 2025 wk 2)
    expect(rows.slice(0, 3).map((r) => r.playerId)).toEqual(['r1', 'w1', 'q1']);
  });
});

describe('league leaders', () => {
  it('use the current season only, started or benched, with the latest manager', () => {
    // 2025: q1 35 + 18 (b) + 50 benched (b) = 103 ; r1 9 + 11 (a) + 22 (b) = 42 ; w1 4 (a) ; t1 0
    expect(leadPoints(ctx).slice(0, 2)).toEqual([
      expect.objectContaining({ playerId: 'q1', value: 103, valueLabel: '103.00', userId: 'b', meta: '2025' }),
      expect.objectContaining({ playerId: 'r1', value: 42, userId: 'b' }),
    ]);
    expect(leadYards(ctx)).toEqual([]); // fixture lines carry no yardage in 2025
    expect(leadTouchdowns(ctx)).toEqual([]);
  });
  it('return nothing when the current season has no lines', () => {
    expect(leadPoints({ ...ctx, currentYear: 2026 })).toEqual([]);
  });
});

describe('BOARDS registry sections', () => {
  it('lists postseason, extras and leaders in order', () => {
    const ids = (s: string) => BOARDS.filter((b) => b.section === s).map((b) => b.id);
    expect(ids('postseason')).toEqual(['postPoints', 'postStarts', 'postTouchdowns', 'postYards', 'postReceptions']);
    expect(ids('extras')).toEqual(['boomStarts', 'dudStarts', 'journeyman']);
    expect(ids('leaders')).toEqual(['leadPoints', 'leadYards', 'leadTouchdowns']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: FAIL, the new exports are undefined ("postPoints is not a function").

- [ ] **Step 3: Write the implementation**

Append to `packages/web/src/lib/playerBoards.ts` (before `export const BOARDS`), then extend `BOARDS`:

```ts
const postseasonStarted = (ctx: BoardContext) => started(ctx).filter((l) => l.postseason);
const intLabel = (v: number) => String(v);

export const postPoints = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => plural(ls.length, 'start'));
export const postStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => ls.length, intLabel, (ls) => `${fmtPts(sum(ls, (l) => l.points))} pts`);
export const postTouchdowns = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.touchdowns), intLabel, (ls) => plural(ls.length, 'start'));
export const postYards = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.yards), intLabel, (ls) => plural(ls.length, 'start'));
export const postReceptions = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.receptions), intLabel, (ls) => plural(ls.length, 'start'));

export const boomStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.filter((l) => l.points >= 30).length, intLabel, (ls) => plural(ls.length, 'start'));
export const dudStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.filter((l) => l.played && l.points < 5).length, intLabel, (ls) => plural(ls.length, 'start'));
export const journeyman = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => new Set(ls.map((l) => l.userId)).size, intLabel, (ls) => plural(ls.length, 'start'));

/** Current season, every rostered line, manager = whoever rostered the player most recently. */
function leaderBoard(ctx: BoardContext, value: (ls: PlayerLine[]) => number, label: (v: number) => string): BoardRow[] {
  const current = ctx.lines.filter((l) => l.year === ctx.currentYear);
  const items = [...groupBy(current, (l) => l.playerId).entries()].map(([playerId, g]) => {
    const latest = g.lines.reduce((a, b) => (b.week > a.week ? b : a));
    return { playerId, value: value(g.lines), userId: latest.userId, latestYear: g.latestYear, latestWeek: g.latestWeek };
  });
  return rank(items.filter((i) => i.value > 0)).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value),
    meta: String(ctx.currentYear), detail: null, userId: i.userId, to: null,
  }));
}
export const leadPoints = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, (ls) => sum(ls, (l) => l.points), fmtPts);
export const leadYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, (ls) => sum(ls, (l) => l.yards), intLabel);
export const leadTouchdowns = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, (ls) => sum(ls, (l) => l.touchdowns), intLabel);
```

Add to the `BOARDS` array, after the all-time entries:

```ts
  { id: 'postPoints', section: 'postseason', title: 'Most postseason points started', definition: 'Points while started in championship-bracket games.', valueHeader: 'Pts', compute: postPoints },
  { id: 'postStarts', section: 'postseason', title: 'Most postseason starts', definition: 'Starts in championship-bracket games.', valueHeader: 'Starts', compute: postStarts },
  { id: 'postTouchdowns', section: 'postseason', title: 'Most postseason touchdowns', definition: 'Passing, rushing and receiving touchdowns while started in the championship bracket.', valueHeader: 'TD', compute: postTouchdowns },
  { id: 'postYards', section: 'postseason', title: 'Most postseason yards', definition: 'Passing, rushing and receiving yards while started in the championship bracket.', valueHeader: 'Yds', compute: postYards },
  { id: 'postReceptions', section: 'postseason', title: 'Most postseason receptions', definition: 'Receptions while started in the championship bracket.', valueHeader: 'Rec', compute: postReceptions },
  { id: 'boomStarts', section: 'extras', title: 'Most 30-point starts', definition: 'Weeks a player scored 30 or more while started.', valueHeader: 'Weeks', compute: boomStarts },
  { id: 'dudStarts', section: 'extras', title: 'Most dud starts', definition: 'Weeks a player played and scored under 5 while started. Unplayed weeks do not count.', valueHeader: 'Weeks', compute: dudStarts },
  { id: 'journeyman', section: 'extras', title: 'Journeyman', definition: 'Different managers who have started the player.', valueHeader: 'Mgrs', compute: journeyman },
  { id: 'leadPoints', section: 'leaders', title: 'Most points', definition: 'Fantasy points this season on any roster, started or benched.', valueHeader: 'Pts', compute: leadPoints },
  { id: 'leadYards', section: 'leaders', title: 'Most yards', definition: 'Passing, rushing and receiving yards this season on any roster.', valueHeader: 'Yds', compute: leadYards },
  { id: 'leadTouchdowns', section: 'leaders', title: 'Most touchdowns', definition: 'Passing, rushing and receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadTouchdowns },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/lib/playerBoards.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/playerBoards.ts packages/web/src/lib/playerBoards.test.ts
git commit -m "feat(web): postseason, extras and league leader boards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Streaks

**Files:**
- Create: `packages/web/src/lib/streaks.ts`
- Test: `packages/web/src/lib/streaks.test.ts`

**Interfaces:**
- Consumes: `History['h2h']` (`H2HSeries` with `a`, `b`, `games[]` of `{ gameId, year, week, tag, aPoints, bPoints }`).
- Produces:
  ```ts
  export interface Streak { userId: UserId; kind: 'W' | 'L'; length: number; from: { year: number; week: number }; to: { year: number; week: number }; active: boolean }
  export function longestStreaks(h2h: History['h2h'], kind: 'W' | 'L', limit = 5): Streak[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/lib/streaks.test.ts
import { describe, it, expect } from 'vitest';
import type { H2HGame, H2HSeries, History } from '@fantasy-dash/core';
import { longestStreaks } from './streaks';

const game = (year: number, week: number, aPoints: number, bPoints: number): H2HGame =>
  ({ gameId: `${year}-${week}-1`, year, week, tag: null, aPoints, bPoints });
const series = (a: string, b: string, games: H2HGame[]): H2HSeries => ({
  a, b, aWins: 0, bWins: 0, ties: 0, streak: { holder: null, length: 0 }, totalPoints: { a: 0, b: 0 },
  biggestWin: null, closest: null, avgMargin: 0, games,
});

// a beats b in 2024 wk 13, 14 and 2025 wk 1 (carry-over), ties wk 2, beats c wk 3, loses wk 4.
const h2h: History['h2h'] = {
  'a|b': series('a', 'b', [game(2024, 13, 100, 90), game(2024, 14, 100, 90), game(2025, 1, 100, 90), game(2025, 2, 95, 95)]),
  'a|c': series('a', 'c', [game(2025, 3, 100, 90), game(2025, 4, 80, 90)]),
  'b|c': series('b', 'c', [game(2024, 12, 70, 90), game(2025, 5, 70, 90)]),
};

describe('longestStreaks', () => {
  it('finds win streaks that carry across seasons and end on a tie', () => {
    const w = longestStreaks(h2h, 'W');
    expect(w[0]).toEqual({ userId: 'a', kind: 'W', length: 3, from: { year: 2024, week: 13 }, to: { year: 2025, week: 1 }, active: false });
  });
  it('reports one streak per manager, the longest, and marks it active when it includes their latest game', () => {
    // c: 2024 wk12 W (vs b), 2025 wk3 L (vs a), wk4 W, wk5 W → runs of 1 and 2; only the 2 is reported, and it is active.
    const w = longestStreaks(h2h, 'W');
    expect(w.filter((s) => s.userId === 'c')).toEqual([
      { userId: 'c', kind: 'W', length: 2, from: { year: 2025, week: 4 }, to: { year: 2025, week: 5 }, active: true },
    ]);
  });
  it('finds losing streaks separately', () => {
    // b: 2024 wk12 L, wk13 L, wk14 L, 2025 wk1 L, wk2 T, wk5 L → the tie ends the run at 4; the later 1-game run is active but shorter.
    const l = longestStreaks(h2h, 'L');
    expect(l[0]).toEqual({ userId: 'b', kind: 'L', length: 4, from: { year: 2024, week: 12 }, to: { year: 2025, week: 1 }, active: false });
  });
  it('orders by length, then most recent end, and caps at the limit', () => {
    const w = longestStreaks(h2h, 'W', 2);
    expect(w.map((s) => [s.userId, s.length])).toEqual([['a', 3], ['c', 2]]);
  });
  it('returns nothing for empty input or all ties', () => {
    expect(longestStreaks({}, 'W')).toEqual([]);
    expect(longestStreaks({ 'x|y': series('x', 'y', [game(2025, 1, 50, 50)]) }, 'W')).toEqual([]);
    expect(longestStreaks({ 'x|y': series('x', 'y', [game(2025, 1, 50, 50)]) }, 'L')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/lib/streaks.test.ts`
Expected: FAIL, "Failed to resolve import ./streaks".

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/src/lib/streaks.ts
import type { History, UserId } from '@fantasy-dash/core';

export interface Streak {
  userId: UserId;
  kind: 'W' | 'L';
  length: number;
  from: { year: number; week: number };
  to: { year: number; week: number };
  /** the run includes the manager's most recent game */
  active: boolean;
}

interface Result { year: number; week: number; r: 'W' | 'L' | 'T' }

/** Each manager's longest run of `kind` across every played game, playoffs included, carried across seasons. One streak per manager. */
export function longestStreaks(h2h: History['h2h'], kind: 'W' | 'L', limit = 5): Streak[] {
  const byUser = new Map<UserId, Result[]>();
  const push = (u: UserId, r: Result) => { const arr = byUser.get(u) ?? []; arr.push(r); byUser.set(u, arr); };
  for (const s of Object.values(h2h)) {
    for (const g of s.games) {
      const aRes: Result['r'] = g.aPoints > g.bPoints ? 'W' : g.aPoints < g.bPoints ? 'L' : 'T';
      const bRes: Result['r'] = aRes === 'W' ? 'L' : aRes === 'L' ? 'W' : 'T';
      push(s.a, { year: g.year, week: g.week, r: aRes });
      push(s.b, { year: g.year, week: g.week, r: bRes });
    }
  }

  const out: Streak[] = [];
  for (const [userId, results] of byUser) {
    results.sort((x, y) => x.year - y.year || x.week - y.week);
    let best: Streak | null = null;
    let run: Result[] = [];
    const flush = (endsAtLatest: boolean) => {
      if (run.length === 0) return;
      const candidate: Streak = {
        userId, kind, length: run.length,
        from: { year: run[0].year, week: run[0].week },
        to: { year: run[run.length - 1].year, week: run[run.length - 1].week },
        active: endsAtLatest,
      };
      if (!best || candidate.length >= best.length) best = candidate; // later run wins a tie: more recent
      run = [];
    };
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.r === kind) run.push(r);
      else flush(false);
      if (i === results.length - 1) flush(true);
    }
    if (best) out.push(best);
  }

  return out
    .sort((x, y) => y.length - x.length || y.to.year - x.to.year || y.to.week - x.to.week || (x.userId < y.userId ? -1 : 1))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/lib/streaks.test.ts`
Expected: PASS, 5 tests. If the `active` flag on the last run is wrong, note the subtlety in the loop: when the final result breaks the run, `flush(false)` runs first (the broken run is not active) and the following `flush(true)` sees an empty run and returns.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/streaks.ts packages/web/src/lib/streaks.test.ts
git commit -m "feat(web): longest win and losing streaks from head-to-head games

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Board and PositionFilter components

**Files:**
- Create: `packages/web/src/components/players/Board.tsx`
- Create: `packages/web/src/components/players/PositionFilter.tsx`
- Test: `packages/web/src/components/players/Board.test.tsx`

**Interfaces:**
- Consumes: `BoardDef`, `BoardRow`, `MAX_ROWS` from Task 2; `PosFilter`, `POS_FILTERS` from Task 1; `Headshot`, `PosPill`, `Avatar` components; `playerName`, `playerPos` from `../../lib/players`.
- Produces:
  ```tsx
  export default function Board({ def, rows, players, managers }: { def: BoardDef; rows: BoardRow[]; players: PlayerDirectory; managers: History['managers'] }): JSX.Element
  export default function PositionFilter({ value, onChange }: { value: PosFilter; onChange: (p: PosFilter) => void }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/components/players/Board.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow } from '../../lib/playerBoards';
import Board from './Board';
import PositionFilter from './PositionFilter';

const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3 },
};
const managers: History['managers'] = { a: { displayName: 'alice', avatar: 'av', seasons: [2025] } };
const def: BoardDef = { id: 'x', section: 'allTime', title: 'Best week by a starter', definition: 'Most points in a week.', valueHeader: 'Pts', compute: () => [] };
const row = (i: number, extra: Partial<BoardRow> = {}): BoardRow => ({
  key: `k${i}`, playerId: i === 0 ? 'q1' : `p${i}`, value: 100 - i, valueLabel: `${100 - i}.00`, meta: '2025 · Wk 1', detail: null, userId: null, to: null, ...extra,
});
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Board', () => {
  it('shows five rows, then all of them on Show all', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(i));
    wrap(<Board def={def} rows={rows} players={players} managers={managers} />);
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /show all/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('renders name, position, unknown players, manager link and game link', () => {
    const rows = [row(0, { userId: 'a', to: '/scores/2025/1/3', detail: '3 starts' }), row(1)];
    wrap(<Board def={def} rows={rows} players={players} managers={managers} />);
    const first = screen.getAllByRole('listitem')[0];
    expect(within(first).getByText('Quincy One')).toBeInTheDocument();
    expect(within(first).getByText('QB')).toBeInTheDocument();
    expect(within(first).getByText('100.00')).toBeInTheDocument();
    expect(within(first).getByText('3 starts')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /alice/ })).toHaveAttribute('href', '/h2h?a=a');
    expect(within(first).getByRole('link', { name: /2025 · Wk 1/ })).toHaveAttribute('href', '/scores/2025/1/3');
    const second = screen.getAllByRole('listitem')[1];
    expect(within(second).getByText('p1')).toBeInTheDocument(); // unknown player falls back to id
    expect(within(second).getByText('?')).toBeInTheDocument();
    expect(within(second).queryByRole('link')).toBeNull();
  });

  it('shows an empty state and no toggle with no rows', () => {
    wrap(<Board def={def} rows={[]} players={players} managers={managers} />);
    expect(screen.getByText('No players at this position.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the toggle when five or fewer rows', () => {
    wrap(<Board def={def} rows={[row(0)]} players={players} managers={managers} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('PositionFilter', () => {
  it('renders every option with the current one pressed and reports clicks', () => {
    const onChange = vi.fn();
    render(<PositionFilter value="RB" onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF']);
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'TE' }));
    expect(onChange).toHaveBeenCalledWith('TE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/components/players/Board.test.tsx`
Expected: FAIL, "Failed to resolve import ./Board".

- [ ] **Step 3: Write the components**

```tsx
// packages/web/src/components/players/PositionFilter.tsx
import { POS_FILTERS, type PosFilter } from '../../lib/playerLines';

interface Props { value: PosFilter; onChange: (p: PosFilter) => void }

/** One row of toggle buttons. The chosen position narrows every board on the page. */
export default function PositionFilter({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Position" className="flex flex-wrap gap-1">
      {POS_FILTERS.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
```

```tsx
// packages/web/src/components/players/Board.tsx
import { useState } from 'react';
import { Link } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow } from '../../lib/playerBoards';
import { playerName, playerPos } from '../../lib/players';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import PosPill from '../PosPill';

interface Props { def: BoardDef; rows: BoardRow[]; players: PlayerDirectory; managers: History['managers'] }

const PREVIEW = 5;

export default function Board({ def, rows, players, managers }: Props) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  return (
    <section className="card overflow-hidden" aria-labelledby={`board-${def.id}`}>
      <header className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2" title={def.definition}>
        <h3 id={`board-${def.id}`} className="section-label text-ink">{def.title}</h3>
        <span className="section-label shrink-0">{def.valueHeader}</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">No players at this position.</p>
      ) : (
        <ol className="divide-y divide-line">
          {shown.map((r, i) => {
            const m = r.userId ? managers[r.userId] : undefined;
            const pos = playerPos(players, r.playerId);
            const metaNode = r.to
              ? <Link to={r.to} className="num hover:text-accent">{r.meta}</Link>
              : <span className="num">{r.meta}</span>;
            return (
              <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                <span className="num w-4 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <Headshot players={players} id={r.playerId} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{playerName(players, r.playerId)}</span>
                    <PosPill pos={pos} />
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    {metaNode}
                    {r.detail && <><span aria-hidden>·</span><span>{r.detail}</span></>}
                    {r.userId && (
                      <>
                        <span aria-hidden>·</span>
                        <Link to={`/h2h?a=${r.userId}`} className="flex items-center gap-1 hover:text-accent">
                          <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={14} />
                          <span>{m?.displayName ?? r.userId}</span>
                        </Link>
                      </>
                    )}
                  </span>
                </span>
                <span className="num shrink-0 text-base font-semibold">{r.valueLabel}</span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
          {all ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/web && npx vitest run src/components/players/Board.test.tsx`
Expected: PASS, 5 tests. If `getByText('?')` fails because PosPill renders `?` twice (Headshot fallback shows the position when the image errors), note the Headshot fallback is only shown after an `onError`, which jsdom does not fire; the pill is the only `?`.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/players
git commit -m "feat(web): generic player board and position filter components

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Players view, page, route and nav

**Files:**
- Create: `packages/web/src/components/players/PlayersView.tsx`
- Create: `packages/web/src/pages/PlayersPage.tsx`
- Modify: `packages/web/src/App.tsx` (imports at the top, route list)
- Modify: `packages/web/src/components/Nav.tsx:6-13` (`links`)
- Test: `packages/web/src/components/players/PlayersView.test.tsx`
- Test: `packages/web/src/components/Nav.test.tsx`

**Interfaces:**
- Consumes: `flattenLines`, `filterLines`, `isPosFilter`, `PosFilter` (Task 1); `BOARDS`, `championsOf`, `BoardContext` (Tasks 2–3); `Board`, `PositionFilter` (Task 5); `history`, `players`, `currentSeason`, `loadAllSeasons` from `../data/load`.
- Produces:
  ```tsx
  export default function PlayersView({ seasons, players, managers, currentYear, lastScoredWeek }: {
    seasons: Season[]; players: PlayerDirectory; managers: History['managers']; currentYear: number; lastScoredWeek: number;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/components/players/PlayersView.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { History } from '@fantasy-dash/core';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import PlayersView from './PlayersView';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] },
};
const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 60, [line('q1', 40), line('r1', 20)]), side('b', 30, [line('w1', 10), line('t1', 20)]))]),
    week(3, [game(2024, 3, 1, side('a', 31, [line('q1', 31)], [line('t1', 3)]), side('b', 7, [line('r1', 7)]), 'Final')], true),
  ], 'a'),
  season(2025, [
    week(1, [game(2025, 1, 1, side('b', 35, [line('q1', 35, { pass_yd: 300, pass_td: 3 })]), side('a', 9, [line('r1', 9, { rush_yd: 40 })]))]),
  ], null, 1),
];

function LocationProbe() { const loc = useLocation(); return <output data-testid="loc">{loc.search}</output>; }
const mount = (initial = '/players') => render(
  <MemoryRouter initialEntries={[initial]}>
    <Routes>
      <Route path="/players" element={<><PlayersView seasons={seasons} players={players} managers={managers} currentYear={2025} lastScoredWeek={1} /><LocationProbe /></>} />
    </Routes>
  </MemoryRouter>,
);

describe('PlayersView', () => {
  it('renders the four sections with every board and the through-week line', () => {
    mount();
    expect(screen.getByText(/through 2025 week 1/i)).toBeInTheDocument();
    for (const h of ['League leaders', 'All-time', 'Postseason', 'Extras']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    expect(screen.getByText('Best week by a starter')).toBeInTheDocument();
    expect(screen.getByText('Most postseason receptions')).toBeInTheDocument();
    expect(screen.getByText('Journeyman')).toBeInTheDocument();
    expect(screen.getByText('Most yards')).toBeInTheDocument();
  });

  it('filters every board by position and writes the choice to the URL', () => {
    mount();
    const best = screen.getByRole('region', { name: 'Best week by a starter' });
    expect(within(best).getAllByRole('listitem')[0]).toHaveTextContent('Quincy One');
    fireEvent.click(screen.getByRole('button', { name: 'RB' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('?pos=RB');
    expect(within(screen.getByRole('region', { name: 'Best week by a starter' })).getAllByRole('listitem')[0]).toHaveTextContent('Ricky One');
    expect(within(screen.getByRole('region', { name: 'Most yards' })).getAllByRole('listitem')[0]).toHaveTextContent('Ricky One');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('');
  });

  it('reads the position from the URL and falls back to All for junk', () => {
    mount('/players?pos=QB');
    expect(screen.getByRole('button', { name: 'QB' })).toHaveAttribute('aria-pressed', 'true');
    mount('/players?pos=XYZ');
    expect(screen.getAllByRole('button', { name: 'All' }).at(-1)).toHaveAttribute('aria-pressed', 'true');
  });

  it('says the season has not started when the current year has no lines', () => {
    render(
      <MemoryRouter>
        <PlayersView seasons={seasons} players={players} managers={managers} currentYear={2026} lastScoredWeek={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Season has not started.')).toBeInTheDocument();
    expect(screen.queryByText('Most yards')).toBeNull();
  });
});
```

Add to `packages/web/src/components/Nav.test.tsx`:

```tsx
  it('links to the player stats tab', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: 'Player stats' })[0]).toHaveAttribute('href', '/players');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/web && npx vitest run src/components/players/PlayersView.test.tsx src/components/Nav.test.tsx`
Expected: PlayersView FAIL "Failed to resolve import ./PlayersView"; Nav FAIL "Unable to find role link with name Player stats".

- [ ] **Step 3: Write the view**

```tsx
// packages/web/src/components/players/PlayersView.tsx
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import { BOARDS, championsOf, type BoardContext, type Section } from '../../lib/playerBoards';
import { filterLines, flattenLines, isPosFilter, type PosFilter } from '../../lib/playerLines';
import Board from './Board';
import PositionFilter from './PositionFilter';

interface Props { seasons: Season[]; players: PlayerDirectory; managers: History['managers']; currentYear: number; lastScoredWeek: number }

const SECTIONS: { id: Section; title: string; note: string }[] = [
  { id: 'leaders', title: 'League leaders', note: 'This season, any roster' },
  { id: 'allTime', title: 'All-time', note: 'Every season' },
  { id: 'postseason', title: 'Postseason', note: 'Championship bracket only. Consolation games do not count.' },
  { id: 'extras', title: 'Extras', note: 'Every season' },
];

export default function PlayersView({ seasons, players, managers, currentYear, lastScoredWeek }: Props) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('pos');
  const pos: PosFilter = isPosFilter(raw) ? raw : 'All';
  const setPos = (p: PosFilter) => {
    const next = new URLSearchParams(params);
    if (p === 'All') next.delete('pos'); else next.set('pos', p);
    setParams(next, { replace: true });
  };

  const allLines = useMemo(() => flattenLines(seasons, players), [seasons, players]);
  const champions = useMemo(() => championsOf(seasons), [seasons]);
  const ctx: BoardContext = useMemo(() => ({ lines: filterLines(allLines, pos), players, champions, currentYear }), [allLines, pos, players, champions, currentYear]);
  const seasonStarted = allLines.some((l) => l.year === currentYear);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Player stats <span className="num font-normal text-muted">through {currentYear} week {lastScoredWeek}</span></h1>
        <nav aria-label="Sections" className="flex flex-wrap gap-3 text-xs">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="text-muted hover:text-accent">{s.title}</a>)}
        </nav>
      </header>
      <div className="sticky top-12 z-[5] -mx-4 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <PositionFilter value={pos} onChange={setPos} />
      </div>
      {SECTIONS.map((s) => {
        const boards = BOARDS.filter((b) => b.section === s.id);
        return (
          <section key={s.id} id={s.id} className="scroll-mt-28 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <span className="text-xs text-muted">{s.note}</span>
            </div>
            {s.id === 'leaders' && !seasonStarted ? (
              <p className="card p-4 text-sm text-muted">Season has not started.</p>
            ) : (
              <div className={`grid gap-4 ${s.id === 'leaders' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                {boards.map((b) => <Board key={b.id} def={b} rows={b.compute(ctx)} players={players} managers={managers} />)}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
```

```tsx
// packages/web/src/pages/PlayersPage.tsx
import { useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import PlayersView from '../components/players/PlayersView';
import { currentSeason, history, players } from '../data/load';

export default function PlayersPage() {
  const seasons = useLoaderData() as Season[];
  return <PlayersView seasons={seasons} players={players} managers={history.managers} currentYear={currentSeason.year} lastScoredWeek={currentSeason.lastScoredWeek} />;
}
```

In `packages/web/src/App.tsx`, add the import next to the other pages:

```tsx
import PlayersPage from './pages/PlayersPage';
```

and the route after the `history/:season` entry:

```tsx
        { path: 'players', loader: () => loadAllSeasons(), element: <PlayersPage /> },
```

In `packages/web/src/components/Nav.tsx`, add after the History link:

```ts
  { to: '/players', label: 'Player stats' },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/web && npx vitest run src/components/players/PlayersView.test.tsx src/components/Nav.test.tsx`
Expected: PASS, 4 + 3 tests. The region role query relies on `<section aria-labelledby>` in `Board`; if it fails, confirm the `id` on the `h3` matches `aria-labelledby`.

- [ ] **Step 5: Typecheck and build**

Run: `pnpm build` from the repo root.
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/players packages/web/src/pages/PlayersPage.tsx packages/web/src/App.tsx packages/web/src/components/Nav.tsx packages/web/src/components/Nav.test.tsx
git commit -m "feat(web): player stats tab with position filter, boards, route and nav link

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Streak cards on the History tab

**Files:**
- Create: `packages/web/src/components/history/StreaksCard.tsx`
- Modify: `packages/web/src/pages/HistoryPage.tsx`
- Test: `packages/web/src/components/history/StreaksCard.test.tsx`

**Interfaces:**
- Consumes: `longestStreaks`, `Streak` (Task 4); `Avatar`; `history` from `../data/load` (page only).
- Produces:
  ```tsx
  export default function StreaksCard({ title, streaks, managers }: { title: string; streaks: Streak[]; managers: History['managers'] }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/components/history/StreaksCard.test.tsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import type { Streak } from '../../lib/streaks';
import StreaksCard from './StreaksCard';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] },
};
const streaks: Streak[] = [
  { userId: 'a', kind: 'W', length: 7, from: { year: 2024, week: 12 }, to: { year: 2025, week: 3 }, active: true },
  { userId: 'b', kind: 'W', length: 4, from: { year: 2023, week: 1 }, to: { year: 2023, week: 4 }, active: false },
];

describe('StreaksCard', () => {
  it('lists streaks with length, span, active marker and manager link', () => {
    render(<MemoryRouter><StreaksCard title="Longest win streaks" streaks={streaks} managers={managers} /></MemoryRouter>);
    expect(screen.getByText('Longest win streaks')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('alice');
    expect(rows[0]).toHaveTextContent('7');
    expect(rows[0]).toHaveTextContent('2024 Wk 12 to 2025 Wk 3');
    expect(within(rows[0]).getByText('active')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/h2h?a=a');
    expect(within(rows[1]).queryByText('active')).toBeNull();
  });
  it('shows an empty state', () => {
    render(<MemoryRouter><StreaksCard title="Longest losing streaks" streaks={[]} managers={managers} /></MemoryRouter>);
    expect(screen.getByText('No streaks yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run src/components/history/StreaksCard.test.tsx`
Expected: FAIL, "Failed to resolve import ./StreaksCard".

- [ ] **Step 3: Write the component and wire the page**

```tsx
// packages/web/src/components/history/StreaksCard.tsx
import { Link } from 'react-router';
import type { History } from '@fantasy-dash/core';
import type { Streak } from '../../lib/streaks';
import Avatar from '../Avatar';

interface Props { title: string; streaks: Streak[]; managers: History['managers'] }

const span = (s: Streak) => `${s.from.year} Wk ${s.from.week} to ${s.to.year} Wk ${s.to.week}`;

export default function StreaksCard({ title, streaks, managers }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2"><h2 className="section-label">{title}</h2></div>
      {streaks.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">No streaks yet.</p>
      ) : (
        <ol className="divide-y divide-line">
          {streaks.map((s, i) => {
            const m = managers[s.userId];
            const name = m?.displayName ?? s.userId;
            return (
              <li key={`${s.userId}-${s.from.year}-${s.from.week}`} className="flex items-center gap-3 px-3 py-2">
                <span className="num w-4 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <Link to={`/h2h?a=${s.userId}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-accent">
                  <Avatar avatar={m?.avatar ?? null} name={name} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{name}</span>
                    <span className="num block text-xs text-muted">
                      {span(s)}
                      {s.active && <span className="ml-1.5 rounded-full bg-win/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-win">active</span>}
                    </span>
                  </span>
                </Link>
                <span className="num shrink-0 text-xl font-semibold">{s.length}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
```

In `packages/web/src/pages/HistoryPage.tsx`, add imports:

```tsx
import StreaksCard from '../components/history/StreaksCard';
import { longestStreaks } from '../lib/streaks';
```

and, inside the component after `const seasons = ...`:

```tsx
  const wins = longestStreaks(history.h2h, 'W');
  const losses = longestStreaks(history.h2h, 'L');
```

then after the closing `</div>` of the table card, before `</section>`:

```tsx
      <div className="grid gap-4 md:grid-cols-2">
        <StreaksCard title="Longest win streaks" streaks={wins} managers={history.managers} />
        <StreaksCard title="Longest losing streaks" streaks={losses} managers={history.managers} />
      </div>
      <p className="text-xs text-muted">Every played game counts, playoffs included. A streak carries across seasons and ends on a tie.</p>
```

Check `text-win` and `bg-win/15` exist: `grep -n "win" packages/web/src/index.css` should show a `--color-win` token. If the alpha form is unavailable, use `style={{ background: 'color-mix(in srgb, var(--win) 15%, transparent)' }}` instead of `bg-win/15`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/web && npx vitest run src/components/history/StreaksCard.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/history/StreaksCard.tsx packages/web/src/components/history/StreaksCard.test.tsx packages/web/src/pages/HistoryPage.tsx
git commit -m "feat(web): longest win and losing streak cards on the history tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Verify against real data and finish

**Files:**
- None committed; a scratch script only.

- [ ] **Step 1: Run the whole suite and the build**

Run from the repo root: `pnpm test` then `pnpm build`.
Expected: every package passes; `✓ built`.

- [ ] **Step 2: Eyeball the boards on real data**

Write this to the scratchpad directory (not the repo) and run it with `npx tsx <path>` from the repo root:

```ts
import { readFileSync } from 'node:fs';
import { flattenLines } from '/Users/mathiasfoster/repos/fantasy-dash/packages/web/src/lib/playerLines';
import { BOARDS, championsOf } from '/Users/mathiasfoster/repos/fantasy-dash/packages/web/src/lib/playerBoards';
import { longestStreaks } from '/Users/mathiasfoster/repos/fantasy-dash/packages/web/src/lib/streaks';

const root = '/Users/mathiasfoster/repos/fantasy-dash/data';
const players = JSON.parse(readFileSync(`${root}/players.json`, 'utf8'));
const history = JSON.parse(readFileSync(`${root}/history.json`, 'utf8'));
const seasons = history.seasons.map((s: { year: number }) => JSON.parse(readFileSync(`${root}/seasons/${s.year}.json`, 'utf8')));
const current = seasons[seasons.length - 1];
const ctx = { lines: flattenLines(seasons, players), players, champions: championsOf(seasons), currentYear: current.year };
const name = (id: string) => players[id]?.name ?? id;
for (const b of BOARDS) {
  console.log(`\n== ${b.title}`);
  for (const r of b.compute(ctx).slice(0, 5)) console.log(`  ${name(r.playerId).padEnd(24)} ${r.valueLabel.padStart(8)}  ${r.meta}${r.detail ? ` · ${r.detail}` : ''}${r.userId ? ` · ${history.managers[r.userId]?.displayName}` : ''}`);
}
for (const k of ['W', 'L'] as const) {
  console.log(`\n== ${k} streaks`);
  for (const s of longestStreaks(history.h2h, k)) console.log(`  ${history.managers[s.userId]?.displayName.padEnd(16)} ${s.length}  ${s.from.year} Wk ${s.from.week} to ${s.to.year} Wk ${s.to.week}${s.active ? ' (active)' : ''}`);
}
```

Expected: sensible names (Chase, Allen, Gibbs near the top of points boards), every board non-empty except possibly Career PPG early in a season, streak lengths consistent with the all-time table's current streak column.

- [ ] **Step 3: Look at it in the browser if feasible**

Run `pnpm dev`, open `/players` and `/history`. Check: the filter bar sticks under the nav, the FLEX filter removes kickers and defenses, the "Show all" toggle expands, the leaders row is three columns on wide screens and one on a phone width, and the streak cards sit under the seasons table.

- [ ] **Step 4: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill: suite green, present the merge / PR / keep menu.
