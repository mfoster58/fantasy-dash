import { describe, it, expect } from 'vitest';
import { buildCharts, laneOf, zoneOf, ChartDbSchema, type DbPos } from '../../src';

type Row = Record<string, string>;
let nextPlay = 1;
/** one play-by-play row; game 2025_01_AAA_BBB, regular season week 1 unless overridden */
const play = (f: Row): Row => ({ game_id: '2025_01_AAA_BBB', play_id: `${nextPlay++}.0`, season_type: 'REG', week: '1', epa: '0', ...f });
/** the participation row for a play */
const part = (p: Row, f: Row): Row => ({ nflverse_game_id: p.game_id, play_id: String(Math.trunc(Number(p.play_id))), ...f });

const POS: Record<string, DbPos> = { W: 'WR', T: 'TE', R: 'RB', Q: 'QB' };
const posOf = (g: string) => POS[g] ?? null;
const build = (plays: Row[], parts: Row[]) => buildCharts(plays, parts, posOf, 2025, '2026-01-01T00:00:00.000Z');

describe('laneOf / zoneOf', () => {
  it('maps run location and gap to a lane', () => {
    expect(laneOf('middle', '')).toBe('MID');
    expect(laneOf('left', 'end')).toBe('LE');
    expect(laneOf('right', 'guard')).toBe('RG');
    expect(laneOf('left', '')).toBeNull();
    expect(laneOf('', '')).toBeNull();
  });
  it('bands air yards at -1, 0, 9, 10, 19, 20', () => {
    expect(zoneOf('-1', 'left')).toBe('blos|left');
    expect(zoneOf('0', 'left')).toBe('short|left');
    expect(zoneOf('9', 'middle')).toBe('short|middle');
    expect(zoneOf('10', 'right')).toBe('mid|right');
    expect(zoneOf('19', 'right')).toBe('mid|right');
    expect(zoneOf('20', 'right')).toBe('deep|right');
    expect(zoneOf('NA', 'right')).toBeNull();
    expect(zoneOf('5', '')).toBeNull();
  });
});

describe('buildCharts: routes', () => {
  it('credits a routed target to the receiver under all and its coverage, and skips a target with no route', () => {
    const a = play({ receiver_player_id: 'W', complete_pass: '1', receiving_yards: '12', epa: '1.5', pass_touchdown: '1' });
    const b = play({ receiver_player_id: 'W', complete_pass: '0', receiving_yards: '0', epa: '-0.5' });
    const c = play({ receiver_player_id: 'W', complete_pass: '1', receiving_yards: '30' });
    const db = build([a, b, c], [part(a, { route: 'SLANT', defense_man_zone_type: 'MAN_COVERAGE' }), part(b, { route: 'SLANT', defense_man_zone_type: '' }), part(c, { route: '' })]);
    expect(db.players.W.pos).toBe('WR');
    expect(db.players.W.routes!.all.SLANT).toEqual([2, 1, 12, 1, 1]);
    expect(db.players.W.routes!.man.SLANT).toEqual([1, 1, 12, 1.5, 1]);
    expect(db.players.W.routes!.zone.SLANT).toBeUndefined();
    expect(db.players.W.lanes).toBeUndefined();
  });
  it('keeps a TE and an RB target, drops a receiver of another position or with no position', () => {
    const a = play({ receiver_player_id: 'T' }), b = play({ receiver_player_id: 'R' }), c = play({ receiver_player_id: 'X' }), d = play({ receiver_player_id: 'Q' });
    const db = build([a, b, c, d], [a, b, c, d].map((p) => part(p, { route: 'GO', defense_man_zone_type: 'ZONE_COVERAGE' })));
    expect(db.players.T.routes!.all.GO![0]).toBe(1);
    expect(db.players.R.routes!.all.GO![0]).toBe(1);
    expect(db.players.X).toBeUndefined();
    expect(db.players.Q?.routes).toBeUndefined();
  });
  it('ignores postseason and week 19+ plays', () => {
    const a = play({ receiver_player_id: 'W', season_type: 'POST', week: '19' }), b = play({ receiver_player_id: 'W', week: '19' });
    const db = build([a, b], [part(a, { route: 'GO' }), part(b, { route: 'GO' })]);
    expect(db.players.W).toBeUndefined();
  });
});

describe('buildCharts: lanes', () => {
  it('files RB carries by lane and box, counts success as positive EPA, skips scrambles and missing gaps', () => {
    const a = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'left', run_gap: 'tackle', yards_gained: '6', epa: '0.4', rush_touchdown: '1' });
    const b = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'left', run_gap: 'tackle', yards_gained: '-1', epa: '-0.6' });
    const c = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'left', run_gap: '', yards_gained: '3' });
    const d = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'middle', run_gap: '', qb_scramble: '1', yards_gained: '9' });
    const db = build([a, b, c, d], [part(a, { defenders_in_box: '6' }), part(b, { defenders_in_box: '8' }), part(c, {}), part(d, {})]);
    const lanes = db.players.R.lanes!;
    expect(lanes.all.LT).toEqual([2, 5, -0.2, 1, 1]);
    expect(lanes.light.LT).toEqual([1, 6, 0.4, 1, 1]);
    expect(lanes.heavy.LT).toEqual([1, -1, -0.6, 0, 0]);
    expect(lanes.all.MID).toBeUndefined();
  });
  it('a carry with no box count goes only into all; a WR carry is not charted', () => {
    const a = play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'right', run_gap: 'end', yards_gained: '4' });
    const b = play({ rush_attempt: '1', rusher_player_id: 'W', run_location: 'right', run_gap: 'end', yards_gained: '4' });
    const db = build([a, b], [part(a, { defenders_in_box: '' })]);
    expect(db.players.R.lanes!.all.RE![0]).toBe(1);
    expect(db.players.R.lanes!.light.RE).toBeUndefined();
    expect(db.players.R.lanes!.heavy.RE).toBeUndefined();
    expect(db.players.W?.lanes).toBeUndefined();
  });
});

describe('buildCharts: zones and splits', () => {
  const qb = (f: Row) => play({ pass_attempt: '1', passer_player_id: 'Q', sack: '0', ...f });
  it('files attempts by zone and pocket; a sack counts as a dropback but not a zone attempt', () => {
    const a = qb({ air_yards: '8', pass_location: 'right', complete_pass: '1', passing_yards: '11', epa: '0.9', pass_touchdown: '1', cpoe: '12.5' });
    const b = qb({ air_yards: '25', pass_location: 'left', complete_pass: '0', passing_yards: '0', epa: '-1.1', interception: '1', cpoe: 'NA' });
    const s = qb({ sack: '1', epa: '-2' });
    const db = build([a, b, s], [
      part(a, { was_pressure: 'FALSE', number_of_pass_rushers: '4', defense_man_zone_type: 'ZONE_COVERAGE', defense_coverage_type: 'COVER_3', time_to_throw: '2.1' }),
      part(b, { was_pressure: 'TRUE', number_of_pass_rushers: '6', defense_man_zone_type: 'MAN_COVERAGE', defense_coverage_type: 'COVER_9', time_to_throw: '3.4' }),
      part(s, { was_pressure: 'TRUE', number_of_pass_rushers: '', defense_man_zone_type: '', defense_coverage_type: '', time_to_throw: '' }),
    ]);
    const z = db.players.Q.zones!, sp = db.players.Q.splits!;
    expect(z.all['short|right']).toEqual([1, 1, 11, 0.9, 1, 0, 12.5, 1]);
    expect(z.clean['short|right']).toEqual([1, 1, 11, 0.9, 1, 0, 12.5, 1]);
    expect(z.pressured['deep|left']).toEqual([1, 0, 0, -1.1, 0, 1, 0, 0]);
    expect(sp.all).toEqual([3, 2, 1, 11, -2.2, 1]);
    expect(sp.pressured).toEqual([2, 1, 0, 0, -3.1, 1]);
    expect(sp.clean).toEqual([1, 1, 1, 11, 0.9, 0]);
    expect(sp.blitz).toEqual([1, 1, 0, 0, -1.1, 0]);
    expect(sp.noblitz).toEqual([1, 1, 1, 11, 0.9, 0]);
    expect(sp.man![0]).toBe(1);
    expect(sp.zone![0]).toBe(1);
    expect(sp.COVER_3![0]).toBe(1);
    expect(Object.keys(sp)).not.toContain('COVER_9');
    expect(sp.quick![0]).toBe(1);
    expect(sp.hold![0]).toBe(1);
  });
  it('a dropback with no participation row counts only in all', () => {
    const a = qb({ air_yards: '3', pass_location: 'middle', complete_pass: '1', passing_yards: '3' });
    const db = build([a], []);
    expect(db.players.Q.splits).toEqual({ all: [1, 1, 1, 3, 0, 0] });
    expect(db.players.Q.zones!.all['short|middle']![0]).toBe(1);
    expect(db.players.Q.zones!.clean).toEqual({});
  });
  it('the result parses with ChartDbSchema', () => {
    const a = qb({ air_yards: '3', pass_location: 'middle' });
    expect(() => ChartDbSchema.parse(build([a], [part(a, { was_pressure: 'FALSE' })]))).not.toThrow();
  });
});
