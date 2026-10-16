import type { BracketGame, DraftPick, History, Season, Transaction } from '@fantasy-dash/core';
import { bestStarts, careerProfile, draftDesk, fieldedAs, finalPlacement, finishOf, franchisePlayers, longestWinStreak, seasonProfile } from './teamProfile';
import { flattenLines } from './playerLines';
import { bracketGame, game, line, players, season, side, standing, week } from '../test/playerFixtures';

// Two weeks, two games each: alice beats bob then loses to cara; dan is the fourth team.
const g = (yr: number, wk: number, id: number, a: [string, number], b: [string, number], aStarters = [line('q1', 20), line('r1', 10)], aBench = [line('w1', 7)]) =>
  game(yr, wk, id, side(a[0], a[1], aStarters, aBench), side(b[0], b[1], [line('t1', 12)]));
const tx = (id: string, type: Transaction['type'], week: number, created: number, adds: string[], drops: string[], bid: number | null = null): Transaction =>
  ({ id, type, week, created, adds: adds.map((p) => ({ playerId: p, userId: 'a' })), drops: drops.map((p) => ({ playerId: p, userId: 'a' })), bid });

function build(): Season {
  const s = season(2025, [
    week(1, [g(2025, 1, 1, ['a', 120], ['b', 90]), g(2025, 1, 2, ['c', 100], ['d', 80])]),
    week(2, [g(2025, 2, 1, ['a', 95], ['c', 130]), g(2025, 2, 2, ['b', 70], ['d', 110])]),
    { ...week(3, [g(2025, 3, 1, ['d', 0], ['a', 0])]), played: false },
  ]);
  s.standings = [standing('c', 1, 2, 0, 0, 230, 175), standing('a', 2, 1, 1, 0, 215, 220), standing('d', 3, 1, 1, 0, 190, 170), standing('b', 4, 0, 2, 0, 160, 230)];
  s.managers = { a: { userId: 'a', displayName: 'alice', teamName: 'Team Alice', avatar: null, rosterId: 1 } };
  s.status = 'in_season';
  s.transactions = [tx('t1', 'waiver', 2, 200, ['w1'], ['k1'], 12), tx('t2', 'free_agent', 1, 100, ['r1'], [])];
  s.playerSeasons = { q1: { points: 40, games: 2, posRank: 4 } };
  return s;
}

describe('seasonProfile', () => {
  const p = seasonProfile(build(), 'a', players);

  it('ranks scoring and points allowed and reads the standings row', () => {
    expect(p.row?.rank).toBe(2);
    expect(p.teams).toBe(4);
    expect(p.scoringRank).toBe(2);           // 215 behind cara's 230
    expect(p.pointsAllowedRank).toBe(3);     // 220 allowed; dan 170 and cara 175 allowed fewer
    expect(p.efficiencyRank).toBe(2);        // fixture efficiency is pf / (pf + 20), so it follows pf
    expect(p.finish).toEqual({ place: null, label: '—', icon: null, note: null });   // in season
    expect(p.seed).toBe(2);
    expect(p.playoffSpots).toBe(2);
    expect(p.madePlayoffs).toBe(true);       // in season: inside the top 2
    expect(p.teamName).toBe('Team Alice');
  });

  it('builds the schedule with league averages and high/low flags', () => {
    expect(p.weeks.map((w) => [w.week, w.opponentId, w.points, w.oppPoints, w.result, w.leagueAvg, w.high, w.low])).toEqual([
      [1, 'b', 120, 90, 'W', 97.5, true, false],
      [2, 'c', 95, 130, 'L', 101.3, false, true],
    ]);
    expect(p.ppw).toBe(107.5);
    expect(p.leagueAvgPpw).toBe(99.4);
    expect(p.weeksPlayed).toBe(2);
  });

  it('lists upcoming games after the played ones and byes in playoff weeks', () => {
    expect(p.schedule.map((e) => e.kind)).toEqual(['played', 'played', 'upcoming']);
    expect(p.schedule[2]).toMatchObject({ kind: 'upcoming', week: 3, opponentId: 'd', matchupId: 1, projected: 100, oppProjected: 100 });
    // alice sits out the first playoff week but plays the next one: a bye
    const s = build();
    s.weeks = [...s.weeks.slice(0, 2), week(3, [g(2025, 3, 1, ['c', 100], ['d', 80])], true), week(4, [g(2025, 4, 1, ['a', 100], ['c', 80])], true)];
    const sched = seasonProfile(s, 'a', players).schedule;
    expect(sched.map((e) => [e.kind, e.week])).toEqual([['played', 1], ['played', 2], ['bye', 3], ['played', 4]]);
    expect(sched[2]).toMatchObject({ kind: 'bye', leagueAvg: 90 });
  });

  it('ranks the best single-week starts and the best by waiver or free-agent pickups', () => {
    // r1 was a free-agent add in week 1 and started both weeks; q1 was never picked up
    expect(p.bestStarts.map((s) => [s.playerId, s.week, s.points, s.waiver])).toEqual([['q1', 1, 20, false], ['q1', 2, 20, false], ['r1', 1, 10, true], ['r1', 2, 10, true]]);
    expect(p.bestWaiverStarts.map((s) => [s.playerId, s.week])).toEqual([['r1', 1], ['r1', 2]]);
    expect(p.bestStarts[0]).toMatchObject({ opponentId: 'b', matchupId: 1, tag: null });
  });

  it('splits points by position with league share and rank', () => {
    const qb = p.positions.find((x) => x.pos === 'QB')!;
    expect(qb.started).toBe(40);
    expect(qb.rank).toBe(1);
    expect(qb.players[0]).toMatchObject({ playerId: 'q1', starts: 2, started: 40, high: 20, bench: 0, ppg: 20, posRank: 4 });
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

describe('finalPlacement', () => {
  const placed = (home: string, away: string, tag: BracketGame['tag'], placement: number | null, bracket: BracketGame['bracket'], advanced: string): BracketGame =>
    ({ ...bracketGame(home, away, tag, 3), placement, bracket, advanced, homePoints: 1, awayPoints: 2 });
  const s = build();
  s.status = 'complete';
  s.standings = [standing('c', 1, 2, 0, 0, 230, 175), standing('a', 2, 1, 1, 0, 215, 220), standing('d', 3, 1, 1, 0, 190, 170), standing('b', 4, 0, 2, 0, 160, 230), standing('e', 5, 0, 2, 0, 150, 240), standing('f', 6, 0, 2, 0, 140, 250)];
  s.brackets = {
    winners: [placed('c', 'a', 'Final', 1, 'winners', 'a'), placed('d', 'b', '3rd', 3, 'winners', 'd')],
    consolation: [placed('e', 'f', 'Toilet Bowl', 1, 'consolation', 'e')],
  };

  it('reads places off the placement games: the Final, the 3rd-place game and the Toilet Bowl', () => {
    expect([...finalPlacement(s).entries()]).toEqual([['a', 1], ['c', 2], ['d', 3], ['b', 4], ['e', 6], ['f', 5]]);
  });

  it('fills the open places by seed for anyone the brackets never placed', () => {
    const t = { ...s, brackets: { winners: [placed('c', 'a', 'Final', 1, 'winners', 'a')], consolation: [] } };
    expect([...finalPlacement(t).entries()]).toEqual([['a', 1], ['c', 2], ['d', 3], ['b', 4], ['e', 5], ['f', 6]]);
  });

  it('is empty while the season is in progress', () => {
    expect(finalPlacement({ ...s, status: 'in_season' }).size).toBe(0);
  });

  it('labels the podium and the toilet bowl with icons', () => {
    expect(finishOf(s, 'a')).toEqual({ place: 1, label: '1st', icon: 'champion', note: 'Champion' });
    expect(finishOf(s, 'c')).toEqual({ place: 2, label: '2nd', icon: 'runnerUp', note: 'Runner-up' });
    expect(finishOf(s, 'd')).toEqual({ place: 3, label: '3rd', icon: 'third', note: 'Third place' });
    expect(finishOf(s, 'b')).toEqual({ place: 4, label: '4th', icon: null, note: 'of 6' });
    expect(finishOf(s, 'e')).toEqual({ place: 6, label: '6th', icon: 'toilet', note: 'Toilet bowl' });
    expect(finishOf({ ...s, status: 'in_season' }, 'a')).toEqual({ place: null, label: '—', icon: null, note: null });
  });
});

describe('bestStarts', () => {
  it('stops counting a pickup once the manager drops the player again', () => {
    const s = build();
    s.transactions = [
      { id: 'add', type: 'waiver', week: 1, created: 100, adds: [{ playerId: 'r1', userId: 'a' }], drops: [], bid: 5 },
      { id: 'drop', type: 'free_agent', week: 1, created: 200, adds: [], drops: [{ playerId: 'r1', userId: 'a' }], bid: null },
    ];
    expect(bestStarts(s, 'a').waiver.map((x) => x.week)).toEqual([1]);
    expect(bestStarts(s, 'a', 1).all).toHaveLength(1);
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
  it('ranks by points while started, then starts, then weeks rostered', () => {
    const lines = flattenLines([build()], players);
    const top = franchisePlayers(lines, 'a');
    expect(top.map((f) => [f.playerId, f.weeks, f.starts, f.started])).toEqual([['q1', 2, 2, 40], ['r1', 2, 2, 20], ['w1', 2, 0, 0]]);
    expect(top[0]).toMatchObject({ from: 2025, to: 2025, seasons: 1, high: 20, position: 'QB' });
  });
});

describe('careerProfile', () => {
  const s = build();
  s.status = 'complete';
  s.honors = { champion: 'c', runnerUp: 'a', third: null, pointsTitle: 'c', lastPlace: 'b' };
  s.brackets = { winners: [{ ...bracketGame('c', 'a', 'Final', 3), placement: 1, advanced: 'c', homePoints: 2, awayPoints: 1 }], consolation: [] };
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
    expect(c.seasons[0]).toMatchObject({ year: 2025, teamName: 'Team Alice', finish: '2nd', finishIcon: 'runnerUp', runnerUp: true, champion: false, ppw: 107.5, moves: 2 });
    expect(c.honors).toEqual({ champion: [], runnerUp: [2025], third: [], pointsTitle: [], lastPlace: [] });
    expect(c.longestWinStreak).toBe(1);
    expect(c.bestFinish).toBe('2nd');
    expect(c.record).toEqual({ w: 1, l: 1, t: 0 });
    expect([c.completeSeasons, c.playoffApps]).toEqual([1, 1]);
    expect(c.allTimeTeam.season[0]).toMatchObject({ slot: 'QB', pick: { playerId: 'q1', year: 2025, points: 40 } });
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

describe('draftDesk', () => {
  const pick = (userId: string, playerId: string, pickNo: number, value: number | null): DraftPick => ({
    round: Math.ceil(pickNo / 2), pickNo, slot: ((pickNo - 1) % 2) + 1, userId, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: true,
    pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value, tradedTo: null,
  });
  const drafted = (year: number, picks: DraftPick[]): Season => {
    const s = build();
    s.year = year;
    s.draft = { draftId: `d${year}`, type: 'snake', rounds: 2, slotOrder: ['a', 'b'], picks, expectedCurve: null, baselines: {} };
    return s;
  };

  it('lists one row per graded draft, newest first, with that year\'s highest and lowest valued pick', () => {
    const desk = draftDesk([
      drafted(2024, [pick('a', 'q1', 1, 30), pick('b', 't1', 2, 5), pick('a', 'r1', 4, -12), pick('b', 'w1', 3, 8)]),
      drafted(2025, [pick('a', 'q1', 1, -20), pick('b', 't1', 2, 40), pick('a', 'r1', 4, 6), pick('b', 'w1', 3, 1)]),
    ], 'a')!;
    expect(desk.drafts).toBe(2);
    expect(desk.seasons.map((s) => [s.year, s.grade, s.value, s.steal?.playerId, s.bust?.playerId])).toEqual([[2025, 'B-', -14, 'r1', 'q1'], [2024, 'A+', 18, 'q1', 'r1']]);
    expect(desk.seasons[1].steal?.teams).toBe(2);
    expect(desk.valuePerDraft).toBe(2);     // (18 − 14) / 2
    expect(desk).not.toHaveProperty('career');
  });

  it('skips drafts where none of the manager\'s picks is valued, and is null with none at all', () => {
    expect(draftDesk([drafted(2025, [pick('a', 'q1', 1, null), pick('b', 't1', 2, 3)])], 'a')).toBeNull();
    expect(draftDesk([build()], 'a')).toBeNull();
  });
});
