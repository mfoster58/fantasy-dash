import { render, screen } from '@testing-library/react';
import Pennant from './Pennant';

describe('Pennant', () => {
  it('is an image named for the title, with the word and the year drawn on it', () => {
    render(<Pennant year={2026} />);
    const img = screen.getByRole('img', { name: 'Champion 2026' });
    expect(img).toHaveTextContent('Champion');
    expect(img).toHaveTextContent('2026');
  });
});
