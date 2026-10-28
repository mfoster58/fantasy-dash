import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { game, line, players, side, week } from '../test/playerFixtures';
import { PerformerCrawl } from './PerformerCrawl';

const w = week(6, [game(2026, 6, 1, side('a', 0, [line('q1', 30.7), line('w1', 12)]), side('b', 0, [line('r1', 22.4), line('k1', 25)]))]);

describe('PerformerCrawl', () => {
  it('a slim bar fixed to the bottom of a laptop screen, never a phone', () => {
    render(<MemoryRouter><PerformerCrawl week={w} players={players} live={false} /></MemoryRouter>);
    const bar = screen.getByRole('region', { name: 'Week 6 top performers' });
    expect(bar).toHaveClass('fixed');
    expect(bar).toHaveClass('hidden');
    expect(bar).toHaveClass('md:flex');
    expect(within(bar).getByText(/Week 6/)).toBeInTheDocument();
  });

  it('runs each position on its own under its name, ranked within it, kickers left out; no manager or position tag', () => {
    render(<MemoryRouter><PerformerCrawl week={w} players={players} live={false} /></MemoryRouter>);
    const run = screen.getAllByTestId('crawl-run')[0];
    expect(within(run).getAllByTestId('crawl-pos').map((e) => e.textContent)).toEqual(['QB', 'RB', 'WR']);
    const items = within(run).getAllByTestId('crawl-item');
    expect(items.map((i) => i.querySelector('a')!.textContent)).toEqual(['Quincy One', 'Ricky One', 'Wally One']);
    expect(items.map((i) => i.querySelector('[data-testid="crawl-rank"]')!.textContent)).toEqual(['1', '1', '1']);
    expect(items[0]).toHaveTextContent('30.7');
    expect(items[0]).not.toHaveTextContent('alice');
    expect(run.querySelector('.pos-pill')).toBeNull();
    expect(items[0].querySelector('a')).toHaveAttribute('href', '/player/q1');
    expect(screen.queryByText('Kick One')).toBeNull();
  });

  it('repeats the run once, hidden from screen readers, so the loop has no seam; it pauses on hover and stays put for reduced motion', () => {
    render(<MemoryRouter><PerformerCrawl week={w} players={players} live={false} /></MemoryRouter>);
    const runs = screen.getAllByTestId('crawl-run');
    expect(runs).toHaveLength(2);
    expect(runs[1]).toHaveAttribute('aria-hidden', 'true');
    const track = runs[0].parentElement!;
    expect(track.className).toMatch(/animate-\[crawl/);
    expect(track).toHaveClass('hover:[animation-play-state:paused]');
    expect(track).toHaveClass('motion-reduce:animate-none');
  });

  it('says Live while the week is being played', () => {
    render(<MemoryRouter><PerformerCrawl week={w} players={players} live /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Week 6 top performers' })).toHaveTextContent('Live');
  });

  it('shows nothing before anyone has scored', () => {
    const empty = week(6, [game(2026, 6, 1, side('a', 0, [line('q1', 0)]), side('b', 0, []))]);
    const { container } = render(<MemoryRouter><PerformerCrawl week={empty} players={players} live={false} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
