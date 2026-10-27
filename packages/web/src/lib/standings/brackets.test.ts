import type { BracketGame, BracketKind, PlayoffTag, Season } from '@fantasy-dash/core';
import { season, standing, week } from '../../test/playerFixtures';
import { standingsBrackets } from './brackets';

const g = (bracket: BracketKind, round: number, matchNo: number, tag: PlayoffTag, home: string | null, away: string | null, extra: Partial<BracketGame> = {}): BracketGame =>
  ({ bracket, round, matchNo, placement: null, week: 14 + round, tag, home, away, homePoints: null, awayPoints: null, advanced: null, gameId: null, ...extra });

// this league's shape: 6 make it, seeds 1-2 on a bye; 7-10 in the toilet bowl
const shape = (team: (seed: number) => string | null, played: boolean): Season['brackets'] => {
  const t = (seed: number) => (played ? team(seed) : null);
  return {
    winners: [
      g('winners', 1, 1, 'QF', t(4), t(5)), g('winners', 1, 2, 'QF', t(6), t(3)),
      g('winners', 2, 3, 'SF', t(1), t(4)), g('winners', 2, 4, 'SF', t(2), t(6)),
      g('winners', 2, 5, '5th', t(5), t(3), { placement: 5 }),
      g('winners', 3, 6, 'Final', t(4), t(2), { placement: 1 }), g('winners', 3, 7, '3rd', t(1), t(6), { placement: 3 }),
    ],
    consolation: [
      g('consolation', 1, 1, 'Cons-R1', t(10), t(7)), g('consolation', 1, 2, 'Cons-R1', t(9), t(8)),
      g('consolation', 2, 3, 'Toilet Bowl', t(7), t(9), { placement: 1 }), g('consolation', 2, 4, 'Cons-7th', t(10), t(8), { placement: 3 }),
    ],
  };
};
const ids = (prefix: string) => (seed: number) => `${prefix}${seed}`;
const table = (prefix: string, order: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) => order.map((seed, i) => standing(`${prefix}${seed}`, i + 1, 10 - i, i, 0, 1000, 900));

function lastYear(): Season {
  const s = season(2025, [], null, 17);
  s.playoffTeams = 6;
  s.standings = table('p');
  s.brackets = shape(ids('p'), true);
  return s;
}
function thisYear(): Season {
  const s = season(2026, [{ ...week(7, []), played: true }], null, 7);
  s.status = 'in_season';
  s.playoffTeams = 6;
  // today's table: n3 leads, n1 is third
  s.standings = table('n', [3, 1, 2, 4, 5, 6, 7, 8, 9, 10]).map((r, i) => ({ ...r, userId: ['n3', 'n1', 'n2', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'][i] }));
  s.brackets = shape(() => null, false);
  return s;
}

describe('standingsBrackets', () => {
  it('projects both brackets from today\'s table, placing seeds where last year\'s bracket put them', () => {
    const b = standingsBrackets(thisYear(), lastYear());
    expect(b.kind).toBe('projected');
    const at = (games: BracketGame[], matchNo: number) => { const x = games.find((y) => y.matchNo === matchNo)!; return [x.home, x.away]; };
    // seed 1 is n3 now: on a bye into the first semi
    expect(at(b.winners, 3)).toEqual(['n3', null]);
    expect(at(b.winners, 4)).toEqual(['n1', null]);
    expect(at(b.winners, 1)).toEqual(['n4', 'n5']);
    expect(at(b.winners, 2)).toEqual(['n6', 'n2']);
    expect(at(b.winners, 6)).toEqual([null, null]);
    expect(at(b.consolation, 1)).toEqual(['n10', 'n7']);
    expect(at(b.consolation, 2)).toEqual(['n9', 'n8']);
    expect(at(b.consolation, 3)).toEqual([null, null]);
    expect(b.seeds).toMatchObject({ n3: 1, n1: 2, n10: 10 });
  });
  it('shows the real bracket once the playoffs are set, and calls it final once the season is', () => {
    const s = thisYear();
    s.brackets = shape(ids('n'), true);
    expect(standingsBrackets(s, lastYear()).kind).toBe('set');
    s.status = 'complete';
    const done = standingsBrackets(s, lastYear());
    expect(done.kind).toBe('final');
    expect(done.winners.find((x) => x.matchNo === 6)!.home).toBe('n4');
  });
  it('has nothing to show before a week is played, without a past bracket, or when the bracket changed shape', () => {
    const early = thisYear(); early.weeks = [{ ...week(1, []), played: false }];
    expect(standingsBrackets(early, lastYear()).kind).toBe('none');
    expect(standingsBrackets(thisYear(), null).kind).toBe('none');
    const bigger = thisYear(); bigger.playoffTeams = 8;
    expect(standingsBrackets(bigger, lastYear()).kind).toBe('none');
  });
});
