import { fireEvent, render, screen, within } from '@testing-library/react';
import StatTable from './StatTable';
import { managerRefs } from '../../lib/stats/scope';
import { statTable } from '../../lib/stats/table';
import { league, season2025 } from '../../test/statsFixtures';

const refs = managerRefs(league());
const names = () => screen.getAllByRole('row').slice(2).map((r) => within(r).getAllByRole('rowheader')[0].querySelector('span.truncate')!.textContent);

describe('StatTable', () => {
  it('starts sorted by Rank (record, then points for), with the rank left of the manager', () => {
    const rows = statTable([season2025()]);
    render(<StatTable rows={rows} refs={refs} pin={null} allTime={false} />);
    const byRank = [...rows].sort((x, y) => x.rank - y.rank).map((r) => refs.find((m) => m.id === r.id)!.name);
    expect(names()).toEqual(byRank);
    expect(screen.getByRole('columnheader', { name: /^Rank/ })).toHaveAttribute('aria-sort', 'ascending');
    const first = screen.getAllByRole('row')[2];
    expect(within(first).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(first.firstElementChild!.tagName).toBe('TD');
    expect(screen.getByRole('columnheader', { name: /^PF/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^PA$|^PA / })).toBeInTheDocument();
  });
  it('group headers and a sticky manager column', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    expect(screen.getByText('Scoring')).toBeInTheDocument();
    expect(screen.queryByText('Playoffs')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /Yrs/ })).toBeNull();
    expect(screen.getAllByRole('rowheader')[0].className).toContain('sticky');
  });
  it('sorts a lower-is-better column ascending first, then flips', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    fireEvent.click(screen.getByRole('button', { name: /^PA\/G/ }));
    expect(names()).toEqual(['alice', 'dan', 'bob', 'cara']);
    expect(screen.getByRole('columnheader', { name: /^PA\/G/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: /^PA\/G/ }));
    expect(names()).toEqual(['cara', 'bob', 'dan', 'alice']);
  });
  it('shows the seasons column in all-time and tints the pinned manager\'s row', () => {
    render(<StatTable rows={statTable(league())} refs={refs} pin="c" allTime />);
    expect(screen.getByRole('columnheader', { name: /Yrs/ })).toBeInTheDocument();
    const cara = screen.getAllByRole('row').find((r) => r.textContent?.includes('cara'))!;
    expect(cara).toHaveAttribute('data-pinned', 'true');
    expect(within(cara).getAllByRole('cell')[1]).toHaveTextContent('2');
  });
  it('tints every number by how it ranks in its column, green for good and red for bad', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    const ppgOf = (name: string) => {
      const r = screen.getAllByRole('row').find((x) => x.querySelector('th span.truncate')?.textContent === name)!;
      const col = within(screen.getAllByRole('row')[1]).getAllByRole('columnheader').findIndex((h) => /^PPG/.test(h.textContent ?? '')) - 1;
      return within(r).getAllByRole('cell')[col] as HTMLElement;
    };
    expect(ppgOf('bob').getAttribute('data-tone')).toBe('good');
    expect(ppgOf('bob').style.background).toMatch(/--win/);
    expect(ppgOf('dan').getAttribute('data-tone')).toBe('bad');
    expect(ppgOf('dan').style.background).toMatch(/--loss/);
    // red through yellow to green: the middle of the column leans on yellow
    expect(ppgOf('cara').style.background).toMatch(/--warn/);
  });
  it('leaves records, streaks and the roster counts untinted', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    const bob = screen.getAllByRole('row').find((x) => x.querySelector('th span.truncate')?.textContent === 'bob')!;
    // the label row, not the group row above it
    const headers = within(screen.getAllByRole('row')[1]).getAllByRole('columnheader').map((h) => (h.textContent ?? '').replace(/ [▾▴]$/, ''));
    for (const label of ['Rec', 'All-play', 'vs med', 'Streaks', 'Close', 'Post rec', 'Pickups', 'Wire pts']) {
      const i = headers.indexOf(label) - 1;
      expect(within(bob).getAllByRole('cell')[i], label).not.toHaveAttribute('data-tone');
    }
  });
  it('shows gold, silver and bronze trophies beside the name, and the playoffs group only in all-time', () => {
    const seasons = league();
    seasons[0].honors = { ...seasons[0].honors, champion: 'a', runnerUp: 'c', third: 'd' };
    render(<StatTable rows={statTable(seasons)} refs={refs} pin={null} allTime />);
    const row = (name: string) => screen.getAllByRole('row').find((x) => x.querySelector('th span.truncate')?.textContent === name)!;
    expect(within(row('alice')).getAllByTestId('finish-champion')).toHaveLength(2);
    expect(within(row('dan')).getAllByTestId('finish-runnerUp')).toHaveLength(1);
    expect(within(row('dan')).getAllByTestId('finish-third')).toHaveLength(1);
    expect(within(row('cara')).getAllByTestId('finish-runnerUp')).toHaveLength(1);
    expect(within(row('bob')).queryByTestId(/finish-/)).toBeNull();
    // gold first, then silver, then bronze
    const kinds = within(row('dan')).getAllByTestId(/finish-/).map((e) => e.getAttribute('data-testid'));
    expect(kinds).toEqual(['finish-runnerUp', 'finish-third']);
    expect(screen.getByText('Playoffs')).toBeInTheDocument();
  });
  it('centres the numbers and leaves the playoff record untinted', () => {
    render(<StatTable rows={statTable(league())} refs={refs} pin={null} allTime />);
    const alice = screen.getAllByRole('row').find((x) => x.querySelector('th span.truncate')?.textContent === 'alice')!;
    const cells = within(alice).getAllByRole('cell');
    for (const c of cells) expect(c).toHaveClass('text-center');
    const headers = within(screen.getAllByRole('row')[1]).getAllByRole('columnheader').map((h) => (h.textContent ?? '').replace(/ [▾▴]$/, ''));
    const poRec = headers.lastIndexOf('Rec') - 1;
    expect(poRec).toBeGreaterThan(headers.indexOf('Rec') - 1);
    expect(cells[poRec]).not.toHaveAttribute('data-tone');
  });
  it('paints a zero fully red in a column where more is better, however many managers share it', () => {
    render(<StatTable rows={statTable(league())} refs={refs} pin={null} allTime />);
    const labels = within(screen.getAllByRole('row')[1]).getAllByRole('columnheader').map((h) => (h.textContent ?? '').replace(/ [▾▴]$/, ''));
    const cellOf = (name: string, label: string) => {
      const r = screen.getAllByRole('row').find((x) => x.querySelector('th span.truncate')?.textContent === name)!;
      return within(r).getAllByRole('cell')[labels.lastIndexOf(label) - 1] as HTMLElement;
    };
    for (const label of ['Titles', 'Apps', 'Finals']) {
      const zero = cellOf('bob', label);
      expect(zero, label).toHaveTextContent('0');
      expect(zero, label).toHaveAttribute('data-tone', 'bad');
      expect(zero.style.background, label).toMatch(/--loss\) 100%/);
    }
  });
  it('explains every column in its header title', () => {
    render(<StatTable rows={statTable([season2025()])} refs={refs} pin={null} allTime={false} />);
    expect(screen.getByRole('button', { name: 'xW' })).toHaveAttribute('title', 'Expected wins: all-play win rate × games played');
  });
});
