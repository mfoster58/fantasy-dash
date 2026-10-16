# Teams and Managers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Teams tab with per-season team pages (roster breakdown, schedule, shape, draft, transactions) and per-manager career pages (seasons, league records, rivals, lineup/draft desks, franchise players).

**Architecture:** Two pure, tested libraries (`lib/teamProfile.ts` for the season and career profiles, `lib/managerRecords.ts` for the manager's placements on the existing record boards) feed presentational cards under `components/teams/`. Four pages wire them to routes that load every season. No core or sync changes.

**Tech Stack:** React 19, react-router 7, Tailwind 4, vitest + testing-library. Code blocks are fenced as `lang path=<file>` so they can be extracted verbatim.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-16-teams-managers-design.md`.
- Top nav link is `Teams` → `/teams`; sub-tabs `Teams` (`/teams/:season`) and `Managers` (`/managers`).
- Routes: `/teams` redirects to `/teams/{currentSeason.year}`; `/teams/:season`, `/teams/:season/:userId`, `/managers`, `/managers/:userId` all use `loadAllSeasons()`.
- Finish label: `1st` / `2nd` / `3rd` / `Last` from honors for complete seasons, else ordinal regular-season rank; `—` in season.
- Gold is a new token `--gold` (light `#b8860b`, dark `#e3b341`) used only for rank-1 records.
- Position bar labels appear only in segments wider than 8%. Started-most-weeks rows are those with starts ≥ half the played weeks. Position cards preview 4 rows.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Commands: `pnpm --filter @fantasy-dash/web exec vitest run <file>`, `pnpm typecheck`, `pnpm --filter @fantasy-dash/web test`, `pnpm build`.

---

### Task 1: Season and career profile library

**Files:**
- Create: `packages/web/src/lib/teamProfile.ts`
- Test: `packages/web/src/lib/teamProfile.test.ts`

**Interfaces:**
- Consumes: `teamGamesOf` (`lib/managerGames.ts`), `managerDraftSummaries`, `letterGrade` (`lib/draft.ts`), `flattenLines` (`lib/playerLines.ts`), `waiverClaims` (`lib/waivers.ts`).
- Produces: `seasonProfile(season, userId, players): SeasonProfile`, `careerProfile(seasons, history, userId, players): CareerProfile`, `longestWinStreak(games)`, `fieldedAs(seasons, userId)`, `franchisePlayers(lines, userId, n)`, `lineupDesk(games)`, `draftDesk(seasons, userId)`, `finishLabel(season, userId, rank)`, `PROFILE_POSITIONS`.

- [ ] **Step 1: Write the failing tests**

```ts path=packages/web/src/lib/teamProfile.test.ts
import type { History, Season, Transaction } from '@fantasy-dash/core';
import { careerProfile, fieldedAs, franchisePlayers, longestWinStreak, seasonProfile } from './teamProfile';
import { flattenLines } from './playerLines';
import { game, line, players, season, side, standing, week } from '../test/playerFixtures';

// Two weeks, two games each: alice beats bob then loses to cara; dan is the fourth team.
const g = (yr: number, wk: number, id: number, a: [string, number], b: [string, number], aStarters = [line('q1', 20), line('r1', 10)], aBench = [line('w1', 7)]) =>
  game(yr, wk, id, side(a[0], a[1], aStarters, aBench), side(b[0], b[1], [line('t1', 12)]));
const tx = (id: string, type: Transaction['type'], week: number, created: number, adds: string[], drops: string[], bid: number | null = null): Transaction =>
  ({ id, type, week, created, adds: adds.map((p) => ({ playerId: p, userId: 'a' })), drops: drops.map((p) => ({ playerId: p, userId: 'a' })), bid });

function build(): Season {
  const s = season(2025, [
    week(1, [g(2025, 1, 1, ['a', 120], ['b', 90]), g(2025, 1, 2, ['c', 100], ['d', 80])]),
    week(2, [g(2025, 2, 1, ['a', 95], ['c', 130]), g(2025, 2, 2, ['b', 70], ['d', 110])]),
    week(3, []),
  ]);
  s.standings = [standing('c', 1, 2, 0, 0, 230, 175), standing('a', 2, 1, 1, 0, 215, 220), standing('d', 3, 1, 1, 0, 190, 170), standing('b', 4, 0, 2, 0, 160, 230)];
  s.managers = { a: { userId: 'a', displayName: 'alice', teamName: 'Team Alice', avatar: null, rosterId: 1 } };
  s.status = 'in_season';
  s.transactions = [tx('t1', 'waiver', 2, 200, ['w1'], ['k1'], 12), tx('t2', 'free_agent', 1, 100, ['r1'], [])];
  return s;
}

describe('seasonProfile', () => {
  const p = seasonProfile(build(), 'a', players);

  it('ranks scoring and points allowed and reads the standings row', () => {
    expect(p.row?.rank).toBe(2);
    expect(p.teams).toBe(4);
    expect(p.scoringRank).toBe(2);           // 215 behind cara's 230
    expect(p.pointsAllowedRank).toBe(2);     // 220 allowed, bob allowed 230
    expect(p.finish).toBe('—');              // in season
    expect(p.teamName).toBe('Team Alice');
  });

  it('builds the schedule with league averages and high/low flags', () => {
    expect(p.weeks.map((w) => [w.week, w.opponentId, w.points, w.oppPoints, w.result, w.leagueAvg, w.high, w.low])).toEqual([
      [1, 'b', 120, 90, 'W', 97.5, true, false],
      [2, 'c', 95, 130, 'L', 101.3, false, true],
    ]);
    expect(p.ppw).toBe(107.5);
    expect(p.leagueAvgPpw).toBe(99.4);
    expect(p.longestWinStreak).toBe(1);
    expect(p.benchLeft).toBe(20);            // fixture ceiling is points + 10 per game
    expect(p.weeksPlayed).toBe(2);
  });

  it('splits points by position with league share and rank', () => {
    const qb = p.positions.find((x) => x.pos === 'QB')!;
    expect(qb.started).toBe(40);
    expect(qb.rank).toBe(1);
    expect(qb.players[0]).toMatchObject({ playerId: 'q1', starts: 2, started: 40, high: 20, bench: 0 });
    const wr = p.positions.find((x) => x.pos === 'WR')!;
    expect(wr.started).toBe(0);
    expect(wr.players).toEqual([]);
    expect(p.neverStarted.map((x) => [x.playerId, x.bench])).toEqual([['w1', 14]]);
    expect(qb.share).toBeCloseTo(40 / 60, 5);
  });

  it("collects the manager's moves, FAAB and best pickup", () => {
    expect(p.moves.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(p.faab).toBe(12);
    expect(p.bestPickup).toMatchObject({ playerId: 'r1', starts: 2, points: 20, bid: null });
  });
});

describe('longestWinStreak', () => {
  it('counts consecutive wins in week order', () => {
    const mk = (week: number, result: 'W' | 'L') => ({ year: 2025, week, result } as Parameters<typeof longestWinStreak>[0][number]);
    expect(longestWinStreak([mk(3, 'W'), mk(1, 'W'), mk(2, 'W'), mk(4, 'L'), mk(5, 'W')])).toBe(3);
    expect(longestWinStreak([])).toBe(0);
  });
});

describe('fieldedAs', () => {
  it('groups contiguous seasons under the same team name, newest first', () => {
    const mk = (year: number, teamName: string | null): Season => ({ ...build(), year, managers: { a: { userId: 'a', displayName: 'alice', teamName, avatar: null, rosterId: 1 } } });
    expect(fieldedAs([mk(2023, 'Old'), mk(2024, 'Old'), mk(2025, 'New'), mk(2026, null)], 'a')).toEqual([
      { teamName: 'alice', from: 2026, to: 2026 }, { teamName: 'New', from: 2025, to: 2025 }, { teamName: 'Old', from: 2023, to: 2024 },
    ]);
  });
});

describe('franchisePlayers', () => {
  it('ranks by weeks rostered then points started', () => {
    const lines = flattenLines([build()], players);
    const top = franchisePlayers(lines, 'a', 6);
    expect(top.map((f) => [f.playerId, f.weeks, f.starts, f.started])).toEqual([['q1', 2, 2, 40], ['r1', 2, 2, 20], ['w1', 2, 0, 0]]);
    expect(top[0]).toMatchObject({ from: 2025, to: 2025, seasons: 1, high: 20, position: 'QB' });
  });
});

describe('careerProfile', () => {
  const s = build();
  s.status = 'complete';
  s.honors = { champion: 'c', runnerUp: 'a', third: null, pointsTitle: 'c', lastPlace: 'b' };
  const history = {
    seasons: [], managers: { a: { displayName: 'alice', avatar: null, seasons: [2025] } },
    h2h: {
      'a|b': { a: 'a', b: 'b', aWins: 1, bWins: 0, ties: 0, streak: { holder: 'a', length: 1 }, totalPoints: { a: 120, b: 90 }, biggestWin: null, closest: null, avgMargin: 30, games: [{ gameId: '2025-1-1', year: 2025, week: 1, tag: null, aPoints: 120, bPoints: 90 }] },
      'a|c': { a: 'a', b: 'c', aWins: 0, bWins: 1, ties: 0, streak: { holder: 'c', length: 1 }, totalPoints: { a: 95, b: 130 }, biggestWin: null, closest: null, avgMargin: 35, games: [{ gameId: '2025-2-1', year: 2025, week: 2, tag: null, aPoints: 95, bPoints: 130 }] },
    },
    allTime: [{ userId: 'a', rank: 2, titles: 0, playoffApps: 1 }], topDraftValues: [], worstDraftValues: [],
  } as unknown as History;
  const c = careerProfile([s], history, 'a', players);

  it('summarises each season and the honors won', () => {
    expect(c.seasons).toHaveLength(1);
    expect(c.seasons[0]).toMatchObject({ year: 2025, teamName: 'Team Alice', finish: '2nd', runnerUp: true, champion: false, ppw: 107.5, moves: 2 });
    expect(c.honors).toEqual({ champion: [], runnerUp: [2025], third: [], pointsTitle: [], lastPlace: [] });
    expect(c.longestWinStreak).toBe(1);
    expect(c.bestFinish).toBe('2nd');
    expect(c.record).toEqual({ w: 1, l: 1, t: 0 });
  });

  it('lists rivalries from the manager\'s point of view with the current streak, winners first', () => {
    expect(c.rivalries.map((r) => [r.opponentId, r.w, r.l, r.streak, r.winPct])).toEqual([['b', 1, 0, 1, 1], ['c', 0, 1, -1, 0]]);
  });

  it('fills the lineup desk from every game', () => {
    expect(c.lineup).toMatchObject({ weeks: 2, started: 215, possible: 235, benchLeft: 20 });
    expect(c.lineup.efficiency).toBeCloseTo(215 / 235, 4);
    expect(c.lineup.best?.week).toBe(1);    // 120 of 130 beats 95 of 105
    expect(c.lineup.worst?.benchPoints).toBe(10);   // every fixture game leaves 10 on the bench; the first one is kept
  });

  it('has no draft desk without a draft', () => {
    expect(c.draft).toBeNull();
    expect(c.franchise.map((f) => f.playerId)).toEqual(['q1', 'r1', 'w1']);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/teamProfile.test.ts`
Expected: FAIL — `Cannot find module './teamProfile'`.

- [ ] **Step 3: Write the library**

```ts path=packages/web/src/lib/teamProfile.ts
import type { DraftPick, History, PlayerDirectory, PlayerId, PlayoffTag, Season, SeasonStatus, StandingRow, Transaction, UserId, WLT } from '@fantasy-dash/core';
import { teamGamesOf, type TeamGame } from './managerGames';
import { letterGrade, managerDraftSummaries } from './draft';
import { flattenLines, type PlayerLine } from './playerLines';
import { waiverClaims } from './waivers';

export const PROFILE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
/** 1 + the number of values strictly better than mine. */
const rankOf = (mine: number, all: number[], better: (a: number, b: number) => boolean) => 1 + all.filter((v) => better(v, mine)).length;
const involves = (t: Transaction, userId: UserId) => t.adds.some((m) => m.userId === userId) || t.drops.some((m) => m.userId === userId);

/** `1st` / `2nd` / `3rd` / `Last` from honors for a complete season, else `#rank` (regular season); `—` before the season ends. */
export function finishLabel(season: Season, userId: UserId, rank: number | undefined): string {
  if (season.status !== 'complete' || rank === undefined) return '—';
  const h = season.honors;
  return h.champion === userId ? '1st' : h.runnerUp === userId ? '2nd' : h.third === userId ? '3rd' : h.lastPlace === userId ? 'Last' : `#${rank}`;
}

export interface WeekLine {
  week: number; tag: PlayoffTag | null; isPlayoff: boolean; matchupId: number;
  opponentId: UserId; points: number; oppPoints: number; result: 'W' | 'L' | 'T';
  /** mean score of every team that week */
  leagueAvg: number;
  high: boolean; low: boolean;
}

export interface PositionPlayer {
  playerId: PlayerId; position: string;
  /** points while in the starting lineup */
  started: number; starts: number; high: number;
  /** points while on the bench */
  bench: number;
  total: number;
}

export interface PositionGroup {
  pos: string;
  /** started points at this position */
  started: number;
  /** started + bench points */
  roster: number;
  /** share of this team's started points */
  share: number;
  /** share of the league's started points */
  leagueShare: number;
  /** rank of started points among the league's teams */
  rank: number;
  players: PositionPlayer[];
}

export interface SeasonProfile {
  year: number; userId: UserId; status: SeasonStatus; row: StandingRow | undefined; teams: number;
  teamName: string; displayName: string; avatar: string | null;
  scoringRank: number;
  /** 1 = most points allowed */
  pointsAllowedRank: number;
  finish: string; finishNote: string | null;
  draftSlot: number | null;
  faab: number;
  longestWinStreak: number;
  /** points the best lineup would have added, over every played game */
  benchLeft: number;
  /** points / ceiling over every played game */
  efficiency: number;
  weeks: WeekLine[];
  weeksPlayed: number;
  /** points per week, and the league's */
  ppw: number; leagueAvgPpw: number;
  positions: PositionGroup[];
  neverStarted: PositionPlayer[];
  picks: DraftPick[]; grade: string | null; draftValue: number | null; draftRank: number | null;
  moves: Transaction[];
  bestPickup: { playerId: PlayerId; points: number; starts: number; week: number; bid: number | null } | null;
}

/** Longest run of wins over games in chronological order. */
export function longestWinStreak(games: TeamGame[]): number {
  let best = 0, run = 0;
  for (const g of [...games].sort((a, b) => a.year - b.year || a.week - b.week)) {
    run = g.result === 'W' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Everything one manager's season page shows. */
export function seasonProfile(season: Season, userId: UserId, players: PlayerDirectory): SeasonProfile {
  const row = season.standings.find((r) => r.userId === userId);
  const rows = season.standings;
  const manager = season.managers[userId];
  const games = teamGamesOf([season]).filter((g) => g.userId === userId);
  const played = season.weeks.filter((w) => w.played);

  const weeks: WeekLine[] = games.map((g) => {
    const wk = season.weeks[g.week - 1];
    const all = wk.games.flatMap((x) => x.sides.map((s) => s.points));
    return {
      week: g.week, tag: g.tag, isPlayoff: g.isPlayoff, matchupId: g.matchupId, opponentId: g.opponentId,
      points: g.points, oppPoints: g.oppPoints, result: g.result, leagueAvg: round1(all.reduce((t, p) => t + p, 0) / Math.max(1, all.length)),
      high: false, low: false,
    };
  }).sort((a, b) => a.week - b.week);
  if (weeks.length > 0) {
    const max = Math.max(...weeks.map((w) => w.points)), min = Math.min(...weeks.map((w) => w.points));
    for (const w of weeks) { w.high = w.points === max; w.low = w.points === min && max !== min; }
  }
  const allSides = played.flatMap((w) => w.games.flatMap((g) => g.sides));
  const ppw = weeks.length ? round1(weeks.reduce((t, w) => t + w.points, 0) / weeks.length) : 0;
  const leagueAvgPpw = allSides.length ? round1(allSides.reduce((t, s) => t + s.points, 0) / allSides.length) : 0;

  // Points by position: this team's started/bench points per player, and the league's started points per position.
  const byPlayer = new Map<PlayerId, PositionPlayer>();
  const posOf = (id: PlayerId) => players[id]?.position ?? '?';
  const leagueStarted = new Map<string, Map<UserId, number>>();
  for (const wk of played) {
    for (const g of wk.games) {
      for (const sd of g.sides) {
        for (const e of sd.starters) {
          if (!e.player) continue;
          const pos = posOf(e.player.playerId);
          const m = leagueStarted.get(pos) ?? new Map<UserId, number>();
          m.set(sd.userId, (m.get(sd.userId) ?? 0) + e.player.points);
          leagueStarted.set(pos, m);
        }
        if (sd.userId !== userId) continue;
        const touch = (id: PlayerId) => byPlayer.get(id) ?? byPlayer.set(id, { playerId: id, position: posOf(id), started: 0, starts: 0, high: 0, bench: 0, total: 0 }).get(id)!;
        for (const e of sd.starters) {
          if (!e.player) continue;
          const p = touch(e.player.playerId);
          p.started += e.player.points; p.starts += 1; p.high = Math.max(p.high, e.player.points); p.total += e.player.points;
        }
        for (const l of sd.bench) { const p = touch(l.playerId); p.bench += l.points; p.total += l.points; }
      }
    }
  }
  for (const p of byPlayer.values()) { p.started = round2(p.started); p.bench = round2(p.bench); p.total = round2(p.total); p.high = round2(p.high); }
  const myStartedTotal = [...byPlayer.values()].reduce((t, p) => t + p.started, 0);
  const leagueStartedTotal = [...leagueStarted.values()].reduce((t, m) => t + [...m.values()].reduce((a, b) => a + b, 0), 0);
  const positions: PositionGroup[] = PROFILE_POSITIONS.map((pos) => {
    const mine = [...byPlayer.values()].filter((p) => p.position === pos && p.starts > 0).sort((a, b) => b.started - a.started || b.total - a.total);
    const started = round2(mine.reduce((t, p) => t + p.started, 0));
    const roster = round2([...byPlayer.values()].filter((p) => p.position === pos).reduce((t, p) => t + p.total, 0));
    const league = leagueStarted.get(pos) ?? new Map<UserId, number>();
    const leaguePos = [...league.values()].reduce((a, b) => a + b, 0);
    return {
      pos, started, roster,
      share: myStartedTotal > 0 ? started / myStartedTotal : 0,
      leagueShare: leagueStartedTotal > 0 ? leaguePos / leagueStartedTotal : 0,
      rank: rankOf(started, [...league.values()], (a, b) => a > b),
      players: mine,
    };
  });
  const neverStarted = [...byPlayer.values()].filter((p) => p.starts === 0).sort((a, b) => b.total - a.total);

  const draft = season.draft;
  const picks = draft ? draft.picks.filter((p) => p.userId === userId).sort((a, b) => a.pickNo - b.pickNo) : [];
  const summaries = draft ? managerDraftSummaries(draft) : [];
  const draftIdx = summaries.findIndex((s) => s.userId === userId);
  const graded = draftIdx >= 0 && summaries[draftIdx].valued > 0;

  const moves = season.transactions.filter((t) => involves(t, userId)).sort((a, b) => b.created - a.created);
  const faab = moves.filter((t) => t.type === 'waiver' && t.adds.some((m) => m.userId === userId)).reduce((t, x) => t + (x.bid ?? 0), 0);
  const claims = waiverClaims([{ year: season.year, transactions: season.transactions }], flattenLines([season], players)).filter((c) => c.userId === userId && c.starts > 0);
  const best = claims.sort((a, b) => b.points - a.points || a.week - b.week)[0];

  const h = season.honors;
  const finishNote = season.status !== 'complete' ? null
    : h.champion === userId ? 'Champion' : h.runnerUp === userId ? 'Runner-up' : h.third === userId ? 'Third place' : h.lastPlace === userId ? 'Toilet bowl' : 'Regular-season rank';
  const ceilingTotal = games.reduce((t, g) => t + g.ceiling, 0);
  const slot = draft ? draft.slotOrder.indexOf(userId) : -1;
  return {
    year: season.year, userId, status: season.status, row, teams: rows.length,
    teamName: manager?.teamName ?? manager?.displayName ?? userId, displayName: manager?.displayName ?? userId, avatar: manager?.avatar ?? null,
    scoringRank: row ? rankOf(row.pf, rows.map((r) => r.pf), (a, b) => a > b) : rows.length,
    pointsAllowedRank: row ? rankOf(row.pa, rows.map((r) => r.pa), (a, b) => a > b) : rows.length,
    finish: finishLabel(season, userId, row?.rank), finishNote,
    draftSlot: slot >= 0 ? slot + 1 : null,
    faab,
    longestWinStreak: longestWinStreak(games),
    benchLeft: round1(games.reduce((t, g) => t + g.benchPoints, 0)),
    efficiency: ceilingTotal > 0 ? games.reduce((t, g) => t + g.points, 0) / ceilingTotal : 0,
    weeks, weeksPlayed: weeks.length, ppw, leagueAvgPpw,
    positions, neverStarted,
    picks,
    grade: graded ? letterGrade(draftIdx + 1, summaries.length) : null,
    draftValue: graded ? summaries[draftIdx].totalValue : null,
    draftRank: graded ? draftIdx + 1 : null,
    moves,
    bestPickup: best ? { playerId: best.playerId, points: best.points, starts: best.starts, week: best.week, bid: best.bid } : null,
  };
}

export interface FieldedAs { teamName: string; from: number; to: number }

/** Distinct team names with the contiguous year ranges they covered, newest first. */
export function fieldedAs(seasons: Season[], userId: UserId): FieldedAs[] {
  const out: FieldedAs[] = [];
  for (const s of [...seasons].sort((a, b) => a.year - b.year)) {
    const m = s.managers[userId];
    if (!m) continue;
    const teamName = m.teamName ?? m.displayName;
    const last = out[out.length - 1];
    if (last && last.teamName === teamName && last.to === s.year - 1) last.to = s.year;
    else out.push({ teamName, from: s.year, to: s.year });
  }
  return out.reverse();
}

export interface FranchisePlayer {
  playerId: PlayerId; position: string; from: number; to: number; seasons: number;
  /** distinct weeks on the roster */
  weeks: number;
  starts: number;
  /** points while started */
  started: number;
  high: number;
}

/** Longest tenures, biggest production: ranked on weeks rostered, then points started. */
export function franchisePlayers(lines: PlayerLine[], userId: UserId, n = 6): FranchisePlayer[] {
  const acc = new Map<PlayerId, FranchisePlayer & { weekKeys: Set<string>; years: Set<number> }>();
  for (const l of lines) {
    if (l.userId !== userId) continue;
    const f = acc.get(l.playerId) ?? acc.set(l.playerId, { playerId: l.playerId, position: l.position, from: l.year, to: l.year, seasons: 0, weeks: 0, starts: 0, started: 0, high: 0, weekKeys: new Set(), years: new Set() }).get(l.playerId)!;
    f.weekKeys.add(`${l.year}-${l.week}`); f.years.add(l.year);
    f.from = Math.min(f.from, l.year); f.to = Math.max(f.to, l.year);
    if (l.started) { f.starts += 1; f.started += l.points; f.high = Math.max(f.high, l.points); }
  }
  return [...acc.values()]
    .map(({ weekKeys, years, ...f }) => ({ ...f, weeks: weekKeys.size, seasons: years.size, started: round2(f.started), high: round2(f.high) }))
    .sort((a, b) => b.weeks - a.weeks || b.started - a.started || (a.playerId < b.playerId ? -1 : 1))
    .slice(0, n);
}

export interface LineupDesk {
  weeks: number; efficiency: number; started: number; possible: number; benchLeft: number;
  /** highest-efficiency game */
  best: TeamGame | null;
  /** most bench points left */
  worst: TeamGame | null;
}

export function lineupDesk(games: TeamGame[]): LineupDesk {
  const played = games.filter((g) => g.ceiling > 0);
  const started = round2(played.reduce((t, g) => t + g.points, 0));
  const possible = round2(played.reduce((t, g) => t + g.ceiling, 0));
  const eff = (g: TeamGame) => g.points / g.ceiling;
  return {
    weeks: played.length, efficiency: possible > 0 ? started / possible : 0, started, possible,
    benchLeft: round1(played.reduce((t, g) => t + g.benchPoints, 0)),
    best: played.reduce<TeamGame | null>((b, g) => (!b || eff(g) > eff(b) ? g : b), null),
    worst: played.reduce<TeamGame | null>((b, g) => (!b || g.benchPoints > b.benchPoints ? g : b), null),
  };
}

export interface DraftSeason { year: number; grade: string; value: number; rank: number; teams: number }
export interface DraftDesk {
  drafts: number; avgGrade: string; valuePerDraft: number; career: number;
  best: DraftSeason | null;
  steal: (DraftPick & { year: number; teams: number }) | null;
  hurt: (DraftPick & { year: number; teams: number }) | null;
  seasons: DraftSeason[];
}

/** Career draft summary over every graded draft; null when none is graded. */
export function draftDesk(seasons: Season[], userId: UserId): DraftDesk | null {
  const lines: DraftSeason[] = [];
  let steal: DraftDesk['steal'] = null, hurt: DraftDesk['hurt'] = null;
  for (const s of seasons) {
    if (!s.draft) continue;
    const summaries = managerDraftSummaries(s.draft);
    const idx = summaries.findIndex((x) => x.userId === userId);
    if (idx < 0 || summaries[idx].valued === 0) continue;
    lines.push({ year: s.year, grade: letterGrade(idx + 1, summaries.length), value: summaries[idx].totalValue, rank: idx + 1, teams: summaries.length });
    for (const p of s.draft.picks) {
      if (p.userId !== userId || p.value === null) continue;
      const tagged = { ...p, year: s.year, teams: s.draft.slotOrder.length };
      if (!steal || p.value > steal.value!) steal = tagged;
      if (!hurt || p.value < hurt.value!) hurt = tagged;
    }
  }
  if (lines.length === 0) return null;
  const career = round1(lines.reduce((t, l) => t + l.value, 0));
  const meanRank = lines.reduce((t, l) => t + l.rank, 0) / lines.length;
  const meanTeams = lines.reduce((t, l) => t + l.teams, 0) / lines.length;
  return {
    drafts: lines.length, avgGrade: letterGrade(Math.round(meanRank), Math.round(meanTeams)), valuePerDraft: round1(career / lines.length), career,
    best: [...lines].sort((a, b) => b.value - a.value)[0] ?? null, steal, hurt, seasons: lines,
  };
}

export interface CareerSeasonLine {
  year: number; status: SeasonStatus; row: StandingRow | undefined; teamName: string;
  finish: string; champion: boolean; runnerUp: boolean; third: boolean; pointsTitle: boolean; lastPlace: boolean; playoffBerth: boolean;
  ppw: number; leagueAvgPpw: number;
  grade: string | null; draftValue: number | null;
  moves: number;
}

export interface Rivalry {
  opponentId: UserId; w: number; l: number; t: number; pf: number; pa: number;
  games: number; winPct: number;
  /** my consecutive wins (positive) or losses (negative) at the end of the series */
  streak: number;
}

export interface CareerProfile {
  userId: UserId; name: string; avatar: string | null;
  allTime: History['allTime'][number] | undefined; managers: number;
  record: WLT; winPct: number; pf: number; pa: number;
  playoffApps: number; titles: number; bestFinish: string;
  fieldedAs: FieldedAs[];
  seasons: CareerSeasonLine[];
  honors: Record<'champion' | 'runnerUp' | 'third' | 'pointsTitle' | 'lastPlace', number[]>;
  rivalries: Rivalry[];
  lineup: LineupDesk;
  draft: DraftDesk | null;
  franchise: FranchisePlayer[];
  longestWinStreak: number;
  weekHighs: number;
}

const FINISH_ORDER = ['1st', '2nd', '3rd'];
/** podium first, then seeds by number, Last at the end */
const finishKey = (f: string) => (FINISH_ORDER.includes(f) ? FINISH_ORDER.indexOf(f) : f === 'Last' ? 1000 : 10 + (parseInt(f.replace('#', ''), 10) || 999));

/** Everything one manager's career page shows. */
export function careerProfile(seasons: Season[], history: History, userId: UserId, players: PlayerDirectory): CareerProfile {
  const games = teamGamesOf(seasons).filter((g) => g.userId === userId);
  const mine = seasons.filter((s) => s.standings.some((r) => r.userId === userId)).sort((a, b) => b.year - a.year);
  const lines: CareerSeasonLine[] = mine.map((s) => {
    const row = s.standings.find((r) => r.userId === userId);
    const h = s.honors;
    const my = games.filter((g) => g.year === s.year);
    const all = s.weeks.filter((w) => w.played).flatMap((w) => w.games.flatMap((g) => g.sides.map((x) => x.points)));
    const summaries = s.draft ? managerDraftSummaries(s.draft) : [];
    const idx = summaries.findIndex((x) => x.userId === userId);
    const graded = idx >= 0 && summaries[idx].valued > 0;
    const m = s.managers[userId];
    return {
      year: s.year, status: s.status, row, teamName: m?.teamName ?? m?.displayName ?? userId, finish: finishLabel(s, userId, row?.rank),
      champion: h.champion === userId, runnerUp: h.runnerUp === userId, third: h.third === userId, pointsTitle: h.pointsTitle === userId, lastPlace: h.lastPlace === userId,
      playoffBerth: s.brackets.winners.some((b) => b.home === userId || b.away === userId),
      ppw: my.length ? round1(my.reduce((t, g) => t + g.points, 0) / my.length) : 0,
      leagueAvgPpw: all.length ? round1(all.reduce((t, p) => t + p, 0) / all.length) : 0,
      grade: graded ? letterGrade(idx + 1, summaries.length) : null,
      draftValue: graded ? summaries[idx].totalValue : null,
      moves: s.transactions.filter((t) => involves(t, userId)).length,
    };
  });
  const honors = { champion: [] as number[], runnerUp: [] as number[], third: [] as number[], pointsTitle: [] as number[], lastPlace: [] as number[] };
  for (const l of lines) for (const k of Object.keys(honors) as (keyof typeof honors)[]) if (l[k]) honors[k].push(l.year);

  const rivalries: Rivalry[] = Object.values(history.h2h)
    .filter((s) => s.a === userId || s.b === userId)
    .map((s) => {
      const me = s.a === userId;
      const ordered = [...s.games].sort((x, y) => x.year - y.year || x.week - y.week);
      let streak = 0;
      for (const g of ordered) {
        const my = me ? g.aPoints : g.bPoints, their = me ? g.bPoints : g.aPoints;
        const r = my > their ? 1 : my < their ? -1 : 0;
        streak = r === 0 ? 0 : (Math.sign(streak) === r ? streak + r : r);
      }
      const w = me ? s.aWins : s.bWins, l = me ? s.bWins : s.aWins, t = s.ties;
      const n = w + l + t;
      return { opponentId: me ? s.b : s.a, w, l, t, pf: me ? s.totalPoints.a : s.totalPoints.b, pa: me ? s.totalPoints.b : s.totalPoints.a, games: n, winPct: n ? (w + t / 2) / n : 0, streak };
    })
    .filter((r) => r.games > 0)
    .sort((x, y) => y.winPct - x.winPct || y.games - x.games || (x.opponentId < y.opponentId ? -1 : 1));

  const rows = lines.map((l) => l.row).filter((r): r is StandingRow => r !== undefined);
  const record: WLT = { w: rows.reduce((t, r) => t + r.w, 0), l: rows.reduce((t, r) => t + r.l, 0), t: rows.reduce((t, r) => t + r.t, 0) };
  const played = record.w + record.l + record.t;
  const finishes = lines.map((l) => l.finish).filter((f) => f !== '—');
  const bestFinish = finishes.sort((a, b) => finishKey(a) - finishKey(b))[0] ?? '—';

  const m = history.managers[userId];
  return {
    userId, name: m?.displayName ?? userId, avatar: m?.avatar ?? null,
    allTime: history.allTime.find((r) => r.userId === userId), managers: history.allTime.length,
    record, winPct: played ? (record.w + record.t / 2) / played : 0,
    pf: round2(rows.reduce((t, r) => t + r.pf, 0)), pa: round2(rows.reduce((t, r) => t + r.pa, 0)),
    playoffApps: lines.filter((l) => l.playoffBerth).length, titles: honors.champion.length, bestFinish,
    fieldedAs: fieldedAs(seasons, userId),
    seasons: lines,
    honors,
    rivalries,
    lineup: lineupDesk(games),
    draft: draftDesk(seasons, userId),
    franchise: franchisePlayers(flattenLines(seasons, players), userId, 6),
    longestWinStreak: longestWinStreak(games),
    weekHighs: games.filter((g) => g.weekHigh).length,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/teamProfile.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/teamProfile.ts packages/web/src/lib/teamProfile.test.ts
git commit -m "Team and manager profile computations"
```

---

### Task 2: Manager record placements and the gold token

**Files:**
- Create: `packages/web/src/lib/managerRecords.ts`
- Test: `packages/web/src/lib/managerRecords.test.ts`
- Modify: `packages/web/src/index.css` (add `--gold` next to `--warn` in both palettes and `--color-gold` in `@theme`)

**Interfaces:**
- Consumes: `boardsFor`, `BoardContext`, `championsOf`, `lastPlacesOf`, `draftValuesOf` (`lib/playerBoards.ts`), `subTabsOf` (`lib/boards/tabs.ts`), `flattenLines`, `fitXfp`, `teamGamesOf`, `managerSeasonsOf`.
- Produces: `allTimeContext(seasons, players, managers): BoardContext`, `managerRecords(ctx, userId, maxRank = 3): ManagerRecord[]` with `ManagerRecord { sub, subTitle, boardId, title, rank, valueLabel, meta, detail }`.

- [ ] **Step 1: Write the failing test**

```ts path=packages/web/src/lib/managerRecords.test.ts
import type { History } from '@fantasy-dash/core';
import { allTimeContext, managerRecords } from './managerRecords';
import { game, line, players, season, side, standing, week } from '../test/playerFixtures';

const s = season(2024, [
  week(1, [game(2024, 1, 1, side('a', 150, [line('q1', 30)]), side('b', 90, [line('r1', 10)]))]),
  week(2, [game(2024, 2, 1, side('a', 140, [line('q1', 28)]), side('b', 95, [line('r1', 12)]))]),
]);
s.standings = [standing('a', 1, 2, 0, 0, 290, 185), standing('b', 2, 0, 2, 0, 185, 290)];
s.honors = { champion: 'a', runnerUp: 'b', third: null, pointsTitle: 'a', lastPlace: 'b' };
const managers: History['managers'] = { a: { displayName: 'alice', avatar: null, seasons: [2024] }, b: { displayName: 'bob', avatar: null, seasons: [2024] } };

describe('managerRecords', () => {
  const ctx = allTimeContext([s], players, managers);

  it('keeps the boards where the manager ranks in the top three, grouped by sub-tab', () => {
    const recs = managerRecords(ctx, 'a');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.rank >= 1 && r.rank <= 3)).toBe(true);
    const wins = recs.find((r) => r.boardId === 'mCareerWins');
    expect(wins).toMatchObject({ sub: 'malltime', subTitle: 'All-time', rank: 1, valueLabel: '2' });
  });

  it('ranks the other manager second on the same board', () => {
    expect(managerRecords(ctx, 'b').find((r) => r.boardId === 'mCareerWins')).toBeUndefined();   // bob has 0 wins, no row
    expect(managerRecords(ctx, 'b').find((r) => r.boardId === 'mCareerPoints')).toMatchObject({ rank: 2 });
  });

  it('honours maxRank', () => {
    expect(managerRecords(ctx, 'b', 1).every((r) => r.rank === 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/managerRecords.test.ts`
Expected: FAIL — `Cannot find module './managerRecords'`.

- [ ] **Step 3: Write the library and the gold token**

```ts path=packages/web/src/lib/managerRecords.ts
import type { History, PlayerDirectory, Season, UserId } from '@fantasy-dash/core';
import { boardsFor, championsOf, draftValuesOf, lastPlacesOf, type BoardContext } from './playerBoards';
import { subTabsOf } from './boards/tabs';
import { managerSeasonsOf, teamGamesOf } from './managerGames';
import { flattenLines } from './playerLines';
import { fitXfp } from './xfp';

export interface ManagerRecord {
  sub: string; subTitle: string; boardId: string; title: string;
  rank: number; valueLabel: string; meta: string; detail: string | null;
}

/** The Records page's all-time, all-positions context. */
export function allTimeContext(seasons: Season[], players: PlayerDirectory, managers: History['managers']): BoardContext {
  const lines = flattenLines(seasons, players);
  const teamGames = teamGamesOf(seasons);
  return {
    lines, players, champions: championsOf(seasons), lastPlaces: lastPlacesOf(seasons), year: null,
    currentYear: Math.max(...seasons.map((s) => s.year)), pos: 'All', picks: draftValuesOf(seasons), xfp: fitXfp(lines),
    transactions: seasons.map((s) => ({ year: s.year, transactions: s.transactions })),
    playerSeasons: Object.fromEntries(seasons.map((s) => [s.year, s.playerSeasons])),
    drafts: Object.fromEntries(seasons.map((s) => [s.year, s.draft])),
    teamGames, managerSeasons: managerSeasonsOf(seasons, teamGames), managers,
  };
}

/** Every manager board (default direction and mode) on which the manager's own row sits at rank ≤ maxRank, in Records-page order. */
export function managerRecords(ctx: BoardContext, userId: UserId, maxRank = 3): ManagerRecord[] {
  const out: ManagerRecord[] = [];
  for (const sub of subTabsOf('managers')) {
    for (const def of boardsFor('managers', sub.id)) {
      const rows = def.compute(ctx);
      const idx = rows.findIndex((r) => r.playerId === null && r.userId === userId);
      if (idx < 0 || idx >= maxRank) continue;
      const r = rows[idx];
      out.push({ sub: sub.id, subTitle: sub.title, boardId: def.id, title: def.title, rank: idx + 1, valueLabel: r.valueLabel, meta: r.meta, detail: r.detail });
    }
  }
  return out;
}
```

In `packages/web/src/index.css`, add a gold token beside `--warn` in the dark palette (`--gold: #e3b341;`), in the light palette (`--gold: #b8860b;`), and `--color-gold: var(--gold);` inside `@theme inline` after `--color-warn`.

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/lib/managerRecords.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/managerRecords.ts packages/web/src/lib/managerRecords.test.ts packages/web/src/index.css
git commit -m "Manager record placements from the record boards; gold token"
```

---

### Task 3: Team page cards

**Files:**
- Create: `packages/web/src/components/teams/ProfileHeader.tsx`, `SeasonShape.tsx`, `Schedule.tsx`, `TeamPicks.tsx`, `RosterBreakdown.tsx`, `TeamMoves.tsx`
- Test: `packages/web/src/components/teams/RosterBreakdown.test.tsx`, `Schedule.test.tsx`

**Interfaces:**
- Consumes: Task 1 types; `Avatar`, `Headshot`, `PosPill`, `playerName`, `playerTeam`, `posColor`, `fmtPts`, `fmtSigned`, `fmtTag`, `pickLabel`, `signClass` (`components/draft/DraftAnalysis`).
- Produces: the six components with the props shown.

- [ ] **Step 1: Write the failing tests**

```tsx path=packages/web/src/components/teams/RosterBreakdown.test.tsx
import { render, screen, within } from '@testing-library/react';
import RosterBreakdown from './RosterBreakdown';
import { players } from '../../test/playerFixtures';
import type { PositionGroup, PositionPlayer } from '../../lib/teamProfile';

const pp = (playerId: string, position: string, started: number, starts: number, bench = 0): PositionPlayer => ({ playerId, position, started, starts, high: started, bench, total: started + bench });
const groups: PositionGroup[] = [
  { pos: 'QB', started: 60, roster: 60, share: 0.6, leagueShare: 0.3, rank: 1, players: [pp('q1', 'QB', 60, 4)] },
  { pos: 'RB', started: 40, roster: 52, share: 0.4, leagueShare: 0.5, rank: 3, players: [pp('r1', 'RB', 40, 2, 12)] },
  { pos: 'WR', started: 0, roster: 0, share: 0, leagueShare: 0.2, rank: 5, players: [] },
  { pos: 'TE', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
  { pos: 'K', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
  { pos: 'DEF', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
];

describe('RosterBreakdown', () => {
  it('draws the share bar, rank chips and position cards with started-most-weeks rows and never-started lists', () => {
    render(<RosterBreakdown positions={groups} neverStarted={[pp('w1', 'WR', 0, 0, 9)]} players={players} seasonTeams={{ q1: 'NYG' }} weeksPlayed={4} />);
    expect(screen.getByTestId('share-QB')).toHaveTextContent('QB 60%');
    expect(screen.getByTestId('share-QB').style.width).toBe('60%');
    expect(screen.getByTestId('rank-QB')).toHaveTextContent('QB 1');
    expect(screen.getByTestId('rank-RB')).toHaveTextContent('RB 3');
    const qb = screen.getByTestId('group-QB');
    expect(within(qb).getByText('Quincy One')).toBeInTheDocument();
    expect(within(qb).getByText('NYG')).toBeInTheDocument();
    expect(within(qb).getByText('Quincy One').closest('li')).toHaveAttribute('data-regular', 'true');   // 4 of 4 weeks
    const rb = screen.getByTestId('group-RB');
    expect(within(rb).getByText('Ricky One').closest('li')).toHaveAttribute('data-regular', 'true');    // 2 of 4 weeks is the threshold
    const wr = screen.getByTestId('group-WR');
    expect(within(wr).getByText('Never started')).toBeInTheDocument();
    expect(within(wr).getByText('Wally One')).toBeInTheDocument();
  });
});
```

```tsx path=packages/web/src/components/teams/Schedule.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Manager } from '@fantasy-dash/core';
import Schedule from './Schedule';
import type { WeekLine } from '../../lib/teamProfile';

const managers: Record<string, Manager> = { b: { userId: 'b', displayName: 'bob', teamName: 'Bobcats', avatar: null, rosterId: 2 }, c: { userId: 'c', displayName: 'cara', teamName: null, avatar: null, rosterId: 3 } };
const weeks: WeekLine[] = [
  { week: 1, tag: null, isPlayoff: false, matchupId: 1, opponentId: 'b', points: 120, oppPoints: 90, result: 'W', leagueAvg: 100, high: true, low: false },
  { week: 15, tag: 'SF', isPlayoff: true, matchupId: 2, opponentId: 'c', points: 95, oppPoints: 130, result: 'L', leagueAvg: 100, high: false, low: true },
];

describe('Schedule', () => {
  it('lists each game with opponent, bold own score, high/low marks, result pill and box score link', () => {
    render(<MemoryRouter><Schedule weeks={weeks} managers={managers} year={2025} /></MemoryRouter>);
    const rows = screen.getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/scores/2025/1/1', '/scores/2025/15/2']);
    expect(rows[0]).toHaveTextContent('Bobcats');
    expect(rows[0]).toHaveTextContent('▲');
    expect(rows[0]).toHaveTextContent('W');
    expect(rows[1]).toHaveTextContent('cara');
    expect(rows[1]).toHaveTextContent('Semifinal');
    expect(rows[1]).toHaveTextContent('▼');
  });

  it('says so when nothing has been played', () => {
    render(<MemoryRouter><Schedule weeks={[]} managers={managers} year={2025} /></MemoryRouter>);
    expect(screen.getByText('No games played yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/teams`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the components**

```tsx path=packages/web/src/components/teams/ProfileHeader.tsx
import type { ReactNode } from 'react';
import Avatar from '../Avatar';

export interface Tile { label: string; value: string; sub?: string | null }

interface Props {
  avatar: string | null; name: string;
  eyebrow: ReactNode; title: string; subtitle?: ReactNode;
  badges: ReactNode[];
  tiles: Tile[];
  /** row under the tiles, e.g. "Fielded as" chips */
  chips?: ReactNode;
  /** muted footer strip */
  strip?: ReactNode;
}

/** The big profile card at the top of a team or manager page: avatar, titles, badge line, 3×2 stat tiles, optional chip row and footer strip. */
export default function ProfileHeader({ avatar, name, eyebrow, title, subtitle, badges, tiles, chips, strip }: Props) {
  return (
    <header className="card overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <Avatar avatar={avatar} name={name} size={84} />
          <div className="min-w-0">
            <div className="section-label flex flex-wrap items-center gap-x-2">{eyebrow}</div>
            <h1 className="mt-1 line-clamp-2 text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]" title={title}>{title}</h1>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{badges.map((b, i) => <span key={i}>{b}</span>)}</div>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="min-w-[5.5rem] rounded-lg border border-line px-3 py-2 text-center">
              <dt className="section-label text-[10px]">{t.label}</dt>
              <dd className="num mt-0.5 text-xl font-semibold leading-tight">{t.value}</dd>
              {t.sub && <dd className="truncate text-[10px] text-muted">{t.sub}</dd>}
            </div>
          ))}
        </dl>
      </div>
      {chips && <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-2.5 text-xs sm:px-6">{chips}</div>}
      {strip && <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line bg-surface-2 px-5 py-2 text-xs text-muted sm:px-6">{strip}</div>}
    </header>
  );
}
```

```tsx path=packages/web/src/components/teams/SeasonShape.tsx
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPpg } from '../../lib/format';

export interface ShapePoint { label: string; mine: number; league: number }

interface Props { label: string; points: ShapePoint[]; mineCaption: string; leagueCaption: string; /** twice as wide for a wide column */ wide?: boolean }

const H = 110, PAD = 10;

/** Small line chart: the team's points per period (accent, dotted) against the league average (dashed). */
export default function SeasonShape({ label, points, mineCaption, leagueCaption, wide = false }: Props) {
  const W = wide ? 720 : 320;
  const values = points.flatMap((p) => [p.mine, p.league]);
  const min = Math.min(...values, Infinity), max = Math.max(...values, -Infinity);
  const span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? PAD + (i * (W - 2 * PAD)) / (points.length - 1) : W / 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const path = (pick: (p: ShapePoint) => number) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  return (
    <section className="card">
      <CardHeader label={label} title="Season shape" />
      {points.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nothing played yet.</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Points by week against the league average">
            <path d={path((p) => p.league)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
            <path d={path((p) => p.mine)} fill="none" stroke="var(--accent)" strokeWidth="2" />
            {points.map((p, i) => (
              <circle key={p.label} cx={x(i)} cy={y(p.mine)} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5">
                <title>{p.label}: {fmtPpg(p.mine)} (league {fmtPpg(p.league)})</title>
              </circle>
            ))}
          </svg>
          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
            <span><span className="num font-semibold text-ink">{mineCaption.split(' ')[0]}</span> {mineCaption.slice(mineCaption.indexOf(' ') + 1)}</span>
            <span><span aria-hidden="true">┄ </span>{leagueCaption}</span>
          </div>
        </>
      )}
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/Schedule.tsx
import { Link } from 'react-router';
import type { Manager, UserId } from '@fantasy-dash/core';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts, fmtTag } from '../../lib/format';
import type { WeekLine } from '../../lib/teamProfile';

interface Props { weeks: WeekLine[]; managers: Record<UserId, Manager>; year: number }

const pill = (r: 'W' | 'L' | 'T') => r === 'W' ? 'bg-win/15 text-win' : r === 'L' ? 'bg-loss/15 text-loss' : 'bg-surface-2 text-muted';

/** One row per played game, newest at the bottom, each opening the box score. */
export default function Schedule({ weeks, managers, year }: Props) {
  return (
    <section className="card">
      <CardHeader label={String(year)} title="Schedule" />
      {weeks.length === 0 ? <p className="px-4 py-3 text-xs text-muted">No games played yet.</p> : (
        <ul className="divide-y divide-line">
          {weeks.map((w) => {
            const opp = managers[w.opponentId];
            return (
              <li key={w.week}>
                <Link to={`/scores/${year}/${w.week}/${w.matchupId}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto_1.75rem] items-center gap-x-3 px-4 py-2 text-sm hover:bg-surface-2">
                  <span className="num text-xs text-muted">{w.week}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{opp?.teamName ?? opp?.displayName ?? w.opponentId}</span>
                    {w.tag && <span className="block text-[10px] font-semibold uppercase tracking-wide text-accent">{fmtTag(w.tag)}</span>}
                  </span>
                  <span className="num whitespace-nowrap text-right">
                    {w.high && <span className="mr-1 text-[10px] text-win" aria-label="Season high">▲</span>}
                    {w.low && <span className="mr-1 text-[10px] text-loss" aria-label="Season low">▼</span>}
                    <span className="font-semibold">{fmtPts(w.points)}</span><span className="text-muted">–{fmtPts(w.oppPoints)}</span>
                  </span>
                  <span className={`num rounded px-1.5 py-0.5 text-center text-xs font-semibold ${pill(w.result)}`}>{w.result}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/TeamPicks.tsx
import { Link } from 'react-router';
import type { DraftPick, PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { CardHeader, signClass } from '../draft/DraftAnalysis';
import { fmtSigned } from '../../lib/format';
import { pickLabel } from '../../lib/draft';
import { playerName, playerPos, playerTeam } from '../../lib/players';

interface Props { picks: DraftPick[]; teams: number; grade: string | null; value: number | null; year: number; players: PlayerDirectory; seasonTeams: Record<PlayerId, string> }

/** The manager's draft, pick by pick, with the rank-based grade and each pick's value. */
export default function TeamPicks({ picks, teams, grade, value, year, players, seasonTeams }: Props) {
  return (
    <section className="card">
      <CardHeader
        label={`${year} draft`} title="Picks"
        aside={grade && <span className="flex items-baseline gap-2"><span className={`num text-sm font-semibold ${signClass(value)}`}>{value === null ? '' : fmtSigned(value, 0)}</span><span className="rounded bg-ink px-2 py-0.5 text-base font-bold text-bg">{grade}</span></span>}
      />
      <ul className="divide-y divide-line">
        {picks.map((p) => (
          <li key={p.pickNo} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="num w-9 text-xs text-muted">{pickLabel(p, teams)}</span>
            <Headshot players={players} id={p.playerId} size={26} />
            <PosPill pos={playerPos(players, p.playerId)} />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{playerName(players, p.playerId)}</span>
              <span className="ml-1.5 text-xs text-muted">{playerTeam(players, p.playerId, seasonTeams)}</span>
              {p.isKeeper && <span className="ml-1.5 rounded bg-surface-2 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted">kept</span>}
            </span>
            <span className={`num rounded px-1.5 py-0.5 text-xs font-semibold ${p.value === null ? 'text-muted' : p.value > 0 ? 'bg-win/15 text-win' : p.value < 0 ? 'bg-loss/15 text-loss' : 'bg-surface-2 text-muted'}`}>
              {p.value === null ? '—' : fmtSigned(p.value, 0)}
            </span>
          </li>
        ))}
      </ul>
      <Link to={`/draft/${year}`} className="block border-t border-line px-4 py-2 text-xs text-accent hover:bg-surface-2">These picks on the {year} draft board →</Link>
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/RosterBreakdown.tsx
import { useState } from 'react';
import type { PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts } from '../../lib/format';
import { playerName, playerTeam, posColor } from '../../lib/players';
import type { PositionGroup, PositionPlayer } from '../../lib/teamProfile';

interface Props { positions: PositionGroup[]; neverStarted: PositionPlayer[]; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; weeksPlayed: number }

const GROUP_NAMES: Record<string, string> = { QB: 'Quarterbacks', RB: 'Running backs', WR: 'Wide receivers', TE: 'Tight ends', K: 'Kickers', DEF: 'Defenses' };
const PREVIEW = 4;
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Group({ g, bench, players, seasonTeams, weeksPlayed }: { g: PositionGroup; bench: PositionPlayer[]; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; weeksPlayed: number }) {
  const [all, setAll] = useState(false);
  const regular = Math.max(1, Math.ceil(weeksPlayed / 2));
  const shown = all ? g.players : g.players.slice(0, PREVIEW);
  const color = posColor(g.pos);
  const row = (p: PositionPlayer, started: boolean) => (
    <li key={p.playerId} data-regular={started && p.starts >= regular ? 'true' : undefined}
      className={`flex items-center gap-2.5 px-3 py-1.5 text-sm ${started && p.starts >= regular ? 'bg-[color-mix(in_srgb,var(--pos-color)_10%,transparent)]' : ''} ${started ? '' : 'text-muted'}`}
      style={{ '--pos-color': color } as React.CSSProperties}>
      <Headshot players={players} id={p.playerId} size={26} />
      <span className="min-w-0 flex-1 truncate">
        <span className={started ? 'font-medium' : ''}>{playerName(players, p.playerId)}</span>
        <span className="ml-1.5 text-xs text-muted">{playerTeam(players, p.playerId, seasonTeams)}</span>
      </span>
      {started
        ? <span className="text-right"><span className="num block font-semibold leading-tight">{fmtPts(p.started)}</span><span className="num block text-[10px] text-muted">{p.starts} start{p.starts === 1 ? '' : 's'}</span></span>
        : <span className="num text-xs">{p.bench > 0 ? fmtPts(p.bench) : '—'}</span>}
    </li>
  );
  return (
    <section className="card overflow-hidden" data-testid={`group-${g.pos}`}>
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="num text-2xl font-bold leading-none" style={{ color }}>{g.pos}</span>
        <span className="section-label flex-1">{GROUP_NAMES[g.pos] ?? g.pos}</span>
        <span className="num text-lg font-semibold">{fmtPts(g.started)} <span className="text-[10px] font-normal text-muted">pts</span></span>
      </header>
      {g.players.length === 0 && bench.length === 0 && <p className="px-3 py-2 text-xs text-muted">Nobody rostered.</p>}
      <ul className="divide-y divide-line">{shown.map((p) => row(p, true))}</ul>
      {g.players.length > PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-3 py-1.5 text-left text-xs text-muted hover:text-ink">
          {all ? 'Show fewer' : `Show ${g.players.length - PREVIEW} more`}
        </button>
      )}
      {bench.length > 0 && (
        <>
          <div className="section-label border-t border-line bg-surface-2 px-3 py-1 text-[10px]">Never started</div>
          <ul className="divide-y divide-line">{bench.map((p) => row(p, false))}</ul>
        </>
      )}
    </section>
  );
}

/** Where the points came from (stacked share bar with the league's shares beneath), rank chips and a card per position. */
export default function RosterBreakdown({ positions, neverStarted, players, seasonTeams, weeksPlayed }: Props) {
  return (
    <section className="space-y-3">
      <div className="card p-4">
        <CardHeader label="Depth chart" title="Roster" aside="Thin bar: league average" />
        <div className="section-label mt-3">Where the points came from</div>
        <div className="mt-1.5 flex h-6 overflow-hidden rounded" aria-hidden="true">
          {positions.map((g) => (
            <span key={g.pos} data-testid={`share-${g.pos}`} className="num flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-semibold text-bg"
              style={{ width: pct(g.share), background: posColor(g.pos) }}>
              {g.share >= 0.08 ? `${g.pos} ${pct(g.share)}` : ''}
            </span>
          ))}
        </div>
        <div className="mt-1 flex h-1 overflow-hidden rounded" aria-hidden="true">
          {positions.map((g) => <span key={g.pos} style={{ width: pct(g.leagueShare), background: posColor(g.pos), opacity: 0.6 }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {positions.map((g) => (
            <span key={g.pos} data-testid={`rank-${g.pos}`} className="num rounded border border-line px-1.5 py-0.5 text-[11px]" title={`${fmtPts(g.started)} started points at ${g.pos}, rank ${g.rank} in the league`}>
              <span className="font-semibold" style={{ color: posColor(g.pos) }}>{g.pos}</span> {g.rank}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {positions.map((g) => <Group key={g.pos} g={g} bench={neverStarted.filter((p) => p.position === g.pos)} players={players} seasonTeams={seasonTeams} weeksPlayed={weeksPlayed} />)}
      </div>
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/TeamMoves.tsx
import { useState } from 'react';
import type { History, PlayerDirectory, PlayerId, Transaction, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import type { SeasonProfile } from '../../lib/teamProfile';

interface Props { moves: Transaction[]; bestPickup: SeasonProfile['bestPickup']; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; managers: History['managers']; userId: UserId }

type Filter = 'all' | 'waiver' | 'free_agent' | 'trade';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'waiver', label: 'Waivers' }, { id: 'free_agent', label: 'Free agents' }, { id: 'trade', label: 'Trades' }];
const TYPE_LABEL: Record<Transaction['type'], string> = { waiver: 'Waiver', free_agent: 'Free agent', trade: 'Trade', commissioner: 'Commish' };
const dateOf = (ms: number) => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** The manager's season transaction log with type filters and the best pickup. */
export default function TeamMoves({ moves, bestPickup, players, seasonTeams, managers, userId }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const count = (f: Filter) => (f === 'all' ? moves.length : moves.filter((m) => m.type === f).length);
  const shown = moves.filter((m) => filter === 'all' || m.type === filter);
  const byDate = new Map<string, Transaction[]>();
  for (const m of shown) byDate.set(dateOf(m.created), [...(byDate.get(dateOf(m.created)) ?? []), m]);
  const player = (id: PlayerId, sign: '+' | '−') => (
    <span key={`${sign}${id}`} className="flex items-center gap-1.5 text-sm">
      <span className={`num w-3 text-center ${sign === '+' ? 'text-win' : 'text-loss'}`}>{sign}</span>
      <Headshot players={players} id={id} size={22} />
      <span className="truncate">{playerName(players, id)}</span>
      <PosPill pos={playerPos(players, id)} />
      <span className="text-xs text-muted">{playerTeam(players, id, seasonTeams)}</span>
    </span>
  );
  return (
    <section className="card">
      <CardHeader label="Transactions" title={`${moves.length} move${moves.length === 1 ? '' : 's'}`} aside={bestPickup && <span>Best pickup <span className="font-medium text-ink">{playerName(players, bestPickup.playerId)}</span> · <span className="num">{fmtPts(bestPickup.points)}</span> pts in {bestPickup.starts} start{bestPickup.starts === 1 ? '' : 's'} since W{bestPickup.week}</span>} />
      <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
        {FILTERS.filter((f) => count(f.id) > 0 || f.id === 'all').map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full px-2.5 py-0.5 text-xs ${filter === f.id ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}>
            {f.label} <span className="num">{count(f.id)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="px-4 pb-3 text-xs text-muted">No moves yet.</p>}
      {[...byDate.entries()].map(([date, list]) => (
        <div key={date}>
          <div className="section-label border-y border-line bg-surface-2 px-4 py-1 text-[10px]">{date}</div>
          <ul className="divide-y divide-line">
            {list.map((m) => {
              const partner = [...m.adds, ...m.drops].map((x) => x.userId).find((id) => id !== userId);
              return (
                <li key={m.id} className="grid gap-x-4 gap-y-1 px-4 py-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-start">
                  <span className="section-label text-[10px]">{TYPE_LABEL[m.type]}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    {m.adds.filter((x) => x.userId === userId).map((x) => player(x.playerId, '+'))}
                    {m.drops.filter((x) => x.userId === userId).map((x) => player(x.playerId, '−'))}
                  </span>
                  <span className="num text-right text-xs text-muted">
                    {m.type === 'waiver' && m.bid !== null && <span className="font-semibold text-ink">${m.bid}</span>}
                    {m.type === 'trade' && partner && <span>with {managers[partner]?.displayName ?? partner}</span>}
                    <span className="block">Week {m.week}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/teams && pnpm typecheck`
Expected: PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/teams
git commit -m "Team page cards: header, shape, schedule, picks, roster breakdown, moves"
```

---

### Task 4: Manager page cards

**Files:**
- Create: `packages/web/src/components/teams/SeasonsTable.tsx`, `LeagueRecords.tsx`, `Rivals.tsx`, `LineupDeskCard.tsx`, `DraftDeskCard.tsx`, `FranchisePlayers.tsx`
- Test: `packages/web/src/components/teams/LeagueRecords.test.tsx`, `Rivals.test.tsx`

**Interfaces:**
- Consumes: Task 1 and 2 types; `CardHeader`, `Avatar`, `Headshot`, `PosPill`, format helpers, `pickLabel`, `playerName`.

- [ ] **Step 1: Write the failing tests**

```tsx path=packages/web/src/components/teams/LeagueRecords.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import LeagueRecords from './LeagueRecords';
import type { ManagerRecord } from '../../lib/managerRecords';

const rec = (boardId: string, sub: string, subTitle: string, rank: number): ManagerRecord => ({ sub, subTitle, boardId, title: boardId, rank, valueLabel: '31', meta: '2023–2026', detail: null });

describe('LeagueRecords', () => {
  it('groups by sub-tab, counts the records, gilds rank one and links each row to its board', () => {
    render(<MemoryRouter><LeagueRecords records={[rec('wins', 'malltime', 'All-time', 1), rec('pts', 'malltime', 'All-time', 2), rec('streak', 'mstreaks', 'Streaks', 3)]} /></MemoryRouter>);
    expect(screen.getByText('1 league record · 3 top-three placings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All-time' })).toBeInTheDocument();
    const gold = screen.getByText('wins').closest('a')!;
    expect(gold).toHaveAttribute('data-rank', '1');
    expect(gold).toHaveAttribute('href', '/records?tab=managers&sub=malltime');
    expect(screen.getByText('streak').closest('a')).toHaveAttribute('data-rank', '3');
  });

  it('says so when the manager holds nothing', () => {
    render(<MemoryRouter><LeagueRecords records={[]} /></MemoryRouter>);
    expect(screen.getByText('No top-three placings yet.')).toBeInTheDocument();
  });
});
```

```tsx path=packages/web/src/components/teams/Rivals.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { History } from '@fantasy-dash/core';
import Rivals from './Rivals';
import type { Rivalry } from '../../lib/teamProfile';

const managers: History['managers'] = { b: { displayName: 'bob', avatar: null, seasons: [] }, c: { displayName: 'cara', avatar: null, seasons: [] }, d: { displayName: 'dan', avatar: null, seasons: [] } };
const r = (opponentId: string, w: number, l: number, streak: number): Rivalry => ({ opponentId, w, l, t: 0, pf: 500, pa: 450, games: w + l, winPct: (w) / (w + l), streak });

describe('Rivals', () => {
  it('colours winning records green, losing red, level muted, with streak and head-to-head links', () => {
    render(<MemoryRouter><Rivals rivalries={[r('b', 3, 1, 2), r('c', 1, 1, -1), r('d', 0, 2, -2)]} managers={managers} userId="a" /></MemoryRouter>);
    const rows = screen.getAllByRole('link');
    expect(rows[0]).toHaveAttribute('href', '/h2h?a=a&b=b');
    expect(rows[0].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'win');
    expect(rows[0]).toHaveTextContent('W2');
    expect(rows[1].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'even');
    expect(rows[2].querySelector('[data-tone]')).toHaveAttribute('data-tone', 'loss');
    expect(rows[2]).toHaveTextContent('L2');
    expect(rows[2]).toHaveTextContent('.000');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/teams/LeagueRecords.test.tsx src/components/teams/Rivals.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the components**

```tsx path=packages/web/src/components/teams/SeasonsTable.tsx
import { Link } from 'react-router';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts, fmtRecord } from '../../lib/format';
import type { CareerSeasonLine } from '../../lib/teamProfile';

interface Props { seasons: CareerSeasonLine[]; userId: string }

const honor = (s: CareerSeasonLine) => s.champion ? '🏆 Champion' : s.runnerUp ? 'Runner-up' : s.third ? 'Third' : s.lastPlace ? 'Last place' : s.playoffBerth ? 'Playoffs' : null;

/** One row per season, newest first, each opening that season's team page. */
export default function SeasonsTable({ seasons, userId }: Props) {
  return (
    <section className="card overflow-hidden">
      <CardHeader label={`${seasons.length} season${seasons.length === 1 ? '' : 's'}`} title="Seasons" />
      <table className="w-full text-sm">
        <thead className="section-label text-[10px]">
          <tr className="border-b border-line">
            <th className="px-4 py-1.5 text-left font-medium">Year</th><th className="py-1.5 text-left font-medium">Team</th>
            <th className="py-1.5 text-right font-medium">Record</th><th className="hidden py-1.5 text-right font-medium sm:table-cell">PF</th>
            <th className="hidden py-1.5 text-right font-medium sm:table-cell">PA</th><th className="py-1.5 pr-4 text-right font-medium">Finish</th><th className="hidden py-1.5 pr-4 text-right font-medium md:table-cell">Draft</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {seasons.map((s) => (
            <tr key={s.year} className="hover:bg-surface-2">
              <td className="num px-4 py-2 font-semibold"><Link to={`/teams/${s.year}/${userId}`} className="hover:text-accent">{s.year}</Link></td>
              <td className="max-w-[12rem] truncate py-2"><Link to={`/teams/${s.year}/${userId}`} className="hover:text-accent">{s.teamName}</Link>{honor(s) && <span className={`ml-2 text-[10px] font-semibold uppercase tracking-wide ${s.champion ? 'text-gold' : s.lastPlace ? 'text-loss' : 'text-muted'}`}>{honor(s)}</span>}</td>
              <td className="num py-2 text-right">{s.row ? fmtRecord(s.row) : '—'}</td>
              <td className="num hidden py-2 text-right sm:table-cell">{s.row ? fmtPts(s.row.pf) : '—'}</td>
              <td className="num hidden py-2 text-right text-muted sm:table-cell">{s.row ? fmtPts(s.row.pa) : '—'}</td>
              <td className={`num py-2 pr-4 text-right font-semibold ${s.champion ? 'text-gold' : ''}`}>{s.finish}</td>
              <td className="num hidden py-2 pr-4 text-right md:table-cell">{s.grade ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/LeagueRecords.tsx
import { Link } from 'react-router';
import { CardHeader } from '../draft/DraftAnalysis';
import type { ManagerRecord } from '../../lib/managerRecords';

interface Props { records: ManagerRecord[] }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Every record board where the manager sits in the top three, grouped by Records sub-tab; rank one in gold. */
export default function LeagueRecords({ records }: Props) {
  const firsts = records.filter((r) => r.rank === 1).length;
  const groups = new Map<string, { title: string; rows: ManagerRecord[] }>();
  for (const r of records) groups.set(r.sub, { title: r.subTitle, rows: [...(groups.get(r.sub)?.rows ?? []), r] });
  return (
    <section className="card">
      <CardHeader label="Record book" title="League records" aside={`${plural(firsts, 'league record')} · ${plural(records.length, 'top-three placing')}`} />
      {records.length === 0 ? <p className="px-4 py-3 text-xs text-muted">No top-three placings yet.</p> : (
        [...groups.entries()].map(([sub, g]) => (
          <div key={sub}>
            <h3 className="section-label border-b border-line bg-surface-2 px-4 py-1 text-[10px]">{g.title}</h3>
            <ul className="divide-y divide-line">
              {g.rows.map((r) => (
                <li key={r.boardId}>
                  <Link to={`/records?tab=managers&sub=${r.sub}`} data-rank={r.rank}
                    className={`flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-surface-2 ${r.rank === 1 ? 'bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]' : ''}`}>
                    <span className={`num w-5 text-center text-xs ${r.rank === 1 ? 'font-bold text-gold' : 'text-muted'}`}>{r.rank === 1 ? '♛' : r.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${r.rank === 1 ? 'font-medium' : ''}`}>{r.title}</span>
                      <span className="block truncate text-xs text-muted">{r.meta}{r.detail ? ` · ${r.detail}` : ''}</span>
                    </span>
                    <span className={`num font-semibold ${r.rank === 1 ? 'text-gold' : ''}`}>{r.valueLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/Rivals.tsx
import { Link } from 'react-router';
import type { History, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts, fmtRecord, fmtWinPct } from '../../lib/format';
import type { Rivalry } from '../../lib/teamProfile';

interface Props { rivalries: Rivalry[]; managers: History['managers']; userId: UserId }

const toneOf = (r: Rivalry) => (r.w > r.l ? 'win' : r.l > r.w ? 'loss' : 'even');
const toneClass = { win: 'text-win', loss: 'text-loss', even: 'text-muted' };

/** Every opponent, best record first; green when winning, red when losing. */
export default function Rivals({ rivalries, managers, userId }: Props) {
  return (
    <section className="card">
      <CardHeader label="Who they own, who owns them" title="Rivals" aside={`${rivalries.length} opponents`} />
      <ul className="divide-y divide-line">
        {rivalries.map((r) => {
          const m = managers[r.opponentId];
          const tone = toneOf(r);
          return (
            <li key={r.opponentId}>
              <Link to={`/h2h?a=${userId}&b=${r.opponentId}`} className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2 text-sm hover:bg-surface-2">
                <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.opponentId} size={24} />
                <span className="min-w-0">
                  <span className="block truncate"><span className="text-xs text-muted">vs</span> {m?.displayName ?? r.opponentId}</span>
                  <span className="num block text-xs text-muted">{fmtPts(r.pf)}–{fmtPts(r.pa)} · {r.games} game{r.games === 1 ? '' : 's'}</span>
                </span>
                <span className="text-right" data-tone={tone}>
                  <span className={`num block font-semibold ${toneClass[tone]}`}>{fmtRecord(r)}</span>
                  <span className={`num block text-xs ${toneClass[tone]}`}>{fmtWinPct(r.winPct)}</span>
                </span>
                <span className={`num w-8 text-right text-xs ${r.streak > 0 ? 'text-win' : r.streak < 0 ? 'text-loss' : 'text-muted'}`}>{r.streak > 0 ? `W${r.streak}` : r.streak < 0 ? `L${-r.streak}` : '—'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/LineupDeskCard.tsx
import { Link } from 'react-router';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPct, fmtPts } from '../../lib/format';
import type { TeamGame } from '../../lib/managerGames';
import type { LineupDesk } from '../../lib/teamProfile';

const link = (g: TeamGame) => `/scores/${g.year}/${g.week}/${g.matchupId}`;

function Moment({ label, game, value, note }: { label: string; game: TeamGame | null; value: string; note: string }) {
  if (!game) return null;
  return (
    <Link to={link(game)} className="block rounded-md border border-line px-3 py-2 hover:bg-surface-2">
      <span className="section-label text-[10px]">{label} <span className="num normal-case tracking-normal text-muted">{game.year} W{game.week}</span></span>
      <span className="num mt-0.5 block text-lg font-semibold leading-tight">{value}</span>
      <span className="block text-xs text-muted">{note}</span>
    </Link>
  );
}

/** Career lineup efficiency with the best-set week and the one that got away. */
export default function LineupDeskCard({ desk }: { desk: LineupDesk }) {
  return (
    <section className="card p-4">
      <CardHeader label="Lineup desk" title="Lineup success" aside={`${desk.weeks} weeks`} />
      <div className="mt-3 flex items-baseline gap-3">
        <span className="num text-3xl font-semibold">{fmtPct(desk.efficiency)}</span>
        <span className="text-xs text-muted">efficiency · <span className="num">{fmtPts(desk.started)}</span> started of <span className="num">{fmtPts(desk.possible)}</span> · <span className="num">{fmtPts(desk.benchLeft)}</span> left on the bench</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-surface-2"><div className="h-full rounded" style={{ width: fmtPct(Math.min(1, desk.efficiency), 0), background: 'color-mix(in srgb, var(--accent) 65%, transparent)' }} /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Moment label="Best-set week" game={desk.best} value={desk.best ? `${fmtPts(desk.best.points)} of ${fmtPts(desk.best.ceiling)}` : ''} note={desk.best ? fmtPct(desk.best.points / desk.best.ceiling) : ''} />
        <Moment label="The one that got away" game={desk.worst} value={desk.worst ? `${fmtPts(desk.worst.points)} of ${fmtPts(desk.worst.ceiling)}` : ''} note={desk.worst ? `${fmtPts(desk.worst.benchPoints)} left on the bench` : ''} />
      </div>
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/DraftDeskCard.tsx
import { Link } from 'react-router';
import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { CardHeader, signClass } from '../draft/DraftAnalysis';
import { fmtSigned } from '../../lib/format';
import { pickLabel } from '../../lib/draft';
import { playerName } from '../../lib/players';
import type { DraftDesk } from '../../lib/teamProfile';

function Pick({ label, pick, players }: { label: string; pick: DraftDesk['steal']; players: PlayerDirectory }) {
  if (!pick) return null;
  return (
    <Link to={`/draft/${pick.year}`} className="flex items-center gap-3 rounded-md border border-line px-3 py-2 hover:bg-surface-2">
      <Headshot players={players} id={pick.playerId} size={32} />
      <span className="min-w-0 flex-1">
        <span className="section-label block text-[10px]">{label} <span className="num normal-case tracking-normal text-muted">{pick.year} · {pickLabel(pick, pick.teams)}</span></span>
        <span className="block truncate font-medium">{playerName(players, pick.playerId)}</span>
      </span>
      <span className={`num text-lg font-semibold ${signClass(pick.value)}`}>{pick.value === null ? '—' : fmtSigned(pick.value, 0)}</span>
    </Link>
  );
}

/** Career draft grades and values, the steal and the one that hurt. */
export default function DraftDeskCard({ desk, players }: { desk: DraftDesk; players: PlayerDirectory }) {
  return (
    <section className="card p-4">
      <CardHeader label="Draft desk" title="Draft success" aside={`${desk.drafts} draft${desk.drafts === 1 ? '' : 's'}`} />
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="rounded bg-ink px-2.5 py-1 text-xl font-bold text-bg">{desk.avgGrade}</span>
        <span className="text-xs text-muted">average grade · value per draft <span className={`num font-semibold ${signClass(desk.valuePerDraft)}`}>{fmtSigned(desk.valuePerDraft, 0)}</span> · career <span className={`num font-semibold ${signClass(desk.career)}`}>{fmtSigned(desk.career, 0)}</span></span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {desk.seasons.map((s) => (
          <Link key={s.year} to={`/draft/${s.year}`} className={`num rounded border px-2 py-0.5 text-xs hover:bg-surface-2 ${desk.best?.year === s.year ? 'border-accent' : 'border-line'}`} title={`${s.year}: ${s.grade}, ${fmtSigned(s.value, 0)}`}>
            {s.year} <span className="font-semibold">{s.grade}</span> <span className={signClass(s.value)}>{fmtSigned(s.value, 0)}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Pick label="The steal" pick={desk.steal} players={players} />
        <Pick label="The one that hurt" pick={desk.hurt} players={players} />
      </div>
    </section>
  );
}
```

```tsx path=packages/web/src/components/teams/FranchisePlayers.tsx
import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPpg, fmtPts } from '../../lib/format';
import { playerName } from '../../lib/players';
import type { FranchisePlayer } from '../../lib/teamProfile';

/** Longest tenures, biggest production: the players this manager kept around and started most. */
export default function FranchisePlayers({ players, franchise }: { players: PlayerDirectory; franchise: FranchisePlayer[] }) {
  return (
    <section className="card">
      <CardHeader label="Longest tenures, biggest production" title="Franchise players" />
      {franchise.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nobody rostered yet.</p> : (
        <ol className="grid gap-px bg-line sm:grid-cols-2">
          {franchise.map((f, i) => (
            <li key={f.playerId} className="flex items-center gap-3 bg-surface px-4 py-3">
              <span className="num w-4 text-xs text-muted">{i + 1}</span>
              <Headshot players={players} id={f.playerId} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5"><PosPill pos={f.position} /><span className="truncate text-sm font-medium">{playerName(players, f.playerId)}</span></span>
                <span className="num block text-xs leading-snug text-muted">{f.from === f.to ? f.from : `${f.from}–${f.to}`} · {f.seasons} season{f.seasons === 1 ? '' : 's'} · {f.starts}/{f.weeks} started</span>
              </span>
              <span className="text-right"><span className="num block font-semibold">{fmtPts(f.started)}</span><span className="num block text-[10px] text-muted">hi {fmtPpg(f.high)}</span></span>
            </li>
          ))}
        </ol>
      )}
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Ranked on weeks rostered and points scored while started.</p>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/components/teams && pnpm typecheck`
Expected: PASS (6 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/teams
git commit -m "Manager page cards: seasons, league records, rivals, desks, franchise players"
```

---

### Task 5: Pages, routes, navigation

**Files:**
- Create: `packages/web/src/components/teams/TeamsTabs.tsx`, `packages/web/src/pages/TeamsPage.tsx`, `TeamPage.tsx`, `ManagersPage.tsx`, `ManagerPage.tsx`
- Modify: `packages/web/src/routes.tsx`, `packages/web/src/components/Nav.tsx` (add `{ to: '/teams', label: 'Teams' }` after Standings)
- Test: `packages/web/src/routes.test.tsx`, `packages/web/src/components/Nav.test.tsx`

- [ ] **Step 1: Extend the tests**

Append to `routes.test.tsx` inside `describe('routes')`:

```ts
  it('serves the teams and managers pages with every season loaded', () => {
    for (const path of ['teams/:season', 'teams/:season/:userId', 'managers', 'managers/:userId']) {
      expect(child(path)?.element, path).toBeTruthy();
      expect(child(path)?.loader, path).toBeTypeOf('function');
    }
    expect(child('teams')?.loader).toBeTypeOf('function');
  });
```

Append to `Nav.test.tsx` inside `describe('Nav')`:

```ts
  it('links to Teams', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: 'Teams' })[0]).toHaveAttribute('href', '/teams');
  });
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `pnpm --filter @fantasy-dash/web exec vitest run src/routes.test.tsx src/components/Nav.test.tsx`
Expected: the two new tests FAIL.

- [ ] **Step 3: Write the tabs, pages and routes**

```tsx path=packages/web/src/components/teams/TeamsTabs.tsx
import { NavLink } from 'react-router';

/** The Teams / Managers sub-tab row shared by every page under the Teams nav item. */
export default function TeamsTabs({ teamsTo }: { teamsTo: string }) {
  const cls = ({ isActive }: { isActive: boolean }) => `-mb-px border-b-2 px-3 py-2 text-sm ${isActive ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`;
  return (
    <nav className="flex border-b border-line" aria-label="Teams sections">
      <NavLink to={teamsTo} className={cls}>Teams</NavLink>
      <NavLink to="/managers" className={cls}>Managers</NavLink>
    </nav>
  );
}
```

```tsx path=packages/web/src/pages/TeamsPage.tsx
import { Link, useLoaderData, useNavigate } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import SeasonPicker from '../components/SeasonPicker';
import TeamsTabs from '../components/teams/TeamsTabs';
import { history } from '../data/load';
import { fmtPts, fmtRecord } from '../lib/format';
import { finishLabel } from '../lib/teamProfile';

/** Every team in one season, in standings order. */
export default function TeamsPage() {
  const { season } = useLoaderData() as { seasons: Season[]; season: Season };
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Teams <span className="num font-normal text-muted">{season.year}</span></h1>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/teams/${y}`)} />
      </header>
      <TeamsTabs teamsTo={`/teams/${season.year}`} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {season.standings.map((r) => {
          const m = season.managers[r.userId];
          const finish = finishLabel(season, r.userId, r.rank);
          return (
            <li key={r.userId}>
              <Link to={`/teams/${season.year}/${r.userId}`} className="card flex h-full items-center gap-3 p-4 transition-colors hover:border-accent">
                <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m?.teamName ?? m?.displayName ?? r.userId}</span>
                  <span className="block truncate text-xs text-muted">{m?.displayName}</span>
                  <span className="num mt-1 block text-xs text-muted">{fmtRecord(r)} · {fmtPts(r.pf)} pts{finish !== '—' ? ` · ${finish}` : ''}</span>
                </span>
                <span className="num text-lg font-semibold text-muted">#{r.rank}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

```tsx path=packages/web/src/pages/TeamPage.tsx
import { Link, useLoaderData, useNavigate, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import SeasonPicker from '../components/SeasonPicker';
import ProfileHeader from '../components/teams/ProfileHeader';
import RosterBreakdown from '../components/teams/RosterBreakdown';
import Schedule from '../components/teams/Schedule';
import SeasonShape from '../components/teams/SeasonShape';
import TeamMoves from '../components/teams/TeamMoves';
import TeamPicks from '../components/teams/TeamPicks';
import TeamsTabs from '../components/teams/TeamsTabs';
import { history, players } from '../data/load';
import { fmtPct, fmtPpg, fmtPts, fmtRecord } from '../lib/format';
import { ordinal, seasonProfile } from '../lib/teamProfile';

/** One manager's season: header, shape, schedule, picks, roster breakdown and moves. */
export default function TeamPage() {
  const { season } = useLoaderData() as { seasons: Season[]; season: Season };
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const years = history.managers[userId]?.seasons ?? [];
  if (!season.managers[userId]) {
    return (
      <section className="space-y-4">
        <TeamsTabs teamsTo={`/teams/${season.year}`} />
        <p className="text-sm text-muted">{history.managers[userId]?.displayName ?? 'That manager'} did not play in {season.year}.{years.length > 0 && <> Try <Link to={`/teams/${years[years.length - 1]}/${userId}`} className="text-accent hover:underline">{years[years.length - 1]}</Link>.</>}</p>
      </section>
    );
  }
  const p = seasonProfile(season, userId, players);
  const inSeason = season.status === 'in_season';
  const ap = p.row?.allPlay;
  return (
    <section className="space-y-4">
      <TeamsTabs teamsTo={`/teams/${season.year}`} />
      <ProfileHeader
        avatar={p.avatar} name={p.displayName}
        eyebrow={<><SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/teams/${y}/${userId}`)} /><Link to={`/teams/${season.year}`} className="text-accent normal-case tracking-normal hover:underline">All teams</Link></>}
        title={p.teamName}
        subtitle={<Link to={`/managers/${userId}`} className="hover:text-accent">{p.displayName} · manager page →</Link>}
        badges={[
          <>Scoring <b className="text-ink">{ordinal(p.scoringRank)}</b> of {p.teams}</>,
          <>Points allowed <b className="text-ink">{ordinal(p.pointsAllowedRank)} most</b></>,
          ap ? <>Vs. everyone <b className="num text-ink">{ap.w}–{ap.l}{ap.t ? `–${ap.t}` : ''}</b></> : null,
        ].filter(Boolean)}
        tiles={[
          { label: 'Record', value: p.row ? fmtRecord(p.row) : '—' },
          { label: 'Pts for', value: p.row ? fmtPpg(p.row.pf) : '—' },
          { label: 'Pts against', value: p.row ? fmtPpg(p.row.pa) : '—' },
          { label: 'Finish', value: p.finish, sub: p.finishNote === 'Regular-season rank' ? 'regular season' : p.finishNote },
          { label: 'Draft slot', value: p.draftSlot === null ? '—' : String(p.draftSlot) },
          { label: 'FAAB spent', value: `$${p.faab}` },
        ]}
        strip={<>
          <span>Longest win streak <b className="num text-ink">{p.longestWinStreak}</b></span>
          <span>Left on the bench <b className="num text-ink">{fmtPpg(p.benchLeft)}</b> · <span className="num">{fmtPct(p.efficiency, 0)}</span> of the best lineup</span>
          {inSeason && <span>Through week {season.lastScoredWeek}</span>}
        </>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-4">
          <SeasonShape label="Week by week" points={p.weeks.map((w) => ({ label: `Week ${w.week}`, mine: w.points, league: w.leagueAvg }))} mineCaption={`${fmtPpg(p.ppw)} a week`} leagueCaption={`${fmtPpg(p.leagueAvgPpw)} league average`} />
          <Schedule weeks={p.weeks} managers={season.managers} year={season.year} />
          {season.draft && p.picks.length > 0 && <TeamPicks picks={p.picks} teams={season.draft.slotOrder.length} grade={p.grade} value={p.draftValue} year={season.year} players={players} seasonTeams={season.playerTeams} />}
        </div>
        <div className="space-y-4">
          <RosterBreakdown positions={p.positions} neverStarted={p.neverStarted} players={players} seasonTeams={season.playerTeams} weeksPlayed={p.weeksPlayed} />
          <TeamMoves moves={p.moves} bestPickup={p.bestPickup} players={players} seasonTeams={season.playerTeams} managers={history.managers} userId={userId} />
        </div>
      </div>
      <p className="text-xs text-muted">Points, ranks and shares cover every played week including playoffs; the record and points tiles are regular season. Totals: {fmtPts(p.row?.pf ?? 0)} for.</p>
    </section>
  );
}
```

```tsx path=packages/web/src/pages/ManagersPage.tsx
import { Link, useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import TeamsTabs from '../components/teams/TeamsTabs';
import { currentSeason, history } from '../data/load';
import { fmtRecord, fmtWinPct } from '../lib/format';

/** Everyone who has managed a team, by all-time rank. */
export default function ManagersPage() {
  useLoaderData() as Season[];
  return (
    <section className="space-y-4">
      <header><h1 className="text-[22px] font-semibold tracking-tight">Managers</h1></header>
      <TeamsTabs teamsTo={`/teams/${currentSeason.year}`} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {history.allTime.map((r) => {
          const m = history.managers[r.userId];
          return (
            <li key={r.userId}>
              <Link to={`/managers/${r.userId}`} className="card flex h-full items-center gap-3 p-4 transition-colors hover:border-accent">
                <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m?.displayName ?? r.userId}{r.titles > 0 && <span className="ml-1.5 text-xs text-gold">🏆{r.titles > 1 ? r.titles : ''}</span>}</span>
                  <span className="num block text-xs text-muted">{r.seasons} season{r.seasons === 1 ? '' : 's'} · {fmtRecord(r)} · {fmtWinPct(r.winPct)}</span>
                </span>
                <span className="num text-lg font-semibold text-muted">#{r.rank}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

```tsx path=packages/web/src/pages/ManagerPage.tsx
import { useMemo } from 'react';
import { Link, useLoaderData, useParams } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import DraftDeskCard from '../components/teams/DraftDeskCard';
import FranchisePlayers from '../components/teams/FranchisePlayers';
import LeagueRecords from '../components/teams/LeagueRecords';
import LineupDeskCard from '../components/teams/LineupDeskCard';
import ProfileHeader from '../components/teams/ProfileHeader';
import Rivals from '../components/teams/Rivals';
import SeasonShape from '../components/teams/SeasonShape';
import SeasonsTable from '../components/teams/SeasonsTable';
import TeamsTabs from '../components/teams/TeamsTabs';
import { currentSeason, history, players } from '../data/load';
import { fmtPpg, fmtRecord, fmtWinPct } from '../lib/format';
import { allTimeContext, managerRecords } from '../lib/managerRecords';
import { careerProfile, ordinal } from '../lib/teamProfile';

/** One manager across every season. */
export default function ManagerPage() {
  const seasons = useLoaderData() as Season[];
  const { userId = '' } = useParams();
  const c = useMemo(() => careerProfile(seasons, history, userId, players), [seasons, userId]);
  const records = useMemo(() => managerRecords(allTimeContext(seasons, players, history.managers), userId), [seasons, userId]);
  if (!history.managers[userId]) return <section className="space-y-4"><TeamsTabs teamsTo={`/teams/${currentSeason.year}`} /><p className="text-sm text-muted">No such manager.</p></section>;
  const latest = c.seasons[0];
  return (
    <section className="space-y-4">
      <TeamsTabs teamsTo={`/teams/${currentSeason.year}`} />
      <ProfileHeader
        avatar={c.avatar} name={c.name}
        eyebrow={<><span>Manager</span>{c.allTime && <span className="num normal-case tracking-normal text-muted">all-time rank {ordinal(c.allTime.rank)} of {c.managers}</span>}</>}
        title={c.name}
        subtitle={latest && <Link to={`/teams/${latest.year}/${userId}`} className="hover:text-accent">{latest.teamName} · {latest.year} team page →</Link>}
        badges={[
          <span className="num">Seasons <b className="text-ink">{c.seasons.length}</b> · {c.seasons.length ? `${c.seasons[c.seasons.length - 1].year}–${c.seasons[0].year}` : ''}</span>,
          c.titles > 0 ? <span className="text-gold">🏆 {c.titles} title{c.titles === 1 ? '' : 's'}</span> : null,
          <span>Longest win streak <b className="num text-ink">{c.longestWinStreak}</b></span>,
          <span>Week highs <b className="num text-ink">{c.weekHighs}</b></span>,
        ].filter(Boolean)}
        tiles={[
          { label: 'Record', value: fmtRecord(c.record) },
          { label: 'Win %', value: fmtWinPct(c.winPct) },
          { label: 'Points for', value: fmtPpg(c.pf) },
          { label: 'Playoffs', value: `${c.playoffApps}/${c.seasons.length}` },
          { label: 'Best finish', value: c.bestFinish },
          { label: 'Titles', value: String(c.titles) },
        ]}
        chips={<><span className="section-label text-[10px]">Fielded as</span>{c.fieldedAs.map((f) => <span key={`${f.teamName}-${f.from}`} className="rounded-full border border-line px-2.5 py-0.5"><span className="font-medium">{f.teamName}</span> <span className="num text-muted">{f.from === f.to ? f.from : `${f.from}–${f.to}`}</span></span>)}</>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-4">
          <SeasonsTable seasons={c.seasons} userId={userId} />
          <SeasonShape wide label="Season by season" points={[...c.seasons].reverse().map((s) => ({ label: String(s.year), mine: s.ppw, league: s.leagueAvgPpw }))} mineCaption={`${fmtPpg(c.seasons.length ? c.seasons.reduce((t, s) => t + s.ppw, 0) / c.seasons.length : 0)} a week`} leagueCaption="league average" />
          <LineupDeskCard desk={c.lineup} />
          {c.draft && <DraftDeskCard desk={c.draft} players={players} />}
          <FranchisePlayers players={players} franchise={c.franchise} />
        </div>
        <div className="space-y-4">
          <LeagueRecords records={records} />
          <Rivals rivalries={c.rivalries} managers={history.managers} userId={userId} />
        </div>
      </div>
    </section>
  );
}
```

Routes — in `packages/web/src/routes.tsx` add the imports:

```ts
import TeamsPage from './pages/TeamsPage';
import TeamPage from './pages/TeamPage';
import ManagersPage from './pages/ManagersPage';
import ManagerPage from './pages/ManagerPage';
import { currentSeason, history, loadAllSeasons, loadSeason } from './data/load';
```

add this loader after `seasonLoader`:

```ts
/** Every season plus the one in the URL; 404 for a season the league never played. */
export async function teamsLoader({ params }: LoaderFunctionArgs) {
  const year = Number(params.season);
  if (!history.seasons.some((s) => s.year === year)) throw new Response(`No season ${params.season}`, { status: 404 });
  const seasons = await loadAllSeasons();
  return { seasons, season: seasons.find((s) => s.year === year)! };
}
```

and these children after the `standings/:season` route:

```ts
      { path: 'teams', loader: () => redirect(`/teams/${currentSeason.year}`) },
      { path: 'teams/:season', loader: teamsLoader, element: <TeamsPage /> },
      { path: 'teams/:season/:userId', loader: teamsLoader, element: <TeamPage /> },
      { path: 'managers', loader: () => loadAllSeasons(), element: <ManagersPage /> },
      { path: 'managers/:userId', loader: () => loadAllSeasons(), element: <ManagerPage /> },
```

Nav — in `packages/web/src/components/Nav.tsx` insert `{ to: '/teams', label: 'Teams' },` after the Standings entry.

- [ ] **Step 4: Typecheck, full test run, build**

Run: `pnpm typecheck && pnpm --filter @fantasy-dash/web test && pnpm build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "Teams and Managers pages, routes and nav link"
```

---

### Task 6: Visual check, docs, merge

- [ ] **Step 1: Screenshots** with the scratchpad helper at 1440 and 400 for `/teams/2026`, `/teams/2026/<a user id>`, `/teams/2023/<id>` (complete season with Finish), `/managers`, `/managers/<id>`. Fix anything that wraps badly.
- [ ] **Step 2: Spec sync** — note any deviation in `docs/superpowers/specs/2026-10-16-teams-managers-design.md`.
- [ ] **Step 3: Memory + ledger** — update `~/.claude/projects/-Users-mathiasfoster-repos/memory/fantasy-dash-project.md` and `.superpowers/sdd/progress.md`.
- [ ] **Step 4: Merge** — `git merge --no-ff teams` into main, push, `gh run watch`, delete the branch.

## Self-review

- Spec coverage: nav/routes (Task 5), team page header/shape/schedule/picks/roster/moves (Tasks 1, 3, 5), manager header/seasons/records/rivals/lineup/draft/franchise (Tasks 1, 2, 4, 5), gold token (Task 2), tests (each task), screenshots (Task 6). The spec's "Transactions" per-card "claims lost" is out of scope since only completed transactions are stored.
- Placeholders: none.
- Type consistency: `WeekLine`, `PositionGroup`, `PositionPlayer`, `SeasonProfile`, `CareerSeasonLine`, `Rivalry`, `LineupDesk`, `DraftDesk`, `FranchisePlayer` are defined in Task 1 and consumed by name in Tasks 3–5; `ManagerRecord` in Task 2 and consumed in Task 4.
