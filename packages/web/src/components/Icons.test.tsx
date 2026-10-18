import { render, screen } from '@testing-library/react';
import { MoveIcon } from './Icons';

describe('MoveIcon', () => {
  it.each([['drafted', 'Drafted'], ['kept', 'Kept'], ['traded', 'Traded'], ['waiver', 'Waiver claim'], ['freeAgent', 'Free-agent add'], ['dropped', 'Dropped'], ['commissioner', 'Commissioner move']] as const)('draws %s with its title', (kind, title) => {
    render(<MoveIcon kind={kind} />);
    expect(screen.getByTitle(title)).toBeInTheDocument();
  });
});
