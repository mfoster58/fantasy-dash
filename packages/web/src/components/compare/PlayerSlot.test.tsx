import { fireEvent, render, screen, within } from '@testing-library/react';
import { miniDb } from '../../test/playerDbFixtures';
import PlayerSlot from './PlayerSlot';

const options = () => within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.getAttribute('data-id'));

describe('PlayerSlot', () => {
  it("suggests the group's players by season points, leaving out ones already picked", () => {
    render(<PlayerSlot index={0} db={miniDb()} pos="WRTE" value={null} taken={['w2']} onPick={() => {}} />);
    fireEvent.focus(screen.getByRole('combobox'));
    // w1 50 pts, t1 27; w2 is taken; r1 and q1 are other groups
    expect(options()).toEqual(['w1', 't1']);
  });
  it('typing filters by name', () => {
    render(<PlayerSlot index={0} db={miniDb()} pos="WRTE" value={null} taken={[]} onPick={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } });
    expect(options()).toEqual(['w2']);
  });
  it('arrow keys and Enter pick', () => {
    const onPick = vi.fn();
    render(<PlayerSlot index={1} db={miniDb()} pos="WRTE" value={null} taken={[]} onPick={onPick} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(box.getAttribute('aria-activedescendant')).toContain('t1');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('t1');
  });
  it('Escape closes the list', () => {
    render(<PlayerSlot index={0} db={miniDb()} pos="RB" value={null} taken={[]} onPick={() => {}} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box.getAttribute('aria-expanded')).toBe('false');
  });
  it('a filled slot shows the player and ✕ clears it', () => {
    const onPick = vi.fn();
    render(<PlayerSlot index={2} db={miniDb()} pos="WRTE" value="t1" taken={[]} onPick={onPick} />);
    expect(screen.getByText('Player C')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onPick).toHaveBeenCalledWith(null);
  });
  it('a TE is offered in WR/TE, not in RB', () => {
    render(<PlayerSlot index={0} db={miniDb()} pos="RB" value={null} taken={[]} onPick={() => {}} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(options()).toEqual(['r1']);
  });
});
