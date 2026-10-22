import type { Season, SleeperMatchup } from '@fantasy-dash/core';
import { game, line, season, side, week } from '../../test/playerFixtures';
import type { LiveData } from './LiveProvider';
import { weekStatus } from './weekStatus';

function current(): Season {
  const a = side('a', 0, [line('q1', 0), line('r1', 0)]);
  const b = side('b', 0, [line('w1', 0)]);
  const w = week(7, [game(2026, 7, 1, a, b)]); w.played = false;
  const s = season(2026, [w], null, 0);
  s.status = 'in_season';
  s.playerTeams = { q1: 'KC', r1: 'SF', w1: 'MIA' };
  s.managers = {
    a: { userId: 'a', displayName: 'alice', teamName: null, avatar: null, rosterId: 1 },
    b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
  };
  return s;
}
const matchups: SleeperMatchup[] = [
  { roster_id: 1, matchup_id: 1, points: 20, custom_points: null, starters: ['q1', 'r1'], players: ['q1', 'r1'], players_points: { q1: 20, r1: 0 } },
  { roster_id: 2, matchup_id: 1, points: 5, custom_points: null, starters: ['w1'], players: ['w1'], players_points: { w1: 5 } },
];
const games = [
  { teams: ['KC', 'BUF'] as [string, string], state: 'post' as const, period: 4, clock: '0:00', kickoff: '2026-10-25T17:00Z', halftime: false },
  { teams: ['SF', 'SEA'] as [string, string], state: 'pre' as const, period: 0, clock: '', kickoff: '2026-10-25T20:25Z', halftime: false },
  { teams: ['MIA', 'NE'] as [string, string], state: 'in' as const, period: 2, clock: '4:00', kickoff: '2026-10-25T17:00Z', halftime: false },
];
const live = (s: Season, over: Partial<LiveData> = {}): LiveData => ({ season: s, week: 7, matchups, games, stats: null, projections: null, polling: true, ...over });

describe('weekStatus', () => {
  it('lays live points over the live week and counts starters whose game is upcoming or in progress', () => {
    const s = current();
    const st = weekStatus(s, s.weeks[0], live(s));
    expect(st.isLive).toBe(true);
    expect(st.week.games[0].sides[0].points).toBe(20);
    expect(st.toPlay(st.week.games[0].sides[0])).toBe(1); // q1 final, r1 upcoming
    expect(st.toPlay(st.week.games[0].sides[1])).toBe(1); // w1 live
    expect(st.outlookOf(st.week.games[0])?.status).toBe('live');
  });
  it('projects from this week\'s fresh projections, scored with the league scoring', () => {
    const s = current();
    s.scoring = { pass_yd: 0.04 };
    const st = weekStatus(s, s.weeks[0], live(s, { projections: { q1: { pass_yd: 250 }, r1: { pass_yd: 25 } } }));
    expect(st.week.games[0].sides[0].projected).toBe(11);
  });
  it('hides the count when ESPN could not be read, and everything when the week is not live', () => {
    const s = current();
    expect(weekStatus(s, s.weeks[0], live(s, { games: null })).toPlay(s.weeks[0].games[0].sides[0])).toBeNull();
    const off = weekStatus(s, s.weeks[0], live(s, { week: null, matchups: null }));
    expect(off.isLive).toBe(false);
    expect(off.outlookOf(s.weeks[0].games[0])).toBeNull();
    expect(off.toPlay(s.weeks[0].games[0].sides[0])).toBeNull();
  });
});
