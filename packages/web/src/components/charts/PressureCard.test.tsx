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
});
