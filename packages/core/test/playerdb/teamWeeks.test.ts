import { describe, it, expect } from 'vitest';
import { teamWeekKey, teamWeeksOf } from '../../src/playerdb/teamWeeks';
import { routesEstimate } from '../../src/playerdb/derive';

const r = (id: string, team: string | null, stats: Record<string, number>, opponent = 'X') => ({ player_id: id, team, opponent, stats });

describe('teamWeeksOf', () => {
  it('sums each team-week from every position and takes the max team snaps', () => {
    const weeks = new Map([[1, [
      r('q', 'SF', { tm_off_snp: 60, pass_att: 30, pass_sack: 2, pass_air_yd: 250, pass_rz_att: 4 }, 'LAR'),
      r('rb', 'SF', { tm_off_snp: 60, rush_att: 20, rush_rz_att: 3, rec_tgt: 4, rec_rz_tgt: 1 }, 'LAR'),
      r('ol', 'SF', { tm_off_snp: 60 }, 'LAR'),
      r('k', 'SF', { fgm: 2 }, 'LAR'),
      r('rb2', 'LAR', { tm_off_snp: 55, rush_att: 10 }, 'SF'),
      r('fa', null, { rush_att: 99 }),
      { ...r('TEAM_SF', 'SF', { tm_off_snp: 60, pass_att: 30, pass_sack: 2, pass_air_yd: 250, rush_att: 20, rush_rz_att: 3, rec_rz_tgt: 1 }, 'LAR'), player: { position: 'TEAM' } },
    ]]]);
    const tws = teamWeeksOf(weeks, new Map([['SF|1', 33]]), null, null);
    expect(tws).toEqual([
      { team: 'LAR', week: 1, opp: 'SF', offSnaps: 55, passAtt: 0, rushAtt: 10, dropbacks: 0, rzLooks: 0, airYds: 0, passPlays: null },
      { team: 'SF', week: 1, opp: 'LAR', offSnaps: 60, passAtt: 30, rushAtt: 20, dropbacks: 32, rzLooks: 4, airYds: 250, passPlays: 33 },
    ]);
    expect(teamWeekKey('SF', 1)).toBe('SF|1');
  });
  it('takes air yards from the nflverse map when given, 0 when the team-week is absent', () => {
    const weeks = new Map([[1, [r('q', 'SF', { pass_att: 30, pass_air_yd: 250 }, 'LAR'), r('rb2', 'LAR', { rush_att: 10 }, 'SF')]]]);
    const tws = teamWeeksOf(weeks, null, new Map([['SF|1', 281]]), null);
    expect(tws.find((t) => t.team === 'SF')!.airYds).toBe(281);
    expect(tws.find((t) => t.team === 'LAR')!.airYds).toBe(0);
  });
});

describe('teamWeeksOf offSnaps', () => {
  it('falls back to the largest off_snp when no row carries tm_off_snp', () => {
    const weeks = new Map([[18, [r('q', 'SF', { off_snp: 60, pass_att: 30 }), r('ol', 'SF', { off_snp: 64 })]]]);
    expect(teamWeeksOf(weeks, null, null, null)[0].offSnaps).toBe(64);
  });
  it('is never below a player off_snp that exceeds tm_off_snp', () => {
    const weeks = new Map([[6, [r('a', 'NYG', { tm_off_snp: 66, off_snp: 60 }), r('b', 'NYG', { tm_off_snp: 66, off_snp: 67 })]]]);
    expect(teamWeeksOf(weeks, null, null, null)[0].offSnaps).toBe(67);
  });
});

describe('teamWeeksOf snap-count fallback', () => {
  it('takes the snap-count team snaps where Sleeper has none, and never goes below Sleeper', () => {
    const weeks = new Map([[18, [r('q', 'SF', { pass_att: 30 }), r('x', 'LAR', { off_snp: 70 })]]]);
    const tws = teamWeeksOf(weeks, null, null, new Map([['SF|18', 64], ['LAR|18', 66]]));
    expect(tws.find((t) => t.team === 'SF')!.offSnaps).toBe(64);
    expect(tws.find((t) => t.team === 'LAR')!.offSnaps).toBe(70);
  });
});

describe('routesEstimate', () => {
  const tw = { team: 'SF', week: 1, opp: 'LAR', offSnaps: 60, passAtt: 30, rushAtt: 20, dropbacks: 32, rzLooks: 4, airYds: 250, passPlays: null };
  it('scales team dropbacks by snap share', () => {
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45, teamSnaps: 60 }, tw)).toBe(24);
  });
  it('is null without snaps, team snaps or a team week', () => {
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45 }, tw)).toBeNull();
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45, teamSnaps: 0 }, tw)).toBeNull();
    expect(routesEstimate({ id: 'a', week: 1, team: 'SF', gp: 1, snaps: 45, teamSnaps: 60 }, undefined)).toBeNull();
  });
});
