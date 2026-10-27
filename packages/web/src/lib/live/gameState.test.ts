import type { NflGame } from './espn';
import { fractionLeft, gameFor, gameLabel, playerGames } from './gameState';

const g = (teams: [string, string], state: NflGame['state'], period = 0, clock = '15:00', halftime = false): NflGame =>
  ({ teams, state, period, clock, kickoff: '2026-10-25T17:00Z', halftime });
const games = [g(['KC', 'WAS'], 'in', 3, '4:12'), g(['SF', 'LAR'], 'post', 4, '0:00'), g(['BUF', 'MIA'], 'pre')];

describe('gameFor', () => {
  it('finds the state of the player\'s NFL game', () => {
    expect(gameFor('WAS', games)).toEqual({ kind: 'live', period: 3, clock: '4:12', halftime: false });
    expect(gameFor('SF', games)).toEqual({ kind: 'final' });
    expect(gameFor('MIA', games)).toEqual({ kind: 'upcoming', kickoff: '2026-10-25T17:00Z' });
  });
  it('gives a finished game its result from the player\'s side: W/L/T, his team\'s score first, vs at home and @ away', () => {
    const done = (home: string, away: string, hs: number, as: number): NflGame => ({ ...g([home, away], 'post', 4, '0:00'), home, score: { [home]: hs, [away]: as } });
    const finals = [done('CLE', 'BAL', 27, 24), done('ARI', 'SEA', 16, 30), done('NYG', 'DAL', 20, 20)];
    expect(gameFor('BAL', finals)).toEqual({ kind: 'final', result: 'L 24-27 @ CLE' });
    expect(gameFor('CLE', finals)).toEqual({ kind: 'final', result: 'W 27-24 vs BAL' });
    expect(gameFor('SEA', finals)).toEqual({ kind: 'final', result: 'W 30-16 @ ARI' });
    expect(gameFor('NYG', finals)).toEqual({ kind: 'final', result: 'T 20-20 vs DAL' });
  });
  it('is a bye for a team with no game or a player with no team, and unknown without ESPN', () => {
    expect(gameFor('NYJ', games)).toEqual({ kind: 'bye' });
    expect(gameFor('', games)).toEqual({ kind: 'bye' });
    expect(gameFor('KC', null)).toEqual({ kind: 'unknown' });
  });
  it('looks each player\'s team up through playerGames', () => {
    const of = playerGames((id) => (id === 'p1' ? 'KC' : 'SF'), games);
    expect(of('p1').kind).toBe('live');
    expect(of('p2').kind).toBe('final');
  });
});

describe('fractionLeft', () => {
  it('counts the minutes left in regulation', () => {
    expect(fractionLeft({ kind: 'live', period: 3, clock: '4:12', halftime: false })).toBeCloseTo((15 + 4.2) / 60, 6);
    expect(fractionLeft({ kind: 'live', period: 1, clock: '15:00', halftime: false })).toBe(1);
    expect(fractionLeft({ kind: 'live', period: 2, clock: '0:00', halftime: true })).toBe(0.5);
  });
  it('is 0 in overtime, after the game and on a bye; 1 before kickoff or without ESPN', () => {
    expect(fractionLeft({ kind: 'live', period: 5, clock: '8:00', halftime: false })).toBe(0);
    expect(fractionLeft({ kind: 'final' })).toBe(0);
    expect(fractionLeft({ kind: 'bye' })).toBe(0);
    expect(fractionLeft({ kind: 'upcoming', kickoff: '2026-10-25T17:00Z' })).toBe(1);
    expect(fractionLeft({ kind: 'unknown' })).toBe(1);
  });
});

describe('gameLabel', () => {
  it('names the game state the way a box score reads', () => {
    expect(gameLabel({ kind: 'live', period: 3, clock: '4:12', halftime: false })).toBe('Q3 4:12');
    expect(gameLabel({ kind: 'live', period: 2, clock: '0:00', halftime: true })).toBe('Half');
    expect(gameLabel({ kind: 'live', period: 5, clock: '8:00', halftime: false })).toBe('OT 8:00');
    expect(gameLabel({ kind: 'final' })).toBe('Final');
    expect(gameLabel({ kind: 'bye' })).toBe('Bye');
    expect(gameLabel({ kind: 'upcoming', kickoff: '2026-10-25T17:00Z' }, 'America/New_York')).toBe('Sun 1:00 PM');
    expect(gameLabel({ kind: 'unknown' })).toBeNull();
  });
});
