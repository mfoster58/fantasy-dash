import { render, screen } from '@testing-library/react';
import ProfileHeader from './ProfileHeader';

const base = { avatar: null, name: 'alice', eyebrow: 'Manager', title: 'Team Alice', tiles: [{ label: 'Record', value: '10-4' }] };

describe('ProfileHeader', () => {
  it('hangs one pennant per title, newest first', () => {
    render(<ProfileHeader {...base} pennants={[2025, 2023]} />);
    const imgs = screen.getAllByRole('img', { name: /Champion/ });
    expect(imgs.map((i) => i.getAttribute('aria-label'))).toEqual(['Champion 2025', 'Champion 2023']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Team Alice');
  });

  it('shows no pennant without a title', () => {
    render(<ProfileHeader {...base} pennants={[]} />);
    expect(screen.queryByRole('img', { name: /Champion/ })).toBeNull();
  });

  it('is a game-of-the-week style banner: blue wash, the avatar cut on a diagonal with two stripes, the title in banner type', () => {
    render(<ProfileHeader {...base} avatar="abc123" />);
    const banner = screen.getByTestId('profile-banner');
    expect(banner).toHaveClass('blue-wash');
    expect(screen.getByTestId('banner-photo').getAttribute('style')).toContain('abc123');
    expect(screen.getAllByTestId('banner-stripe')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('font-display', 'uppercase');
  });

  it('without an avatar the panel shows his initials', () => {
    render(<ProfileHeader {...base} />);
    expect(screen.getByTestId('banner-photo')).toHaveTextContent('AL');
  });
});
