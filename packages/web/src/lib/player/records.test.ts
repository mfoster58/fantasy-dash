import { allTimeContext } from '../managerRecords';
import { playerRecords } from './records';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';

const ctx = () => allTimeContext(leagueSeasons(), players, { A: { displayName: 'Alice', avatar: null, seasons: [2025, 2026] }, B: { displayName: 'Bob', avatar: null, seasons: [2025, 2026] } });

describe('playerRecords', () => {
  it('lists boards where he ranks in the top three, each once', () => {
    const recs = playerRecords(ctx(), 'w1', 'WR');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.rank >= 1 && r.rank <= 3)).toBe(true);
    expect(new Set(recs.map((r) => r.boardId)).size).toBe(recs.length);
  });
  it('labels a position-board placing with the position and skips boards already listed under All', () => {
    const recs = playerRecords(ctx(), 'w1', 'WR');
    const all = new Set(recs.filter((r) => !r.title.endsWith(' · WR')).map((r) => r.boardId));
    for (const r of recs.filter((x) => x.title.endsWith(' · WR'))) expect(all.has(r.boardId.replace(/:WR$/, ''))).toBe(false);
  });
  it('is empty for a player with no league lines', () => {
    expect(playerRecords(ctx(), 't1', 'TE')).toEqual([]);
  });
});
