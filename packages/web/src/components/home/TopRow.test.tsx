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
    expect(banner).toHaveTextContent('CurryLover53 · 4-2');
    const side2 = screen.getByRole('region', { name: 'Champ watch' });
    expect(side2).toHaveTextContent(/Tuten\s*🏆/);
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
  });
  it('shows no rank before any week is played', () => {
    const s = league();
    s.standings = [standing('b', 1, 0, 0, 0, 0, 0), standing('a', 2, 0, 0, 0, 0, 0)];
    wrap(<GameBanner game={s.weeks[0].games[0]} season={s} view={view({})} />);
    const b = screen.getByRole('region', { name: 'Game of the week' });
    expect(b).not.toHaveTextContent('1st');
    expect(b).not.toHaveTextContent('2nd');
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
