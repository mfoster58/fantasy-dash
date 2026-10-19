import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from './season';
import { VIEWS, viewPool, viewsFor, volume } from './views';

describe('views', () => {
  it('each position has its views, ids unique within a position', () => {
    expect(viewsFor('QB').map((v) => v.id)).toEqual(['anya', 'aggr', 'clutch', 'press', 'cov']);
    expect(viewsFor('RB').map((v) => v.id)).toEqual(['xfp', 'rz', 'boom', 'ryoe', 'opp', 'ypc']);
    expect(viewsFor('WR').map((v) => v.id)).toEqual(['xfp', 'role', 'yprr', 'sep', 'fd', 'cov']);
    expect(viewsFor('TE').map((v) => v.id)).toEqual(viewsFor('WR').map((v) => v.id));
    for (const v of VIEWS) expect(v.quads).toHaveLength(4);
  });
  it('volume: dropbacks, carries + targets, targets', () => {
    const s = seasonStats(statsDb(), statsCharts());
    expect(volume(s.find((p) => p.id === 'qA')!)).toBe(160);
    expect(volume(s.find((p) => p.id === 'rUp')!)).toBe(54 + 12);
    expect(volume(s.find((p) => p.id === 'wA')!)).toBe(42);
  });
  it('the pool applies the minimum, drops nulls, and keeps the 40 with most volume', () => {
    const s = seasonStats(statsDb(), statsCharts());
    const boom = VIEWS.find((v) => v.id === 'boom' && v.pos.includes('RB'))!;
    expect(viewPool(boom, s, 'RB').map((p) => p.id)).toEqual(['rDown', 'rUp']);   // only they have play-by-play rushing
    const many = Array.from({ length: 60 }, (_, i) => ({ ...s.find((p) => p.id === 'rUp')!, id: `x${i}`, car: 100 + i }));
    const pool = viewPool(VIEWS.find((v) => v.id === 'xfp' && v.pos.includes('RB'))!, many, 'RB');
    expect(pool).toHaveLength(40);
    expect(pool[0].id).toBe('x59');
  });
});
