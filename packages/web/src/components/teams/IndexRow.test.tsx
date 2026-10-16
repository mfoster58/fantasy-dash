import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import IndexRow, { Spark } from './IndexRow';

describe('IndexRow', () => {
  it('renders the whole row as one link with rank, names, stats, visual and call to action', () => {
    render(<MemoryRouter><ul><IndexRow to="/teams/2025/a" rank={3} avatar={null} name="alice" title="Team Alice" subtitle="alice" badge={<span>2nd</span>}
      stats={[{ label: 'Record', value: '8-6', sub: 'streak W2' }, { label: 'Titles', value: '1', tone: 'gold' }]} visual={<i data-testid="viz" />} cta="View team" /></ul></MemoryRouter>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/teams/2025/a');
    expect(link).toHaveTextContent('3');
    expect(link).toHaveTextContent('Team Alice');
    expect(link).toHaveTextContent('streak W2');
    expect(screen.getByText('1')).toHaveClass('text-gold');
    expect(screen.getByTestId('viz')).toBeInTheDocument();
    expect(link).toHaveTextContent('View team →');
  });
});

describe('Spark', () => {
  it('colours dots by result and says so when there is nothing to draw', () => {
    const { rerender } = render(<Spark label="shape" points={[{ label: 'Week 1', value: 120, league: 100, result: 'W' }, { label: 'Week 2', value: 90, league: 100, result: 'L' }]} />);
    const dots = screen.getByRole('img').querySelectorAll('circle');
    expect([...dots].map((d) => d.getAttribute('fill'))).toEqual(['var(--win)', 'var(--loss)']);
    rerender(<Spark label="shape" points={[]} />);
    expect(screen.getByText('no games yet')).toBeInTheDocument();
  });
});
