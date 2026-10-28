import type { History, Season } from '@fantasy-dash/core';
import { managerEntries, playerEntries, rosterEntries } from './navMenus';
import { season, standing } from '../test/playerFixtures';

function build(): Season {
  const s = season(2025, []);
  s.standings = [standing('b', 1, 1, 1, 0, 220, 215), standing('a', 2, 1, 1, 0, 215, 220)];
  s.managers = {
    a: { userId: 'a', displayName: 'alice', teamName: 'Team Alice', avatar: null, rosterId: 1 },
    b: { userId: 'b', displayName: 'bob', teamName: null, avatar: 'img-b', rosterId: 2 },
  };
  return s;
}
const history = {
  seasons: [], h2h: {}, topDraftValues: [], worstDraftValues: [],
  managers: { a: { displayName: 'alice', avatar: null, seasons: [2025] }, b: { displayName: 'bob', avatar: 'img-b', seasons: [2024, 2025] }, c: { displayName: 'carol', avatar: null, seasons: [2024] } },
  allTime: [{ userId: 'b', rank: 1 }, { userId: 'c', rank: 2 }, { userId: 'a', rank: 3 }],
} as unknown as History;

describe('playerEntries', () => {
  it('names the two player pages and nothing more', () => {
    expect(playerEntries.map((e) => [e.title, e.subtitle])).toEqual([['Database', null], ['Comparison tool', null]]);
  });
});

describe('rosterEntries', () => {
  it('lists this season\'s teams in standings order, each linking to its team page', () => {
    expect(rosterEntries(build())).toEqual([
      { userId: 'b', title: 'bob', subtitle: null, avatar: 'img-b', to: '/teams/2025/b' },
      { userId: 'a', title: 'Team Alice', subtitle: 'alice', avatar: null, to: '/teams/2025/a' },
    ]);
  });
});

describe('managerEntries', () => {
  it('lists every manager in all-time order with the seasons played, each linking to the career page', () => {
    expect(managerEntries(history)).toEqual([
      { userId: 'b', title: 'bob', subtitle: '2 seasons', avatar: 'img-b', to: '/managers/b' },
      { userId: 'c', title: 'carol', subtitle: '1 season', avatar: null, to: '/managers/c' },
      { userId: 'a', title: 'alice', subtitle: '1 season', avatar: null, to: '/managers/a' },
    ]);
  });
});
