import { fireEvent, render, screen, within } from '@testing-library/react';
import { targetCharts } from '../../test/chartFixtures';
import TargetMap from './TargetMap';

const card = () => screen.getByRole('region', { name: /Target map/ });
const zone = (k: string) => card().querySelector(`[data-zone="${k}"]`)!;

describe('TargetMap', () => {
  it("shows each zone's share and target count without hovering", () => {
    render(<TargetMap charts={[targetCharts()]} gsis="00-w1" />);
    expect(zone('short|left').querySelector('[data-main]')!.textContent).toBe('50%');
    expect(zone('short|left')).toHaveTextContent('10 tgt');
    expect(card().querySelectorAll('[data-zone]')).toHaveLength(3);
  });
  it('the Play-action filter narrows the zones', () => {
    render(<TargetMap charts={[targetCharts()]} gsis="00-w1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Play-action' }));
    expect(card().querySelectorAll('[data-zone]')).toHaveLength(1);
    expect(zone('short|left').querySelector('[data-main]')!.textContent).toBe('100%');
  });
  it('Catch % colours by percentile; a 2-target zone is unranked', () => {
    render(<TargetMap charts={[targetCharts()]} gsis="00-w2" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Catch %' }));
    expect(zone('short|left').querySelector('[data-main]')!.textContent).toBe('50%');
    expect(zone('short|left').getAttribute('data-pct')).toBe('0');
    expect(zone('deep|right').getAttribute('data-pct')).toBe('');
  });
  it('FTN filters are disabled when the season has no FTN', () => {
    render(<TargetMap charts={[targetCharts(2026, false)]} gsis="00-w1" />);
    expect(within(card()).getByRole('button', { name: 'Play-action' })).toBeDisabled();
    expect(within(card()).getByRole('button', { name: 'All' })).not.toBeDisabled();
  });
  it('carries the FTN credit line and the route-tree note', () => {
    render(<TargetMap charts={[targetCharts()]} gsis="00-w1" />);
    expect(card()).toHaveTextContent('Data: FTN Data via nflverse');
    expect(card()).toHaveTextContent("Route tree arrives when the season's route data is published");
  });
});

describe('TargetMap beside the route tree', () => {
  it('the route-tree note shows only in a season without route data', () => {
    render(<TargetMap charts={[{ ...targetCharts(2025), participation: true }]} gsis="00-w1" />);
    expect(card()).not.toHaveTextContent('Route tree arrives');
  });
});
