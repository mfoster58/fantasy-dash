import { fireEvent, render, screen, within } from '@testing-library/react';
import Heatmap from './Heatmap';
import { managerRefs } from '../../lib/stats/scope';
import { league } from '../../test/statsFixtures';

const refs = managerRefs(league());
const rows = refs.map((r) => ({ id: r.id }));
const cols = [{ key: '1', label: '1' }, { key: '2', label: '2', divider: true }];
const cell = (id: string, key: string) => (id === 'd' && key === '2' ? null : { fill: 'var(--win)', text: `${id}${key}`, title: `${id} in week ${key}`, dot: id === 'a' && key === '1', outline: id === 'b' });

describe('Heatmap', () => {
  it('draws a labelled grid with a cell per row and column, titles, dots, outlines and a dashed divider column', () => {
    render(<Heatmap rows={rows} cols={cols} cell={cell} refs={refs} pin={null} right={(id) => (id === 'a' ? '2 · $13' : null)} ariaLabel="Form" />);
    const table = screen.getByRole('table', { name: 'Form' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(screen.getByTitle('a in week 1')).toHaveTextContent('a1');
    expect(screen.getByTitle('a in week 1').querySelector('[data-dot]')).not.toBeNull();
    expect(screen.getByTitle('b in week 1')).toHaveAttribute('data-outline', 'true');
    expect(screen.getByTitle('a in week 2')).toHaveAttribute('data-divider', 'true');
    expect(screen.getByText('2 · $13')).toBeInTheDocument();
    const dRow = within(table).getAllByRole('row')[4];
    expect(within(dRow).getAllByRole('cell')).toHaveLength(3);   // week 1, an empty week 2, the empty right column
  });
  it('fades every other row when a manager is pinned, and lets a hovered row take over', () => {
    render(<Heatmap rows={rows} cols={cols} cell={cell} refs={refs} pin="a" ariaLabel="Form" />);
    const [, a, b] = screen.getAllByRole('row');
    expect(a).toHaveAttribute('data-pinned', 'true');
    expect(b).toHaveAttribute('data-dim', 'true');
    fireEvent.mouseEnter(b);
    expect(b).toHaveAttribute('data-pinned', 'true');
    expect(a).toHaveAttribute('data-dim', 'true');
  });
});
