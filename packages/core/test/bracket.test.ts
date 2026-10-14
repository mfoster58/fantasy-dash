import { describe, it, expect } from 'vitest';
import { tagFor, resolveBracket, tagForGame, computeHonors } from '../src/bracket';
import type { SleeperBracketGame } from '../src/sleeper/types';
import type { StandingRow } from '../src/types';

const rosterToUser = { 1: 'u1', 2: 'u2', 3: 'u3', 4: 'u4' };

describe('tagFor', () => {
  it('tags winners bracket games', () => {
    expect(tagFor('winners', 1, null)).toBe('QF');
    expect(tagFor('winners', 2, null)).toBe('SF');
    expect(tagFor('winners', 2, 5)).toBe('5th');
    expect(tagFor('winners', 3, 1)).toBe('Final');
    expect(tagFor('winners', 3, 3)).toBe('3rd');
  });
  it('tags consolation games', () => {
    expect(tagFor('consolation', 1, null)).toBe('Cons-R1');
    expect(tagFor('consolation', 2, 1)).toBe('Toilet Bowl');
    expect(tagFor('consolation', 2, 3)).toBe('Cons-7th');
  });
});

describe('resolveBracket', () => {
  const points: Record<string, number> = { 'u1@15': 100, 'u2@15': 90, 'u3@15': 100, 'u4@15': 90 };
  const weekPoints = (week: number, userId: string) => points[`${userId}@${week}`] ?? null;

  it('advances the higher scorer in the winners bracket', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 1, t2: 2, w: 2, l: 1 }];
    const [g] = resolveBracket(raw, 'winners', 15, rosterToUser, weekPoints);
    expect(g).toMatchObject({ week: 15, tag: 'QF', home: 'u1', away: 'u2', homePoints: 100, awayPoints: 90, advanced: 'u1', gameId: null });
  });

  it('advances the lower scorer in the consolation bracket', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 3, t2: 4, w: 3, l: 4 }];
    const [g] = resolveBracket(raw, 'consolation', 15, rosterToUser, weekPoints);
    expect(g.advanced).toBe('u4');
  });

  it('falls back to the Sleeper w field on a tie', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 1, t2: 3, w: 3, l: 1 }];
    const [g] = resolveBracket(raw, 'winners', 15, rosterToUser, weekPoints);
    expect(g.advanced).toBe('u3');
  });

  it('leaves teams and outcome null when not yet decided', () => {
    const raw: SleeperBracketGame[] = [{ r: 2, m: 3, t1_from: { w: 1 }, t2_from: { w: 2 }, p: 1 }];
    const [g] = resolveBracket(raw, 'winners', 15, rosterToUser, weekPoints);
    expect(g).toMatchObject({ week: 16, tag: 'Final', home: null, away: null, homePoints: null, awayPoints: null, advanced: null });
  });
});

describe('tagForGame', () => {
  it('finds the tag for a pair in a week regardless of order', () => {
    const raw: SleeperBracketGame[] = [{ r: 1, m: 1, t1: 1, t2: 2 }];
    const b = resolveBracket(raw, 'winners', 15, rosterToUser, () => null);
    expect(tagForGame(b, 15, 'u2', 'u1')).toBe('QF');
    expect(tagForGame(b, 16, 'u2', 'u1')).toBeNull();
    expect(tagForGame(b, 15, 'u3', 'u1')).toBeNull();
  });
});

describe('computeHonors', () => {
  const standings = [
    { userId: 'u2', pf: 1500 }, { userId: 'u1', pf: 1600 }, { userId: 'u3', pf: 1000 }, { userId: 'u4', pf: 900 },
  ] as StandingRow[];
  const pts: Record<string, number> = { 'u1@16': 120, 'u2@16': 110, 'u3@16': 80, 'u4@16': 60, 'u1@15': 1, 'u3@15': 1 };
  const wp = (w: number, u: string) => pts[`${u}@${w}`] ?? null;
  const winners = resolveBracket(
    [{ r: 2, m: 1, t1: 1, t2: 2, p: 1 }, { r: 2, m: 2, t1: 3, t2: 4, p: 3 }], 'winners', 15, rosterToUser, wp);
  const consolation = resolveBracket(
    [{ r: 2, m: 1, t1: 3, t2: 4, p: 1 }], 'consolation', 15, rosterToUser, wp);

  it('reads champion, runner-up, third, last place and points title', () => {
    expect(computeHonors(winners, consolation, standings, 'complete')).toEqual({
      champion: 'u1', runnerUp: 'u2', third: 'u3', lastPlace: 'u4', pointsTitle: 'u1',
    });
  });

  it('is all null while the season is in progress', () => {
    expect(computeHonors(winners, consolation, standings, 'in_season')).toEqual({
      champion: null, runnerUp: null, third: null, lastPlace: null, pointsTitle: null,
    });
  });
});
