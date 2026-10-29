import { initLeague, history, currentSeason, league, loadPlayerDb, hasPlayerDb, loadSeason } from './load';
import { leagues } from '../../../../league.config';

describe('per-league loading', () => {
  it('exposes the league, its history and its current season after initLeague', () => {
    expect(league.slug).toBe('husky');
    expect(history.seasons.length).toBeGreaterThan(0);
    expect(currentSeason).toBe(history.seasons.at(-1));
  });
  it('joins the league\'s points onto the shared player database', async () => {
    const year = history.seasons.map((s) => s.year).filter(hasPlayerDb).at(-1)!;
    const db = await loadPlayerDb(year);
    expect(db.rows.some((r) => typeof r.pts === 'number')).toBe(true);
    expect(db.xfp).toBeTruthy();
  });
  it('loads the league\'s own season files', async () => {
    const s = await loadSeason(currentSeason.year);
    expect(s.leagueId).toBe(currentSeason.leagueId);
  });
  it('rejects a configured league that has not been synced yet, leaving the current league in place', async () => {
    await expect(initLeague({ slug: 'not-synced', leagueId: '0', name: 'X', managerNames: {} })).rejects.toThrow(/not-synced/);
    expect(league.slug).toBe('husky');
  });
  it('the real config has a league with data', () => {
    expect(leagues.some((l) => l.slug === 'husky')).toBe(true);
  });
});
