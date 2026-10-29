import { validateLeagues } from '@fantasy-dash/core';
import { defaultLeague, leagues } from '../../../league.config';
import { routes } from './routes';
import { legacyHeads } from './lib/league';

it('the league config is valid', () => {
  expect(validateLeagues(leagues, defaultLeague, legacyHeads(routes))).toEqual([]);
});
