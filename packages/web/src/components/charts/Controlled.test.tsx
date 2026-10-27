import { render, screen, within } from '@testing-library/react';
import { miniCharts, targetCharts } from '../../test/chartFixtures';
import PassingZones from './PassingZones';
import PressureCard from './PressureCard';
import RouteTree from './RouteTree';
import RunLanes from './RunLanes';
import TargetMap from './TargetMap';

/** Controlled mode: the compare page's shared bar picks season, filter and metric; the card hides its own picker and controls. */
const region = (name: RegExp) => screen.getByRole('region', { name });
const noControls = (r: HTMLElement) => {
  expect(within(r).queryByRole('combobox')).toBeNull();
  expect(within(r).queryAllByRole('group')).toHaveLength(0);
};

describe('chart cards in controlled mode', () => {
  it('run lanes: props pick the heavy box and yards per carry', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" control={{ year: 2025, filter: 'heavy', metric: 'ypc' }} />);
    const r = region(/Run lanes/);
    noControls(r);
    expect(r.querySelectorAll('[data-lane]')).toHaveLength(2);
    expect(r.querySelector('[data-lane="LT"] [data-chip]')!.getAttribute('data-chip')).toBe('3.5');
  });
  it('route tree: props pick vs Zone', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w2" pos="WR" control={{ year: 2025, filter: 'zone', metric: 'share' }} />);
    const r = region(/Route tree/);
    noControls(r);
    expect(r.querySelectorAll('[data-route]')).toHaveLength(1);
  });
  it('target map: props pick play-action', () => {
    render(<TargetMap charts={[targetCharts()]} gsis="00-w1" control={{ year: 2026, filter: 'pa', metric: 'share' }} />);
    const r = region(/Target map/);
    noControls(r);
    expect(r.querySelectorAll('[data-zone]')).toHaveLength(1);
  });
  it('passing zones: props pick the clean pocket', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" control={{ year: 2025, filter: 'clean', metric: 'share' }} />);
    const r = region(/Passing zones/);
    noControls(r);
    expect(r.querySelectorAll('[data-zone]')).toHaveLength(1);
  });
  it('pressure card: props pick the metric', () => {
    render(<PressureCard charts={[miniCharts()]} gsis="00-q1" control={{ year: 2025, filter: 'all', metric: 'comp' }} />);
    const r = region(/Under pressure/);
    noControls(r);
    expect(r.querySelector('li[data-key="all"]')).toHaveTextContent('67%');
  });
  it('controlled to a season with no data shows the empty note', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" control={{ year: 2026, filter: 'all', metric: 'share' }} />);
    expect(screen.getByTestId('chart-empty')).toBeInTheDocument();
  });
});
