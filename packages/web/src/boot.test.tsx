import { start } from './boot';

const husky = { slug: 'husky', leagueId: '1', name: 'Husky Fantasy', managerNames: {} };

describe('start', () => {
  it('redirects legacy links without rendering', async () => {
    const render = vi.fn(), replace = vi.fn();
    await start({ where: { kind: 'redirect', to: '/x/husky/players' }, base: '/x', render, replace });
    expect(replace).toHaveBeenCalledWith('/x/husky/players');
    expect(render).not.toHaveBeenCalled();
  });
  it('shows league-not-found for a configured league with no data yet', async () => {
    const render = vi.fn();
    await start({ where: { kind: 'league', league: husky }, base: '', render, replace: vi.fn(), init: () => Promise.reject(new Error('No data')) });
    expect(render).toHaveBeenCalledTimes(1);
    expect((render.mock.calls[0][0] as { type: { name: string } }).type.name).toBe('LeagueNotFound');
  });
  it('mounts the app for a league and titles the tab with its name', async () => {
    const render = vi.fn();
    await start({ where: { kind: 'league', league: husky }, base: '', render, replace: vi.fn(), init: () => Promise.resolve() });
    expect(document.title).toBe('Husky Fantasy');
    expect(render).toHaveBeenCalledTimes(1);
  });
});
