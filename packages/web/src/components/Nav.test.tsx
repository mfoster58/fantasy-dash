import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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
});
