import { moments } from './moments';
import { teamGamesOf } from '../managerGames';
import { season2025 } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

describe('moments', () => {
  const m = moments(teamGamesOf([season2025()]));
  const brief = (x: { week: number; winnerId: string; loserId: string; margin: number }) => `${x.week}:${x.winnerId}>${x.loserId}:${x.margin}`;
  it('finds the highest losing scores, lowest winning scores, biggest and smallest margins', () => {
    expect(m.robbed.map(brief)).toEqual(['5:a>d:30', '2:b>d:6', '1:a>b:20', '3:b>c:40']);
    expect(m.stolen.map(brief)).toEqual(['3:a>d:5', '5:c>b:5', '4:a>b:1', '1:d>c:20']);
    expect(m.flattened.map(brief)).toEqual(['4:c>d:70', '3:b>c:40', '2:a>c:35', '5:a>d:30']);
    expect(m.close.map(brief)).toEqual(['4:a>b:1', '3:a>d:5', '5:c>b:5', '2:b>d:6']);
    expect(m.robbed[0]).toEqual({ year: 2025, week: 5, matchupId: 1, winnerId: 'a', loserId: 'd', winPts: 150, losePts: 120, margin: 30 });
  });
  it('leaves ties out and honours the list length', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 100, []), side('b', 100, [])), game(2025, 1, 2, side('c', 90, []), side('d', 80, []))])];
    const one = moments(teamGamesOf([s]), 1);
    expect(one.close).toHaveLength(1);
    expect(one.close[0].winnerId).toBe('c');
  });
});
