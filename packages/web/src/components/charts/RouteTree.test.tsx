import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import RouteTree from './RouteTree';

const card = () => screen.getByRole('region', { name: /Route tree/ });
const chips = () => [...card().querySelectorAll('[data-chip]')].map((n) => n.getAttribute('data-chip'));

describe('RouteTree', () => {
  it('opens on target share: chips show his share, routes he was never targeted on are not drawn', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    expect(chips()).toEqual(['60%', '30%', '10%']);
    expect(card().querySelectorAll('[data-route]')).toHaveLength(3);
    expect(within(card()).getByRole('button', { name: 'Target share' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('a metric shows the real stat on the chip and the percentile in the small text', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/tgt' }));
    expect(chips()).toEqual(['15.0', '12.0', '6.0']);
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('100');
    expect(within(card()).getAllByText(/100th · 15 tgt/).length).toBeGreaterThan(0);
  });
  it('switching to vs Man greys a route he has too few man targets on', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/tgt' }));
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('100');
    fireEvent.click(within(card()).getByRole('button', { name: 'vs Man' }));
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('');
    expect(within(card()).getAllByText(/3 tgt · too few to rank/).length).toBeGreaterThan(0);
  });
  it('a TE route under 5 targets is greyed with no rank', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-t1" pos="TE" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/tgt' }));
    expect(card().querySelector('[data-route="IN/DIG"]')!.getAttribute('data-pct')).toBe('');
  });
  it('hovering a bar highlights its route and fills the tip line', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    fireEvent.pointerEnter(card().querySelector('li[data-key="GO"]')!, { pointerType: 'mouse' });
    expect(card().querySelector('[data-route="GO"]')!.getAttribute('data-hot')).toBe('true');
    expect(screen.getByTestId('chart-tip')).toHaveTextContent('Go · 30 targets, 15 catches, 450 yds, 3 TD');
    expect(screen.getByTestId('chart-tip')).toHaveTextContent('ranked against 3 WRs');
  });
  it('clicking a route the mouse is on keeps it highlighted', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    const go = card().querySelector('[data-route="GO"]')!;
    // a real browser fires both pointer and mouse events for a mouse
    fireEvent.pointerEnter(go, { pointerType: 'mouse' });
    fireEvent.mouseEnter(go);
    fireEvent.pointerDown(go, { pointerType: 'mouse' });
    fireEvent.click(go);
    expect(go.getAttribute('data-hot')).toBe('true');
  });
  it('a tap highlights a route even though the browser also fires mouse compatibility events', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
    const go = card().querySelector('[data-route="GO"]')!;
    fireEvent.pointerEnter(go, { pointerType: 'touch' });
    fireEvent.pointerDown(go, { pointerType: 'touch' });
    fireEvent.mouseEnter(go);
    fireEvent.click(go);
    expect(go.getAttribute('data-hot')).toBe('true');
    fireEvent.pointerDown(go, { pointerType: 'touch' });
    fireEvent.click(go);
    expect(go.getAttribute('data-hot')).toBe('false');
  });
  it('renders nothing for a player with no route data', () => {
    const { container } = render(<RouteTree charts={[miniCharts()]} gsis="00-q1" pos="QB" />);
    expect(container).toBeEmptyDOMElement();
  });
});
