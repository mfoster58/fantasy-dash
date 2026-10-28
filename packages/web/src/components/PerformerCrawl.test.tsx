import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { game, line, players, side, week } from '../test/playerFixtures';
import { PerformerCrawl } from './PerformerCrawl';

const managers = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
};
const w = week(6, [game(2026, 6, 1, side('a', 0, [line('q1', 30.7), line('w1', 12)]), side('b', 0, [line('r1', 22.4), line('k1', 25)]))]);

describe('PerformerCrawl', () => {
  it('a slim bar fixed to the bottom of a laptop screen, never a phone', () => {
    render(<MemoryRouter><PerformerCrawl week={w} managers={managers} players={players} live={false} /></MemoryRouter>);
    const bar = screen.getByRole('region', { name: 'Week 6 top performers' });
    expect(bar).toHaveClass('fixed');
    expect(bar).toHaveClass('hidden');
    expect(bar).toHaveClass('md:flex');
    expect(within(bar).getByText(/Week 6/)).toBeInTheDocument();
  });

  it('runs the starters by points, kickers left out, each with rank, points and the manager, linking to the player', () => {
    render(<MemoryRouter><PerformerCrawl week={w} managers={managers} players={players} live={false} /></MemoryRouter>);
    const items = within(screen.getAllByTestId('crawl-run')[0]).getAllByTestId('crawl-item');
    expect(items.map((i) => i.querySelector('a')!.textContent)).toEqual(['Quincy One', 'Ricky One', 'Wally One']);
    expect(items[0]).toHaveTextContent('1');
    expect(items[0]).toHaveTextContent('30.7');
    expect(items[0]).toHaveTextContent('alice');
    expect(items[0].querySelector('a')).toHaveAttribute('href', '/player/q1');
    expect(screen.queryByText('Kick One')).toBeNull();
  });

  it('repeats the run once, hidden from screen readers, so the loop has no seam; it pauses on hover and stays put for reduced motion', () => {
    render(<MemoryRouter><PerformerCrawl week={w} managers={managers} players={players} live={false} /></MemoryRouter>);
    const runs = screen.getAllByTestId('crawl-run');
    expect(runs).toHaveLength(2);
    expect(runs[1]).toHaveAttribute('aria-hidden', 'true');
    const track = runs[0].parentElement!;
    expect(track.className).toMatch(/animate-\[crawl/);
    expect(track).toHaveClass('hover:[animation-play-state:paused]');
    expect(track).toHaveClass('motion-reduce:animate-none');
  });

  it('says Live while the week is being played', () => {
    render(<MemoryRouter><PerformerCrawl week={w} managers={managers} players={players} live /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Week 6 top performers' })).toHaveTextContent('Live');
  });

  it('shows nothing before anyone has scored', () => {
    const empty = week(6, [game(2026, 6, 1, side('a', 0, [line('q1', 0)]), side('b', 0, []))]);
    const { container } = render(<MemoryRouter><PerformerCrawl week={empty} managers={managers} players={players} live={false} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
