import { render, screen } from '@testing-library/react';
import ProfileHeader from './ProfileHeader';

const base = { avatar: null, name: 'alice', eyebrow: 'Manager', title: 'Team Alice', tiles: [{ label: 'Record', value: '10-4' }] };

describe('ProfileHeader', () => {
  it('hangs one pennant per title beside the name, newest first', () => {
    render(<ProfileHeader {...base} pennants={[2025, 2023]} />);
    const imgs = screen.getAllByRole('img', { name: /Champion/ });
    expect(imgs.map((i) => i.getAttribute('aria-label'))).toEqual(['Champion 2025', 'Champion 2023']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Team Alice');
  });

  it('shows no pennant without a title', () => {
    render(<ProfileHeader {...base} pennants={[]} />);
    expect(screen.queryByRole('img', { name: /Champion/ })).toBeNull();
  });
});
