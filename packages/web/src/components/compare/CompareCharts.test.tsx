import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts, targetCharts } from '../../test/chartFixtures';
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
  it('a season without pressure data disables Clean and Pressured in the shared Pocket filter', () => {
    render(<CompareCharts group="QB" players={[{ gsis: '00-q1', name: 'Quarter One', pos: 'QB' }]} chart={targetCharts()} />);
    const pocket = screen.getByRole('group', { name: 'Pocket' });
    expect(within(pocket).getByRole('button', { name: 'Pressured' })).toBeDisabled();
    expect(within(pocket).getByRole('button', { name: 'Clean pocket' })).toBeDisabled();
    expect(within(pocket).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('a season without FTN disables the target-map play filters', () => {
    render(<CompareCharts group="WRTE" players={[{ gsis: '00-w1', name: 'Wide One', pos: 'WR' }]} chart={targetCharts(2026, false)} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Chart' })).getByRole('button', { name: 'Target map' }));
    expect(within(screen.getByRole('group', { name: 'Plays' })).getByRole('button', { name: 'Play-action' })).toBeDisabled();
  });
  it('each chart is captioned with its player and the credit line is present', () => {
    render(<CompareCharts group="RB" players={players} chart={miniCharts()} />);
    expect(screen.getByText('Run One')).toBeInTheDocument();
    expect(screen.getByText(/Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse/)).toBeInTheDocument();
  });
});
