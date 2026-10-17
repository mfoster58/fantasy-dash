import { fireEvent, render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('has one title, a ? that reveals the definition in the header, and a caption, with no eyebrow line', () => {
    render(<StatCard id="x" title="Luck" about="What counts here" caption="Read it so."><p>body</p></StatCard>);
    expect(screen.getByRole('heading', { name: 'Luck' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Luck' }).querySelector('header .section-label')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What counts' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('What counts here');
    expect(screen.getByRole('tooltip').parentElement?.tagName).toBe('HEADER');
    expect(screen.getByText('Read it so.')).toBeInTheDocument();
  });
  it('spans two columns when wide', () => {
    render(<StatCard id="y" title="t" wide><p>body</p></StatCard>);
    expect(screen.getByRole('region', { name: 't' }).className).toContain('lg:col-span-full');
  });
  it('can shrink inside the grid so a wide table scrolls within the card instead of widening the page', () => {
    render(<StatCard id="z" title="z"><p>body</p></StatCard>);
    expect(screen.getByRole('region', { name: 'z' }).className).toMatch(/\bmin-w-0\b/);
  });
});
