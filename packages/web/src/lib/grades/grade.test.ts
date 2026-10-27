import type { ChartDb, GradeSums, PlayerDb, PlayerWeek } from '@fantasy-dash/core';
import { player, row, teamWeek } from '../../test/playerDbFixtures';
import { gradeCards, scoutingSummary, type GradedCard } from './grade';

const WEEKS = [1, 2, 3, 4];
/** one row per week played, with the season's numbers split evenly */
const rows = (id: string, team: string, weeks: number[], season: Partial<PlayerWeek>): PlayerWeek[] =>
  weeks.map((w) => row(id, w, team, Object.fromEntries(Object.entries(season).map(([k, v]) => [k, (v as number) / weeks.length]))));

const recv = (tgt: number, g: GradeSums = {}): GradeSums => ({
  tgt, rec: tgt * 0.6, yds: tgt * 8, epa: tgt * 0.2, succ: tgt / 2, fd: tgt / 3, td: 2, cpN: tgt, cpSum: tgt * 0.6, cpRec: tgt * 0.6,
  deep: 6, deepRec: 3, deepYds: 150, deepEpa: 3, t3: 8, t3Conv: 4, rzTgt: 5, ezTgt: 3, teamRzTgt: 20,
  ftnTgt: tgt, catchable: tgt * 0.8, drops: 2, contested: 6, contestedRec: 3, created: 1, motionTgt: tgt / 2, paTgt: tgt / 5, ...g,
});

/** four weeks: WRs wa/wb/wc/ws (ws under the volume minimum), TEs ta/tb, RBs ra/rb, QBs qa/qb */
function fixture(ftn = true): { db: PlayerDb; chart: ChartDb } {
  const db: PlayerDb = {
    year: 2026, throughWeek: 4, routesReal: false, builtAt: '2026-10-27T00:00:00.000Z',
    players: Object.fromEntries([
      player('wa', 'WR', ['TB']), player('wb', 'WR', ['TB']), player('wc', 'WR', ['KC']), player('ws', 'WR', ['KC']),
      player('ta', 'TE', ['TB']), player('tb', 'TE', ['KC']), player('ra', 'RB', ['TB']), player('rb', 'RB', ['KC']),
      player('qa', 'QB', ['TB']), player('qb', 'QB', ['KC']),
    ].map((p) => [p.id, p])),
    teamWeeks: WEEKS.flatMap((w) => [teamWeek('TB', w), teamWeek('KC', w)]),
    xfp: { QB: null, RB: null, WR: null, TE: null },
    rows: [
      ...rows('wa', 'TB', WEEKS, { re_tgt: 40, re_rec: 24, re_yds: 320, re_air: 400, snaps: 200, teamSnaps: 240, routesEst: 120 }),
      ...rows('wb', 'TB', [1, 2], { re_tgt: 30, re_rec: 20, re_yds: 250, re_air: 300, snaps: 100, teamSnaps: 120, routesEst: 60 }),
      ...rows('wc', 'KC', WEEKS, { re_tgt: 24, re_rec: 14, re_yds: 150, re_air: 200, snaps: 180, teamSnaps: 240, routesEst: 100 }),
      ...rows('ws', 'KC', WEEKS, { re_tgt: 8, re_rec: 4, re_yds: 40, re_air: 50, snaps: 60, teamSnaps: 240, routesEst: 40 }),
      ...rows('ta', 'TB', WEEKS, { re_tgt: 20, re_rec: 14, re_yds: 150, re_air: 120, snaps: 200, teamSnaps: 240, routesEst: 100 }),
      ...rows('tb', 'KC', WEEKS, { re_tgt: 18, re_rec: 12, re_yds: 120, re_air: 100, snaps: 180, teamSnaps: 240, routesEst: 90 }),
      ...rows('ra', 'TB', WEEKS, { ru_att: 60, ru_yds: 270, re_tgt: 10, snaps: 150, teamSnaps: 240 }),
      ...rows('rb', 'KC', WEEKS, { ru_att: 40, ru_yds: 160, re_tgt: 8, snaps: 120, teamSnaps: 240 }),
      ...rows('qa', 'TB', WEEKS, { pa_att: 120, pa_sack: 8, pa_yds: 900, snaps: 240, teamSnaps: 240 }),
      ...rows('qb', 'KC', WEEKS, { pa_att: 100, pa_sack: 10, pa_yds: 700, snaps: 240, teamSnaps: 240 }),
    ],
  };
  const qbSums = (dbs: number, g: GradeSums = {}): GradeSums => ({ db: dbs, dbEpa: dbs * 0.05, dbSucc: dbs / 2, att: dbs - 8, sacks: 8, sackYds: 50, passYds: 900, passTd: 6, int: 2, deepAtt: 10, deepCmp: 4, deepAttEpa: 2, deepCpoeSum: 20, deepCpoeN: 10, t3Db: 20, t3DbConv: 8, rzDb: 15, rzTd: 5, q4Db: 30, q4Epa: 1, trailDb: 40, trailEpa: 2, scr: 6, scrYds: 40, drun: 5, drunEpa: 1, rushFd: 4, ftnDb: dbs, ftnAtt: dbs - 8, iw: 3, readN: 100, firstRead: 60, throwaway: 4, faultSack: 2, catchableThrown: 90, recDrops: 5, paDb: 25, paEpa: 3, blitzDb: 30, blitzEpa: -2, noBlitzDb: 98, noBlitzEpa: 6, ...g });
  const rbSums = (car: number): GradeSums => ({ car, carYds: car * 4, carEpa: 1, carSucc: car / 2, carFd: car / 4, explosive: 6, stuffed: 8, in10: 8, in5: 6, in5Td: 3, outside: 10, teamIn10: 12, ftnCar: car, boxN: car, boxSum: car * 7, lightCar: 20, lightYds: 100, heavyCar: 10, heavyYds: 30, rpo: 4, tgt: 10, epa: 2, yacN: 6, yacOe: 3 });
  const chart: ChartDb = {
    year: 2026, builtAt: '2026-10-27T00:00:00.000Z', participation: false, ftn, injuries: {},
    players: {
      '00-wa': { pos: 'WR', grades: recv(40, { drops: 1, catchable: 30, deepYds: 300 }) },
      '00-wb': { pos: 'WR', grades: recv(30, { drops: 3, catchable: 20, deepYds: 200 }) },
      '00-wc': { pos: 'WR', grades: recv(24, { drops: 4, catchable: 16, deep: 4, deepYds: 100 }) },
      '00-ws': { pos: 'WR', grades: recv(8) },
      '00-ta': { pos: 'TE', grades: recv(20) },
      '00-tb': { pos: 'TE', grades: recv(18) },
      '00-ra': { pos: 'RB', grades: rbSums(60) },
      '00-rb': { pos: 'RB', grades: rbSums(40) },
      '00-qa': { pos: 'QB', grades: qbSums(128, { scr: 0, scrYds: 0 }) },
      '00-qb': { pos: 'QB', grades: qbSums(110) },
    },
  };
  return { db, chart };
}

const tile = (cards: GradedCard[], key: string) => cards.flatMap((c) => c.tiles).find((t) => t.key === key)!;

describe('gradeCards', () => {
  it('WR cards come in the spec order and groups', () => {
    const { db, chart } = fixture();
    const cards = gradeCards(db, chart, 'wa')!;
    expect(cards.map((c) => c.title)).toEqual(['Opportunity', 'Usage', 'Efficiency', 'Beating expectation', 'Deep threat', 'Money downs', 'Ball skills & separation']);
    expect(cards.map((c) => c.group)).toEqual(['Opportunity', 'Opportunity', 'Production', 'Production', 'Production', 'Production', 'How he plays']);
    expect(cards.every((c) => c.tiles.length === 4)).toBe(true);
  });

  it('QB and RB card sets follow the spec', () => {
    const { db, chart } = fixture();
    expect(gradeCards(db, chart, 'qa')!.map((c) => c.title)).toEqual(['Efficiency', 'Accuracy & aggressiveness', 'Deep ball', 'Clutch & situational', 'Decision making', 'Pocket & pressure', 'Legs', 'Scheme']);
    expect(gradeCards(db, chart, 'ra')!.map((c) => c.title)).toEqual(['Workload', 'Efficiency', 'Rushing vs expected', 'After contact', 'Receiving back', 'Fronts faced', 'Running style']);
  });

  it('a TE is ranked against TEs only', () => {
    const { db, chart } = fixture();
    // ta has the lower target share of any receiver, but the higher of the two TEs
    expect(tile(gradeCards(db, chart, 'ta')!, 'tgtShare').pct).toBe(100);
  });

  it('style tile: ranked but flagged style', () => {
    const { db, chart } = fixture();
    const t = tile(gradeCards(db, chart, 'wa')!, 'adot');
    expect(t.style).toBe(true);
    expect(t.status).toBe('ranked');
    expect(typeof t.pct).toBe('number');
  });

  it('a lower-is-better tile flips the percentile', () => {
    const { db, chart } = fixture();
    const t = tile(gradeCards(db, chart, 'wa')!, 'dropRate');
    expect(t.text).toBe('3%');
    expect(t.detail).toBe('1 of 30 catchable');
    expect(t.pct).toBe(100);
  });

  it('a count tile ranks per game but shows the season total', () => {
    const { db, chart } = fixture();
    // wa: 300 deep yards in 4 games; wb: 200 in 2 games; wc has 4 deep targets, too few to rank
    const wa = tile(gradeCards(db, chart, 'wa')!, 'deepYds'), wb = tile(gradeCards(db, chart, 'wb')!, 'deepYds');
    expect(wa.text).toBe('300');
    expect(wb.pct).toBe(100);
    expect(wa.pct).toBe(0);
  });

  it('a deep tile with 4 deep targets is small', () => {
    const { db, chart } = fixture();
    const t = tile(gradeCards(db, chart, 'wc')!, 'deepCatches');
    expect(t.status).toBe('small');
    expect(t.pct).toBeNull();
    expect(t.text).toBe('3 / 4');
  });

  it('under the volume minimum every tile is small and the summary is empty', () => {
    const { db, chart } = fixture();
    const cards = gradeCards(db, chart, 'ws')!;
    expect(cards.flatMap((c) => c.tiles).every((t) => t.status === 'small' || t.status === 'none' || t.status === 'noFtn')).toBe(true);
    expect(scoutingSummary(cards)).toEqual({ best: [], worst: [] });
  });

  it('a QB with no scrambles: yards per scramble is — / none, unranked', () => {
    const { db, chart } = fixture();
    const t = tile(gradeCards(db, chart, 'qa')!, 'ypScramble');
    expect(t).toMatchObject({ text: '—', detail: 'none', pct: null, status: 'none' });
  });

  it('an FTN tile in a season without FTN reads — / no FTN data', () => {
    const { db, chart } = fixture(false);
    const t = tile(gradeCards(db, chart, 'wa')!, 'dropRate');
    expect(t).toMatchObject({ text: '—', detail: 'no FTN data', pct: null, status: 'noFtn' });
  });

  it('returns null with no gsis id or no grades', () => {
    const { db, chart } = fixture();
    db.players.wa = { ...db.players.wa, gsisId: null };
    expect(gradeCards(db, chart, 'wa')).toBeNull();
    expect(gradeCards(db, undefined, 'wb')).toBeNull();
    delete chart.players['00-wc'].grades;
    expect(gradeCards(db, chart, 'wc')).toBeNull();
  });
});

describe('scoutingSummary', () => {
  it('top and bottom 4 graded tiles; style and unranked tiles excluded; no tile in both', () => {
    const { db, chart } = fixture();
    const cards = gradeCards(db, chart, 'wa')!;
    const { best, worst } = scoutingSummary(cards);
    expect(best).toHaveLength(4);
    expect(worst).toHaveLength(4);
    const tiles = cards.flatMap((c) => c.tiles.map((t) => ({ ...t, card: c.title })));
    for (const r of [...best, ...worst]) {
      const t = tiles.find((x) => x.label === r.label && x.card === r.card)!;
      expect(t.status).toBe('ranked');
      expect(t.style).toBe(false);
    }
    expect(best.map((r) => r.pct)).toEqual([...best.map((r) => r.pct)].sort((a, b) => b - a));
    expect(worst.map((r) => r.pct)).toEqual([...worst.map((r) => r.pct)].sort((a, b) => a - b));
    expect(best.some((b) => worst.some((w) => w.label === b.label && w.card === b.card))).toBe(false);
  });
});
