import { flattenLines } from '../playerLines';
import { journeyOf, stintRange } from './journey';
import { leagueSeasons, pick, tx } from '../../test/playerPageFixtures';
import { line, players } from '../../test/playerFixtures';

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
    expect(st.map((x) => [x.userId, x.from, x.to])).toEqual([['A', { year: 2026, week: 3 }, null], ['A', { year: 2025, week: 3 }, { year: 2026, week: 2 }], ['B', { year: 2025, week: 0 }, { year: 2025, week: 2 }]]);
    expect(st[0].moves.map((m) => m.text)).toEqual(['Free-agent add']);
  });
  it('ends a stint at the season it was not kept into', () => {
    const s = leagueSeasons();
    s[1].draft!.picks = s[1].draft!.picks.filter((p) => p.playerId !== 'w1');
    s[1].weeks = s[1].weeks.map((w) => ({ ...w, games: w.games.map((g) => ({ ...g, sides: g.sides.map((sd) => ({ ...sd, starters: sd.starters.filter((e) => e.player?.playerId !== 'w1') })) as typeof g.sides })) }));
    const [bob] = of('w1', s);
    expect(bob.to).toEqual({ year: 2025, week: 3 });
  });
  it('dates a stint by the weeks he was on the roster: an add and a drop in the same week make a one-week stint', () => {
    const s = leagueSeasons();
    s[1].transactions.push(tx('free_agent', 1, 100, [['k1', 'B']], []), tx('waiver', 1, 150, [], [['k1', 'B']]));
    const st = of('k1', s);
    expect(st.map((x) => [x.userId, x.from, x.to, x.starts])).toEqual([['B', { year: 2026, week: 1 }, { year: 2026, week: 1 }, 0]]);
    expect(st[0].moves.map((m) => m.kind)).toEqual(['dropped', 'freeAgent']);
  });
  it('starts a waiver claim at the first week he was on the roster, which can be the week after the claim', () => {
    const s = leagueSeasons();
    const [wk1, wk2] = s[1].weeks.map((w) => w.games[0].sides[1]);
    wk1.bench = wk1.bench.filter((b) => b.playerId !== 'k1');
    wk2.bench = [...wk2.bench, line('k1', 6)];
    s[1].transactions.push(tx('waiver', 1, 50, [['k1', 'B']], [], 3));
    expect(of('k1', s).map((x) => [x.from, x.to])).toEqual([[{ year: 2026, week: 2 }, null]]); // still on the roster in the newest week
  });
  it('still shows a spell on a roster with no recorded move', () => {
    const st = of('k1');
    expect(st.map((x) => [x.userId, x.from, x.to, x.moves.length])).toEqual([['B', { year: 2026, week: 1 }, { year: 2026, week: 1 }, 0]]);
  });
  it('puts the stint he is still in first when two managers had him in the same week', () => {
    const s = leagueSeasons();
    s[1].transactions.push(tx('free_agent', 1, 100, [['k1', 'A']], []), tx('free_agent', 1, 110, [], [['k1', 'A']]), tx('waiver', 1, 120, [['k1', 'B']], []));
    expect(of('k1', s).map((x) => [x.userId, x.from, x.to])).toEqual([['B', { year: 2026, week: 1 }, null], ['A', { year: 2026, week: 1 }, { year: 2026, week: 1 }]]);
  });
  it('keeps a kept player on the roster between the draft and week 1', () => {
    const s = leagueSeasons();
    s[1].weeks = [];
    s[1].transactions = [];
    const [bob] = of('w1', s);
    expect(bob).toMatchObject({ userId: 'B', to: null });
    expect(bob.moves[0].kind).toBe('kept');
  });
  it('builds a stint from moves alone: added after the last played week and kept, before week 1', () => {
    const s = leagueSeasons();
    s[0].transactions.push(tx('free_agent', 4, 900, [['t1', 'A']], []));
    s[1].weeks = [];
    s[1].transactions = [];
    s[1].draft!.picks.push(pick(9, 90, 'A', 't1', true));
    expect(of('t1', s).map((x) => [x.userId, x.from, x.to, x.moves.map((m) => m.kind)])).toEqual([['A', { year: 2025, week: 4 }, null, ['kept', 'freeAgent']]]);
  });
  it('shows a drafted player who never played a week', () => {
    const s = leagueSeasons();
    s[0].draft!.picks.push(pick(10, 100, 'A', 't1', false));
    s[0].transactions.push(tx('free_agent', 1, 50, [], [['t1', 'A']]));
    expect(of('t1', s).map((x) => [x.userId, x.moves.map((m) => m.kind)])).toEqual([['A', ['dropped', 'drafted']]]);
  });
  it('is empty for a player never rostered', () => {
    expect(of('t1')).toEqual([]);
  });
});
