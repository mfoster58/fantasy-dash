import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import { game, line, season, side, standing, week } from '../../test/playerFixtures';
import HomeStandings from './HomeStandings';
import ResultsCard from './ResultsCard';
import TopPerformers from './TopPerformers';

vi.mock('../../data/load', async (orig) => ({ ...(await orig<typeof import('../../data/load')>()), players: (await import('../../test/playerFixtures')).players }));

function league(): Season {
  const w6 = week(6, [
    game(2026, 6, 1, side('a', 159.98, [line('q1', 30.7, { rush_att: 16, rush_yd: 64, rush_td: 2 })]), side('b', 120, [line('w1', 28.5, { rec: 12, rec_tgt: 15, rec_yd: 165 })])),
    game(2026, 6, 2, side('c', 140, [line('r1', 1)]), side('d', 76.6, [line('t1', 2)])),
  ]);
  const s = season(2026, [w6], null, 6);
  s.status = 'in_season';
  s.playoffTeams = 2;
  s.standings = [standing('a', 1, 5, 1, 0, 985.2, 755.3), standing('b', 2, 4, 2, 0, 848.6, 775.9), standing('c', 3, 3, 3, 0, 800, 800), standing('d', 4, 0, 6, 0, 604.2, 908.5)];
  s.standings[0].streak = 'W2';
  s.managers = Object.fromEntries(['a', 'b', 'c', 'd'].map((u, i) => [u, { userId: u, displayName: `mgr-${u}`, teamName: `Team ${u.toUpperCase()}`, avatar: null, rosterId: i + 1 }]));
  return s;
}
const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('HomeStandings', () => {
  it('every team with W, L, win %, PF, PPG, PA and streak, a playoff cut, team links and the full table link', () => {
    const s = league();
    wrap(<HomeStandings season={s} />);
    const rows = screen.getAllByTestId('home-standings-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Team A');
    expect(rows[0]).toHaveTextContent('mgr-a');
    expect(rows[0]).toHaveTextContent('985.2');
    expect(rows[0]).toHaveTextContent('W2');
    expect(rows[0]).toHaveTextContent('.833');
    expect(rows[0]).toHaveTextContent('164.2');
    expect(screen.getByRole('columnheader', { name: 'Win%' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'PPG' })).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: 'Team A' })).toHaveAttribute('href', '/teams/2026/a');
    // the same cut as the full standings table: a rule under the last playoff team, no label row
    expect(rows[1]).toHaveAttribute('data-playoff-cut', 'true');
    expect(rows.filter((r) => r.hasAttribute('data-playoff-cut'))).toHaveLength(1);
    expect(screen.queryByText('Playoff cut')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Full table/ })).toHaveAttribute('href', '/standings/2026');
  });
});

describe('ResultsCard', () => {
  it('is titled by week number and names managers in each quick hitter', () => {
    const s = league();
    wrap(<ResultsCard season={s} week={s.weeks[0]} />);
    const card = screen.getByRole('region', { name: 'Week 6' });
    expect(card).toHaveTextContent('High score');
    expect(card).toHaveTextContent('mgr-a');
    expect(card).toHaveTextContent('159.98');
    expect(card).toHaveTextContent('mgr-c over mgr-d');
    expect(card).toHaveTextContent('+63.4');
    expect(card).toHaveTextContent('Nail-biter');
    expect(card).not.toHaveTextContent('bench');
    expect(within(card).getByRole('link', { name: /Scores/ })).toHaveAttribute('href', '/scores/2026/6');
  });
});

describe('TopPerformers', () => {
  it('lists starters by points with name, manager and the full stat line, linking to the player', () => {
    const s = league();
    wrap(<TopPerformers season={s} week={s.weeks[0]} />);
    const card = screen.getByRole('region', { name: 'Week 6 top performers' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Quincy One');
    expect(items[0]).toHaveTextContent('mgr-a');
    expect(items[0]).toHaveTextContent('16 car, 64 yds, 2 TD');
    expect(items[0]).toHaveTextContent('30.7');
    expect(within(items[0]).getByRole('link', { name: 'Quincy One' })).toHaveAttribute('href', '/player/q1');
    expect(within(card).getByRole('link', { name: /Players/ })).toHaveAttribute('href', '/stats/players');
  });
});
