import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import HistoryPage from './HistoryPage';
import { history } from '../data/load';

describe('HistoryPage', () => {
  it('links every named manager to the career page', () => {
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    const champion = history.seasons.find((s) => s.status === 'complete')!.honors.champion!;
    const name = history.managers[champion].displayName;
    const links = screen.getAllByRole('link', { name: new RegExp(`^${name}$`) });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toHaveAttribute('href', `/managers/${champion}`);
    expect(document.querySelector('a[href^="/h2h?a="]')).toBeNull();
  });
});
