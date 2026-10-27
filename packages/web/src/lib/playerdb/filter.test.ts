import { aggregate } from './aggregate';
import { filterAggs, isRookie } from './filter';
import { parseState } from './url';
import { miniDb } from '../../test/playerDbFixtures';

const db = miniDb();
db.players.w2 = { ...db.players.w2, draft: { year: 2026, round: 3, pick: 70 } };
db.players.t1 = { ...db.players.t1, draft: null, yearsExp: 0 };
const all = aggregate(db, 1, 3);
const ids = (q: string) => filterAggs(all, db, parseState(new URLSearchParams(q), 3), {}, 2026).map((a) => a.id).sort();

describe('isRookie', () => {
  it('is drafted that season, or undrafted with as many years in the league as seasons since', () => {
    expect(isRookie(db.players.w2, 2026, 2026)).toBe(true);
    expect(isRookie(db.players.t1, 2026, 2026)).toBe(true);
    expect(isRookie({ ...db.players.t1, yearsExp: 1 }, 2025, 2026)).toBe(true);
    expect(isRookie(db.players.w1, 2026, 2026)).toBe(false);
  });
});

describe('filterAggs', () => {
  it('keeps rookies only, and one NFL team only', () => {
    expect(ids('rookies=1')).toEqual(['t1', 'w2']);
    expect(ids('team=KC')).toEqual(['t1', 'w1']);
    expect(ids('team=KC&rookies=1')).toEqual(['t1']);
    expect(ids('tab=wr&q=two')).toEqual(['w2']);
  });
});
