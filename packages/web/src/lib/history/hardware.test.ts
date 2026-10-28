import { game, season, side, standing, week } from '../../test/playerFixtures';
import { seasonHardware } from './hardware';

const mgr = (userId: string, teamName: string | null, avatar: string | null) => ({ userId, displayName: userId.toUpperCase(), teamName, avatar, rosterId: 1 });

function done() {
  const s = season(2025, [
    week(1, [game(2025, 1, 1, side('a', 120, []), side('b', 100, []))]),
    week(17, [game(2025, 17, 1, side('b', 112.1, []), side('a', 115.48, []), 'Final'), game(2025, 17, 2, side('c', 140, []), side('d', 130, []), '3rd')], true),
  ]);
  s.managers = { a: mgr('a', 'Chad McConkey', 'https://sleepercdn.com/uploads/a.jpg'), b: mgr('b', null, 'abc123'), c: mgr('c', 'Bijon', null), d: mgr('d', 'Write me off', null) };
  s.standings = [standing('c', 1, 10, 4, 0, 2062, 1800), standing('a', 2, 8, 6, 0, 2004, 1885), standing('b', 3, 8, 6, 0, 1900, 1850), standing('d', 4, 3, 11, 0, 1600, 2100)];
  s.honors = { champion: 'a', runnerUp: 'b', third: 'c', pointsTitle: 'c', lastPlace: 'd' };
  return s;
}

describe('seasonHardware', () => {
  it("names every winner with that season's team name, picture, record and seed", () => {
    const h = seasonHardware(done());
    expect(h).toMatchObject({ year: 2025, live: false });
    expect(h.champion).toMatchObject({ userId: 'a', team: 'Chad McConkey', manager: 'A', avatar: 'https://sleepercdn.com/uploads/a.jpg', w: 8, l: 6, rank: 2 });
    // a Sleeper avatar id becomes its full-size URL; no team name falls back to the manager's name
    expect(h.runnerUp).toMatchObject({ team: 'B', avatar: 'https://sleepercdn.com/avatars/abc123' });
    expect(h.third?.userId).toBe('c');
    expect(h.pointsTitle).toMatchObject({ userId: 'c', pf: 2062 });
    expect(h.seed?.userId).toBe('c');
    expect(h.lastPlace?.userId).toBe('d');
  });
  it('the final score comes from the Final game, champion first', () => {
    expect(seasonHardware(done()).final).toEqual({ winner: 115.48, loser: 112.1 });
  });
  it('a season in progress has no hardware yet: its top seed and points leader so far', () => {
    const s = done();
    s.status = 'in_season';
    s.honors = { champion: null, runnerUp: null, third: null, pointsTitle: null, lastPlace: null };
    const h = seasonHardware(s);
    expect(h).toMatchObject({ live: true, champion: null, final: null, lastPlace: null });
    expect(h.seed?.userId).toBe('c');
    expect(h.pointsTitle).toMatchObject({ userId: 'c', pf: 2062 });
  });
});
