import { render, screen } from '@testing-library/react';
import Pennant from './Pennant';

describe('Pennant', () => {
  it('is an image named for the title, with the word and the year drawn on it', () => {
    render(<Pennant year={2026} />);
    const img = screen.getByRole('img', { name: 'Champion 2026' });
    const texts = [...img.querySelectorAll('text')];
    expect(texts.map((t) => t.textContent)).toEqual(['CHAMPION', '2026']);
    // the word is fitted to a fixed run so it stays inside the outline whatever font loads; the year keeps a gutter from it
    expect(texts[0]).toHaveAttribute('textLength', '56');
    expect(texts[0]).toHaveAttribute('lengthAdjust', 'spacing');
    expect(Number(texts[1].getAttribute('font-size'))).toBeLessThanOrEqual(24);
  });

  it('matches the site\'s gold language: no grommets, a muted label, the year and trophy in gold on a tinted panel', () => {
    render(<Pennant year={2026} />);
    const img = screen.getByRole('img', { name: 'Champion 2026' });
    expect(img.querySelectorAll('circle')).toHaveLength(0);
    const [label, year] = [...img.querySelectorAll('text')];
    expect(label.getAttribute('fill')).toBe('var(--muted)');
    // the year is a touch deeper than the bare gold token so it keeps above 3:1 on the light theme's tint
    expect(year.getAttribute('fill')).toBe('color-mix(in srgb, var(--gold) 88%, var(--ink))');
    expect(img.querySelector('[data-testid="glyph-champion"]')).toHaveStyle({ color: 'var(--gold)' });
    // the banner is a faint gold tint with a gold outline, not a solid gold block
    const banner = img.querySelector('path')!;
    expect(banner.getAttribute('stroke')).toContain('var(--gold)');
    const stops = [...img.querySelectorAll<SVGStopElement>('linearGradient stop')];
    expect(stops).toHaveLength(2);
    for (const s of stops) expect(s.style.stopColor).toContain('var(--surface)');
  });
});
