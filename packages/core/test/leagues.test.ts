import { describe, it, expect } from 'vitest';
import { nflYears, runPerLeague, validateLeagues, type LeagueConfig } from '../src/leagues';
import type { SleeperLeague } from '../src/sleeper/types';

const L = (slug: string, leagueId = '1'): LeagueConfig => ({ slug, leagueId, name: slug.toUpperCase(), managerNames: {} });
const sl = (season: string, status: string, leg?: number) => ({ season, status, settings: { last_scored_leg: leg } }) as unknown as SleeperLeague;

describe('validateLeagues', () => {
  it('accepts a valid list', () => {
    expect(validateLeagues([L('husky'), L('dynasty-2')], 'husky', ['standings'])).toEqual([]);
  });
  it('flags bad and duplicate slugs, reserved route names and a missing default', () => {
    const errs = validateLeagues([L('Husky'), L('a'), L('a'), L('standings')], 'nope', ['standings']);
    expect(errs).toEqual(expect.arrayContaining([
      expect.stringContaining('"Husky"'), expect.stringContaining('duplicate slug "a"'),
      expect.stringContaining('"standings" is a route name'), expect.stringContaining('defaultLeague "nope"'),
    ]));
  });
  it('rejects an empty list', () => {
    expect(validateLeagues([], 'husky', [])).toEqual(expect.arrayContaining([expect.stringContaining('no leagues')]));
  });
});

describe('nflYears', () => {
  it('unions years across leagues, complete if any league is, max scored week otherwise, newest first', () => {
    const years = nflYears([
      [sl('2026', 'in_season', 7), sl('2025', 'complete')],
      [sl('2026', 'in_season', 8), sl('2025', 'post_season', 17), sl('2024', 'complete')],
    ]);
    expect(years).toEqual([
      { year: 2026, season: '2026', complete: false, throughWeek: 8 },
      { year: 2025, season: '2025', complete: true, throughWeek: 18 },
      { year: 2024, season: '2024', complete: true, throughWeek: 18 },
    ]);
  });
  it('caps an unfinished season at week 18 and treats a missing leg as 0', () => {
    expect(nflYears([[sl('2026', 'in_season', 22)], [sl('2027', 'pre_draft')]]).map((y) => y.throughWeek)).toEqual([0, 18]);
  });
});

describe('runPerLeague', () => {
  it('runs every league, keeps going past a failure, and reports the failures', async () => {
    const logs: string[] = [];
    const { results, failed } = await runPerLeague([L('a'), L('b'), L('c')], async (l) => {
      if (l.slug === 'b') throw new Error('boom');
      return l.slug.length;
    }, (m) => logs.push(m));
    expect([...results.keys()]).toEqual(['a', 'c']);
    expect(failed).toEqual(['b']);
    expect(logs.some((m) => m.includes('✗ b') && m.includes('boom'))).toBe(true);
  });
});
