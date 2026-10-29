import { legacyHeads, resolveLeague } from './league';
import { routes } from '../routes';

const leagues = [{ slug: 'husky', leagueId: '1', name: 'Husky Fantasy', managerNames: {} }, { slug: 'dyn', leagueId: '2', name: 'Dynasty', managerNames: {} }];
const legacy = new Set(['standings', 'player', 'players']);
const at = (pathname: string, rest = '', base = '/fantasy-dash') => resolveLeague({ pathname, rest, base, leagues, legacy, defaultSlug: 'husky' });

describe('resolveLeague', () => {
  it('finds the league in the first segment after the base', () => {
    expect(at('/fantasy-dash/dyn/standings/2026')).toEqual({ kind: 'league', league: leagues[1] });
    expect(at('/husky', '', '')).toEqual({ kind: 'league', league: leagues[0] });
  });
  it('is the root page with nothing after the base', () => {
    expect(at('/fantasy-dash/')).toEqual({ kind: 'root' });
    expect(at('/fantasy-dash')).toEqual({ kind: 'root' });
  });
  it('sends an old single-league link to the default league with its path, query and hash', () => {
    expect(at('/fantasy-dash/players/2025', '?pos=WR#top')).toEqual({ kind: 'redirect', to: '/fantasy-dash/husky/players/2025?pos=WR#top' });
  });
  it('is unknown for anything else, without guessing a league', () => {
    expect(at('/fantasy-dash/huskyy/standings')).toEqual({ kind: 'unknown' });
  });
});

describe('legacyHeads', () => {
  it('lists the first segment of every top-level route', () => {
    const heads = legacyHeads(routes);
    for (const h of ['standings', 'player', 'players', 'records', 'all-time', 'draft', 'stats', 'scores', 'teams', 'managers', 'h2h', 'history']) expect(heads.has(h), h).toBe(true);
    expect(heads.has('')).toBe(false);
  });
});
