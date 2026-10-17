import { describe, it, expect } from 'vitest';
import { indexWeekly, mapFields, numberOf, round3 } from '../../src/playerdb/fields';

describe('numberOf', () => {
  it('parses numbers and treats blanks, NA and junk as null', () => {
    expect(numberOf('3.5')).toBe(3.5);
    expect(numberOf('0')).toBe(0);
    expect(numberOf('')).toBeNull();
    expect(numberOf('NA')).toBeNull();
    expect(numberOf('abc')).toBeNull();
    expect(numberOf(undefined)).toBeNull();
  });
});

describe('mapFields', () => {
  it('renames present numeric columns and drops the rest, rounding to 3 dp', () => {
    expect(mapFields({ passing_epa: '4.75172', pacr: '', junk: '9' }, { passing_epa: 'pa_epa', pacr: 'pa_pacr' })).toEqual({ pa_epa: 4.752 });
    expect(round3(0.2222222)).toBe(0.222);
  });
});

describe('indexWeekly', () => {
  it('keys rows by id and week, skipping rejected rows and merging duplicates', () => {
    const rows: Record<string, string>[] = [
      { pid: 'x', week: '1', t: 'REG', v: '1' },
      { pid: 'x', week: '1', t: 'REG', w: '2' },
      { pid: 'x', week: '2', t: 'POST', v: '3' },
      { pid: '', week: '2', t: 'REG', v: '3' },
    ];
    const m = indexWeekly(rows, 'pid', { v: 'pa_att', w: 'pa_cmp' }, (r) => r.t === 'REG');
    expect([...m.keys()]).toEqual(['x|1']);
    expect(m.get('x|1')).toEqual({ pa_att: 1, pa_cmp: 2 });
  });
});
