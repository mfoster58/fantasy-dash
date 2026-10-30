import { describe, expect, it } from 'vitest';
import cleTen from '../../test/fixtures/espn/401873013.json';
import sfAtl from '../../test/fixtures/espn/401873017.json';
import nygHou from '../../test/fixtures/espn/401873016.json';
import indMin from '../../test/fixtures/espn/401873014.json';
import dalPhi from '../../test/fixtures/espn/401873009.json';
import carGb from '../../test/fixtures/espn/live-car-gb.json';
import { parseSummary } from './espnGame';
import { readPlays, type Starter } from './readPlays';

/** the league's own scoring, the keys a play can touch */
const SCORING = { rec: 1, rec_yd: 0.1, rec_td: 6, rush_yd: 0.1, rush_td: 6, pass_yd: 0.04, pass_td: 4, pass_int: -1, pass_cmp: 0.1, pass_inc: -0.2, fum_lost: -2 };
const starter = (id: string, firstName: string, lastName: string, team: string, pos: string): Starter => ({ id, firstName, lastName, team, pos });
const CONCEPCION = starter('13298', 'KC', 'Concepcion Jr.', 'CLE', 'WR');
const WANDALE = starter('8126', "Wan'Dale", 'Robinson', 'TEN', 'WR');
const BIJAN = starter('9509', 'Bijan', 'Robinson', 'ATL', 'RB');
const MARKS = starter('12474', 'Woody', 'Marks', 'HOU', 'RB');
const JONES = starter('4199', 'Aaron', 'Jones Sr.', 'MIN', 'RB');
const TAYLOR = starter('6813', 'Jonathan', 'Taylor', 'IND', 'RB');
const DAK = starter('3294', 'Dak', 'Prescott', 'DAL', 'QB');
const read = (json: unknown, ...who: Starter[]) => readPlays(parseSummary(json)!, who, SCORING);
const count = (plays: { kind: string }[]) => plays.reduce<Record<string, number>>((m, p) => ({ ...m, [p.kind]: (m[p.kind] ?? 0) + 1 }), {});

describe('readPlays', () => {
  it('finds every catch, target and run of a receiver, with yards that add up to his stat line', () => {
    const plays = read(cleTen, CONCEPCION);
    expect(count(plays)).toEqual({ rec: 8, inc: 2, run: 3 });
    expect(plays.filter((p) => p.kind === 'rec').reduce((n, p) => n + p.gain, 0)).toBe(129);
    expect(plays.filter((p) => p.kind === 'run').reduce((n, p) => n + p.gain, 0)).toBe(23);
  });

  it('reads one catch: where it started, how far, which side, how deep and its points', () => {
    const p = read(cleTen, CONCEPCION).find((x) => x.gain === 32)!;
    expect(p).toMatchObject({ pid: '13298', kind: 'rec', los: 52, gain: 32, dir: 'right', depth: 'short', td: false, pts: 4.2, period: 2, eventId: '401873013' });
    expect(p.time).toBe(Date.parse('2026-10-25T18:12:42Z'));
  });

  it('tells two players with the same initial and surname apart by team: W.Robinson for Tennessee, Bi.Robinson for Atlanta', () => {
    expect(count(read(cleTen, WANDALE))).toEqual({ rec: 4, inc: 2 });
    const bijan = read(sfAtl, BIJAN);
    expect(count(bijan)).toEqual({ run: 20, rec: 5 });
    expect(bijan.filter((p) => p.kind === 'run').reduce((n, p) => n + p.gain, 0)).toBe(63);
  });

  it('reads a run through its gap, even after "reported in as eligible"', () => {
    const plays = read(nygHou, MARKS);
    expect(count(plays)).toEqual({ run: 19, rec: 1 });
    expect(plays.find((p) => p.kind === 'run' && p.gain === 11)).toMatchObject({ gap: 'right end', los: 56 });
  });

  it('takes two points off for a fumble the other team recovered, none for one that went out of bounds, and no run for picking up a teammate\'s fumble', () => {
    const marks = read(nygHou, MARKS);
    expect(marks.find((p) => p.text.includes('RECOVERED by NYG'))).toMatchObject({ kind: 'run', gain: -3, td: false, pts: -2.3 });
    expect(marks.some((p) => p.text.includes('X.Hutchinson'))).toBe(false);
    const jones = read(indMin, JONES);
    expect(jones.find((p) => p.kind === 'rec')).toMatchObject({ gain: 1, pts: 1.1 });
  });

  it('marks touchdowns', () => {
    const taylor = read(indMin, TAYLOR);
    expect(count(taylor)).toEqual({ run: 18, rec: 2, inc: 1 });
    expect(taylor.filter((p) => p.td)).toHaveLength(1);
  });

  it('reads a quarterback\'s throws: completions with yards and touchdowns, incompletions, and his runs', () => {
    const plays = read(dalPhi, DAK);
    const c = count(plays);
    expect(c.pass).toBe(15);
    expect(c.passinc).toBe(12);
    expect(c.run).toBe(2);
    expect(plays.filter((p) => p.kind === 'pass').reduce((n, p) => n + p.gain, 0)).toBe(212);
    expect(plays.filter((p) => p.kind === 'pass' && p.td)).toHaveLength(3);
    expect(plays.find((p) => p.kind === 'passinc')!.pts).toBe(-0.2);
  });

  it('counts a run with offensive holding downfield only to the spot of the foul, as the stat line does', () => {
    // "right end to TEN 49 for 10 yards ... Offensive Holding, enforced at CLV 44": from the CLE 41, 3 yards count
    expect(read(cleTen, CONCEPCION).find((p) => p.text.includes('Offensive Holding'))).toMatchObject({ kind: 'run', gain: 3, pts: 0.3 });
    expect(read(nygHou, MARKS).filter((p) => p.kind === 'run').reduce((n, p) => n + p.gain, 0)).toBe(66);
  });

  it('reads a play whose text ESPN starts with a space (Hubbard\'s goal-line runs, Panthers-Packers live)', () => {
    const hubbard = read(carGb, starter('7594', 'Chuba', 'Hubbard', 'CAR', 'RB'));
    const runs = hubbard.filter((p) => p.kind === 'run');
    expect(runs.find((p) => p.los === 9)).toMatchObject({ gain: 2, gap: 'right tackle' });
    expect(runs.find((p) => p.los === 7)).toMatchObject({ gain: 6, gap: 'left tackle' });
  });

  it('skips plays wiped out by a penalty', () => {
    expect(read(nygHou, MARKS).some((p) => /no play/i.test(p.text))).toBe(false);
  });

  it('draws nothing for kickers and defences, or for players not in this game', () => {
    expect(read(cleTen, starter('12711', 'Tyler', 'Loop', 'BAL', 'K'), starter('SEA', 'Seattle', 'Seahawks', 'SEA', 'DEF'), BIJAN)).toEqual([]);
  });
});
