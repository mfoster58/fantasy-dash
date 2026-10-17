import { render, screen } from '@testing-library/react';
import Pennant from './Pennant';

describe('Pennant', () => {
  it('is an image named for the title, with the word and the year drawn on it', () => {
    render(<Pennant year={2026} />);
    const img = screen.getByRole('img', { name: 'Champion 2026' });
    const texts = [...img.querySelectorAll('text')];
    expect(texts.map((t) => t.textContent)).toEqual(['CHAMPION', '2026']);
    // the word is fitted to a fixed run so it never crosses the inset border whatever font loads; the year keeps a gutter from it
    expect(texts[0]).toHaveAttribute('textLength', '56');
    expect(texts[0]).toHaveAttribute('lengthAdjust', 'spacing');
    expect(Number(texts[1].getAttribute('font-size'))).toBeLessThanOrEqual(24);
  });
});
