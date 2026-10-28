import { render, screen, within } from '@testing-library/react';
import type { ChartDb } from '@fantasy-dash/core';
import { MemoryRouter, Route, Routes } from 'react-router';
import PlayerPage from './PlayerPage';
import { leagueSeasons, pick } from '../test/playerPageFixtures';
import { miniDb } from '../test/playerDbFixtures';
import { miniCharts, targetCharts } from '../test/chartFixtures';

// a data router cannot initialise under jsdom (AbortSignal), so the loader hook is stubbed and the page rendered in a memory router
let loaded: unknown;
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => loaded }));
vi.mock('../data/load', async (orig) => ({
  ...(await orig<typeof import('../data/load')>()),
  players: (await import('../test/playerFixtures')).players,
  history: { seasons: [], managers: { A: { displayName: 'Alice', avatar: null, seasons: [2025, 2026] }, B: { displayName: 'Bob', avatar: null, seasons: [2025, 2026] } }, h2h: {}, allTime: [], topDraftValues: [], worstDraftValues: [] },
}));

function mount(id: string, seasons = leagueSeasons(), charts = [miniCharts()]) {
  loaded = { id, seasons, dbs: [miniDb()], charts };
  render(<MemoryRouter initialEntries={[`/player/${id}`]}><Routes><Route path="/player/:id" element={<PlayerPage />} /></Routes></MemoryRouter>);
}
const section = (name: RegExp) => screen.queryByRole('region', { name });
/** 2026 grade sums for the miniDb receivers */
const gradesChart = (): ChartDb => ({
  year: 2026, builtAt: '', participation: false, ftn: true, injuries: {},
  players: { '00-w1': { pos: 'WR', grades: { tgt: 26, ftnTgt: 26, catchable: 20, drops: 1 } }, '00-w2': { pos: 'WR', grades: { tgt: 10, ftnTgt: 10, catchable: 8, drops: 2 } } },
});

describe('PlayerPage', () => {
  it('shows every section for a rostered WR with database rows, a trophy for his title season', () => {
    mount('w1');
    expect(screen.getByRole('heading', { level: 1, name: /Wide One/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('finish-champion').length).toBeGreaterThan(0);
    for (const name of [/In this league/, /Advanced by season/, /Game log/, /Path through the league/, /League records/]) expect(section(name), String(name)).toBeInTheDocument();
    const gold = within(section(/In this league/)!).getAllByRole('row').find((r) => r.getAttribute('data-title') === 'true');
    expect(gold).toHaveTextContent('2025');
    expect(within(section(/Path through the league/)!).getByTestId('trade-card')).toBeInTheDocument();
  });
  it('a WR page links to Compare with him in slot A', () => {
    mount('w1');
    expect(screen.getByRole('link', { name: 'Compare' })).toHaveAttribute('href', '/players/compare?season=2026&pos=WRTE&p=w1');
  });
  it('a kicker page has no Compare link', () => {
    mount('k1');
    expect(screen.queryByRole('link', { name: 'Compare' })).toBeNull();
  });
  it("the header shows this season's position rank and the team banner", () => {
    mount('w1');
    expect(screen.getByTestId('tile-posrank')).toHaveTextContent('Pos rank · 2026WR1');
    expect(screen.getByTestId('player-banner')).toHaveAttribute('data-team', 'MIA');
  });
  it('kicker shows league sections only', () => {
    mount('k1');
    expect(screen.getByRole('heading', { level: 1, name: /Kick One/ })).toBeInTheDocument();
    expect(section(/Among/)).toBeNull();
    expect(section(/Game log/)).toBeNull();
    expect(section(/In this league/)).toBeInTheDocument();
  });
  it('a never-rostered database player shows the advanced sections only', () => {
    mount('t1');
    expect(section(/In this league/)).toBeNull();
    expect(section(/Path through the league/)).toBeNull();
    expect(section(/Game log/)).toBeInTheDocument();
    expect(screen.getByText('Never rostered in this league')).toBeInTheDocument();
  });
  it('a drafted player who never played a week shows his path, not "Never rostered"', () => {
    const s = leagueSeasons();
    s[0].draft!.picks.push(pick(10, 100, 'A', 't1', false));
    mount('t1', s);
    expect(screen.queryByText('Never rostered in this league')).toBeNull();
    expect(section(/Path through the league/)).toBeInTheDocument();
  });
  it('shows a trade as a swap card: each manager and what they received, this player marked', () => {
    mount('w1');
    const card = within(section(/Path through the league/)!).getByTestId('trade-card');
    const sides = within(card).getAllByTestId('trade-side');
    expect(sides.map((s) => s.textContent)).toEqual([expect.stringMatching(/Bob\s*received.*Wally One.*8\.0/), expect.stringMatching(/Alice\s*received.*Ricky One.*22\.0/)]);
    expect(within(sides[0]).getByText('Wally One').closest('[data-me]')!.getAttribute('data-me')).toBe('true');
    expect(within(section(/Path through the league/)!).queryByText(/who got/)).toBeNull();
  });
  it('orders the page: in this league, the game log, advanced numbers, charts, grades, then the path beside the records', () => {
    mount('w1', leagueSeasons(), [miniCharts(), gradesChart(), targetCharts()]);
    const order = [/In this league/, /Game log/, /Advanced by season/, /Route tree/, /Target map/, /^Grades/, /Path through the league/, /League records/].map((n) => section(n)!);
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, String(i)).toBeTruthy();
  });
  it('has no Percentiles card any more', () => {
    mount('w1', leagueSeasons(), [miniCharts(), gradesChart()]);
    expect(section(/Among/)).toBeNull();
  });
  it('keeps Season, G, PTS, PPG and RK fixed in Advanced by season, and Wk and Opp in the game log', () => {
    mount('w1');
    const adv = section(/Advanced by season/)!;
    const first = within(adv).getAllByRole('row')[2];
    expect(first.querySelector('td')).toHaveClass('sticky');
    for (const k of ['g', 'pts', 'ppg', 'posRank']) expect(within(first).getByTestId(`cell-${k}`), k).toHaveClass('sticky');
    expect(within(first).getByTestId('cell-projPlus')).not.toHaveClass('sticky');
    const log = section(/Game log/)!;
    const cells = within(log).getAllByRole('row')[2].querySelectorAll('td');
    expect(cells[0]).toHaveClass('sticky');
    expect(cells[1]).toHaveClass('sticky');
    expect(cells[2]).not.toHaveClass('sticky');
  });
  it('leaves the manager and the result out of the game log', () => {
    mount('w1');
    const heads = within(section(/Game log/)!).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).not.toContain('Manager');
    expect(heads).not.toContain('Result');
    // nor whether he started or sat
    const log = section(/Game log/)!;
    for (const t of ['Started', 'Bench', 'FA']) expect(within(log).queryByText(t), t).toBeNull();
    for (const r of within(log).getAllByTestId('log-week')) expect(r.querySelectorAll('td')[2]).toHaveAttribute('data-testid', 'cell-pts');
    expect(heads).toEqual(expect.arrayContaining(['Wk', 'Opp']));
  });
  it('keeps only the season fixed in Advanced by season on a phone', () => {
    const was = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('max-width: 639px'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      mount('w1');
      const first = within(section(/Advanced by season/)!).getAllByRole('row')[2];
      expect(first.querySelector('td')).toHaveClass('sticky');
      for (const k of ['g', 'pts', 'ppg', 'posRank']) expect(within(first).getByTestId(`cell-${k}`), k).not.toHaveClass('sticky');
    } finally { window.matchMedia = was; }
  });
  it('a WR gets the route tree and the target map side by side', () => {
    mount('w1', leagueSeasons(), [miniCharts(), targetCharts()]);
    expect(section(/Route tree/)!.parentElement).toBe(section(/Target map/)!.parentElement);
  });
  it('a WR gets the route tree, after the advanced numbers', () => {
    mount('w1');
    const tree = section(/Route tree/)!;
    expect(tree).toBeInTheDocument();
    expect(section(/Run lanes/)).toBeNull();
    expect(section(/Advanced by season/)!.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('an RB gets run lanes and a route tree; a QB gets passing zones and the pressure card', () => {
    mount('r1');
    expect(section(/Run lanes/)).toBeInTheDocument();
    expect(section(/Route tree/)).toBeInTheDocument();
    mount('q1');
    expect(section(/Passing zones/)).toBeInTheDocument();
    expect(section(/Under pressure/)).toBeInTheDocument();
  });
  it('a QB also gets a route tree of his throws', () => {
    mount('q1');
    expect(section(/Route tree/)).toBeInTheDocument();
    expect(within(section(/Route tree/)!).getByRole('button', { name: 'Throw share' })).toBeInTheDocument();
  });
  it('hides every card when the player has no gsis id', () => {
    const db = miniDb();
    db.players.w1 = { ...db.players.w1, gsisId: null };
    loaded = { id: 'w1', seasons: leagueSeasons(), dbs: [db], charts: [miniCharts()] };
    render(<MemoryRouter initialEntries={['/player/w1']}><Routes><Route path="/player/:id" element={<PlayerPage />} /></Routes></MemoryRouter>);
    expect(section(/Route tree/)).toBeNull();
    expect(section(/Target map/)).toBeNull();
  });
  it('lists only his chart seasons in a card picker', () => {
    const empty = { year: 2024, builtAt: '', participation: true, injuries: {}, players: {} };
    mount('w1', leagueSeasons(), [miniCharts(2025), empty, miniCharts(2023)]);
    const picker = within(section(/Route tree/)!).getByRole('combobox');
    // the current season leads while its data isn't out
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['2026', '2025', '2023']);
  });
});
