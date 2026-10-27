import { parseState, serializeState } from './url';

describe('url state', () => {
  it('defaults everything and omits defaults when serializing', () => {
    const s = parseState(new URLSearchParams(''), 6);
    expect(s).toEqual({ tab: 'all', from: 1, to: 6, mode: 'total', roster: 'all', sort: 'pts', dir: 'desc', q: '', team: 'all', rookies: false });
    expect(serializeState(s, 6).toString()).toBe('');
  });
  it('round-trips every param', () => {
    const p = new URLSearchParams('tab=wr&from=3&to=5&mode=pg&roster=123&sort=yprr&dir=asc&q=egb&team=KC&rookies=1');
    const s = parseState(p, 6);
    expect(s).toEqual({ tab: 'wr', from: 3, to: 5, mode: 'pg', roster: '123', sort: 'yprr', dir: 'asc', q: 'egb', team: 'KC', rookies: true });
    expect(serializeState(s, 6).toString()).toBe(p.toString());
  });
  it('falls back on junk, clamps weeks and swaps a reversed range', () => {
    const s = parseState(new URLSearchParams('tab=xx&from=9&to=0&mode=zz&sort=nope&dir=up'), 6);
    expect(s).toMatchObject({ tab: 'all', from: 1, to: 6, mode: 'total', sort: 'pts', dir: 'desc' });
    expect(parseState(new URLSearchParams('from=5&to=2'), 6)).toMatchObject({ from: 2, to: 5 });
    expect(parseState(new URLSearchParams('sort=constructor'), 6).sort).toBe('pts');
  });
  it('falls back to points, descending, when the sort column is not on the tab', () => {
    expect(parseState(new URLSearchParams('tab=wr&sort=cpoe&dir=asc'), 6)).toMatchObject({ tab: 'wr', sort: 'pts', dir: 'desc' });
    expect(parseState(new URLSearchParams('sort=yprr'), 6)).toMatchObject({ tab: 'all', sort: 'pts', dir: 'desc' });
    expect(parseState(new URLSearchParams('tab=qb&sort=cpoe&dir=asc'), 6)).toMatchObject({ sort: 'cpoe', dir: 'asc' });
  });
  it('clamps integer weeks into range before swapping, and falls back only for non-numbers', () => {
    expect(parseState(new URLSearchParams('from=9&to=4'), 6)).toMatchObject({ from: 4, to: 6 });
    expect(parseState(new URLSearchParams('from=0&to=17'), 6)).toMatchObject({ from: 1, to: 6 });
    expect(parseState(new URLSearchParams('from=abc&to=2.5'), 6)).toMatchObject({ from: 1, to: 6 });
  });
});
