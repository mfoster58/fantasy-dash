import { describe, it, expect } from 'vitest';
import type { PlayerDirectory } from '@fantasy-dash/core';
import { statLine, posColor, headshotUrl, shortName } from './players';

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

describe('headshotUrl', () => {
  const dir: PlayerDirectory = {
    '4046': { id: '4046', name: 'Patrick Mahomes', firstName: 'Patrick', lastName: 'Mahomes', position: 'QB', team: 'KC', yearsExp: 8, birthDate: null },
    DET: { id: 'DET', name: 'Detroit Lions', firstName: 'Detroit', lastName: 'Lions', position: 'DEF', team: 'DET', yearsExp: 0, birthDate: null },
  };
  it('uses the player thumbnail for skill players', () => {
    expect(headshotUrl(dir, '4046')).toBe('https://sleepercdn.com/content/nfl/players/thumb/4046.jpg');
  });
  it('uses the lowercase team logo for defenses', () => {
    expect(headshotUrl(dir, 'DET')).toBe('https://sleepercdn.com/images/team_logos/nfl/det.png');
  });
});

describe('shortName', () => {
  const dir: PlayerDirectory = {
    '4046': { id: '4046', name: 'Patrick Mahomes', firstName: 'Patrick', lastName: 'Mahomes', position: 'QB', team: 'KC', yearsExp: 8, birthDate: null },
    '9488': { id: '9488', name: 'Jaxon Smith-Njigba', firstName: 'Jaxon', lastName: 'Smith-Njigba', position: 'WR', team: 'SEA', yearsExp: 3, birthDate: null },
    DET: { id: 'DET', name: 'Detroit Lions', firstName: 'Detroit', lastName: 'Lions', position: 'DEF', team: 'DET', yearsExp: 0, birthDate: null },
  };
  it('cuts the first name to its initial', () => {
    expect(shortName(dir, '4046')).toBe('P. Mahomes');
    expect(shortName(dir, '9488')).toBe('J. Smith-Njigba');
  });
  it('keeps just the nickname for a defense', () => {
    expect(shortName(dir, 'DET')).toBe('Lions');
  });
  it('falls back to the id for an unknown player', () => {
    expect(shortName(dir, '1')).toBe('1');
  });
});
