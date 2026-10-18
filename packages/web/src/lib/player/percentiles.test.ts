import { METRICS, percentileBars } from './percentiles';
import { COLUMNS } from '../playerdb/columns';
import { miniDb } from '../../test/playerDbFixtures';

/** w2 keeps only his 4-target week, under Catch%'s 3-targets-a-week minimum over the 3-week season */
const thinW2 = () => { const db = miniDb(); db.rows = db.rows.filter((r) => !(r.id === 'w2' && r.week === 2)); return db; };

describe('percentileBars', () => {
  it('only lists metrics that exist as Players-table columns', () => {
    for (const list of Object.values(METRICS)) for (const m of list) expect(COLUMNS[m.key], m.key).toBeDefined();
  });
  it('gives a WR one bar per WR metric', () => {
    expect(percentileBars(miniDb(), 'w1')!.map((b) => b.key)).toEqual(METRICS.WR.map((m) => m.key));
  });
  it('ranks among peers over the sample minimum: a lone qualifier sits at 50', () => {
    expect(percentileBars(thinW2(), 'w1')!.find((b) => b.key === 'catchPct')).toMatchObject({ pct: 50, small: false });
  });
  it('greys a bar he is under the minimum for', () => {
    expect(percentileBars(thinW2(), 'w2')!.find((b) => b.key === 'catchPct')).toMatchObject({ pct: null, small: true });
  });
  it('turns a lower-is-better column around so a high bar is always good', () => {
    const drop = percentileBars(miniDb(), 'w1')!.find((b) => b.key === 'dropPct')!;
    expect(drop.pct === null || drop.pct <= 50).toBe(true);
  });
  it('is null for a player with no rows', () => {
    expect(percentileBars(miniDb(), 'k1')).toBeNull();
  });
});
