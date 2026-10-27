import { miniDb } from '../../test/playerDbFixtures';
import { compareHref, groupOf, parseCompare } from './url';

const q = (s: string) => new URLSearchParams(s);

describe('compare URL state', () => {
  it('round-trips state', () => {
    const s = { season: 2026, pos: 'WRTE' as const, ids: ['w1', 't1'] };
    expect(compareHref(s)).toBe('/players/compare?season=2026&pos=WRTE&p=w1,t1');
    expect(parseCompare(q(compareHref(s).split('?')[1]), [2025, 2026], miniDb())).toEqual(s);
    expect(compareHref({ season: 2026, pos: 'RB', ids: [] })).toBe('/players/compare?season=2026&pos=RB');
  });
  it('drops unknown, wrong-position and duplicate ids and keeps four', () => {
    const db = miniDb();
    for (const id of ['w3', 'w4', 'w5']) db.players[id] = { ...db.players.w1, id };
    expect(parseCompare(q('season=2026&pos=WRTE&p=w1,zz,r1,w1,w2,w3,w4,w5'), [2026], db).ids).toEqual(['w1', 'w2', 'w3', 'w4']);
  });
  it('falls back to RB and the newest season', () => {
    expect(parseCompare(q('season=1999&pos=K'), [2024, 2026, 2025], miniDb())).toEqual({ season: 2026, pos: 'RB', ids: [] });
  });
  it('WR and TE share a group; kickers have none', () => {
    expect(groupOf('WR')).toBe('WRTE');
    expect(groupOf('TE')).toBe('WRTE');
    expect(groupOf('QB')).toBe('QB');
    expect(groupOf('K')).toBeNull();
  });
});
