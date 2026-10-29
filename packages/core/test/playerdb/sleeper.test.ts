import { describe, it, expect } from 'vitest';
import { positionOf, sleeperRow } from '../../src/playerdb/sources/sleeper';

const raw = {
  player_id: '12514', team: 'TB', opponent: 'DAL', player: { position: 'WR' },
  stats: { gp: 1, gs: 1, off_snp: 64, tm_off_snp: 72, rec: 6, rec_tgt: 9, rec_yd: 38, rec_air_yd: 22, rec_yar: 16, rec_drop: 1, rec_rz_tgt: 2, rec_20_29: 1, rush_att: 1, rush_yd: 14, rush_td: 1, pts_ppr: 17.2, pos_rank_ppr: 17 },
};

describe('sleeperRow', () => {
  it('maps the counting stats and buckets 20+ catches, and leaves league points to the points file', () => {
    const row = sleeperRow(raw, 5);
    expect(row).toMatchObject({ id: '12514', week: 5, team: 'TB', opp: 'DAL', gp: 1, gs: 1, snaps: 64, teamSnaps: 72, re_rec: 6, re_tgt: 9, re_yds: 38, re_yac: 16, re_drop: 1, re_rz: 2, re_20: 1, ru_att: 1, ru_yds: 14, ru_td: 1, ppr: 17.2, posRankPpr: 17 });
    expect(row).not.toHaveProperty('pts');
    expect(row).not.toHaveProperty('proj');
    expect(row!.ppr).toBe(17.2);
    expect(row).not.toHaveProperty('pa_att');
    expect(row).not.toHaveProperty('routes');
    expect(row).not.toHaveProperty('re_air'); // Sleeper rec_air_yd is completed air yards; intended air yards come from nflverse
  });
  it('leaves re_20 out when no bucket is present', () => {
    const row = sleeperRow({ player_id: '1', team: 'KC', stats: { gp: 1, pass_att: 30 } }, 1)!;
    expect(row).not.toHaveProperty('re_20');
    expect(row.pa_att).toBe(30);
    expect(sleeperRow({ player_id: '1', team: 'KC', stats: { gp: 1, pass_att: 30, pass_air_yd: 200 } }, 1)).not.toHaveProperty('pa_air');
  });
  it('returns null for a player who did not play or has no team', () => {
    expect(sleeperRow({ player_id: '1', team: 'KC', stats: { gp: 0, pass_att: 1 } }, 1)).toBeNull();
    expect(sleeperRow({ player_id: '1', team: null, stats: { gp: 1 } }, 1)).toBeNull();
    expect(sleeperRow({ player_id: '1', team: 'KC', stats: null }, 1)).toBeNull();
  });
});

describe('positionOf', () => {
  it('prefers the override, then the row, then the directory, and rejects non-table positions', () => {
    expect(positionOf({ player_id: '12530', team: 'JAX', player: { position: 'DB' }, stats: {} }, 'DB', { '12530': 'WR' })).toBe('WR');
    expect(positionOf({ player_id: '1', team: 'KC', player: { position: 'TE' }, stats: {} }, 'WR', {})).toBe('TE');
    expect(positionOf({ player_id: '1', team: 'KC', stats: {} }, 'RB', {})).toBe('RB');
    expect(positionOf({ player_id: '1', team: 'KC', player: { position: 'K' }, stats: {} }, null, {})).toBeNull();
  });
});
