import { flattenLines } from '../playerLines';
import { seasonTable, summaryOf } from './seasons';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';

const of = (id: string) => { const s = leagueSeasons(); return seasonTable(flattenLines(s, players).filter((l) => l.playerId === id), s, id); };

describe('seasonTable', () => {
  it('rows a traded title season with both managers, bench points and playoff points', () => {
    expect(of('w1').rows[0]).toEqual({ year: 2025, managers: ['A', 'B'], starts: 2, rostered: 3, benchPts: 30, pts: 28, ppg: 14, best: 30, posRank: 2, overallRank: 2, w: 2, l: 0, t: 0, playoffPts: 8, title: true });
  });
  it('rows a season with no winners-bracket game as playoffPts null', () => {
    expect(of('w1').rows[1]).toMatchObject({ year: 2026, managers: ['B'], starts: 2, pts: 19, w: 1, l: 1, playoffPts: null, title: false });
  });
  it('closes with a career row and marks each column best only when there is more than one season', () => {
    const t = of('w1');
    expect(t.career).toEqual({ managers: 2, starts: 4, rostered: 5, benchPts: 30, pts: 47, ppg: 11.75, best: 30, w: 3, l: 1, t: 0, playoffPts: 8 });
    expect(t.best).toMatchObject({ pts: 28, best: 30, posRank: 1, overallRank: 1 });
  });
  it('makes no row for a season where every line is a consolation game', () => {
    const s = leagueSeasons();
    for (const g of s[1].weeks.flatMap((w) => w.games)) g.tag = 'Toilet Bowl';
    const t = seasonTable(flattenLines(s, players).filter((l) => l.playerId === 'w1'), s, 'w1');
    expect(t.rows.map((r) => r.year)).toEqual([2025]);
    expect(t.best).toEqual({});
  });
});

describe('summaryOf', () => {
  it('turns the career row into header tiles with title years', () => {
    expect(summaryOf(of('w1'))).toEqual({ ptsStarted: 47, perStart: 11.75, starts: 4, rostered: 5, best: 30, w: 3, l: 1, t: 0, managers: 2, titles: [2025] });
  });
  it('is all zeros and nulls for a player never rostered', () => {
    expect(summaryOf(of('t1'))).toEqual({ ptsStarted: 0, perStart: null, starts: 0, rostered: 0, best: null, w: 0, l: 0, t: 0, managers: 0, titles: [] });
  });
});
