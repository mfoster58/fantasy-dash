import { render, screen } from '@testing-library/react';
import EfficiencyCard from './EfficiencyCard';

describe('EfficiencyCard', () => {
  it('shows the percentage, a bar and the started-of-possible totals', () => {
    render(<EfficiencyCard desk={{ weeks: 54, efficiency: 0.9157, started: 7978.42, possible: 8712.62, benchLeft: 734.2, best: null, worst: null }} />);
    expect(screen.getByText('Efficiency')).toBeInTheDocument();
    expect(screen.getByText('91.6%')).toBeInTheDocument();
    expect(screen.getByTestId('efficiency-bar').style.width).toBe('92%');
    expect(screen.getByText('7978.42')).toBeInTheDocument();
    expect(screen.getByText(/of 8712.62 max/)).toBeInTheDocument();
    expect(screen.queryByText(/Best-set/)).toBeNull();
  });
});
