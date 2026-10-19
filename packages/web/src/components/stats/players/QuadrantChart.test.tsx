import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from '../../../lib/stats/players/season';
import { VIEWS, viewPool } from '../../../lib/stats/players/views';
import QuadrantChart from './QuadrantChart';

const stats = seasonStats(statsDb(), statsCharts());
const view = VIEWS.find((v) => v.id === 'xfp' && v.pos.includes('RB'))!;
const mount = (note?: string) => render(<MemoryRouter><QuadrantChart view={view} pool={viewPool(view, stats, 'RB')} note={note} /></MemoryRouter>);

describe('QuadrantChart', () => {
  it('draws a logo per player with a short-name label, the four quadrant names and the question', () => {
    mount();
    const card = screen.getByRole('region', { name: /Expected vs actual/ });
    expect(card.querySelectorAll('[data-player]').length).toBe(viewPool(view, stats, 'RB').length);
    expect(within(card).getByText('R. Back')).toBeInTheDocument();
    for (const q of view.quads) expect(within(card).getByText(q.toUpperCase())).toBeInTheDocument();
    expect(within(card).getByText(view.question)).toBeInTheDocument();
  });
  it('a logo that fails to load becomes a circle with the team code', () => {
    mount();
    const card = screen.getByRole('region', { name: /Expected vs actual/ });
    expect(card.querySelectorAll('circle')).toHaveLength(0);
    fireEvent.error(card.querySelector('image')!);
    expect(card.querySelectorAll('circle')).toHaveLength(1);
  });
  it('hovering a logo shows his name and both values', () => {
    mount();
    const card = screen.getByRole('region', { name: /Expected vs actual/ });
    fireEvent.pointerEnter(card.querySelector('[data-player="rUp"]')!, { pointerType: 'mouse' });
    expect(within(card).getByRole('tooltip')).toHaveTextContent('Rising Back');
    expect(within(card).getByRole('tooltip')).toHaveTextContent('Actual fantasy points per game');
  });
  it('the Table toggle lists the same players with both values', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.length).toBe(viewPool(view, stats, 'RB').length + 1);
  });
  it('shows the note instead of the chart', () => {
    mount('Coverage data arrives after the season ends.');
    expect(screen.getByText('Coverage data arrives after the season ends.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Expected vs actual/ }).querySelector('[data-player]')).toBeNull();
  });
});
