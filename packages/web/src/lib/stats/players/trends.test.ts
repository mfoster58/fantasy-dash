import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { trends } from './trends';

describe('trends', () => {
  const t = trends(statsDb(), statsCharts(), 'RB');
  const row = (id: string) => [...t.up, ...t.down].find((r) => r.id === id);
  it('windows the last five scored weeks with the RB columns', () => {
    expect(t.weeks).toEqual([1, 2, 3, 4, 5]);
    expect(t.columns.map((c) => c.key)).toEqual(['snap', 'rush', 'tgt', 'xfp', 'opp']);
  });
  it('a growing role trends up, a shrinking one down', () => {
    expect(t.up[0].id).toBe('rUp');
    expect(t.down[0].id).toBe('rDown');
    expect(row('rUp')!.cells.snap.change).toBeCloseTo((80 + 85) / 2 - 30);
  });
  it('injury-shortened and missed games do not count toward the change', () => {
    // rHurt: healthy weeks 1 and 5 only; one early healthy game is not enough to be ranked
    expect(row('rHurt')).toBeUndefined();
  });
  it('a currently Out player leaves both lists for the Injured line', () => {
    expect(row('rOut')).toBeUndefined();
    expect(t.injured).toEqual([{ id: 'rOut', name: 'Out Back', team: 'BBB', status: 'Out', injury: 'Groin' }]);
  });
  it('a bye shows as a bye cell', () => {
    const r = row('rLast');
    if (r) expect(r.cells.snap.weeks[2]).toEqual({ week: 3, state: 'bye', value: null });
  });
  it('the window ends at the last scored week when one is given (week 18 is not scored)', () => {
    expect(trends(statsDb(), statsCharts(), 'RB', 4).weeks).toEqual([1, 2, 3, 4]);
  });
  it('WR columns', () => {
    expect(trends(statsDb(), statsCharts(), 'WR').columns.map((c) => c.key)).toEqual(['snap', 'route', 'tgt', 'ay', 'xfp']);
  });
});
