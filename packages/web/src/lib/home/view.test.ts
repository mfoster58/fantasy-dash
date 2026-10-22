import { game, side } from '../../test/playerFixtures';
import { gameView, pregameWin } from './view';

const g = (a: number, b: number) => { const x = side('a', a, []); const y = side('b', b, []); x.projected = 145.8; y.projected = 142.3; return game(2026, 7, 1, x, y); };

describe('pregameWin', () => {
  it('is Φ of the projected gap, clamped to 1–99, and 50/50 with nothing projected', () => {
    expect(pregameWin(145.8, 142.3)).toEqual([54, 46]);
    expect(pregameWin(300, 10)).toEqual([99, 1]);
    expect(pregameWin(0, 0)).toEqual([50, 50]);
  });
});

describe('gameView', () => {
  it('before kickoff without live data: synced projections, pregame win %, no winner', () => {
    expect(gameView(g(0, 0), null, false)).toEqual({ status: 'upcoming', scores: [145.8, 142.3], projected: [145.8, 142.3], win: [54, 46], toPlay: [null, null], winner: null });
  });
  it('before kickoff with live data: current-lineup projections and their win %', () => {
    const v = gameView(g(0, 0), { status: 'upcoming', projected: [130, 140], win: [40, 60] }, false);
    expect(v).toMatchObject({ scores: [130, 140], win: [40, 60] });
  });
  it('live: points so far, projected finals, live win %, players left, no winner', () => {
    const v = gameView(g(78.4, 61.2), { status: 'live', projected: [141, 139.6], win: [57, 43] }, false, [5, 6]);
    expect(v).toEqual({ status: 'live', scores: [78.4, 61.2], projected: [141, 139.6], win: [57, 43], toPlay: [5, 6], winner: null });
  });
  it('final: the winner by points, or nobody on a tie', () => {
    expect(gameView(g(131.5, 138.2), null, true)).toMatchObject({ status: 'final', scores: [131.5, 138.2], winner: 1, win: null });
    expect(gameView(g(100, 100), { status: 'final', projected: [100, 100], win: [50, 50] }, false).winner).toBeNull();
  });
});
