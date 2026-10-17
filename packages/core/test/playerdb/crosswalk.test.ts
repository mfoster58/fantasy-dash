import { describe, it, expect } from 'vitest';
import { buildCrosswalk, normalizeName, normalizeTeam } from '../../src/playerdb/crosswalk';

const ids = [
  { sleeper_id: '12514', gsis_id: '00-0040129', pfr_id: 'EgbuEm01', name: 'Emeka Egbuka', position: 'WR', team: 'TBB' },
  { sleeper_id: '4034', gsis_id: '00-0033280', pfr_id: 'NA', name: 'Christian McCaffrey', position: 'RB', team: 'SFO' },
  { sleeper_id: 'NA', gsis_id: '00-0099999', pfr_id: 'NoboNo01', name: 'Nobody', position: 'QB', team: 'FA' },
];
const nflPlayers = [
  { gsis_id: '00-0033280', display_name: 'Christian McCaffrey', position: 'RB', latest_team: 'SF' },
  { gsis_id: '00-0012345', display_name: 'Odell Beckham Jr.', position: 'WR', latest_team: 'LA' },
  { gsis_id: '00-0055555', display_name: 'Mike Williams', position: 'WR', latest_team: 'LAC' },
  { gsis_id: '00-0066666', display_name: 'Mike Williams', position: 'WR', latest_team: 'NYJ' },
];
const snaps = [
  { pfr_player_id: 'McCaCh01', player: 'Christian McCaffrey', position: 'RB', team: 'SF' },
  { pfr_player_id: 'BeckOd01', player: 'Odell Beckham', position: 'WR', team: 'LA' },
];

describe('normalize', () => {
  it('strips punctuation, suffixes and case; maps nflverse team codes to Sleeper', () => {
    expect(normalizeName("Odell Beckham Jr.")).toBe('odell beckham');
    expect(normalizeName('A.J. Brown')).toBe('aj brown');
    expect(normalizeName('Kenneth Walker III')).toBe('kenneth walker');
    expect(normalizeTeam('LA')).toBe('LAR');
    expect(normalizeTeam('TBB')).toBe('TB');
    expect(normalizeTeam('KC')).toBe('KC');
  });
});

describe('buildCrosswalk', () => {
  const cw = buildCrosswalk(ids, nflPlayers, snaps);
  it('uses the id file first', () => {
    expect(cw.gsisOf('12514', { name: 'x', pos: 'WR', team: null })).toBe('00-0040129');
    expect(cw.pfrOf('12514', { name: 'x', pos: 'WR', team: null })).toBe('EgbuEm01');
  });
  it('falls back to name, position and team when an id is NA or the player is missing', () => {
    expect(cw.pfrOf('4034', { name: 'Christian McCaffrey', pos: 'RB', team: 'SF' })).toBe('McCaCh01');
    expect(cw.gsisOf('999', { name: 'Odell Beckham Jr.', pos: 'WR', team: 'LAR' })).toBe('00-0012345');
    expect(cw.pfrOf('999', { name: 'Odell Beckham Jr.', pos: 'WR', team: 'LAR' })).toBe('BeckOd01');
  });
  it('falls back to name and position only when that pair is unique', () => {
    expect(cw.gsisOf('999', { name: 'Odell Beckham', pos: 'WR', team: 'MIA' })).toBe('00-0012345');
    expect(cw.gsisOf('999', { name: 'Mike Williams', pos: 'WR', team: 'MIA' })).toBeNull();
  });
  it('returns null for a miss', () => {
    expect(cw.gsisOf('999', { name: 'Unknown Guy', pos: 'TE', team: 'KC' })).toBeNull();
    expect(cw.pfrOf('999', { name: 'Unknown Guy', pos: 'TE', team: 'KC' })).toBeNull();
  });
});
