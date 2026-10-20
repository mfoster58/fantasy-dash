import { render, screen } from '@testing-library/react';
import LiveOutlook from './LiveOutlook';

describe('LiveOutlook', () => {
  it('shows each side\'s projected final against its pre-game projection, and the win % split', () => {
    render(<LiveOutlook outlook={{ projected: [118.4, 96.2], win: [64, 36], status: 'live' }} pregame={[110, 105]} names={['Team Alice', 'Team Bob']} />);
    expect(screen.getByText('118.40')).toBeInTheDocument();
    expect(screen.getByText('96.20')).toBeInTheDocument();
    expect(screen.getByTestId('proj-bar-0')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('proj-bar-1').style.width).toBe(`${(96.2 / 118.4) * 100}%`);
    expect(screen.getByTestId('pregame-1').style.left).toBe(`${(105 / 118.4) * 100}%`);
    expect(screen.getByTestId('win-0')).toHaveStyle({ width: '64%' });
    expect(screen.getByTestId('win-1')).toHaveStyle({ width: '36%' });
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('36%')).toBeInTheDocument();
  });
});
