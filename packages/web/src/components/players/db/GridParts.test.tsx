import { render, screen } from '@testing-library/react';
import { ColumnHeaderCells, GroupHeaderCells, StatCells } from './GridParts';
import { groupsFor } from '../../../lib/playerdb/columns';
import { aggregate } from '../../../lib/playerdb/aggregate';
import { miniDb } from '../../../test/playerDbFixtures';

const body = groupsFor('wr').slice(1);
const agg = aggregate(miniDb(), 1, 3).find((a) => a.id === 'w1')!;

describe('GridParts', () => {
  it('collapses a group to one header cell and one body cell', () => {
    const collapsed = new Set([body[0].group]);
    render(<table><thead><tr><GroupHeaderCells groups={body} collapsed={collapsed} onToggleGroup={() => {}} /></tr><tr><ColumnHeaderCells groups={body} collapsed={collapsed} title={(c) => c.def} /></tr></thead>
      <tbody><tr><StatCells groups={body} collapsed={collapsed} agg={agg} mode="total" tint={() => 'transparent'} /></tr></tbody></table>);
    expect(screen.getByRole('button', { name: `Expand ${body[0].group}` })).toBeInTheDocument();
    const cells = screen.getAllByRole('row')[2].querySelectorAll('td');
    expect(cells.length).toBe(1 + body.slice(1).reduce((n, g) => n + g.cols.length, 0));
  });
  it('renders plain header labels when there is no sort', () => {
    render(<table><thead><tr><ColumnHeaderCells groups={body.slice(0, 1)} collapsed={new Set()} title={(c) => c.def} /></tr></thead></table>);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
