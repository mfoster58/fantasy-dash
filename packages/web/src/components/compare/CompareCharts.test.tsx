import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import CompareCharts from './CompareCharts';

const players = [{ gsis: '00-r1', name: 'Run One', pos: 'RB' }, { gsis: '00-r2', name: 'Run Two', pos: 'RB' }];

describe('CompareCharts', () => {
  it('the chart kinds follow the position group', () => {
    render(<CompareCharts group="RB" players={players} chart={miniCharts()} />);
    const kinds = within(screen.getByRole('group', { name: 'Chart' })).getAllByRole('button').map((b) => b.textContent);
    expect(kinds).toEqual(['Run lanes', 'Route tree', 'Target map']);
  });
  it("one filter change reaches every player's chart", () => {
    render(<CompareCharts group="RB" players={players} chart={miniCharts()} />);
    expect(screen.getAllByRole('region', { name: /Run lanes/ })).toHaveLength(2);
    fireEvent.click(within(screen.getByRole('group', { name: 'Box' })).getByRole('button', { name: 'Heavy box (7+)' }));
    const [a, b] = screen.getAllByRole('region', { name: /Run lanes/ });
    expect(a.querySelectorAll('[data-lane]')).toHaveLength(2);
    expect(b.querySelectorAll('[data-lane]')).toHaveLength(0);
  });
  it('each chart is captioned with its player and the credit line is present', () => {
    render(<CompareCharts group="RB" players={players} chart={miniCharts()} />);
    expect(screen.getByText('Run One')).toBeInTheDocument();
    expect(screen.getByText(/Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse/)).toBeInTheDocument();
  });
});
