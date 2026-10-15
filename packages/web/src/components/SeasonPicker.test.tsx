import { fireEvent, render, screen } from '@testing-library/react';
import SeasonPicker from './SeasonPicker';

describe('SeasonPicker', () => {
  it('lists years newest first and reports a number', () => {
    const onChange = vi.fn();
    render(<SeasonPicker years={[2024, 2025]} value={2025} onChange={onChange} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['2025', '2024']);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2024' } });
    expect(onChange).toHaveBeenCalledWith(2024);
  });
  it('offers All-time first when asked and reports it as "all"', () => {
    const onChange = vi.fn();
    render(<SeasonPicker years={[2024, 2025]} value="all" onChange={onChange} allTime />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['All-time', '2025', '2024']);
    expect(screen.getByRole('combobox')).toHaveValue('all');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2025' } });
    expect(onChange).toHaveBeenCalledWith(2025);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(onChange).toHaveBeenCalledWith('all');
  });
});
