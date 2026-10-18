import { flattenLines } from '../playerLines';
import { journeyOf, stintRange } from './journey';
import { leagueSeasons, tx } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';

const of = (id: string, s = leagueSeasons()) => journeyOf(flattenLines(s, players).filter((l) => l.playerId === id), s, players, id);

describe('journeyOf', () => {
  it('splits a drafted player at the trade and carries the keeper into the next season, newest first', () => {
    const [bob, alice] = of('w1');
    expect(bob).toMatchObject({ userId: 'B', teamName: 'Bob', from: { year: 2025, week: 3 }, to: null, starts: 3, pts: 27, w: 2, l: 1, title: true });
    expect(bob.moves.map((m) => [m.kind, m.text])).toEqual([['kept', 'Kept at an R2 price'], ['traded', 'Traded from Alice, who got Ricky One']]);
    expect(alice).toMatchObject({ userId: 'A', teamName: 'Team A', from: { year: 2025, week: 0 }, to: { year: 2025, week: 2 }, starts: 1, pts: 20, title: false });
    expect(alice.moves.map((m) => m.text)).toEqual(['Drafted R3 #25']);
    expect(stintRange(bob)).toBe('2025 Wk 3 → now');
    expect(stintRange(alice)).toBe('2025 draft → 2025 Wk 2');
  });
  it('a drop and re-add in the same week keeps one stint, listing both moves', () => {
    const [alice] = of('r1');
    expect(alice.userId).toBe('A');
    expect(alice.to).toBeNull();
    expect(alice.moves.map((m) => [m.kind, m.text])).toEqual([['waiver', 'Waiver claim · $5 FAAB'], ['dropped', 'Dropped'], ['kept', 'Kept at an R1 price'], ['traded', 'Traded from Bob, who got Wally One']]);
  });
  it('a drop and a re-add in a later week makes two stints', () => {
    const s = leagueSeasons();
    s[1].transactions = [tx('free_agent', 2, 500, [], [['r1', 'A']]), tx('free_agent', 3, 600, [['r1', 'A']], [])];
    const st = of('r1', s);
    expect(st.map((x) => [x.userId, x.from, x.to])).toEqual([['A', { year: 2026, week: 3 }, null], ['A', { year: 2025, week: 3 }, { year: 2026, week: 1 }], ['B', { year: 2025, week: 0 }, { year: 2025, week: 2 }]]);
    expect(st[0].moves.map((m) => m.text)).toEqual(['Free-agent add']);
  });
  it('ends a stint at the season it was not kept into', () => {
    const s = leagueSeasons();
    s[1].draft!.picks = s[1].draft!.picks.filter((p) => p.playerId !== 'w1');
    s[1].weeks = s[1].weeks.map((w) => ({ ...w, games: w.games.map((g) => ({ ...g, sides: g.sides.map((sd) => ({ ...sd, starters: sd.starters.filter((e) => e.player?.playerId !== 'w1') })) as typeof g.sides })) }));
    const [bob] = of('w1', s);
    expect(bob.to).toEqual({ year: 2025, week: 3 });
  });
  it('is empty for a player never rostered', () => {
    expect(of('t1')).toEqual([]);
  });
});
