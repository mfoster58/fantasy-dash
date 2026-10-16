import { RETIRED_PATHS, routes } from './routes';

const child = (path: string) => routes[0].children!.find((r) => r.path === path);

describe('routes', () => {
  it('redirects the retired player stats and all-time URLs to records', () => {
    expect(RETIRED_PATHS).toEqual({ players: '/records', 'all-time': '/records' });
    for (const path of Object.keys(RETIRED_PATHS)) {
      expect(child(path)?.loader).toBeTypeOf('function');
      expect(child(path)?.element).toBeUndefined();
    }
  });
  it('serves records with every season loaded', () => {
    expect(child('records')?.element).toBeTruthy();
    expect(child('records')?.loader).toBeTypeOf('function');
  });
});
