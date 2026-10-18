import { dbYearsOf, isRostered } from './coverage';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { miniDb } from '../../test/playerDbFixtures';

describe('coverage', () => {
  it('knows who was ever on a roster, starter or bench', () => {
    const s = leagueSeasons();
    expect(isRostered(s, 'w1')).toBe(true);
    expect(isRostered(s, 'q1')).toBe(true);
    expect(isRostered(s, 'k1')).toBe(true);
    expect(isRostered(s, 't1')).toBe(false);
  });
  it('lists the database years a player has rows in, oldest first', () => {
    const older = { ...miniDb(), year: 2025 };
    expect(dbYearsOf([miniDb(), older], 'w1')).toEqual([2025, 2026]);
    expect(dbYearsOf([miniDb()], 'nobody')).toEqual([]);
  });
});
