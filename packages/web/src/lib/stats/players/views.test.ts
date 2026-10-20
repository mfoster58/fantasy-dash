import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from './season';
import { STAT_OPTIONS, VIEWS, customView, viewPool, viewsFor, volume } from './views';

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

describe('custom views', () => {
  it('every position has its own list of stats to pick from, each a real PlayerStat number', () => {
    for (const pos of ['QB', 'RB', 'WR', 'TE'] as const) expect(STAT_OPTIONS[pos].length).toBeGreaterThanOrEqual(10);
    expect(STAT_OPTIONS.QB.map((o) => o.key)).toContain('cpoe');
    expect(STAT_OPTIONS.RB.map((o) => o.key)).toContain('succ');
    expect(STAT_OPTIONS.WR.map((o) => o.key)).toContain('yprr');
  });
  it('builds a view from two picks: labels, quadrant names from both, and the position minimum', () => {
    const v = customView('RB', 'car', 'ppg');
    expect(v.id).toBe('custom');
    expect([v.x, v.y]).toEqual(['car', 'ppg']);
    expect(v.label).toBe('PPG vs Carries');
    expect(v.quads).toEqual(['High Carries · High PPG', 'Low Carries · High PPG', 'High Carries · Low PPG', 'Low Carries · Low PPG']);
    const pool = viewPool(v, seasonStats(statsDb(), statsCharts()), 'RB');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((p) => p.car >= 20)).toBe(true);
  });
  it('an unknown pick falls back to the first options', () => {
    const v = customView('QB', 'nope', 'nada');
    expect([v.x, v.y]).toEqual([STAT_OPTIONS.QB[0].key, STAT_OPTIONS.QB[1].key]);
  });
});

