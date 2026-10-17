import { COLUMNS, statTable } from './table';
import { league, season2025 } from '../../test/statsFixtures';
import { season } from '../../test/playerFixtures';

const row = (rows: ReturnType<typeof statTable>, id: string) => rows.find((r) => r.id === id)!;

describe('statTable', () => {
  const rows = statTable([season2025()]);
  it('lists every manager in standings order with the season\'s record, all-play, expected wins and luck', () => {
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    const a = row(rows, 'a');
    expect([a.seasons, a.w, a.l, a.t, a.apW, a.apL, a.apT]).toEqual([1, 4, 0, 0, 9, 3, 0]);
    expect(a.xw).toBeCloseTo(3, 6);
    expect(a.luck).toBeCloseTo(1, 6);
    expect([a.medW, a.medL, a.streakW, a.streakL]).toEqual([3, 1, 4, 0]);
  });
  it('carries the scoring, game and lineup numbers', () => {
    const a = row(rows, 'a');
    expect([a.ppg, a.paPg, a.highs, a.top3, a.bottom3, a.floor, a.ceiling]).toEqual([107.5, 92.25, 2, 4, 0, 100, 120]);
    expect(a.sd).toBeCloseTo(19.2, 1);
    expect([a.closeW, a.closeL, a.blowW, a.blowL, a.sos]).toEqual([2, 0, 1, 0, -11.44]);
    expect([a.postW, a.postL, a.postGames, a.postPpg]).toEqual([1, 0, 1, 150]);
    expect(a.eff).toBeCloseTo(580 / 630, 4);
    expect(a.benchLeft).toBe(50);
    expect([a.projPlus, a.dProj]).toEqual([0.5, 7.5]);
  });
  it('carries the roster numbers', () => {
    const a = row(rows, 'a');
    expect([a.faab, a.pickups, a.draftValue]).toEqual([13, 2, 12]);
    expect(a.waiverShare).toBeCloseTo(120 / 580, 4);
    const b = row(rows, 'b');
    expect([b.streakW, b.streakL, b.closeW, b.closeL, b.draftValue]).toEqual([2, 1, 1, 1, 18]);
  });
  it('adds seasons up for all-time', () => {
    const a = row(statTable(league()), 'a');
    expect([a.seasons, a.w, a.l, a.ppg]).toEqual([2, 5, 1, (430 + 190) / 6]);
  });
  it('gives zeros, never NaN, for a season with nothing played', () => {
    const empty = season2026();
    const r = statTable([empty]);
    expect(r).toHaveLength(4);
    for (const col of COLUMNS) expect(col.text(r[0])).not.toMatch(/NaN|undefined/);
    expect(row(r, 'a').ppg).toBe(0);
  });
});

describe('COLUMNS', () => {
  const rows = statTable([season2025()]);
  it('formats every column as text and sorts records by win share', () => {
    const a = rows[0];
    const text = Object.fromEntries(COLUMNS.map((c) => [c.key, c.text(a)]));
    expect(text.rec).toBe('4-0');
    expect(text.allPlay).toBe('9-3');
    expect(text.xw).toBe('3.0');
    expect(text.luck).toBe('+1.0');
    expect(text.median).toBe('3-1');
    expect(text.streaks).toBe('W4 / L0');
    expect(text.eff).toBe('92%');
    expect(text.faab).toBe('$13');
    expect(text.sos).toBe('-11.4');
    expect(COLUMNS.find((c) => c.key === 'rec')!.value(a)).toBe(1);
    expect(COLUMNS.find((c) => c.key === 'postPpg')!.text(rows[1])).toBe('90.0');
    expect(COLUMNS.find((c) => c.key === 'postPpg')!.text({ ...a, postGames: 0 })).toBe('—');
  });
  it('knows which way is good', () => {
    expect(COLUMNS.find((c) => c.key === 'paPg')!.higherBetter).toBe(false);
    expect(COLUMNS.find((c) => c.key === 'sd')!.higherBetter).toBe(false);
    expect(COLUMNS.find((c) => c.key === 'ppg')!.higherBetter).toBe(true);
  });
});

function season2026() {
  const s = season(2026, []);
  s.status = 'in_season';
  s.managers = season2025().managers;
  s.standings = season2025().standings.map((r) => ({ ...r, w: 0, l: 0, t: 0, pf: 0, pa: 0, ppg: 0, winPct: 0, maxPoints: 0, efficiency: 0, allPlay: { w: 0, l: 0, t: 0, pct: 0 }, weeklyHighs: 0 }));
  return s;
}
