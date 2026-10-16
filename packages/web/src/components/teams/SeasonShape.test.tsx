import { render, screen } from '@testing-library/react';
import SeasonShape from './SeasonShape';

describe('SeasonShape', () => {
  it('colours the dots by result and marks where the playoffs start', () => {
    render(<SeasonShape label="Week by week" mineCaption="110.0 a week" leagueCaption="100.0 league average" points={[
      { label: 'Week 1', mine: 120, league: 100, result: 'W' },
      { label: 'Week 2', mine: 90, league: 100, result: 'L' },
      { label: 'Week 3', mine: 100, league: 100, result: 'T' },
      { label: 'Week 4', mine: null, league: 100, playoff: true },
      { label: 'Week 5', mine: 130, league: 100, result: 'W', playoff: true },
    ]} />);
    const dots = screen.getByRole('img').querySelectorAll('circle');
    expect([...dots].map((d) => d.getAttribute('fill'))).toEqual(['var(--win)', 'var(--loss)', 'var(--muted)', 'var(--muted)', 'var(--win)']);
    expect(screen.getByTestId('bye-dot')).toBeInTheDocument();
    expect(screen.getByText('Bye')).toBeInTheDocument();
    // the team's line breaks at the bye: two segments; the league line runs through
    const [league, mine] = [...screen.getByRole('img').querySelectorAll('path')].map((p) => p.getAttribute('d') ?? '');
    expect((mine.match(/M/g) ?? []).length).toBe(2);
    expect((league.match(/M/g) ?? []).length).toBe(1);
    expect(screen.getByTestId('playoff-line')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('keeps accent dots and no band when points carry no result', () => {
    render(<SeasonShape wide label="Season by season" mineCaption="110.0 a week" leagueCaption="league average" points={[{ label: '2024', mine: 110, league: 100 }, { label: '2025', mine: 120, league: 100 }]} />);
    const dots = screen.getByRole('img').querySelectorAll('circle');
    expect([...dots].map((d) => d.getAttribute('fill'))).toEqual(['var(--accent)', 'var(--accent)']);
    expect(screen.queryByTestId('playoff-line')).toBeNull();
  });
});
