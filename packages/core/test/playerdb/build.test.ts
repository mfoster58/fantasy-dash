import { describe, it, expect } from 'vitest';
import { buildPlayerDb, mergeInto, type PlayerDbInput } from '../../src/playerdb/build';
import { PlayerDbSchema } from '../../src/playerdb/schema';
import type { SleeperWeekStat } from '../../src/sleeper/types';

const scoring = { rec: 1, rec_yd: 0.1, rush_yd: 0.1, pass_yd: 0.04 };
const wr = (id: string, team: string, week: number, tgt: number, extra: Record<string, number> = {}): SleeperWeekStat =>
  ({ player_id: id, team, opponent: 'OPP', player: { position: 'WR' }, stats: { gp: 1, rec_tgt: tgt, rec: tgt - 1, rec_yd: tgt * 10, rec_air_yd: tgt * 8, rec_yar: 5, off_snp: 50, tm_off_snp: 60, ...extra } });
const qb = (id: string, team: string): SleeperWeekStat => ({ player_id: id, team, opponent: 'OPP', player: { position: 'QB' }, stats: { gp: 1, pass_att: 30, pass_sack: 2, pass_air_yd: 240, pass_yd: 250 } });

function input(over: Partial<PlayerDbInput> = {}): PlayerDbInput {
  const sleeperWeeks = new Map<number, SleeperWeekStat[]>();
  for (let w = 1; w <= 2; w++) sleeperWeeks.set(w, [
    wr('w1', 'TB', w, 9), wr('w2', 'TB', w, 4), wr('dup', 'TB', w, 1), qb('q1', 'TB'),
    { player_id: 'k1', team: 'TB', player: { position: 'K' }, stats: { gp: 1, fgm: 2 } },
    { player_id: 'inj', team: 'TB', player: { position: 'WR' }, stats: { gp: 0 } },
  ]);
  return {
    year: 2026, throughWeek: 2, builtAt: '2026-10-17T00:00:00.000Z', scoring, positionOverrides: {},
    sleeperWeeks,
    projections: new Map([[1, { w1: { rec: 5, rec_yd: 60 } }]]),
    directory: {
      w1: { player_id: 'w1', full_name: 'Wide One', position: 'WR', team: 'TB', years_exp: 1, birth_date: '2002-10-14' },
      w2: { player_id: 'w2', full_name: 'Wide Two', position: 'WR', team: 'TB' },
      dup: { player_id: 'dup', full_name: 'No Map', position: 'WR', team: 'TB' },
      q1: { player_id: 'q1', full_name: 'Quarter One', position: 'QB', team: 'TB' },
    },
    crosswalk: { gsisOf: (id) => ({ w1: '00-1', w2: '00-2', q1: '00-q' }[id] ?? null), pfrOf: (id) => ({ w1: 'WideOn01' }[id] ?? null) },
    byGsis: new Map([['00-1|1', { re_epa: 2.5, re_yac: 99, re_sep: 3.1 }], ['00-q|1', { pa_epa: 4, pa_sack: 7 }]]),
    byPfr: new Map([['WideOn01|1', { re_bt: 1, re_rtg: 100 }]]),
    nflPlayers: new Map([['00-1', { birthDate: '2002-10-14', draft: { year: 2025, round: 1, pick: 19 }, college: 'Ohio State', height: 73, weight: 205 }]]),
    participation: null,
    ...over,
  };
}

describe('mergeInto', () => {
  it('fills only the keys the base lacks', () => {
    const base = { id: 'a', week: 1, team: 'X', gp: 1, re_yac: 5 } as const;
    const row = { ...base };
    mergeInto(row, { re_yac: 99, re_epa: 1 });
    expect(row).toEqual({ ...base, re_epa: 1 });
    mergeInto(row, undefined);
    expect(row).toEqual({ ...base, re_epa: 1 });
  });
});

describe('buildPlayerDb', () => {
  const db = buildPlayerDb(input());
  it('keeps only played QB/RB/WR/TE rows, sorted by week then id, and validates', () => {
    expect(PlayerDbSchema.parse(db)).toEqual(db);
    expect(db.rows.map((r) => `${r.week}:${r.id}`)).toEqual(['1:dup', '1:q1', '1:w1', '1:w2', '2:dup', '2:q1', '2:w1', '2:w2']);
    expect(db.throughWeek).toBe(2);
    expect(db.routesReal).toBe(false);
  });
  it('joins nflverse and PFR fields through the crosswalk, base winning', () => {
    const w1 = db.rows.find((r) => r.id === 'w1' && r.week === 1)!;
    expect(w1).toMatchObject({ re_epa: 2.5, re_sep: 3.1, re_bt: 1, re_rtg: 100, re_yac: 5, proj: 11 });
    const q1 = db.rows.find((r) => r.id === 'q1' && r.week === 1)!;
    expect(q1).toMatchObject({ pa_epa: 4, pa_sack: 2 });
    const dup = db.rows.find((r) => r.id === 'dup' && r.week === 1)!;
    expect(dup).not.toHaveProperty('re_epa');
    expect(db.players.dup.gsisId).toBeNull();
  });
  it('estimates routes from snap share when there is no participation data', () => {
    const w1 = db.rows.find((r) => r.id === 'w1' && r.week === 1)!;
    expect(w1.routesEst).toBe(Math.round((50 / 60) * 32));
    expect(w1).not.toHaveProperty('routes');
    expect(db.teamWeeks.find((t) => t.team === 'TB' && t.week === 1)).toMatchObject({ passAtt: 30, dropbacks: 32, airYds: 240, passPlays: null });
  });
  it('uses real routes and pass plays when participation is given', () => {
    const real = buildPlayerDb(input({ participation: { routes: new Map([['00-1|1', 31]]), passPlays: new Map([['TB|1', 35]]) } }));
    expect(real.routesReal).toBe(true);
    const w1 = real.rows.find((r) => r.id === 'w1' && r.week === 1)!;
    expect(w1.routes).toBe(31);
    expect(w1).not.toHaveProperty('routesEst');
    expect(real.teamWeeks.find((t) => t.team === 'TB' && t.week === 1)!.passPlays).toBe(35);
  });
  it('builds player meta from the directory, the crosswalk and the nflverse biography', () => {
    expect(db.players.w1).toEqual({ id: 'w1', gsisId: '00-1', pfrId: 'WideOn01', name: 'Wide One', pos: 'WR', teams: ['TB'], birthDate: '2002-10-14', yearsExp: 1, draft: { year: 2025, round: 1, pick: 19 }, college: 'Ohio State', height: 73, weight: 205 });
    expect(db.players.w2).toMatchObject({ gsisId: '00-2', pfrId: null, draft: null, birthDate: null });
    expect(db.players).not.toHaveProperty('k1');
    expect(db.players).not.toHaveProperty('inj');
  });
  it('leaves xfp off when a position has too few rows', () => {
    expect(db.xfp).toEqual({ QB: null, RB: null, WR: null, TE: null });
    expect(db.rows[0]).not.toHaveProperty('xfp');
  });
  it('applies position overrides', () => {
    const o = buildPlayerDb(input({ positionOverrides: { k1: 'TE' } }));
    expect(o.players.k1.pos).toBe('TE');
  });

  it('stops at throughWeek for rows and team weeks', () => {
    const one = buildPlayerDb(input({ throughWeek: 1 }));
    expect(new Set(one.rows.map((r) => r.week))).toEqual(new Set([1]));
    expect(one.teamWeeks.length).toBeGreaterThan(0);
    expect(new Set(one.teamWeeks.map((t) => t.week))).toEqual(new Set([1]));
    const zero = buildPlayerDb(input({ throughWeek: 0 }));
    expect(zero.rows).toEqual([]);
    expect(zero.teamWeeks).toEqual([]);
    expect(zero.xfp).toEqual({ QB: null, RB: null, WR: null, TE: null });
    expect(PlayerDbSchema.parse(zero)).toEqual(zero);
  });
  it('builds the weeks that are present when one is missing', () => {
    const base = input();
    base.sleeperWeeks.set(3, base.sleeperWeeks.get(2)!);
    base.sleeperWeeks.delete(2);
    const gap = buildPlayerDb({ ...base, throughWeek: 3 });
    expect([...new Set(gap.rows.map((r) => r.week))]).toEqual([1, 3]);
  });
  it('lists teams in week order across a trade', () => {
    const base = input();
    base.sleeperWeeks.get(1)!.push(wr('tr', 'TB', 1, 5));
    base.sleeperWeeks.get(2)!.push(wr('tr', 'KC', 2, 5));
    expect(buildPlayerDb(base).players.tr.teams).toEqual(['TB', 'KC']);
  });
  it('falls back to the directory birth date, and to null when it is blank', () => {
    const base = input();
    for (const w of [1, 2]) base.sleeperWeeks.get(w)!.push(wr('b1', 'TB', w, 5), wr('b2', 'TB', w, 5));
    base.directory.b1 = { player_id: 'b1', full_name: 'B One', position: 'WR', team: 'TB', birth_date: '1999-05-05' };
    base.directory.b2 = { player_id: 'b2', full_name: 'B Two', position: 'WR', team: 'TB', birth_date: '' };
    const o = buildPlayerDb(base);
    expect(o.players.b1.birthDate).toBe('1999-05-05');
    expect(o.players.b2.birthDate).toBeNull();
  });
  it('falls back through the weekly row names to the id for names', () => {
    const base = input();
    for (const w of [1, 2]) base.sleeperWeeks.get(w)!.push(
      { player_id: 'n1', team: 'TB', player: { position: 'WR', first_name: 'Row', last_name: 'Name' }, stats: { gp: 1, rec_tgt: 3 } },
      { player_id: 'n2', team: 'TB', player: { position: 'WR' }, stats: { gp: 1, rec_tgt: 3 } },
    );
    base.directory.n1 = { player_id: 'n1', position: 'WR', team: 'TB' };
    const o = buildPlayerDb(base);
    expect(o.players.n1.name).toBe('Row Name');
    expect(o.players.n2.name).toBe('n2');
  });
  it('never gives a QB routes', () => {
    const real = buildPlayerDb(input({ participation: { routes: new Map([['00-q|1', 30]]), passPlays: new Map() } }));
    const q1 = real.rows.find((r) => r.id === 'q1' && r.week === 1)!;
    expect(q1).not.toHaveProperty('routes');
  });
  it('fits and applies xfp once a position has enough rows', () => {
    const weeks = new Map<number, SleeperWeekStat[]>();
    const dir: PlayerDbInput['directory'] = {};
    for (let w = 1; w <= 2; w++) {
      const list: SleeperWeekStat[] = [];
      for (let i = 0; i < 30; i++) {
        const id = `x${i}`;
        list.push({ player_id: id, team: 'TB', opponent: 'OPP', player: { position: 'WR' }, stats: { gp: 1, rec_tgt: 1 + ((i + w) % 12), rec_air_yd: 0, rec_rz_tgt: 0 } });
        dir[id] = { player_id: id, full_name: id, position: 'WR', team: 'TB' };
      }
      weeks.set(w, list);
    }
    const o = buildPlayerDb(input({ scoring: { gp: 1, rec_tgt: 1.5 }, sleeperWeeks: weeks, directory: dir, projections: new Map(), byGsis: new Map(), byPfr: new Map() }));
    expect(o.rows.length).toBe(60);
    expect(o.xfp.WR).not.toBeNull();
    for (const r of o.rows) expect(Math.abs(r.xfp! - r.pts!)).toBeLessThan(0.01);
  });
  it('builds rows for an overridden position', () => {
    const o = buildPlayerDb(input({ positionOverrides: { k1: 'TE' } }));
    expect(o.rows.some((r) => r.id === 'k1')).toBe(true);
    expect(o.players.k1.pos).toBe('TE');
  });
  it('does not reorder the caller input', () => {
    const base = input();
    const before = base.sleeperWeeks.get(1)!.map((r) => r.player_id);
    buildPlayerDb(base);
    expect(base.sleeperWeeks.get(1)!.map((r) => r.player_id)).toEqual(before);
  });
});
