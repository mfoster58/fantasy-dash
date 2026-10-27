import { gradeFixture as fixture } from '../../test/gradeFixtures';
import { gradeCards, scoutingSummary, type GradedCard } from './grade';

const tile = (cards: GradedCard[], key: string) => cards.flatMap((c) => c.tiles).find((t) => t.key === key)!;

describe('gradeCards', () => {
  it('WR cards come in the spec order and groups', () => {
    const { db, chart } = fixture();
    const cards = gradeCards(db, chart, 'wa')!;
    expect(cards.map((c) => c.title)).toEqual(['Opportunity', 'Usage', 'Efficiency', 'Beating expectation', 'Deep threat', 'Big plays', 'Money downs', 'Ball skills & separation', 'Fantasy']);
    expect(cards.map((c) => c.group)).toEqual(['Opportunity', 'Opportunity', 'Production', 'Production', 'Production', 'Production', 'Production', 'How he plays', 'Production']);
    expect(cards.every((c) => c.tiles.length === 4)).toBe(true);
  });

  it('QB and RB card sets follow the spec', () => {
    const { db, chart } = fixture();
    expect(gradeCards(db, chart, 'qa')!.map((c) => c.title)).toEqual(['Efficiency', 'Accuracy & aggressiveness', 'Deep ball', 'Clutch & situational', 'Pocket & pressure', 'Legs', 'Decision making', 'Scheme', 'Fantasy']);
    expect(gradeCards(db, chart, 'ra')!.map((c) => c.title)).toEqual(['Workload', 'Efficiency', 'Rushing vs expected', 'After contact', 'Receiving back', 'Money downs', 'Fronts faced', 'Running style', 'Fantasy']);
  });

  it('fantasy: points per game, and the rushing share uses league scoring', () => {
    const { db, chart } = fixture();
    const cards = gradeCards(db, chart, 'qa', { rush_yd: 0.1, rush_td: 6 })!;
    expect(tile(cards, 'ppg').text).toBe('20.0');
    // 100 rushing yards and a TD = 16 of 80 points
    expect(tile(cards, 'rushShare')).toMatchObject({ text: '20%', style: true });
    expect(tile(gradeCards(db, chart, 'qa', { rush_yd: 0.2, rush_td: 4 })!, 'rushShare').text).toBe('30%');
  });
  it('RB money downs: short yardage, 3rd downs on carries and targets, team red-zone carries, TDs per touch', () => {
    const { db, chart } = fixture();
    const cards = gradeCards(db, chart, 'ra')!;
    expect(tile(cards, 'shortYardage')).toMatchObject({ text: '4 / 5' });
    expect(tile(cards, 'thirdDown')).toMatchObject({ text: '50%', detail: '4 of 8' });
    expect(tile(cards, 'rzCarShare')).toMatchObject({ text: '56%', detail: '9 of 16' });
    expect(tile(cards, 'tdTouch')).toMatchObject({ detail: '2 TD on 68 touches' });
  });
  it('WR big plays from the player database', () => {
    const { db, chart } = fixture();
    const cards = gradeCards(db, chart, 'wa')!;
    expect(tile(cards, 'rec20')).toMatchObject({ text: '8', detail: '2.0 per game' });
    expect(tile(cards, 'explosiveRate').text).toBe('20%');
    expect(tile(cards, 'yacRec').text).toBe('4.0');
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

  it('red-zone share divides by his teams\' totals over every week he played, targeted or not', () => {
    const { db, chart } = fixture();
    // wa played all four weeks for TB, wb only weeks 1-2
    expect(tile(gradeCards(db, chart, 'wa')!, 'rzShare').detail).toBe('5 of 20');
    expect(tile(gradeCards(db, chart, 'wb')!, 'rzShare').detail).toBe('5 of 10');
    expect(tile(gradeCards(db, chart, 'ra')!, 'in10Share').detail).toBe('8 of 12');
  });

  it('the RB inside-10 tile reads Team carries inside the 10', () => {
    const { db, chart } = fixture();
    expect(tile(gradeCards(db, chart, 'ra')!, 'in10Share').label).toBe('Team carries inside the 10');
  });
  it('WR efficiency is YPRR, EPA per target, success rate and FDRR, per-route tiles marked est.', () => {
    const { db, chart } = fixture();
    const eff = gradeCards(db, chart, 'wa')!.find((c) => c.title === 'Efficiency')!;
    expect(eff.tiles.map((t) => t.label)).toEqual(['Yards per route run', 'EPA per target', 'Success rate', 'First downs per route run']);
    // wa: 320 yds on 120 estimated routes
    expect(eff.tiles[0]).toMatchObject({ text: '2.67', detail: 'est. routes' });
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
