import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Nav from './Nav';

// a stale tab after a deploy can 404 on the season chunk: the menu must say so rather than sit on "Loading…"
vi.mock('../data/load', async (orig) => {
  const real = await orig<typeof import('../data/load')>();
  return { ...real, loadSeason: () => Promise.reject(new Error('chunk missing')) };
});

describe('Nav when the season fails to load', () => {
  it('tells the reader the Rosters list could not load instead of loading forever', async () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Rosters' }));
    const panel = document.getElementById('nav-menu-rosters')!;
    expect(await within(panel).findByText(/could not load/i)).toBeInTheDocument();
    expect(within(panel).queryByText(/loading/i)).toBeNull();
    // the Managers list does not depend on the season file
    fireEvent.click(screen.getByRole('button', { name: 'Managers' }));
    expect(within(document.getElementById('nav-menu-managers')!).getAllByRole('link').length).toBeGreaterThan(0);
  });
});
