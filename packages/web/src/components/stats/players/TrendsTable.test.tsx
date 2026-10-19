import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from '../../../lib/stats/players/season';
import { trends } from '../../../lib/stats/players/trends';
import TrendsTable from './TrendsTable';
import YprrChart from './YprrChart';

describe('TrendsTable', () => {
  const data = trends(statsDb(), statsCharts(), 'RB');
  it('trending up and down sections, a row per player with his weekly bars and change', () => {
    render(<MemoryRouter><TrendsTable data={data} pos="RB" season={2026} /></MemoryRouter>);
    const card = screen.getByRole('region', { name: /RB volume trends/ });
    expect(within(card).getByText(/Trending up/)).toBeInTheDocument();
    expect(within(card).getByText(/Trending down/)).toBeInTheDocument();
    const up = within(card).getByText('Rising Back').closest('tr')!;
    expect(up.querySelectorAll('[data-week]').length).toBe(5 * data.columns.length);
    expect(up).toHaveTextContent('+52.5');
  });
  it('the Injured line names who left the lists and why', () => {
    render(<MemoryRouter><TrendsTable data={data} pos="RB" season={2026} /></MemoryRouter>);
    expect(screen.getByText('Injured').closest('p')).toHaveTextContent('Out Back: Out (Groin)');
  });
});

describe('YprrChart', () => {
  it('draws the YPRR rays and says when routes are estimated', () => {
    render(<MemoryRouter><YprrChart stats={seasonStats(statsDb(), statsCharts())} pos="WR" estimated /></MemoryRouter>);
    const card = screen.getByRole('region', { name: /Yards per route run/ });
    expect(within(card).getByText('2.0 YPRR')).toBeInTheDocument();
    expect(within(card).getByText(/routes estimated/)).toBeInTheDocument();
  });
});
