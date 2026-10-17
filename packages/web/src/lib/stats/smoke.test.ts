import { history, loadAllSeasons, players } from '../../data/load';
import { managerRefs, scopeSeasons, regular } from './scope';
import { teamGamesOf } from '../managerGames';
import { eloFor, eloHistory } from './elo';
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from './season';
import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from './strength';
import { draftReturns, pointOrigins, rosterAge, wireActivity } from './roster';
import { moments } from './moments';
import { COLUMNS, statTable } from './table';

describe('stats over the committed seasons', () => {
  it('produces a row per manager for every season and all-time, with no NaN anywhere', async () => {
    const seasons = await loadAllSeasons();
    const scopes = [...history.seasons.map((s) => s.year), 'all' as const];
    for (const scope of scopes) {
      const scoped = scopeSeasons(seasons, scope);
      const refs = managerRefs(scoped);
      const games = teamGamesOf(scoped);
      const reg = regular(games);
      const rows = statTable(scoped);
      expect(rows).toHaveLength(refs.length);
      for (const r of rows) for (const c of COLUMNS) expect(c.text(r), `${scope} ${r.id} ${c.key}`).not.toMatch(/NaN|undefined|Infinity/);
      expect(eloFor(eloHistory(seasons), scope).series).toHaveLength(managerRefs(seasons).length);
      weeklyFinishes(scoped); consistency(reg); scheduleLuck(reg); strengthOfSchedule(reg); allPlayGrid(reg, refs.map((r) => r.id)); postseasonForm(games); pointOrigins(scoped); rosterAge(scoped, players); moments(games);
      if (scope !== 'all') { const s = scoped[0]; standingsRace(s); formGuide(s); scoringCalendar(s); draftReturns(s); wireActivity(s); }
    }
  });
});
