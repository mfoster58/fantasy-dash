import { ownership } from './ownership';
import { season2024, season2025 } from '../../test/statsFixtures';

describe('ownership', () => {
  const own = ownership(season2025());
  it('credits a drafted player to the drafter with his round and pick', () => {
    expect(own('q1', 'a', 1)).toEqual({ kind: 'draft', round: 1, pickNo: 1 });
    expect(own('q1', 'b', 1)).toBeNull();
  });
  it('a waiver add counts from its week, with the bid', () => {
    expect(own('x1', 'a', 1)).toBeNull();
    expect(own('x1', 'a', 2)).toEqual({ kind: 'waiver', week: 2, bid: 10 });
  });
  it('a drop takes effect the week after it is logged, so the drop week still belongs to the dropper', () => {
    expect(own('x1', 'a', 4)).toEqual({ kind: 'waiver', week: 2, bid: 10 });
    expect(own('x1', 'a', 5)).toBeNull();
  });
  it('a drafted player dropped and re-added is a pickup from the re-add on', () => {
    expect(own('t2', 'a', 1)).toEqual({ kind: 'draft', round: 2, pickNo: 8 });
    expect(own('t2', 'a', 3)).toBeNull();
    expect(own('t2', 'a', 4)).toEqual({ kind: 'waiver', week: 4, bid: 3 });
  });
  it('a trade moves the player to the other manager from the trade week', () => {
    expect(own('t1', 'd', 2)).toEqual({ kind: 'draft', round: 1, pickNo: 4 });
    expect(own('t1', 'c', 3)).toEqual({ kind: 'trade', week: 3, bid: null });
    expect(own('t1', 'd', 3)).toBeNull();
    expect(own('w1', 'd', 5)).toEqual({ kind: 'trade', week: 3, bid: null });
  });
  it('knows nothing about a player the log never mentions, and copes with a season without a draft', () => {
    expect(own('zz', 'a', 1)).toBeNull();
    expect(ownership(season2024())('q1', 'a', 1)).toBeNull();
  });
});
