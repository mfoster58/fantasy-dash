import { leaders } from './leaders';

describe('leaders', () => {
  it('the highest leads; ties all lead', () => {
    expect(leaders([3, 7, null, 7])).toEqual([false, true, false, true]);
  });
  it('lower is better', () => {
    expect(leaders([0.3, 0.2, 0.5], true)).toEqual([false, true, false]);
  });
  it('fewer than two values: nobody leads', () => {
    expect(leaders([5, null, null])).toEqual([false, false, false]);
    expect(leaders([])).toEqual([]);
  });
});
