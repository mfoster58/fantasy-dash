import { describe, it, expect } from 'vitest';
import { statLine, posColor } from './players';

describe('statLine', () => {
  it('formats a quarterback line including rushing', () => {
    expect(statLine('QB', { pass_cmp: 20, pass_att: 30, pass_yd: 250, pass_td: 2, pass_int: 1, rush_att: 3, rush_yd: 12 }))
      .toBe('20/30, 250 yds · 2 TD · 1 INT · 3 car 12 yds');
  });
  it('formats rushing and receiving', () => {
    expect(statLine('RB', { rush_att: 18, rush_yd: 85, rush_td: 1, rec: 3, rec_yd: 20 })).toBe('18 car 85 yds 1 TD · 3 rec 20 yds');
    expect(statLine('WR', { rec: 5, rec_tgt: 8, rec_yd: 70, fum_lost: 1 })).toBe('5 rec 70 yds · 1 FUM');
  });
  it('formats kickers and defenses', () => {
    expect(statLine('K', { fgm: 2, fga: 3, xpm: 3, xpa: 3 })).toBe('2/3 FG, 3/3 XP');
    expect(statLine('DEF', { pts_allow: 17, sack: 3, int: 1 })).toBe('17 PA, 3 sck, 1 INT');
    expect(statLine('DEF', { pts_allow: 17, sack: 3, int: 1, def_td: 1 })).toBe('17 PA, 3 sck, 1 INT, 1 TD');
  });
  it('returns an empty string with no stats', () => {
    expect(statLine('QB', {})).toBe('');
    expect(statLine('RB', {})).toBe('');
  });
});

describe('posColor', () => {
  it('maps to the position CSS variable with a fallback', () => {
    expect(posColor('RB')).toBe('var(--pos-RB, var(--muted))');
  });
});
