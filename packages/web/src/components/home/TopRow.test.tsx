import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import { game, season, side, standing, week } from '../../test/playerFixtures';
import type { GameView } from '../../lib/home/view';
import GameBanner from './GameBanner';
import SideGame from './SideGame';
import TopRow from './TopRow';

function league(): Season {
  const a = side('a', 0, []); a.projected = 145.8; a.recordBefore = { w: 3, l: 3, t: 0 };
  const b = side('b', 0, []); b.projected = 142.3; b.recordBefore = { w: 4, l: 2, t: 0 };
  const c = side('c', 0, []); c.projected = 125.8; c.recordBefore = { w: 0, l: 6, t: 0 };
  const d = side('d', 0, []); d.projected = 101; d.recordBefore = { w: 4, l: 2, t: 0 };
  const w = week(7, [game(2026, 7, 1, a, b), game(2026, 7, 2, c, d)]); w.played = false;
  const s = season(2026, [w], null, 0);
  s.status = 'in_season';
  s.managers = {
    a: { userId: 'a', displayName: 'azhangatang', teamName: 'The Js', avatar: 'https://x/a.jpg', rosterId: 1 },
    b: { userId: 'b', displayName: 'CurryLover53', teamName: 'The Window', avatar: null, rosterId: 2 },
    c: { userId: 'c', displayName: 'adildo', teamName: 'My boutte hurts', avatar: null, rosterId: 3 },
    d: { userId: 'd', displayName: 'mattygggg', teamName: 'Tuten', avatar: null, rosterId: 4 },
  };
  return s;
}
const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);
const view = (over: Partial<GameView>): GameView => ({ status: 'upcoming', scores: [145.8, 142.3], projected: [145.8, 142.3], win: [54, 46], toPlay: [null, null], winner: null, ...over });

describe('TopRow', () => {
  it('without live data shows the banner and tagged game projected, linking to box scores and teams', () => {
    const s = league();
    wrap(<TopRow season={s} week={s.weeks[0]} picks={{ hero: s.weeks[0].games[0], sides: [{ game: s.weeks[0].games[1], tag: 'champ' }] }} champion="d" />);
    const banner = screen.getByRole('region', { name: 'Game of the week' });
    expect(banner).toHaveTextContent('Projected');
    expect(banner).toHaveTextContent('145.8');
    expect(banner).toHaveTextContent('54%');
    expect(within(banner).getByRole('link', { name: 'The Js vs The Window' })).toHaveAttribute('href', '/scores/2026/7/1');
    expect(within(banner).getByRole('link', { name: 'The Window' })).toHaveAttribute('href', '/teams/2026/b');
    expect(within(banner).getByText('CurryLover53')).toBeInTheDocument();
    expect(banner).toHaveTextContent('4-2');
    const side2 = screen.getByRole('region', { name: 'Champ watch' });
    expect(within(side2).getByTestId('finish-champion')).toBeInTheDocument();
    expect(side2).not.toHaveTextContent('🏆');
    expect(within(side2).getByRole('link', { name: 'My boutte hurts vs Tuten' })).toHaveAttribute('href', '/scores/2026/7/2');
  });
});

describe('GameBanner states', () => {
  it('live: Live label, points, projected finals and players left, nobody highlighted', () => {
    const s = league();
    wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({ status: 'live', scores: [78.4, 61.2], projected: [141, 139.6], win: [57, 43], toPlay: [5, 6] })} />);
    const b = screen.getByRole('region', { name: 'Game of the week' });
    expect(b).toHaveTextContent('Live');
    expect(b).toHaveTextContent('Proj 141.0 · 5 to play');
    expect(within(b).getByText('78.4')).not.toHaveClass('font-bold');
  });
  it('final: the winner bright, the loser dimmed, and the margin', () => {
    const s = league();
    wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({ status: 'final', scores: [131.5, 138.2], win: null, winner: 1 })} />);
    const b = screen.getByRole('region', { name: 'Game of the week' });
    expect(b).toHaveTextContent('Final');
    expect(within(b).getByText('138.2')).toHaveClass('font-bold');
    expect(within(b).getByText('131.5')).toHaveClass('text-muted');
    expect(b).toHaveTextContent('The Window by 6.7');
  });
  it('the win bar is green for the favourite and red for the underdog', () => {
    const s = league();
    wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({ win: [38, 62] })} />);
    expect(screen.getByTestId('banner-win-0')).toHaveStyle({ width: '38%', background: 'var(--loss)' });
    expect(screen.getByTestId('banner-win-1')).toHaveStyle({ width: '62%', background: 'var(--win)' });
    expect(screen.getByText('62%')).toHaveStyle({ color: 'var(--win)' });
  });
  it('a team without a photo gets its initials on the panel', () => {
    const s = league();
    wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({})} />);
    expect(screen.getByText('CU')).toBeInTheDocument();
  });
});

describe('GameBanner links and ranks', () => {
  it('lets clicks on the team photos through to the box score link', () => {
    const s = league();
    const { container } = wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({})} />);
    const panels = container.querySelectorAll('[data-testid="banner-photo"]');
    expect(panels).toHaveLength(2);
    panels.forEach((p) => expect(p).toHaveClass('pointer-events-none'));
    // the names and scores stay out of the stacking order so a click on them reaches the box score link
    expect(container.querySelector('[data-testid="banner-body"]')).not.toHaveClass('relative');
  });
  it('ends each photo at the gold stripe: the frame is skewed like the stripes and stops at the gold one\'s outer edge', () => {
    const s = league();
    const { container } = wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({})} />);
    const [left, right] = Array.from(container.querySelectorAll('[data-testid="banner-photo"]'));
    const frame = (p: Element) => p.querySelector('[data-testid="photo-frame"]') as HTMLElement;
    const gold = (p: Element) => p.querySelector('.bg-gold') as HTMLElement;
    expect(frame(left)).toHaveClass('-skew-x-[11deg]');
    expect(frame(left)).toHaveClass('overflow-hidden');
    expect(frame(left).style.right).toBe('26px');
    expect(gold(left)).toHaveClass('[--at:26px]');
    expect(frame(right)).toHaveClass('skew-x-[11deg]');
    expect(frame(right).style.left).toBe('26px');
  });
  it('puts the manager on their own line and record, rank and streak on the line below', () => {
    const s = league();
    wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({})} standing={(u) => (u === 'b' ? { rank: 1, streak: 'W2' } : undefined)} />);
    const b = screen.getByRole('region', { name: 'Game of the week' });
    expect(within(b).getByRole('link', { name: 'CurryLover53' })).toHaveAttribute('href', '/managers/b');
    expect(within(b).getByText('W2')).toBeInTheDocument();
    expect(within(b).getByTestId('banner-line-b')).toHaveTextContent(/^4-2\s*·\s*1st\s*·\s*W2$/);
    expect(within(b).getByTestId('banner-line-a')).toHaveTextContent(/^3-3$/);
  });
  it('the home banner shows no rank or streak before any week is played, and both after', () => {
    const s = league();
    s.standings = [standing('b', 1, 0, 0, 0, 0, 0), standing('a', 2, 0, 0, 0, 0, 0)];
    const picks = { hero: s.weeks[0].games[0], sides: [] };
    const { unmount } = wrap(<TopRow season={s} week={s.weeks[0]} picks={picks} champion={null} />);
    expect(screen.getByRole('region', { name: 'Game of the week' })).not.toHaveTextContent('1st');
    unmount();
    s.weeks.unshift({ ...week(6, []), played: true });
    wrap(<TopRow season={s} week={s.weeks[1]} picks={picks} champion={null} />);
    expect(screen.getByRole('region', { name: 'Game of the week' })).toHaveTextContent('1st');
  });
  it('a tie says so once final', () => {
    const s = league();
    wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({ status: 'final', scores: [120, 120], win: null, winner: null })} />);
    expect(screen.getByRole('region', { name: 'Game of the week' })).toHaveTextContent('Tie');
  });
});

describe('SideGame', () => {
  it('labels each tag and shows the state on the right', () => {
    const s = league();
    wrap(<SideGame game={s.weeks[0].games[1]} season={s} tag="upset" champion={null} view={view({ status: 'live', scores: [64.2, 52.8] })} />);
    const r = screen.getByRole('region', { name: 'Upset alert' });
    expect(r).toHaveTextContent('Live');
    expect(r).toHaveTextContent('64.2');
  });
});
