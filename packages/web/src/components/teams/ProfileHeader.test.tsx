import { render, screen } from '@testing-library/react';
import ProfileHeader from './ProfileHeader';

const base = { avatar: null, name: 'alice', eyebrow: 'Manager', title: 'Team Alice', tiles: [{ label: 'Record', value: '10-4' }] };

describe('ProfileHeader', () => {
  it('hangs one pennant per title beside the name, newest first', () => {
    render(<ProfileHeader {...base} pennants={[2025, 2023]} />);
    const imgs = screen.getAllByRole('img', { name: /Champion/ });
    expect(imgs.map((i) => i.getAttribute('aria-label'))).toEqual(['Champion 2025', 'Champion 2023']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Team Alice');
    // on phones the pennants hang in the card's top-right corner, out of the name's way; from sm up they sit inline beside the name
    const rail = imgs[0].parentElement!;
    expect(rail.className).toMatch(/\babsolute\b/);
    expect(rail.className).toMatch(/\bsm:static\b/);
    // the wide row lets the left group stretch so the pennants reach the top edge; the tiles centre themselves
    const row = rail.closest('header')!.firstElementChild!;
    expect(row.className).not.toMatch(/lg:items-center/);
    expect(row.querySelector('dl')!.className).toMatch(/\blg:self-center\b/);
  });

  it('shows no pennant without a title', () => {
    render(<ProfileHeader {...base} pennants={[]} />);
    expect(screen.queryByRole('img', { name: /Champion/ })).toBeNull();
  });
});
