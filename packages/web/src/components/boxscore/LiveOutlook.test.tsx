import { render, screen } from '@testing-library/react';
import LiveOutlook from './LiveOutlook';

describe('LiveOutlook', () => {
  it('shows only the win % split, the favourite green and the underdog red', () => {
    render(<LiveOutlook outlook={{ projected: [118.4, 96.2], win: [36, 64], status: 'live' }} />);
    expect(screen.getByRole('region', { name: 'Win probability' })).toBeInTheDocument();
    expect(screen.queryByText('Projected final')).not.toBeInTheDocument();
    expect(screen.queryByText('118.40')).not.toBeInTheDocument();
    expect(screen.getByTestId('win-0')).toHaveStyle({ width: '36%', background: 'var(--loss)' });
    expect(screen.getByTestId('win-1')).toHaveStyle({ width: '64%', background: 'var(--win)' });
    expect(screen.getByText('36%')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Win probability' })).toHaveTextContent(/^Win probability36%64%$/);
  });
  it('a dead-even game is neither green nor red', () => {
    render(<LiveOutlook outlook={{ projected: [100, 100], win: [50, 50], status: 'live' }} />);
    expect(screen.getByTestId('win-0')).toHaveStyle({ background: 'var(--dim)' });
    expect(screen.getByTestId('win-1')).toHaveStyle({ background: 'var(--dim)' });
  });
});
