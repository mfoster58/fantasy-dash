import { fireEvent, render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('has an eyebrow, a title, a ? that reveals the definition in the header, and a caption', () => {
    render(<StatCard id="x" eyebrow="Expected vs actual" title="Luck" about="What counts here" caption="Read it so."><p>body</p></StatCard>);
    expect(screen.getByRole('heading', { name: 'Luck' })).toBeInTheDocument();
    expect(screen.getByText('Expected vs actual')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What counts' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('What counts here');
    expect(screen.getByRole('tooltip').parentElement?.tagName).toBe('HEADER');
    expect(screen.getByText('Read it so.')).toBeInTheDocument();
  });
  it('spans two columns when wide', () => {
    render(<StatCard id="y" eyebrow="e" title="t" wide><p>body</p></StatCard>);
    expect(screen.getByRole('region', { name: 't' }).className).toContain('lg:col-span-2');
  });
});
