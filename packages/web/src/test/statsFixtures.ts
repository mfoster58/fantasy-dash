import { computeStandings, type Draft, type DraftPick, type Manager, type PlayerDirectory, type PlayerLine, type Season, type Transaction, type UserId, type Week } from '@fantasy-dash/core';
import { game, line, side, week, season } from './playerFixtures';

const P = (id: string, name: string, position: string, yearsExp: number | null, birthDate: string | null) =>
  ({ id, name, firstName: name.split(' ')[0], lastName: name.split(' ')[1] ?? '', position, team: 'KC', yearsExp, birthDate });

export const statsPlayers: PlayerDirectory = {
  q1: P('q1', 'Quincy One', 'QB', 3, '1999-03-01'),
  r1: P('r1', 'Ricky One', 'RB', 5, '1995-09-02'),
  r2: P('r2', 'Ricky Two', 'RB', 1, null),
  w1: P('w1', 'Wally One', 'WR', 4, '1998-01-15'),
  w2: P('w2', 'Wally Two', 'WR', 2, '2000-05-05'),
  t1: P('t1', 'Tony One', 'TE', 6, '1996-11-30'),
  t2: P('t2', 'Tony Two', 'TE', 0, null),
  k1: P('k1', 'Kick One', 'K', 8, null),
  KC: P('KC', 'Kansas City Chiefs', 'DEF', null, null),
  x1: P('x1', 'Xavier One', 'RB', 9, '1992-02-02'),
  x2: P('x2', 'Xavier Two', 'WR', 10, null),
};

export const MANAGERS: Record<UserId, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team Alice', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team Bob', avatar: 'img-b', rosterId: 2 },
  c: { userId: 'c', displayName: 'cara', teamName: 'Team Cara', avatar: null, rosterId: 3 },
  d: { userId: 'd', displayName: 'dan', teamName: 'Team Dan', avatar: null, rosterId: 4 },
};
const IDS = ['a', 'b', 'c', 'd'];

/** a side whose points are the sum of its starters */
const S = (userId: string, starters: [string, number][]) => {
  const lines: PlayerLine[] = starters.map(([p, pts]) => line(p, pts));
  return side(userId, lines.reduce((t, l) => t + l.points, 0), lines);
};
const pick = (round: number, pickNo: number, slot: number, userId: string, playerId: string, value: number): DraftPick => ({
  round, pickNo, slot, userId, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: true,
  pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value, tradedTo: null,
});
const tx = (id: string, type: Transaction['type'], week: number, created: number, adds: [string, string][], drops: [string, string][], bid: number | null): Transaction =>
  ({ id, type, week, created, adds: adds.map(([playerId, userId]) => ({ playerId, userId })), drops: drops.map(([playerId, userId]) => ({ playerId, userId })), bid });

function finish(year: number, weeks: Week[], playoffWeekStart: number, extra: Partial<Season> = {}): Season {
  const s = season(year, weeks);
  s.playoffWeekStart = playoffWeekStart;
  s.playoffTeams = 2;
  s.managers = { ...MANAGERS };
  s.standings = computeStandings(weeks, IDS, playoffWeekStart);
  return { ...s, ...extra };
}

/** 2024: two regular-season weeks, no playoffs, no draft, no transactions */
export function season2024(): Season {
  const y = 2024;
  return finish(y, [
    week(1, [game(y, 1, 1, S('a', [['q1', 100]]), S('b', [['r1', 90]])), game(y, 1, 2, S('c', [['w1', 80]]), S('d', [['t1', 70]]))]),
    week(2, [game(y, 2, 1, S('a', [['q1', 90]]), S('c', [['w1', 100]])), game(y, 2, 2, S('b', [['r1', 110]]), S('d', [['t1', 60]]))]),
  ], 3);
}

/** 2025: four regular-season weeks, one playoff week, a two-round draft and four transactions (see the plan's table) */
export function season2025(): Season {
  const y = 2025;
  const draft: Draft = {
    draftId: 'D25', type: 'snake', rounds: 2, slotOrder: IDS, expectedCurve: null, baselines: {},
    picks: [pick(1, 1, 1, 'a', 'q1', 20), pick(1, 2, 2, 'b', 'r1', 15), pick(1, 3, 3, 'c', 'w1', -5), pick(1, 4, 4, 'd', 't1', 10),
      pick(2, 5, 4, 'd', 'k1', 0), pick(2, 6, 3, 'c', 'KC', -2), pick(2, 7, 2, 'b', 'w2', 3), pick(2, 8, 1, 'a', 't2', -8)],
  };
  const transactions: Transaction[] = [
    tx('t1', 'waiver', 2, 1000, [['x1', 'a']], [['t2', 'a']], 10),
    tx('t2', 'free_agent', 3, 2000, [['x2', 'b']], [], null),
    tx('t3', 'trade', 3, 3000, [['t1', 'c'], ['w1', 'd']], [['t1', 'd'], ['w1', 'c']], null),
    tx('t4', 'waiver', 4, 4000, [['t2', 'a']], [['x1', 'a']], 3),
  ];
  return finish(y, [
    week(1, [game(y, 1, 1, S('a', [['q1', 60], ['r2', 60]]), S('b', [['r1', 100]])), game(y, 1, 2, S('c', [['w1', 90]]), S('d', [['t1', 110]]))]),
    week(2, [game(y, 2, 1, S('a', [['q1', 70], ['r2', 60]]), S('c', [['w1', 95]])), game(y, 2, 2, S('b', [['r1', 118]]), S('d', [['t1', 112]]))]),
    week(3, [game(y, 3, 1, S('a', [['q1', 50], ['x1', 30]]), S('d', [['w1', 75]])), game(y, 3, 2, S('b', [['r1', 100], ['x2', 40]]), S('c', [['t1', 100]]))]),
    week(4, [game(y, 4, 1, S('a', [['q1', 60], ['t2', 40]]), S('b', [['r1', 99]])), game(y, 4, 2, S('c', [['t1', 130]]), S('d', [['w1', 60]]))]),
    week(5, [game(y, 5, 1, S('a', [['q1', 100], ['t2', 50]]), S('d', [['w1', 120]]), 'Final'), game(y, 5, 2, S('b', [['r1', 90]]), S('c', [['t1', 95]]), 'Toilet Bowl')], true),
  ], 5, { draft, transactions, honors: { champion: 'a', runnerUp: 'd', third: null, pointsTitle: 'b', lastPlace: 'b' } });
}

export const league = (): Season[] => [season2024(), season2025()];
