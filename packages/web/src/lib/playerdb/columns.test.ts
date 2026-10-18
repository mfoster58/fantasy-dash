import { COLUMNS, DEFAULT_SORT, TABS, TAB_GROUPS, belowMin, columnValue, columnsFor, fmtValue, groupsFor, tabPositions } from './columns';
import { aggregate } from './aggregate';
import { miniDb } from '../../test/playerDbFixtures';

const agg = (id: string, from = 1, to = 3) => aggregate(miniDb(), from, to).find((a) => a.id === id)!;

describe('column catalogue', () => {
  it('every tab lists existing columns with no duplicates and the lead block first', () => {
    for (const tab of TABS) {
      const cols = columnsFor(tab);
      const keys = cols.map((c) => c.key);
      expect(new Set(keys).size, tab).toBe(keys.length);
      for (const g of TAB_GROUPS[tab]) for (const k of g.keys) expect(COLUMNS[k], `${tab}:${k}`).toBeDefined();
      expect(keys.slice(0, 5)).toEqual(['g', 'pts', 'ppg', 'posRank', 'projPlus']);
      expect(groupsFor(tab)[0].group).toBe('');
    }
    expect(COLUMNS[DEFAULT_SORT]).toBeDefined();
    expect(tabPositions('all')).toEqual(['QB', 'RB', 'WR', 'TE']);
    expect(TAB_GROUPS.all.map((g) => [g.group, g.keys])).toEqual([
      ['', ['g', 'pts', 'ppg', 'posRank', 'projPlus']],
      ['Usage', ['snapPct', 'touches']],
      ['Rushing', ['car', 'ruYds', 'ruTd']],
      ['Receiving', ['tgt', 'rec', 'reYds', 'reTd']],
      ['Passing', ['cmp', 'att', 'paYds', 'paTd', 'int']],
    ]);
    expect(tabPositions('te')).toEqual(['TE']);
  });
  it('every column has a definition and a format', () => {
    for (const c of Object.values(COLUMNS)) { expect(c.def.length, c.key).toBeGreaterThan(8); expect(['int', 'dec1', 'dec2', 'pct', 'signed1']).toContain(c.fmt); }
  });
});

describe('columnValue', () => {
  const w1 = agg('w1');
  it('computes rates from summed numerators and denominators', () => {
    expect(columnValue(COLUMNS.catchPct, w1, 'total')).toBeCloseTo(17 / 26, 6);
    expect(columnValue(COLUMNS.yprr, w1, 'total')).toBeCloseTo(250 / 97, 6);
    expect(columnValue(COLUMNS.tgtPct, w1, 'total')).toBeCloseTo(26 / 100, 6);
    expect(columnValue(COLUMNS.ayPct, w1, 'total')).toBeCloseTo(300 / 780, 6);
    expect(columnValue(COLUMNS.wopr, w1, 'total')).toBeCloseTo(1.5 * 26 / 100 + 0.7 * 300 / 780, 6);
    expect(columnValue(COLUMNS.snapPct, w1, 'total')).toBeCloseTo(163 / 180, 6);
    expect(columnValue(COLUMNS.fdrr, w1, 'total')).toBeCloseTo(11 / 97, 6);
    expect(columnValue(COLUMNS.epaDb, agg('q1'), 'total')).toBeCloseTo(9 / 96, 6);
  });
  it('caps snap and route share at 100%', () => {
    const over = { ...w1, s: { ...w1.s, snaps: 70, teamSnaps: 66 }, routes: 50, t: { ...w1.t, dropbacks: 40 } };
    expect(columnValue(COLUMNS.snapPct, over, 'total')).toBe(1);
    expect(columnValue(COLUMNS.routePct, over, 'total')).toBe(1);
  });
  it('divides counting stats by games in per-game mode and leaves rates alone', () => {
    expect(columnValue(COLUMNS.tgt, w1, 'total')).toBe(26);
    expect(columnValue(COLUMNS.tgt, w1, 'pg')).toBeCloseTo(26 / 3, 6);
    expect(columnValue(COLUMNS.catchPct, w1, 'pg')).toBeCloseTo(17 / 26, 6);
    expect(columnValue(COLUMNS.ppg, w1, 'pg')).toBeCloseTo(50 / 3, 6);
  });
  it('returns null for missing numerators or zero denominators', () => {
    expect(columnValue(COLUMNS.ypc, w1, 'total')).toBeNull();
    expect(columnValue(COLUMNS.sep, agg('w2'), 'total')).toBeNull();
    expect(columnValue(COLUMNS.fpoe, agg('t1'), 'total')).toBeNull();
    expect(columnValue(COLUMNS.fpoe, w1, 'total')).toBeCloseTo(50 - 47, 6);
  });
  it('flags rate cells under the per-week minimum', () => {
    expect(belowMin(COLUMNS.catchPct, agg('r1'))).toBe(true);         // 6 targets < 3 × 3
    expect(belowMin(COLUMNS.catchPct, agg('w2'))).toBe(false);        // 10 targets ≥ 3 × 3
    expect(belowMin(COLUMNS.yprr, agg('r1'))).toBe(false);            // 35 routes ≥ 10 × 3
  });
  it('marks route columns as estimated and lower-is-better columns', () => {
    expect(COLUMNS.yprr.est).toBe(true);
    expect(COLUMNS.int.lowerIsBetter).toBe(true);
    expect(COLUMNS.pts.tinted).toBe(false);
  });
  it('formats by kind, and ints as one decimal in per-game mode', () => {
    expect(fmtValue(26, 'int', 'total')).toBe('26');
    expect(fmtValue(26 / 3, 'int', 'pg')).toBe('8.7');
    expect(fmtValue(0.6538, 'pct', 'total')).toBe('65.4%');
    expect(fmtValue(2.5773, 'dec2', 'total')).toBe('2.58');
    expect(fmtValue(3, 'signed1', 'total')).toBe('+3.0');
    expect(fmtValue(null, 'int', 'total')).toBe('–');
  });
});

describe('zero fill', () => {
  it('shows 0 for a counting stat the player had none of in games he played, and keeps rates and model values empty', () => {
    const w1 = agg('w1');
    expect(columnValue(COLUMNS.cmp, w1, 'total')).toBe(0);
    expect(columnValue(COLUMNS.ruTd, w1, 'total')).toBe(0);
    expect(columnValue(COLUMNS.cmp, w1, 'pg')).toBe(0);
    expect(columnValue(COLUMNS.ypc, w1, 'total')).toBeNull();
    expect(columnValue(COLUMNS.fpoe, agg('t1'), 'total')).toBeNull();
    expect(columnValue(COLUMNS.touches, w1, 'total')).toBe(17);
  });
});
