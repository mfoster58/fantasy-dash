import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import PlayerPage from './PlayerPage';
import { leagueSeasons } from '../test/playerPageFixtures';
import { miniDb } from '../test/playerDbFixtures';

// a data router cannot initialise under jsdom (AbortSignal), so the loader hook is stubbed and the page rendered in a memory router
let loaded: unknown;
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => loaded }));
vi.mock('../data/load', async (orig) => ({
  ...(await orig<typeof import('../data/load')>()),
  players: (await import('../test/playerFixtures')).players,
  history: { seasons: [], managers: { A: { displayName: 'Alice', avatar: null, seasons: [2025, 2026] }, B: { displayName: 'Bob', avatar: null, seasons: [2025, 2026] } }, h2h: {}, allTime: [], topDraftValues: [], worstDraftValues: [] },
}));

function mount(id: string) {
  loaded = { id, seasons: leagueSeasons(), dbs: [miniDb()] };
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
    expect(within(section(/Path through the league/)!).getByText('Traded from Alice, who got Ricky One')).toBeInTheDocument();
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
});
