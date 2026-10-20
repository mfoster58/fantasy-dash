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
    expect([a.ppg, a.paPg, a.highs, a.top3, a.bottom3, a.min, a.max]).toEqual([107.5, 92.25, 2, 4, 0, 80, 130]);
    expect(a.sd).toBeCloseTo(19.2, 1);
    expect([a.closeW, a.closeL, a.blowW, a.blowL, a.sos]).toEqual([2, 0, 1, 0, -11.44]);
    expect([a.postW, a.postL, a.postGames, a.postPpg]).toEqual([1, 0, 1, 150]);
    expect(a.eff).toBeCloseTo(580 / 630, 4);
    expect(a.benchLeft).toBe(50);
    expect([a.projPlus, a.dProj]).toEqual([0.5, 7.5]);
  });
  it('totals points for and against, and ranks by record with points for breaking ties', () => {
    const a = row(rows, 'a');
    expect([a.pf, a.pa]).toEqual([430, 369]);
    expect(rows.map((r) => r.rank).sort()).toEqual([1, 2, 3, 4]);
    const share = (r: (typeof rows)[number]) => (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t);
    const byRank = [...rows].sort((x, y) => x.rank - y.rank);
    for (let i = 1; i < byRank.length; i++) {
      const p = byRank[i - 1], q = byRank[i];
      expect(share(p) > share(q) || (share(p) === share(q) && p.pf >= q.pf), `${p.id} before ${q.id}`).toBe(true);
    }
  });
  it('carries the roster numbers', () => {
    const a = row(rows, 'a');
    expect([a.faab, a.pickups, a.draftValue]).toEqual([13, 2, 12]);
    expect(a.waiverShare).toBeCloseTo(120 / 580, 4);
    const b = row(rows, 'b');
    expect([b.streakW, b.streakL, b.closeW, b.closeL, b.draftValue]).toEqual([2, 1, 1, 1, 18]);
  });
  it('counts winners-bracket playoff games only, with titles and finals', () => {
    const rows = statTable(league());
    expect(row(rows, 'a')).toMatchObject({ titles: 1, poApps: 1, poW: 1, poL: 0, poGames: 1, poPpg: 150, finals: 1 });
    expect(row(rows, 'd')).toMatchObject({ titles: 0, poApps: 1, poW: 0, poL: 1, finals: 1 });
    // the toilet bowl is consolation, not the playoffs
    expect(row(rows, 'b')).toMatchObject({ poApps: 0, poGames: 0, poPpg: 0 });
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
    expect(text.sos).toBe('-11.4');
    expect(COLUMNS.find((c) => c.key === 'rec')!.value(a)).toBe(1);
    expect(COLUMNS.find((c) => c.key === 'postPpg')!.text(rows[1])).toBe('90.0');
    expect(COLUMNS.find((c) => c.key === 'postPpg')!.text({ ...a, postGames: 0 })).toBe('—');
  });
  it('drops the blowout and FAAB columns, calls bench points Bench+, and adds a playoffs group', () => {
    expect(COLUMNS.map((c) => c.key)).not.toContain('blow');
    expect(COLUMNS.map((c) => c.key)).not.toContain('faab');
    expect(COLUMNS.find((c) => c.key === 'bench')!.label).toBe('Bench+');
    expect(COLUMNS.filter((c) => c.group === 'Playoffs').map((c) => c.label)).toEqual(['Apps', 'Rec', 'Win %', 'PPG', 'Finals', 'Titles']);
    const a = statTable(league()).find((r) => r.id === 'a')!;
    expect(COLUMNS.filter((c) => c.group === 'Playoffs').map((c) => c.text(a))).toEqual(['1', '1-0', '1.000', '150.0', '1', '1']);
    expect(COLUMNS.find((c) => c.key === 'poPpg')!.text({ ...a, poGames: 0 })).toBe('—');
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
