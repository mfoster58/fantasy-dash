import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Game, GameSide, History, PlayerDirectory, Season, Week } from '@fantasy-dash/core';
import AllTimeRecords from './AllTimeRecords';
import type { AllTimeRecords as Records } from '../lib/allTimeRecords';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: 'av-a', seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: 'av-b', seasons: [2024, 2025] },
};

const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3 },
  r1: { id: 'r1', name: 'Ricky One', firstName: 'Ricky', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 2 },
  w1: { id: 'w1', name: 'Wally One', firstName: 'Wally', lastName: 'One', position: 'WR', team: 'MIA', yearsExp: 4 },
  t1: { id: 't1', name: 'Tony One', firstName: 'Tony', lastName: 'One', position: 'TE', team: 'KC', yearsExp: 6 },
  q2: { id: 'q2', name: 'Quinn Two', firstName: 'Quinn', lastName: 'Two', position: 'QB', team: 'BUF', yearsExp: 5 },
  r2: { id: 'r2', name: 'Rob Two', firstName: 'Rob', lastName: 'Two', position: 'RB', team: 'DET', yearsExp: 1 },
};

const side = (userId: string, points: number, starters: [string, number][]): GameSide => ({
  userId, points, projected: 100, ceiling: points + 10, efficiency: 0.9,
  starters: starters.map(([id, pts]) => ({ slot: 'FLEX', player: { playerId: id, points: pts, projected: null, stats: {} } })),
  bench: [], optimalSwaps: [], recordBefore: { w: 3, l: 1, t: 0 }, seasonPpg: 105.5,
});
const game: Game = {
  id: '2025-16-3', matchupId: 3, week: 16, tag: 'Final', winner: 'a', margin: 100.4,
  sides: [side('a', 180.4, [['t1', 5], ['q1', 30], ['r1', 12], ['w1', 9]]), side('b', 80, [['q2', 25], ['r2', 8]])],
};
const emptyWeek = (week: number): Week => ({ week, isPlayoff: false, played: false, games: [], highScore: null });
const season2025 = {
  year: 2025, leagueId: 'L', status: 'complete', lastScoredWeek: 16, playoffWeekStart: 15, playoffTeams: 6,
  rosterSlots: [], scoring: {}, managers: {}, brackets: { winners: [], consolation: [] }, standings: [],
  honors: { champion: 'a', runnerUp: 'b', third: null, pointsTitle: null, lastPlace: null }, draft: null,
  weeks: [...Array.from({ length: 15 }, (_, i) => emptyWeek(i + 1)), { week: 16, isPlayoff: true, played: true, games: [game], highScore: null }],
} as Season;

const records: Records = {
  highScores: [{ gameId: '2025-16-3', year: 2025, week: 16, tag: 'Final', userId: 'a', points: 180.4, opponent: 'b', oppPoints: 80 }],
  lowScores: [{ gameId: '2025-16-3', year: 2025, week: 16, tag: 'Final', userId: 'b', points: 80, opponent: 'a', oppPoints: 180.4 }],
  closest: [{ gameId: '2024-1-2', year: 2024, week: 1, tag: null, high: { userId: 'a', points: 90 }, low: { userId: 'b', points: 90 }, margin: 0 }],
  blowouts: [{ gameId: '2025-16-3', year: 2025, week: 16, tag: 'Final', high: { userId: 'a', points: 180.4 }, low: { userId: 'b', points: 80 }, margin: 100.4 }],
};

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('AllTimeRecords', () => {
  it('shows each list and links every row to its box score', () => {
    wrap(<AllTimeRecords records={records} managers={managers} seasons={[season2025]} players={players} />);

    const high = screen.getByTestId('records-highScores');
    expect(within(high).getByText('High scores')).toBeInTheDocument();
    const highRow = within(high).getByRole('link');
    expect(highRow).toHaveAttribute('href', '/scores/2025/16/3');
    expect(highRow).toHaveTextContent('alice');
    expect(highRow).toHaveTextContent('180.40');
    expect(highRow).toHaveTextContent('vs bob');
    expect(highRow).toHaveTextContent('2025 · Wk 16 · Championship');

    const low = screen.getByTestId('records-lowScores');
    expect(within(low).getByText('Low scores')).toBeInTheDocument();
    expect(within(low).getByRole('link')).toHaveTextContent('bob');

    const closest = screen.getByTestId('records-closest');
    expect(within(closest).getByText('Closest matchups')).toBeInTheDocument();
    const closeRow = within(closest).getByRole('link');
    expect(closeRow).toHaveAttribute('href', '/scores/2024/1/2');
    expect(closeRow).toHaveTextContent('Tie');
    expect(closeRow).toHaveTextContent('2024 · Wk 1');
    expect(closeRow).not.toHaveTextContent('·  ·');

    const blow = screen.getByTestId('records-blowouts');
    expect(within(blow).getByText('Blowouts')).toBeInTheDocument();
    const blowRow = within(blow).getByRole('link');
    expect(blowRow).toHaveTextContent(/alice.*180\.40vsbob.*80\.00/);
    expect(blowRow).toHaveTextContent('2025 · Wk 16');
    expect(blowRow).toHaveTextContent('Championship');
    expect(blowRow).toHaveTextContent('by 100.40');
    expect(blowRow).not.toHaveTextContent('+100.40');
  });

  it("shows each side's top three starters when the game is loaded", () => {
    wrap(<AllTimeRecords records={records} managers={managers} seasons={[season2025]} players={players} />);

    const highRow = within(screen.getByTestId('records-highScores')).getByRole('link');
    expect(highRow).toHaveTextContent(/Quincy One\s*30\.00.*Ricky One\s*12\.00.*Wally One\s*9\.00/);
    expect(highRow).not.toHaveTextContent('Tony One');
    expect(highRow).not.toHaveTextContent('Quinn Two');

    const lowRow = within(screen.getByTestId('records-lowScores')).getByRole('link');
    expect(lowRow).toHaveTextContent(/Quinn Two\s*25\.00.*Rob Two\s*8\.00/);
    expect(lowRow).not.toHaveTextContent('Quincy One');

    const blowRow = within(screen.getByTestId('records-blowouts')).getByRole('link');
    expect(blowRow).toHaveTextContent(/Quincy One.*Wally One.*180\.40vsbob.*Quinn Two.*Rob Two.*80\.00/);

    // 2024 is not loaded: the row still renders, just without players.
    const closeRow = within(screen.getByTestId('records-closest')).getByRole('link');
    expect(closeRow).toHaveTextContent('alice');
    expect(closeRow).not.toHaveTextContent('Quincy One');
  });

  it('stacks the matchup cards full width below the score cards', () => {
    wrap(<AllTimeRecords records={records} managers={managers} seasons={[]} players={players} />);
    const ids = ['records-highScores', 'records-lowScores', 'records-closest', 'records-blowouts'].map((id) => screen.getByTestId(id));
    const order = [...document.querySelectorAll('[data-testid^="records-"]')].map((el) => el.getAttribute('data-testid'));
    expect(order).toEqual(['records-highScores', 'records-lowScores', 'records-closest', 'records-blowouts']);
    expect(ids[2].className).toContain('md:col-span-2');
    expect(ids[3].className).toContain('md:col-span-2');
    expect(ids[0].className).not.toContain('md:col-span-2');
  });

  it('says so when a list is empty', () => {
    const empty: Records = { highScores: [], lowScores: [], closest: [], blowouts: [] };
    wrap(<AllTimeRecords records={empty} managers={managers} seasons={[]} players={players} />);
    expect(screen.getAllByText('No games yet.')).toHaveLength(4);
  });
});
