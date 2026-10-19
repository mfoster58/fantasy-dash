import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import PressureCard from './PressureCard';

const card = () => screen.getByRole('region', { name: /Under pressure/ });
const row = (k: string) => card().querySelector(`li[data-key="${k}"]`)!;

describe('PressureCard', () => {
  it('lists All dropbacks then the splits he has, with EPA per dropback and percentile', () => {
    render(<PressureCard charts={[miniCharts()]} gsis="00-q1" />);
    expect(row('all')).toHaveTextContent('+0.11');
    expect(row('pressured')).toHaveTextContent('-0.23');
    expect(row('COVER_0')).toHaveTextContent('–');
    expect(row('blitz')).toBeNull();
  });
  it('Sack % ranks lower as better', () => {
    render(<PressureCard charts={[miniCharts()]} gsis="00-q1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Sack %' }));
    expect(row('all')).toHaveTextContent('7.1%');
    expect(row('all').getAttribute('data-pct')).toBe('0');
  });
  it('renders nothing without splits', () => {
    const { container } = render(<PressureCard charts={[miniCharts()]} gsis="00-w1" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('opens on the current season greyed out with a note until its data exists; an earlier season shows the chart', () => {
    render(<PressureCard charts={[miniCharts()]} gsis="00-q1" current={2026} />);
    const c = screen.getByRole('region', { name: /Under pressure/ });
    const picker = within(c).getByRole('combobox') as HTMLSelectElement;
    expect(picker.value).toBe('2026');
    expect([...picker.options].map((o) => o.value)).toEqual(['2026', '2025']);
    expect(within(c).getByTestId('chart-empty')).toHaveTextContent('No pressure data for 2026 yet');
    expect(c.querySelectorAll('[data-chip], [data-main], li[data-key]')).toHaveLength(0);
    fireEvent.change(picker, { target: { value: '2025' } });
    expect(within(c).queryByTestId('chart-empty')).toBeNull();
    expect(c.querySelectorAll('[data-chip], [data-main], li[data-key]').length).toBeGreaterThan(0);
  });
});
