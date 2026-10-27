import { describe, it, expect } from 'vitest';
import { buildCharts, laneOf, zoneOf, ChartDbSchema, parseInjuries, type DbPos } from '../../src';

type Row = Record<string, string>;
let nextPlay = 1;
/** one play-by-play row; game 2025_01_AAA_BBB, regular season week 1 unless overridden */
const play = (f: Row): Row => ({ game_id: '2025_01_AAA_BBB', play_id: `${nextPlay++}.0`, season_type: 'REG', week: '1', epa: '0', ...f });
/** the participation row for a play */
const part = (p: Row, f: Row): Row => ({ nflverse_game_id: p.game_id, play_id: String(Math.trunc(Number(p.play_id))), ...f });

const POS: Record<string, DbPos> = { W: 'WR', T: 'TE', R: 'RB', Q: 'QB' };
const posOf = (g: string) => POS[g] ?? null;
const build = (plays: Row[], parts: Row[], ftn: Row[] = []) => buildCharts(plays, parts, posOf, 2025, '2026-01-01T00:00:00.000Z', [], ftn);
/** the FTN charting row for a play */
const ftnRow = (p: Row, f: Row): Row => ({ nflverse_game_id: p.game_id, nflverse_play_id: String(Math.trunc(Number(p.play_id))), ...f });

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

describe('buildCharts: without participation, and FTN', () => {
  const carry = (f: Row = {}) => play({ rush_attempt: '1', rusher_player_id: 'R', run_location: 'left', run_gap: 'tackle', yards_gained: '4', ...f });
  it('without participation, lanes and zones are built from play-by-play under all', () => {
    const q = play({ pass_attempt: '1', passer_player_id: 'Q', sack: '0', air_yards: '5', pass_location: 'left' });
    const db = build([carry(), q], []);
    expect(db.players.R.lanes!.all.LT![0]).toBe(1);
    expect(db.players.Q.zones!.all['short|left']![0]).toBe(1);
    expect(db.players.Q.zones!.clean).toEqual({});
    expect(db.players.Q.zones!.pressured).toEqual({});
    expect(db.players.Q.splits).toBeUndefined();
  });
  it('the box split falls back to FTN n_defense_box; a box of 0 goes only into all', () => {
    const a = carry(), b = carry(), c = carry();
    const db = build([a, b, c], [], [ftnRow(a, { n_defense_box: '6' }), ftnRow(b, { n_defense_box: '8' }), ftnRow(c, { n_defense_box: '0' })]);
    const l = db.players.R.lanes!;
    expect(l.all.LT![0]).toBe(3);
    expect(l.light.LT![0]).toBe(1);
    expect(l.heavy.LT![0]).toBe(1);
  });
  it('the participation box wins over FTN', () => {
    const a = carry();
    const db = build([a], [part(a, { defenders_in_box: '8' })], [ftnRow(a, { n_defense_box: '6' })]);
    expect(db.players.R.lanes!.heavy.LT![0]).toBe(1);
    expect(db.players.R.lanes!.light.LT).toBeUndefined();
  });
  it('ftn is true only with FTN rows; old JSON without the flag still parses', () => {
    const a = carry();
    expect(build([a], []).ftn).toBe(false);
    expect(build([a], [], [ftnRow(a, { n_defense_box: '7' })]).ftn).toBe(true);
    const old = { ...build([a], []) } as Record<string, unknown>;
    delete old.ftn;
    expect(() => ChartDbSchema.parse(old)).not.toThrow();
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
    const other = play({ receiver_player_id: 'W' });
    const db = build([a, other], [part(other, { route: 'GO' })]);
    expect(db.players.Q.splits).toEqual({ all: [1, 1, 1, 3, 0, 0] });
    expect(db.players.Q.zones!.all['short|middle']![0]).toBe(1);
    expect(db.players.Q.zones!.clean).toEqual({});
  });
  it('the result parses with ChartDbSchema', () => {
    const a = qb({ air_yards: '3', pass_location: 'middle' });
    expect(() => ChartDbSchema.parse(build([a], [part(a, { was_pressure: 'FALSE' })]))).not.toThrow();
  });
});


describe('buildCharts: plays (play-by-play only)', () => {
  const rush = (f: Row) => play({ rush_attempt: '1', rusher_player_id: 'R', ...f });
  it('success follows the yards-to-go rule at each down, exactly at the threshold', () => {
    const plays = [
      rush({ down: '1', ydstogo: '10', yards_gained: '4' }),   // 40%: success
      rush({ down: '1', ydstogo: '10', yards_gained: '3' }),   // short
      rush({ down: '2', ydstogo: '5', yards_gained: '3' }),    // 60%: success
      rush({ down: '2', ydstogo: '5', yards_gained: '2' }),    // short
      rush({ down: '3', ydstogo: '2', yards_gained: '2' }),    // 100%: success
      rush({ down: '4', ydstogo: '2', yards_gained: '1' }),    // short
    ];
    const db = build(plays, []);
    expect(db.players.R.plays!.rush).toEqual([6, 3, 0, 15]);
  });
  it('explosive at exactly 10 yards; scrambles and two-point tries are not carries', () => {
    const db = build([
      rush({ down: '1', ydstogo: '10', yards_gained: '10' }),
      rush({ down: '1', ydstogo: '10', yards_gained: '9' }),
      rush({ down: '1', ydstogo: '10', yards_gained: '30', qb_scramble: '1' }),
      rush({ down: '', ydstogo: '0', yards_gained: '2', two_point_attempt: '1' }),
    ], []);
    expect(db.players.R.plays!.rush).toEqual([2, 2, 1, 19]);
  });
  it('red-zone bands at 1, 5, 6, 10, 11, 20 and 21, with PPR points for carries and targets', () => {
    const db = build([
      rush({ yardline_100: '1', rushing_yards: '1', rush_touchdown: '1' }),
      rush({ yardline_100: '5', rushing_yards: '2' }),
      rush({ yardline_100: '6', rushing_yards: '3' }),
      rush({ yardline_100: '10', rushing_yards: '0' }),
      rush({ yardline_100: '11', rushing_yards: '5' }),
      rush({ yardline_100: '20', rushing_yards: '0' }),
      rush({ yardline_100: '21', rushing_yards: '9' }),
      play({ pass_attempt: '1', sack: '0', receiver_player_id: 'R', yardline_100: '8', complete_pass: '1', receiving_yards: '8', pass_touchdown: '1' }),
    ], []);
    expect(db.players.R.plays!.rz).toEqual({ ra: [2, 6.3], rb: [2, 0.3], rc: [2, 0.5], tb: [1, 7.8] });
  });
  it('QB dropbacks split into quarters 1–3 and 4 plus overtime', () => {
    const qb = (q: string, epa: string) => play({ pass_attempt: '1', passer_player_id: 'Q', sack: '0', qtr: q, epa });
    const db = build([qb('1', '0.5'), qb('3', '-0.25'), qb('4', '1'), qb('5', '0.5')], []);
    expect(db.players.Q.plays!.qtr).toEqual([2, 0.25, 2, 1.5]);
  });
  it('with no participation file: participation false; lanes and zones from play-by-play, no routes, splits or throws', () => {
    const db = build([
      play({ receiver_player_id: 'W' }),
      rush({ run_location: 'left', run_gap: 'tackle', down: '1', ydstogo: '10', yards_gained: '5' }),
      play({ pass_attempt: '1', passer_player_id: 'Q', sack: '0', air_yards: '5', pass_location: 'left' }),
    ], []);
    expect(db.participation).toBe(false);
    expect(db.players.W?.routes).toBeUndefined();
    expect(db.players.R.lanes!.all.LT![0]).toBe(1);
    expect(db.players.Q.zones!.all['short|left']![0]).toBe(1);
    expect(db.players.Q.splits).toBeUndefined();
    expect(db.players.Q.throws).toBeUndefined();
    expect(db.players.R.plays!.rush![0]).toBe(1);
  });
  it('with participation: participation true', () => {
    const a = play({ receiver_player_id: 'W' });
    expect(build([a], [part(a, { route: 'GO' })]).participation).toBe(true);
  });
});

describe('parseInjuries', () => {
  it('keeps regular-season rows by gsis and week, IR as Out, a blank status as listed', () => {
    const inj = parseInjuries([
      { season_type: 'REG', gsis_id: 'G1', week: '3', report_status: 'Out', report_primary_injury: 'Knee', practice_primary_injury: 'Knee' },
      { season_type: 'REG', gsis_id: 'G1', week: '5', report_status: '', report_primary_injury: '', practice_primary_injury: 'Knee' },
      { season_type: 'REG', gsis_id: 'G2', week: '6', report_status: 'Injured Reserve', report_primary_injury: 'Groin', practice_primary_injury: '' },
      { season_type: 'POST', gsis_id: 'G3', week: '19', report_status: 'Out', report_primary_injury: 'Ankle', practice_primary_injury: '' },
    ]);
    expect(inj).toEqual({ G1: { '3': ['Out', 'Knee'], '5': ['', 'Knee'] }, G2: { '6': ['Out', 'Groin'] } });
  });
  it('older files have game_type instead of season_type', () => {
    expect(parseInjuries([{ game_type: 'REG', gsis_id: 'G9', week: '1', report_status: 'Out', report_primary_injury: 'Hand', practice_primary_injury: 'Hand' }]))
      .toEqual({ G9: { '1': ['Out', 'Hand'] } });
  });
  it('buildCharts stores the parsed report', () => {
    const db = buildCharts([], [], () => null, 2026, 'x', [{ season_type: 'REG', gsis_id: 'G1', week: '2', report_status: 'Questionable', report_primary_injury: 'Hamstring', practice_primary_injury: '' }]);
    expect(db.injuries).toEqual({ G1: { '2': ['Questionable', 'Hamstring'] } });
  });
});

describe('buildCharts: QB throws by route, and play-by-play by week', () => {
  it('credits each routed target to the passer, under all and its coverage', () => {
    const a = play({ receiver_player_id: 'W', passer_player_id: 'Q', pass_attempt: '1', sack: '0', complete_pass: '1', receiving_yards: '12', epa: '1.5', pass_touchdown: '1' });
    const b = play({ receiver_player_id: 'T', passer_player_id: 'Q', pass_attempt: '1', sack: '0', complete_pass: '0', receiving_yards: '0', epa: '-0.5' });
    const db = build([a, b], [part(a, { route: 'SLANT', defense_man_zone_type: 'MAN_COVERAGE' }), part(b, { route: 'SLANT', defense_man_zone_type: 'ZONE_COVERAGE' })]);
    expect(db.players.Q.throws!.all.SLANT).toEqual([2, 1, 12, 1, 1]);
    expect(db.players.Q.throws!.man.SLANT).toEqual([1, 1, 12, 1.5, 1]);
    expect(db.players.Q.throws!.zone.SLANT).toEqual([1, 0, 0, -0.5, 0]);
  });
  it('no throws without participation', () => {
    const a = play({ receiver_player_id: 'W', passer_player_id: 'Q', pass_attempt: '1', sack: '0' });
    expect(build([a], []).players.Q?.throws).toBeUndefined();
  });
  it('keeps the play-by-play counts per week as well as for the season', () => {
    const rush = (week: string, gained: string) => play({ week, rush_attempt: '1', rusher_player_id: 'R', down: '1', ydstogo: '10', yards_gained: gained, yardline_100: '4', rushing_yards: gained });
    const qb = (week: string, q: string) => play({ week, pass_attempt: '1', passer_player_id: 'Q', sack: '0', qtr: q, epa: '1' });
    const db = build([rush('1', '5'), rush('2', '12'), rush('2', '0'), qb('1', '4'), qb('2', '1')], []);
    expect(db.players.R.plays!.rush).toEqual([3, 2, 1, 17]);
    expect(db.players.R.plays!.weeks!['1'].rush).toEqual([1, 1, 0, 5]);
    expect(db.players.R.plays!.weeks!['2'].rush).toEqual([2, 1, 1, 12]);
    expect(db.players.R.plays!.weeks!['2'].rz).toEqual({ ra: [2, 1.2] });
    expect(db.players.Q.plays!.weeks!['1'].qtr).toEqual([0, 0, 1, 1]);
    expect(db.players.Q.plays!.weeks!['2'].qtr).toEqual([1, 1, 0, 0]);
  });
});

describe('buildCharts: grades and target maps', () => {
  const tgt = (f: Row) => play({ pass_attempt: '1', sack: '0', receiver_player_id: 'W', passer_player_id: 'Q', posteam: 'AAA', ...f });
  const carry = (f: Row) => play({ rush_attempt: '1', rusher_player_id: 'R', posteam: 'AAA', ...f });

  it('grades: receiver sums, deep, money downs, catch over expected', () => {
    const db = build([
      tgt({ complete_pass: '1', receiving_yards: '25', epa: '1.5', success: '1', first_down: '1', cp: '0.4', yards_after_catch: '5', xyac_mean_yardage: '3', air_yards: '20', pass_location: 'left', down: '3', yardline_100: '40' }),
      tgt({ complete_pass: '0', receiving_yards: '0', epa: '-0.5', success: '0', first_down: '0', cp: '0.8', air_yards: '12', pass_location: 'middle', down: '1', yardline_100: '12' }),
      tgt({ complete_pass: '1', receiving_yards: '8', epa: '0.7', success: '1', first_down: '0', touchdown: '1', pass_touchdown: '1', td_team: 'AAA', cp: 'NA', yards_after_catch: '2', xyac_mean_yardage: 'NA', air_yards: '6', pass_location: 'right', down: '2', yardline_100: '8' }),
    ], []);
    expect(db.players.W.grades).toMatchObject({ tgt: 3, rec: 2, yds: 33, epa: 1.7, succ: 2, fd: 2, td: 1, cpN: 2, cpSum: 1.2, cpRec: 1, yacN: 1, yacOe: 2, deep: 1, deepRec: 1, deepYds: 25, deepEpa: 1.5, t3: 1, t3Conv: 1, rzTgt: 2, ezTgt: 1 });
  });

  it('grades: FTN rates count only FTN-covered targets', () => {
    const a = tgt({ air_yards: '5', pass_location: 'left' }), b = tgt({ air_yards: '5', pass_location: 'left' });
    const g = build([a, b], [], [ftnRow(a, { is_drop: 'TRUE', is_catchable_ball: 'TRUE' })]).players.W.grades!;
    expect(g).toMatchObject({ tgt: 2, ftnTgt: 1, drops: 1, catchable: 1 });
  });

  it('grades: team red-zone share follows the games he played, across a trade', () => {
    const g1 = { game_id: '2025_01_AAA_BBB', posteam: 'AAA', yardline_100: '10' };
    const g2 = { game_id: '2025_02_CCC_DDD', posteam: 'CCC', yardline_100: '10', week: '2' };
    const g3 = { game_id: '2025_03_CCC_EEE', posteam: 'CCC', yardline_100: '10', week: '3' };
    const db = build([
      tgt(g1), tgt({ ...g1, receiver_player_id: 'Z' }), tgt({ ...g1, receiver_player_id: 'Z' }),
      tgt(g2), tgt({ ...g2, receiver_player_id: 'Z' }),
      ...[1, 2, 3, 4, 5].map(() => tgt({ ...g3, receiver_player_id: 'Z' })),
    ], []);
    expect(db.players.W.grades).toMatchObject({ rzTgt: 2, teamRzTgt: 5 });
  });

  it('grades: QB dropbacks, deep, situational, legs and FTN keys', () => {
    const a = play({ qb_dropback: '1', pass_attempt: '1', sack: '0', passer_player_id: 'Q', posteam: 'AAA', complete_pass: '1', passing_yards: '30', pass_touchdown: '1', touchdown: '1', td_team: 'AAA', epa: '2', success: '1', air_yards: '22', cpoe: '30', down: '3', first_down: '1', yardline_100: '15', qtr: '4', score_differential: '-3' });
    const b = play({ qb_dropback: '1', pass_attempt: '1', sack: '1', passer_player_id: 'Q', posteam: 'AAA', yards_gained: '-7', epa: '-1.5', success: '0', down: '1', yardline_100: '50', qtr: '1', score_differential: '0' });
    const c = play({ qb_dropback: '1', pass_attempt: '0', rush_attempt: '1', qb_scramble: '1', passer_player_id: 'Q', rusher_player_id: 'Q', posteam: 'AAA', yards_gained: '9', epa: '0.8', success: '1', first_down: '1', down: '2', yardline_100: '60', qtr: '2', score_differential: '0' });
    const d = play({ rush_attempt: '1', rusher_player_id: 'Q', posteam: 'AAA', yards_gained: '3', epa: '0.3', first_down: '0' });
    const g = build([a, b, c, d], [], [
      ftnRow(a, { is_interception_worthy: 'FALSE', read_thrown: '1', is_catchable_ball: 'TRUE', is_play_action: 'TRUE', n_blitzers: '2', is_drop: 'FALSE' }),
      ftnRow(b, { is_qb_fault_sack: 'TRUE', n_blitzers: '0', read_thrown: '0' }),
    ]).players.Q.grades!;
    expect(g).toMatchObject({
      db: 3, dbEpa: 1.3, dbSucc: 2, att: 1, sacks: 1, sackYds: 7, passYds: 30, passTd: 1,
      deepAtt: 1, deepCmp: 1, deepAttEpa: 2, deepCpoeSum: 30, deepCpoeN: 1,
      t3Db: 1, t3DbConv: 1, rzDb: 1, rzTd: 1, q4Db: 1, q4Epa: 2, trailDb: 1, trailEpa: 2,
      scr: 1, scrYds: 9, drun: 1, drunEpa: 0.3, rushFd: 1,
      ftnDb: 2, ftnAtt: 1, readN: 1, firstRead: 1, catchableThrown: 1, faultSack: 1, paDb: 1, paEpa: 2, blitzDb: 1, blitzEpa: 2, noBlitzDb: 1, noBlitzEpa: -1.5,
    });
    expect(g.iw ?? 0).toBe(0);
    expect(g.int ?? 0).toBe(0);
  });

  it('grades: rusher keys incl. box split and outside runs', () => {
    const c1 = carry({ run_location: 'left', run_gap: 'end', yards_gained: '12', epa: '1', success: '1', first_down: '1', yardline_100: '30' });
    const c2 = carry({ run_location: 'middle', yards_gained: '0', epa: '-0.4', success: '0', yardline_100: '4' });
    const c3 = carry({ run_location: 'right', run_gap: 'tackle', yards_gained: '4', epa: '0.6', success: '1', touchdown: '1', rush_touchdown: '1', td_team: 'AAA', yardline_100: '4' });
    const g = build([c1, c2, c3], [], [ftnRow(c1, { n_defense_box: '6', is_rpo: 'TRUE' }), ftnRow(c2, { n_defense_box: '8' })]).players.R.grades!;
    expect(g).toMatchObject({ car: 3, carYds: 16, carEpa: 1.2, carSucc: 2, carFd: 2, explosive: 1, stuffed: 1, in10: 2, in5: 2, in5Td: 1, outside: 1, ftnCar: 2, boxN: 2, boxSum: 14, lightCar: 1, lightYds: 12, heavyCar: 1, heavyYds: 0, rpo: 1, teamIn10: 2 });
  });

  it('targets: zones by FTN filter; a target without an FTN row is only in all', () => {
    const a = tgt({ air_yards: '5', pass_location: 'left', complete_pass: '1', receiving_yards: '7', epa: '0.5' });
    const b = tgt({ air_yards: '25', pass_location: 'right' });
    const t = build([a, b], [], [ftnRow(a, { is_play_action: 'TRUE' })]).players.W.targets!;
    expect(t.all!['short|left']).toEqual([1, 1, 7, 0.5, 0]);
    expect(t.all!['deep|right']![0]).toBe(1);
    expect(t.pa!['short|left']![0]).toBe(1);
    expect(t.pa!['deep|right']).toBeUndefined();
    expect(t.nopa?.['short|left']).toBeUndefined();
  });

  it('old chart JSON without grades or targets still parses; new output parses', () => {
    const a = tgt({ air_yards: '5', pass_location: 'left' });
    const db = build([a], [], [ftnRow(a, { is_motion: 'TRUE' })]);
    expect(() => ChartDbSchema.parse(db)).not.toThrow();
    const old = JSON.parse(JSON.stringify(db));
    for (const p of Object.values(old.players) as Record<string, unknown>[]) { delete p.grades; delete p.targets; }
    expect(() => ChartDbSchema.parse(old)).not.toThrow();
  });
});
