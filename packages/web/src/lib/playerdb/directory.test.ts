import { dbDirectory } from './directory';
import { miniDb } from '../../test/playerDbFixtures';

describe('dbDirectory', () => {
  it('exposes every database player as a PlayerInfo with his last team', () => {
    const d = dbDirectory(miniDb());
    expect(d.w1).toEqual({ id: 'w1', name: 'Wide One', firstName: 'Wide', lastName: 'One', position: 'WR', team: 'KC', yearsExp: 2, birthDate: null });
    expect(Object.keys(d)).toHaveLength(5);
  });
});
