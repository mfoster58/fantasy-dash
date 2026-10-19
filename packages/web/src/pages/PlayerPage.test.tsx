import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import PlayerPage from './PlayerPage';
import { leagueSeasons, pick } from '../test/playerPageFixtures';
import { miniDb } from '../test/playerDbFixtures';
import { miniCharts } from '../test/chartFixtures';

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

describe('PlayerPage', () => {
  it('shows every section for a rostered WR with database rows, a trophy for his title season', () => {
    mount('w1');
    expect(screen.getByRole('heading', { level: 1, name: /Wide One/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('finish-champion').length).toBeGreaterThan(0);
    for (const name of [/In this league/, /Among WRs/, /Advanced by season/, /Game log/, /Path through the league/, /League records/]) expect(section(name), String(name)).toBeInTheDocument();
    const gold = within(section(/In this league/)!).getAllByRole('row').find((r) => r.getAttribute('data-title') === 'true');
    expect(gold).toHaveTextContent('2025');
    expect(within(section(/Path through the league/)!).getByTestId('trade-card')).toBeInTheDocument();
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
  it('orders the page: advanced numbers on their own row, then charts and the game log, then the path beside Among WRs over the records', () => {
    mount('w1');
    const order = [/Advanced by season/, /Route tree/, /Game log/, /Path through the league/, /Among WRs/, /League records/].map((n) => section(n)!);
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, String(i)).toBeTruthy();
    // its own row: not sharing a parent with Among WRs any more
    expect(section(/Advanced by season/)!.parentElement).not.toBe(section(/Among WRs/)!.parentElement);
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
  it('a WR gets the route tree, a TE too, between the advanced numbers and the game log', () => {
    mount('w1');
    const tree = section(/Route tree/)!;
    expect(tree).toBeInTheDocument();
    expect(section(/Run lanes/)).toBeNull();
    expect(tree.compareDocumentPosition(section(/Game log/)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
  it('hides every card when the player has no gsis id', () => {
    const db = miniDb();
    db.players.w1 = { ...db.players.w1, gsisId: null };
    loaded = { id: 'w1', seasons: leagueSeasons(), dbs: [db], charts: [miniCharts()] };
    render(<MemoryRouter initialEntries={['/player/w1']}><Routes><Route path="/player/:id" element={<PlayerPage />} /></Routes></MemoryRouter>);
    expect(section(/Route tree/)).toBeNull();
  });
  it('lists only his chart seasons in a card picker', () => {
    const empty = { year: 2024, builtAt: '', participation: true, injuries: {}, players: {} };
    mount('w1', leagueSeasons(), [miniCharts(2025), empty, miniCharts(2023)]);
    const picker = within(section(/Route tree/)!).getByRole('combobox');
    // the current season leads while its data isn't out
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['2026', '2025', '2023']);
  });
});
