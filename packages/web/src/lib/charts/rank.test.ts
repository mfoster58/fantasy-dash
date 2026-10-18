import { miniCharts } from '../../test/chartFixtures';
import { chartItems, hasChart } from './rank';
import { LANE_SPEC, ROUTE_SPEC, SPLIT_SPEC, ZONE_SPEC } from './specs';

const db = miniCharts();
const item = <K extends string>(items: { key: K }[] | null, key: K) => items!.find((i) => i.key === key)!;

describe('chartItems: routes', () => {
  it('ranks yards per target among WRs with 5+ targets on the route', () => {
    const go = item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt'), 'GO');
    expect(go.value).toBe(15);
    expect(go.pct).toBe(50);           // 8, 15, 24
    expect(item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt'), 'IN/DIG').pct).toBe(100); // 12 vs 10
  });
  it('ranks a route he has exactly 5 targets on, and leaves one with 4 unranked', () => {
    expect(item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt'), 'SLANT').ranked).toBe(true);
    const dig = item(chartItems(ROUTE_SPEC, db, '00-t1', 'all', 'ypt'), 'IN/DIG');
    expect(dig.ranked).toBe(false);
    expect(dig.pct).toBeNull();
    expect(dig.value).toBe(7.5);
  });
  it('ranks a TE only against TEs', () => {
    expect(item(chartItems(ROUTE_SPEC, db, '00-t1', 'all', 'ypt'), 'GO').pct).toBe(50); // the lone TE
  });
  it('target share is ranked within the 50+ target pool, plus himself', () => {
    const go = item(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'share'), 'GO');
    expect(go.share).toBeCloseTo(0.6);
    expect(go.value).toBeCloseTo(0.6);
    expect(go.pct).toBe(100);          // w1 0.6 vs w2 0.333; x3 (10 targets) is out of the pool
    expect(go.sharePct).toBe(100);
  });
  it('filters by coverage, and only lists routes he has counts for in that filter', () => {
    const man = chartItems(ROUTE_SPEC, db, '00-w1', 'man', 'ypt')!;
    expect(man.map((i) => i.key)).toEqual(['GO', 'IN/DIG']);
    expect(man[0].pct).toBe(100);       // 12 vs w2's 8
    expect(man[1].ranked).toBe(false);  // 3 man targets on the dig
  });
  it('lists items in route order, null for a player with no route table, and hasChart follows', () => {
    expect(chartItems(ROUTE_SPEC, db, '00-w1', 'all', 'ypt')!.map((i) => i.key)).toEqual(['GO', 'IN/DIG', 'SLANT']);
    expect(chartItems(ROUTE_SPEC, db, '00-q1', 'all', 'ypt')).toBeNull();
    expect(chartItems(ROUTE_SPEC, db, 'nobody', 'all', 'ypt')).toBeNull();
    expect(hasChart(ROUTE_SPEC, db, '00-w1')).toBe(true);
    expect(hasChart(ROUTE_SPEC, db, '00-r2')).toBe(false);
  });
});

describe('chartItems: lanes, zones, splits', () => {
  it('lanes need 10 carries; success % is successes over carries', () => {
    const items = chartItems(LANE_SPEC, db, '00-r1', 'all', 'succ')!;
    expect(item(items, 'LT').value).toBe(0.5);
    expect(item(items, 'LT').pct).toBe(100);   // 0.5 vs r2's 0.333
    expect(item(items, 'MID').ranked).toBe(false);
  });
  it('zones: CPOE is the mean over attempts with a CPOE', () => {
    const z = item(chartItems(ZONE_SPEC, db, '00-q1', 'all', 'cpoe'), 'short|right');
    expect(z.value).toBe(0.5);
    expect(z.pct).toBe(100);
    expect(item(chartItems(ZONE_SPEC, db, '00-q1', 'all', 'cpoe'), 'deep|left').ranked).toBe(false);
  });
  it('splits: sack % ranks lower as better', () => {
    const all = item(chartItems(SPLIT_SPEC, db, '00-q1', 'all', 'sack'), 'all');
    expect(all.value).toBeCloseTo(12 / 170);
    expect(all.pct).toBe(0);                    // q2 sacks less
    expect(item(chartItems(SPLIT_SPEC, db, '00-q2', 'all', 'sack'), 'all').pct).toBe(100);
  });
  it('splits: a split under 20 dropbacks is unranked', () => {
    expect(item(chartItems(SPLIT_SPEC, db, '00-q1', 'all', 'epa'), 'COVER_0').ranked).toBe(false);
  });
});
