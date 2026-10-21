import type { History } from '@fantasy-dash/core';
import { leadPoints } from '../playerBoards';
import { game, line, players, season, side, week } from '../../test/playerFixtures';
import { MODEL_BOARDS, TD_BOARDS, YARD_BOARDS, homeLeaderContext } from './leaders';

const managers: History['managers'] = { a: { displayName: 'alice', avatar: null, seasons: [2025, 2026] }, b: { displayName: 'bob', avatar: null, seasons: [2025, 2026] } };
const seasons = [
  season(2025, [week(1, [game(2025, 1, 1, side('a', 90, [line('q1', 90, { pass_yd: 400 })]), side('b', 1, [line('r1', 1)]))])]),
  season(2026, [week(1, [game(2026, 1, 1, side('a', 30, [line('q1', 30, { pass_yd: 250, pass_td: 2 })]), side('b', 25, [line('r1', 25, { rush_yd: 120, rush_td: 1 })]))])], null, 1),
];

describe('homeLeaderContext', () => {
  it('ranks the chosen year only, and narrows by position', () => {
    const ctxOf = homeLeaderContext(seasons, players, managers, 2026);
    expect(leadPoints(ctxOf('All')).map((r) => [r.playerId, r.value])).toEqual([['q1', 30], ['r1', 25]]);
    expect(leadPoints(ctxOf('RB')).map((r) => r.playerId)).toEqual(['r1']);
    expect(leadPoints(ctxOf('TE'))).toEqual([]);
  });
  it('switches yards and touchdowns by split and the model panel by FPOE or xFP', () => {
    const ctx = homeLeaderContext(seasons, players, managers, 2026)('All');
    expect(YARD_BOARDS.all(ctx)[0].playerId).toBe('q1');
    expect(YARD_BOARDS.rush(ctx).map((r) => r.playerId)).toEqual(['r1']);
    expect(TD_BOARDS.pass(ctx).map((r) => r.playerId)).toEqual(['q1']);
    expect(Object.keys(MODEL_BOARDS)).toEqual(['fpoe', 'xfp']);
    expect(() => MODEL_BOARDS.fpoe(ctx, 'desc')).not.toThrow();
  });
});
