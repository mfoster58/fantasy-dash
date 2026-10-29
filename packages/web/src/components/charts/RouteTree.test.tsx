import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import RouteTree from './RouteTree';
import { asPhone } from '../../test/phone';

const card = () => screen.getByRole('region', { name: /Route tree/ });
const chips = () => [...card().querySelectorAll('[data-chip]')].map((n) => n.getAttribute('data-chip'));

describe('RouteTree', () => {
  it('on a phone the field is cut to the routes so they draw near full size, each route keeping only its number', () => {
    const restore = asPhone();
    try {
      render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" />);
      const svg = card().querySelector('svg[role="img"]')!;
      expect(Number(svg.getAttribute('viewBox')!.split(' ')[2])).toBeLessThanOrEqual(400);
      expect(chips()).toEqual(['60%', '30%', '10%']);
      const route = card().querySelector('[data-route="GO"]')!;
      expect(route.textContent).toBe(route.querySelector('[data-chip]')!.getAttribute('data-chip'));
      // the names stay in the list under the field
      expect(within(card().querySelector('li[data-key="GO"]')!).getByText('Go')).toBeInTheDocument();
    } finally { restore(); }
  });
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
  it('a QB gets his throws by route, opening on throw share, with QB metrics ranked among QBs', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-q1" pos="QB" />);
    expect(within(card()).getByRole('button', { name: 'Throw share' })).toHaveAttribute('aria-pressed', 'true');
    expect(card().querySelectorAll('[data-route]')).toHaveLength(3);
    expect(chips()).toEqual(['54%', '5%', '41%']);   // route order: go, screen, dig
    fireEvent.click(within(card()).getByRole('button', { name: 'Comp %' }));
    expect(card().querySelector('[data-route="GO"]')!.getAttribute('data-pct')).toBe('100');   // 45% vs q2's 30%
    fireEvent.mouseEnter(card().querySelector('li[data-key="GO"]')!);
    fireEvent.pointerEnter(card().querySelector('li[data-key="GO"]')!, { pointerType: 'mouse' });
    expect(screen.getByTestId('chart-tip')).toHaveTextContent('Go · 40 throws, 18 completions');
  });
  it('renders nothing for a player with no route data', () => {
    const { container } = render(<RouteTree charts={[miniCharts()]} gsis="00-r2" pos="RB" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('opens on the current season greyed out with a note until its data exists; an earlier season shows the chart', () => {
    render(<RouteTree charts={[miniCharts()]} gsis="00-w1" pos="WR" current={2026} />);
    const c = screen.getByRole('region', { name: /Route tree/ });
    const picker = within(c).getByRole('combobox') as HTMLSelectElement;
    expect(picker.value).toBe('2026');
    expect([...picker.options].map((o) => o.value)).toEqual(['2026', '2025']);
    expect(within(c).getByTestId('chart-empty')).toHaveTextContent('No route data for 2026 yet');
    expect(c.querySelectorAll('[data-chip], [data-main], li[data-key]')).toHaveLength(0);
    fireEvent.change(picker, { target: { value: '2025' } });
    expect(within(c).queryByTestId('chart-empty')).toBeNull();
    expect(c.querySelectorAll('[data-chip], [data-main], li[data-key]').length).toBeGreaterThan(0);
  });
});
