import { describe, expect, it } from 'vitest';
import { buildCatchSpots, CatchSpotsSchema, catchKey } from './catches';

const row = (over: Record<string, string>) => ({
  season_type: 'REG', week: '7', posteam: 'CLE', qtr: '1', time: '07:13', complete_pass: '1', air_yards: '-3', ...over,
});

describe('buildCatchSpots', () => {
  it('keeps each completed catch\'s air yards by week, keyed by team, quarter and game clock', () => {
    const db = buildCatchSpots([row({}), row({ qtr: '2', time: '12:15', air_yards: '4' })], 2026, 'now');
    expect(CatchSpotsSchema.parse(db)).toEqual({ year: 2026, builtAt: 'now', weeks: { 7: { 'CLE|1|7:13': -3, 'CLE|2|12:15': 4 } } });
  });

  it('writes the clock the way ESPN does, and the team the way Sleeper does', () => {
    expect(catchKey('LA', 3, '00:42')).toBe('LAR|3|0:42');
    expect(buildCatchSpots([row({ posteam: 'LA', qtr: '4', time: '09:05' })], 2026, 'now').weeks[7]).toEqual({ 'LAR|4|9:05': -3 });
  });

  it('leaves out incompletions, plays without air yards and the postseason', () => {
    const db = buildCatchSpots([row({ complete_pass: '0' }), row({ air_yards: 'NA' }), row({ season_type: 'POST' })], 2026, 'now');
    expect(db.weeks).toEqual({});
  });
});
