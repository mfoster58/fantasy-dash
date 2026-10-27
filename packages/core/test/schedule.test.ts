import { describe, it, expect } from 'vitest';
import { parseSchedule, ScheduleSchema } from '../src';

const row = (season: string, game_type: string, week: string, away_team: string, home_team: string) => ({ season, game_type, week, away_team, home_team });

describe('parseSchedule', () => {
  it('parses regular-season games of the year, normalising team codes', () => {
    const rows = [row('2026', 'REG', '8', 'LA', 'SF'), row('2026', 'WC', '19', 'SF', 'DAL'), row('2025', 'REG', '8', 'KC', 'BUF')];
    expect(parseSchedule(rows, 2026)).toEqual({ year: 2026, games: [{ week: 8, home: 'SF', away: 'LAR' }] });
  });
  it('the result parses with ScheduleSchema', () => {
    expect(() => ScheduleSchema.parse(parseSchedule([row('2026', 'REG', '1', 'NE', 'SEA')], 2026))).not.toThrow();
  });
});
