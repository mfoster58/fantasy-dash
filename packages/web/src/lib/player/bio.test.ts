import { bioOf } from './bio';
import { players } from '../../test/playerFixtures';
import { miniDb } from '../../test/playerDbFixtures';

const today = new Date('2026-10-18T12:00:00Z');
const withBio = () => {
  const db = miniDb();
  db.players.w1 = { ...db.players.w1, birthDate: '2001-05-29', height: 74, weight: 210, college: 'BYU', draft: { year: 2023, round: 5, pick: 177 } };
  return db;
};

describe('bioOf', () => {
  it('reads the newest database entry: age on the day, feet and inches, NFL draft', () => {
    expect(bioOf('w1', players, [withBio()], today)).toMatchObject({ name: 'Wide One', pos: 'WR', age: 25, height: `6'2"`, weight: 210, college: 'BYU', nflDraft: '2023 · R5 #177' });
  });
  it('falls back to the directory for a kicker, leaving unknown fields null', () => {
    expect(bioOf('k1', players, [miniDb()], today)).toEqual({ name: 'Kick One', pos: 'K', nflTeam: 'BAL', age: null, height: null, weight: null, college: null, nflDraft: null });
  });
  it('counts a birthday later in the year as not yet reached', () => {
    const db = withBio();
    db.players.w1 = { ...db.players.w1, birthDate: '2001-12-01' };
    expect(bioOf('w1', players, [db], today).age).toBe(24);
  });
});
