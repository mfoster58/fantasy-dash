import { fireEvent, render, screen, within } from '@testing-library/react';
import { gradeCards } from '../../lib/grades/grade';
import { gradeFixture } from '../../test/gradeFixtures';
import AdvancedTable from './AdvancedTable';

function mount() {
  const { db, chart } = gradeFixture();
  render(<AdvancedTable names={['Wide A', 'Wide B']} cards={[gradeCards(db, chart, 'wa'), gradeCards(db, chart, 'wb')]} />);
}
const table = () => screen.getByRole('table');
const groups = () => within(table()).getAllByTestId('adv-group').map((g) => g.textContent);

describe('AdvancedTable', () => {
  it('bucket pills filter the rows and the leads line follows', () => {
    mount();
    expect(groups()).toHaveLength(7);
    const before = screen.getByTestId('leads').textContent;
    fireEvent.click(within(screen.getByRole('group', { name: 'Buckets' })).getByRole('button', { name: 'Deep threat' }));
    expect(groups()).toEqual(['Deep threat']);
    expect(screen.getByTestId('leads').textContent).not.toBe(before);
  });
  it('the leader cell has the gold outline and ▲; style rows never lead', () => {
    mount();
    const lead = table().querySelectorAll('td[data-lead="true"]');
    expect(lead.length).toBeGreaterThan(0);
    for (const td of lead) expect(td).toHaveTextContent('▲');
    expect(table().querySelector('tr[data-key="adot"] td[data-lead="true"]')).toBeNull();
  });
  it('percentiles read as ordinals', () => {
    mount();
    expect(table().querySelector('tr[data-key="dropRate"]')).toHaveTextContent(/\d+(st|nd|rd|th)/);
  });
  it('no question line next to the card titles', () => {
    mount();
    expect(screen.queryByText(/\?/)).toBeNull();
  });
});
