import type { History, Season } from '@fantasy-dash/core';
import { managerRows, teamRows } from './indexRows';
import { bracketGame, game, line, players, season, side, standing, week } from '../test/playerFixtures';

function build(): Season {
  const s = season(2025, [
    week(1, [game(2025, 1, 1, side('a', 120, [line('q1', 20), line('r1', 10)]), side('b', 90, [line('t1', 12)]))]),
    week(2, [game(2025, 2, 1, side('a', 95, [line('q1', 30), line('r1', 5)]), side('b', 130, [line('t1', 12)]))]),
    { ...week(3, [game(2025, 3, 1, side('a', 0, []), side('b', 0, []))]), played: false },
  ]);
  s.standings = [standing('b', 1, 1, 1, 0, 220, 215), standing('a', 2, 1, 1, 0, 215, 220)];
  s.managers = { a: { userId: 'a', displayName: 'alice', teamName: 'Team Alice', avatar: null, rosterId: 1 }, b: { userId: 'b', displayName: 'bob', teamName: 'Team Bob', avatar: null, rosterId: 2 } };
  s.status = 'in_season';
  return s;
}
const history = { seasons: [], managers: { a: { displayName: 'alice', avatar: null, seasons: [2025] }, b: { displayName: 'bob', avatar: null, seasons: [2025] } }, h2h: {},
  allTime: [{ userId: 'b', rank: 1, seasons: 1, w: 1, l: 1, t: 0, winPct: 0.5, pf: 220, pa: 215, ppg: 110, titles: 1, weeklyHighs: 1 }, { userId: 'a', rank: 2, seasons: 1, w: 1, l: 1, t: 0, winPct: 0.5, pf: 215, pa: 220, ppg: 107.5, titles: 0, weeklyHighs: 1 }], topDraftValues: [], worstDraftValues: [] } as unknown as History;

describe('teamRows', () => {
  const rows = teamRows(build());
  it('follows standings order with ranks for points for and against, a weekly sparkline with results and the top started scorer', () => {
    expect(rows.map((r) => [r.userId, r.teamName, r.pfRank, r.paRank])).toEqual([['b', 'Team Bob', 1, 1], ['a', 'Team Alice', 2, 2]]);
    expect(rows[1].spark).toEqual([{ label: 'Week 1', value: 120, league: 105, result: 'W' }, { label: 'Week 2', value: 95, league: 112.5, result: 'L' }]);
    expect(rows[1].topScorer).toEqual({ playerId: 'q1', points: 50 });
    expect(rows[1].inSeason).toBe(true);
    expect(rows[1].finish.place).toBeNull();
  });
});

describe('managerRows', () => {
  const s = build();
  s.status = 'complete';
  s.brackets = { winners: [{ ...bracketGame('b', 'a', 'Final', 3), placement: 1, advanced: 'b', homePoints: 2, awayPoints: 1 }], consolation: [] };
  const rows = managerRows([s], history);
  it('keeps the all-time order with a chip per season carrying the finish, playoffs over complete seasons and a PPG sparkline', () => {
    expect(rows.map((r) => [r.userId, r.rank, r.name, r.teamName, r.playoffApps, r.completeSeasons])).toEqual([['b', 1, 'bob', 'Team Bob', 1, 1], ['a', 2, 'alice', 'Team Alice', 1, 1]]);
    expect(rows[0].seasons).toEqual([{ year: 2025, status: 'complete', teamName: 'Team Bob', rank: 1, finish: '1st', icon: 'champion' }]);
    expect(rows[1].seasons[0]).toMatchObject({ finish: '2nd', icon: 'runnerUp' });
    expect(rows[1].spark).toEqual([{ label: '2025', value: 107.5, league: 108.75 }]);
  });
  it('counts no playoff berth for an in-season year', () => {
    const live = build();
    expect(managerRows([live], history)[0]).toMatchObject({ playoffApps: 0, completeSeasons: 0, seasons: [{ year: 2025, status: 'in_season', rank: 1, finish: '—' }] });
  });
});
