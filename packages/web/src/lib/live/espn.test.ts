import { normTeam, parseScoreboard, scoreboardUrl } from './espn';

const event = (home: string, away: string, state: string, period: number, clock: string, date: string, name = 'STATUS_IN_PROGRESS') => ({
  date,
  status: { period, displayClock: clock, type: { state, name } },
  competitions: [{ competitors: [{ team: { abbreviation: home } }, { team: { abbreviation: away } }] }],
});

describe('ESPN scoreboard', () => {
  it('asks for the given regular-season week', () => {
    expect(scoreboardUrl(2026, 8)).toBe('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=8');
  });
  it('turns ESPN team codes into Sleeper ones', () => {
    expect(normTeam('WSH')).toBe('WAS');
    expect(normTeam('KC')).toBe('KC');
  });
  it('reads each game\'s teams, state, quarter, clock, kickoff and halftime', () => {
    const games = parseScoreboard({ events: [
      event('KC', 'WSH', 'in', 3, '4:12', '2026-10-25T17:00Z'),
      event('SF', 'LAR', 'in', 2, '0:00', '2026-10-25T17:00Z', 'STATUS_HALFTIME'),
      event('BUF', 'MIA', 'pre', 0, '0:00', '2026-10-26T00:20Z', 'STATUS_SCHEDULED'),
    ] });
    expect(games[0]).toEqual({ teams: ['KC', 'WAS'], state: 'in', period: 3, clock: '4:12', kickoff: '2026-10-25T17:00Z', halftime: false });
    expect(games[1].halftime).toBe(true);
    expect(games[2].state).toBe('pre');
  });
  it('gives no games for a body it cannot read', () => {
    expect(parseScoreboard(null)).toEqual([]);
    expect(parseScoreboard({ events: [{ nope: 1 }] })).toEqual([]);
  });
});
