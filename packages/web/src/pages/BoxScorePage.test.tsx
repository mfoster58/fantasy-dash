import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { game, season, side } from '../test/playerFixtures';
import GameBanner from '../components/home/GameBanner';
import { gameView } from '../lib/home/view';

describe('box score banner', () => {
  it('titled by week, linking nowhere itself, with team and manager links and the standings entering the week', () => {
    const a = side('a', 120, []); a.recordBefore = { w: 3, l: 1, t: 0 };
    const b = side('b', 99.25, []); b.recordBefore = { w: 1, l: 3, t: 0 };
    const g = game(2025, 5, 1, a, b);
    const s = season(2025, [], null, 5);
    s.managers = { a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 }, b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 } };
    render(<MemoryRouter><GameBanner game={g} season={s} view={gameView(g, null, true)} title="Week 5" to={null} odds={false} decimals={2}
      standing={(u) => (u === 'a' ? { rank: 2, streak: 'W3' } : undefined)} /></MemoryRouter>);
    const banner = screen.getByRole('region', { name: 'Week 5' });
    expect(screen.queryByRole('link', { name: 'Team A vs Team B' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Team A' })).toHaveAttribute('href', '/teams/2025/a');
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByTestId('banner-line-a')).toHaveTextContent(/^3-1\s*·\s*2nd\s*·\s*W3$/);
    expect(banner).toHaveTextContent('120.00');
    expect(banner).toHaveTextContent('Team A by 20.75');
  });
});
