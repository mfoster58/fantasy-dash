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
    expect(games[0]).toEqual({ teams: ['KC', 'WAS'], state: 'in', period: 3, clock: '4:12', kickoff: '2026-10-25T17:00Z', halftime: false, field: null });
    expect(games[1].halftime).toBe(true);
    expect(games[2].state).toBe('pre');
  });
  it('reads where the ball is and who has it in a game in progress', () => {
    const e = {
      date: '2026-10-27T00:15Z',
      status: { period: 4, displayClock: '11:21', type: { state: 'in', name: 'STATUS_IN_PROGRESS' } },
      competitions: [{
        competitors: [{ homeAway: 'home', team: { id: '21', abbreviation: 'PHI' } }, { homeAway: 'away', team: { id: '28', abbreviation: 'WSH' } }],
        situation: { possession: '28', yardLine: 11, shortDownDistanceText: '1st & 10', downDistanceText: '1st & 10 at PHI 11', isRedZone: true },
      }],
    };
    expect(parseScoreboard({ events: [e] })[0].field).toEqual({ home: 'PHI', away: 'WAS', possession: 'WAS', yardLine: 11, down: '1st & 10 at PHI 11', redZone: true });
    const between = { ...e, competitions: [{ ...e.competitions[0], situation: {} }] };
    expect(parseScoreboard({ events: [between] })[0].field).toEqual({ home: 'PHI', away: 'WAS', possession: null, yardLine: null, down: null, redZone: false });
    const notStarted = { ...e, status: { period: 0, displayClock: '0:00', type: { state: 'pre', name: 'STATUS_SCHEDULED' } } };
    expect(parseScoreboard({ events: [notStarted] })[0].field).toBeNull();
  });
  it('reads the home team and each side\'s score', () => {
    const e = {
      date: '2026-10-25T17:00Z',
      status: { period: 4, displayClock: '0:00', type: { state: 'post', name: 'STATUS_FINAL' } },
      competitions: [{ competitors: [{ homeAway: 'home', score: '27', team: { id: '5', abbreviation: 'CLE' } }, { homeAway: 'away', score: '24', team: { id: '33', abbreviation: 'BAL' } }] }],
    };
    const [game] = parseScoreboard({ events: [e] });
    expect(game.home).toBe('CLE');
    expect(game.score).toEqual({ CLE: 27, BAL: 24 });
  });
  it('gives no games for a body it cannot read', () => {
    expect(parseScoreboard(null)).toEqual([]);
    expect(parseScoreboard({ events: [{ nope: 1 }] })).toEqual([]);
  });
});
