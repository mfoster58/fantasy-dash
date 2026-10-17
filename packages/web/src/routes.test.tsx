import type { LoaderFunctionArgs } from 'react-router';
import { RETIRED_PATHS, routes } from './routes';
import { currentSeason, history } from './data/load';

const child = (path: string) => routes[0].children!.find((r) => r.path === path);
const run = (path: string, params: Record<string, string> = {}) =>
  (child(path)!.loader as (a: LoaderFunctionArgs) => unknown)({ params, request: new Request(`http://x/${path}`), context: {} } as LoaderFunctionArgs);
const locationOf = async (p: unknown) => ((await p) as Response).headers.get('Location');

describe('routes', () => {
  it('redirects the retired player stats and all-time URLs to records', () => {
    expect(RETIRED_PATHS).toEqual({ players: '/records', 'all-time': '/records' });
    for (const path of Object.keys(RETIRED_PATHS)) {
      expect(child(path)?.loader).toBeTypeOf('function');
      expect(child(path)?.element).toBeUndefined();
    }
  });
  it('serves the team and manager pages with every season loaded, and no index page for either', () => {
    for (const path of ['teams/:season/:userId', 'managers/:userId']) {
      expect(child(path)?.element, path).toBeTruthy();
      expect(child(path)?.loader, path).toBeTypeOf('function');
    }
    for (const path of ['teams', 'teams/:season', 'managers']) expect(child(path)?.element, path).toBeUndefined();
  });
  it('sends a bare teams URL to the top team of that season, and a bare managers URL to the all-time number one', async () => {
    expect(await locationOf(run('teams'))).toBe(`/teams/${currentSeason.year}`);
    const year = history.seasons[0].year;
    expect(await locationOf(run('teams/:season', { season: String(year) }))).toMatch(new RegExp(`^/teams/${year}/\\d+$`));
    await expect(run('teams/:season', { season: '1999' })).rejects.toMatchObject({ status: 404 });
    expect(await locationOf(run('managers'))).toBe(`/managers/${history.allTime[0].userId}`);
  });
  it('serves stats with every season loaded and sends the managers alias to it with its query intact', async () => {
    expect(child('stats')?.element).toBeTruthy();
    expect(child('stats')?.loader).toBeTypeOf('function');
    const r = (await (child('stats/managers')!.loader as (a: LoaderFunctionArgs) => unknown)({ params: {}, request: new Request('http://x/stats/managers?season=all&pin=1'), context: {} } as LoaderFunctionArgs)) as Response;
    expect(r.headers.get('Location')).toBe('/stats?season=all&pin=1');
  });
  it('serves records with every season loaded', () => {
    expect(child('records')?.element).toBeTruthy();
    expect(child('records')?.loader).toBeTypeOf('function');
  });
});
