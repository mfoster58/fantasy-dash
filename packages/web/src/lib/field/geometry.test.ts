import { describe, expect, it } from 'vitest';
import type { FieldPlay } from './readPlays';
import { isBig, markOf, Y } from './geometry';

const play = (over: Partial<FieldPlay>): FieldPlay => ({
  id: '1', eventId: 'e', driveId: 'd', pid: 'p', kind: 'rec', los: 52, gain: 32, td: false, dir: 'right', depth: 'short', gap: null,
  pts: 4.2, time: 0, period: 2, clock: '5:08', text: '', ...over,
});
const endY = (d: string) => Number(d.trim().split(/[\s,]+/).pop());

describe('field geometry', () => {
  it('runs 3 units a yard from the goal line at 30, the offense going up', () => {
    expect(Y(0)).toBe(30);
    expect(Y(100)).toBe(330);
    expect(Y(20)).toBe(90);
  });

  it('draws a catch as a ball flight to its side of the field and a run after it that ends where he was tackled', () => {
    const m = markOf(play({}));
    expect(m.flight).toBeTruthy();
    expect(endY(m.path!)).toBe(Y(20));
    expect(m.end![0]).toBeGreaterThan(100); // thrown to the right
    expect(m.end![1]).toBe(Y(20));
  });

  it('draws a run as one curve through its gap', () => {
    const m = markOf(play({ kind: 'run', gap: 'left end', gain: 18, los: 27 }));
    expect(m.flight).toBeUndefined();
    expect(m.path).toMatch(/^M80 .* C/);
    expect(m.end![0]).toBeLessThan(60);
    expect(m.end![1]).toBe(Y(9));
  });

  it('takes a touchdown into the end zone', () => {
    expect(markOf(play({ td: true, gain: 20, los: 20 })).end![1]).toBeLessThan(Y(0));
  });

  it('ends a target that fell incomplete in the air, with no run after it', () => {
    const m = markOf(play({ kind: 'inc', gain: 0, pts: 0 }));
    expect(m.flight).toBeTruthy();
    expect(m.path).toBeUndefined();
    expect(m.end).toBeNull();
  });

  it('places the same play the same way every time it is drawn', () => {
    expect(markOf(play({ id: '42' }))).toEqual(markOf(play({ id: '42' })));
  });

  it('calls touchdowns, turnovers, 25-yard gains and 4-point plays big, but not a quarterback\'s routine throw', () => {
    expect(isBig(play({ gain: 32 }))).toBe(true);
    expect(isBig(play({ gain: 8, pts: 1.8 }))).toBe(false);
    expect(isBig(play({ gain: 3, pts: 9.3, td: true }))).toBe(true);
    expect(isBig(play({ kind: 'int', gain: 0, pts: -1 }))).toBe(true);
    expect(isBig(play({ kind: 'pass', gain: 40, pts: 5.7 }))).toBe(false);
    expect(isBig(play({ kind: 'pass', gain: 16, pts: 4.7, td: true }))).toBe(true);
  });
});
