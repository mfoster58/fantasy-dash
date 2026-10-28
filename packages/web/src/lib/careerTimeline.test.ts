import { careerTimeline } from './careerTimeline';
import type { CareerSeasonLine } from './teamProfile';
import { game, line, players, season, side, week } from '../test/playerFixtures';

const lineOf = (year: number, extra: Partial<CareerSeasonLine> = {}): CareerSeasonLine => ({
  year, status: 'complete', row: { userId: 'a', rank: 3, w: 9, l: 5, t: 0, pf: 1900.4 } as CareerSeasonLine['row'], teamName: 'Alpha', finish: '3rd', finishIcon: 'third',
  champion: false, runnerUp: false, third: true, pointsTitle: false, lastPlace: false, playoffBerth: true, ppw: 120, leagueAvgPpw: 110, grade: null, draftValue: null, moves: 0, ...extra,
});

describe('careerTimeline', () => {
  const s25 = season(2025, [
    week(1, [game(2025, 1, 1, side('a', 50, [line('q1', 20), line('r1', 10)], [line('w1', 40)]), side('b', 12, [line('t1', 12)]))]),
    week(2, [game(2025, 2, 1, side('a', 48, [line('q1', 15), line('r1', 30)]), side('b', 12, [line('t1', 12)]))]),
  ]);
  const s26 = season(2026, [week(1, [game(2026, 1, 1, side('a', 30, [line('w1', 30)]), side('b', 12, [line('t1', 12)]))])]);
  const stops = careerTimeline([lineOf(2026, { status: 'in_season', finishIcon: null, third: false }), lineOf(2025, { pointsTitle: true })], [s25, s26], 'a', players, 'alice');

  it('runs oldest first with the finish icon, record, regular-season rank and points for', () => {
    expect(stops.map((s) => s.year)).toEqual([2025, 2026]);
    expect(stops[0]).toMatchObject({ finish: 'third', pointsTitle: true, w: 9, l: 5, rank: 3, pf: 1900.4, live: false, teamName: 'Alpha' });
    expect(stops[1]).toMatchObject({ finish: null, live: true });
  });
  it("names his top scorer as the player with the most points while started; bench points don't count", () => {
    // r1 40 started, q1 35; w1's 40 came on the bench
    expect(stops[0].top).toMatchObject({ playerId: 'r1', points: 40 });
    expect(stops[1].top).toMatchObject({ playerId: 'w1', points: 30 });
  });
  it('falls back to "Team <manager>" when the league stored no team name', () => {
    const [s] = careerTimeline([lineOf(2025, { teamName: 'alice' })], [s25], 'a', players, 'alice');
    expect(s.teamName).toBe('Team alice');
  });
});
