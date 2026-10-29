// @vitest-environment node
// jsdom's AbortSignal is rejected by Node's Request, which the data router builds for loaders; this test needs no DOM.
import { createMemoryRouter } from 'react-router';
import { routes } from './routes';
import { currentSeason } from './data/load';

describe('routes under a league basename', () => {
  it('keeps loader redirects inside the league', async () => {
    const router = createMemoryRouter(routes, { basename: '/husky', initialEntries: ['/husky/standings'] });
    await vi.waitFor(() => expect(router.state.navigation.state).toBe('idle'));
    await vi.waitFor(() => expect(router.state.location.pathname).toMatch(new RegExp(`standings/${currentSeason.year}$`)));
    expect(router.state.errors).toBeNull();
  });
});
