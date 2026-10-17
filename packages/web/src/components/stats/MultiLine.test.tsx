import { fireEvent, render, screen } from '@testing-library/react';
import MultiLine from './MultiLine';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());
const series = [{ id: 'a', values: [1, 1, 2] }, { id: 'b', values: [2, null, 1] }];

describe('MultiLine', () => {
  it('draws one path per series, broken at a gap, with x labels, guides, a divider, a band and right labels', () => {
    render(<MultiLine series={series} xLabels={['wk 1', 'wk 2', 'wk 3']} yDomain={[1, 2]} invertY guides={[{ y: 1.5, label: 'playoff line', tone: 'win' }]} dividers={[2]} bands={[2]} rightLabel={(s) => s.id} refs={refs} pin="a" ariaLabel="Race" />);
    const svg = screen.getByRole('img', { name: 'Race' });
    const paths = svg.querySelectorAll('path[data-series]');
    expect(paths).toHaveLength(2);
    expect(svg.querySelector('path[data-series="a"]')).toHaveAttribute('data-pinned', 'true');
    expect(svg.querySelector('path[data-series="a"]')!.getAttribute('d')!.match(/M/g)).toHaveLength(1);
    expect(svg.querySelector('path[data-series="b"]')!.getAttribute('d')!.match(/M/g)).toHaveLength(2);
    expect(screen.getByText('wk 1')).toBeInTheDocument();
    expect(screen.getByText('playoff line')).toBeInTheDocument();
    expect(svg.querySelector('[data-divider]')).not.toBeNull();
    expect(svg.querySelector('[data-band]')).not.toBeNull();
    expect(svg.querySelector('text[data-series-label="a"]')).toHaveAttribute('data-pinned', 'true');
    // hovering a path lights that series instead
    fireEvent.mouseEnter(svg.querySelector('path[data-series="b"]')!);
    expect(svg.querySelector('path[data-series="b"]')).toHaveAttribute('data-pinned', 'true');
    expect(svg.querySelector('path[data-series="a"]')).toHaveAttribute('data-dim', 'true');
  });
});
