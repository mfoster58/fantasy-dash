import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniCharts } from '../../test/chartFixtures';
import RunLanes from './RunLanes';

const card = () => screen.getByRole('region', { name: /Run lanes/ });
const lane = (k: string) => card().querySelector(`[data-lane="${k}"]`)!;

describe('RunLanes', () => {
  it('opens on carry share, with the bars in field order', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" />);
    expect(lane('LT').querySelector('[data-chip]')!.getAttribute('data-chip')).toBe('55%');
    expect([...card().querySelectorAll('li[data-key]')].map((n) => n.getAttribute('data-key'))).toEqual(['LT', 'MID', 'RE']);
  });
  it('Yds/carry shows the stat with its percentile; a 9-carry lane is unranked', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Yds/carry' }));
    expect(lane('LT').querySelector('[data-chip]')!.getAttribute('data-chip')).toBe('5.0');
    expect(lane('LT').getAttribute('data-pct')).toBe('100');
    expect(lane('MID').getAttribute('data-pct')).toBe('');
  });
  it('the box switch filters carries', () => {
    render(<RunLanes charts={[miniCharts()]} gsis="00-r1" />);
    fireEvent.click(within(card()).getByRole('button', { name: 'Heavy box (7+)' }));
    expect(card().querySelectorAll('[data-lane]')).toHaveLength(2);
  });
  it('renders nothing without lane data', () => {
    const { container } = render(<RunLanes charts={[miniCharts()]} gsis="00-w1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
