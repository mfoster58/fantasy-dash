import { render } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar', () => {
  it('shows a team photo URL as it is', () => {
    const { container } = render(<Avatar avatar="https://sleepercdn.com/uploads/team-a.jpg" name="Alice" />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('https://sleepercdn.com/uploads/team-a.jpg');
  });
  it('turns an account avatar id into its thumbnail URL', () => {
    const { container } = render(<Avatar avatar="abc123" name="Alice" />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('https://sleepercdn.com/avatars/thumbs/abc123');
  });
  it('shows initials without an avatar', () => {
    const { container } = render(<Avatar avatar={null} name="Alice" />);
    expect(container).toHaveTextContent('AL');
  });
});
