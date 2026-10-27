import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts, targetCharts } from '../../test/chartFixtures';
import PassingZones from './PassingZones';

const card = () => screen.getByRole('region', { name: /Passing zones/ });
const zone = (k: string) => card().querySelector(`[data-zone="${k}"]`)!;

describe('PassingZones', () => {
  it('without participation, Clean and Pressured are disabled and All shows zones', () => {
    render(<PassingZones charts={[targetCharts()]} gsis="00-q1" current={2026} />);
    expect(within(card()).getByRole('button', { name: 'Clean pocket' })).toBeDisabled();
    expect(within(card()).getByRole('button', { name: 'Pressured' })).toBeDisabled();
    expect(zone('short|right').querySelector('[data-main]')!.textContent).toBe('100%');
    expect(screen.queryByTestId('chart-empty')).toBeNull();
  });
  it('opens on throw share; the main number is the share', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" />);
    expect(zone('short|right').querySelector('[data-main]')!.textContent).toBe('51%');
    expect(card().querySelectorAll('[data-zone]')).toHaveLength(3);
  });
  it('a metric shows the actual stat as the main number and the percentile underneath', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Comp %' }));
    expect(zone('short|right').querySelector('[data-main]')!.textContent).toBe('80%');
    expect(zone('short|right')).toHaveTextContent('100th · 80 att');
    expect(zone('deep|left')).toHaveTextContent('too few to rank');
  });
  it('tiles show All / vs Man / vs Zone from the splits, EPA per dropback for share', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" />);
    const tiles = within(card()).getAllByTestId('zone-tile');
    expect(tiles.map((t) => t.textContent)).toEqual([expect.stringContaining('+0.11'), expect.stringContaining('+0.07'), expect.stringContaining('+0.13')]);
  });
  it('CPOE on a zone with no CPOE attempts shows a dash instead of crashing', () => {
    const db = miniCharts();
    db.players['00-q1'].zones!.all['blos|middle'] = [1, 0, 0, -0.5, 0, 0, 0, 0];
    render(<PassingZones charts={[db]} gsis="00-q1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'CPOE' }));
    expect(zone('blos|middle').querySelector('[data-main]')!.textContent).toBe('–');
  });
  it('renders nothing without zone data', () => {
    const { container } = render(<PassingZones charts={[miniCharts()]} gsis="00-w1" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('opens on the current season greyed out with a note until its data exists; an earlier season shows the chart', () => {
    render(<PassingZones charts={[miniCharts()]} gsis="00-q1" current={2026} />);
    const c = screen.getByRole('region', { name: /Passing zones/ });
    const picker = within(c).getByRole('combobox') as HTMLSelectElement;
    expect(picker.value).toBe('2026');
    expect([...picker.options].map((o) => o.value)).toEqual(['2026', '2025']);
    expect(within(c).getByTestId('chart-empty')).toHaveTextContent('No passing data for 2026 yet');
    expect(c.querySelectorAll('[data-chip], [data-main], li[data-key]')).toHaveLength(0);
    fireEvent.change(picker, { target: { value: '2025' } });
    expect(within(c).queryByTestId('chart-empty')).toBeNull();
    expect(c.querySelectorAll('[data-chip], [data-main], li[data-key]').length).toBeGreaterThan(0);
  });
});
