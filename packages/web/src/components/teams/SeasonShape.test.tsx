import { render, screen } from '@testing-library/react';
import SeasonShape from './SeasonShape';

describe('SeasonShape', () => {
  it('colours the dots by result and marks where the playoffs start', () => {
    render(<SeasonShape label="Week by week" mineCaption="110.0 a week" leagueCaption="100.0 league average" points={[
      { label: 'Week 1', mine: 120, league: 100, result: 'W' },
      { label: 'Week 2', mine: 90, league: 100, result: 'L' },
      { label: 'Week 3', mine: 100, league: 100, result: 'T' },
      { label: 'Week 4', mine: 130, league: 100, result: 'W', playoff: true },
    ]} />);
    const dots = screen.getByRole('img').querySelectorAll('circle');
    expect([...dots].map((d) => d.getAttribute('fill'))).toEqual(['var(--win)', 'var(--loss)', 'var(--muted)', 'var(--win)']);
    expect(screen.getByTestId('playoff-band')).toBeInTheDocument();
    expect(screen.getByText('Playoffs')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('keeps accent dots and no band when points carry no result', () => {
    render(<SeasonShape wide label="Season by season" mineCaption="110.0 a week" leagueCaption="league average" points={[{ label: '2024', mine: 110, league: 100 }, { label: '2025', mine: 120, league: 100 }]} />);
    const dots = screen.getByRole('img').querySelectorAll('circle');
    expect([...dots].map((d) => d.getAttribute('fill'))).toEqual(['var(--accent)', 'var(--accent)']);
    expect(screen.queryByTestId('playoff-band')).toBeNull();
    expect(screen.queryByText('Playoffs')).toBeNull();
  });
});
