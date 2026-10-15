import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import Nav from './Nav';

describe('Nav', () => {
  it('toggles the narrow-screen menu and closes it on navigation', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /menu/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByTestId('nav-menu');
    fireEvent.click(menu.querySelector('a[href="/standings"]')!);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the menu on any route change and on Escape', () => {
    render(<MemoryRouter><Nav /><Link to="/scores">elsewhere</Link></MemoryRouter>);
    const button = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByText('elsewhere'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('links to the player stats tab', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: 'Player stats' })[0]).toHaveAttribute('href', '/players');
  });
});
