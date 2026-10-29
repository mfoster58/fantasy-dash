import { render } from '@testing-library/react';
import RootPage from './RootPage';
import LeagueNotFound from './LeagueNotFound';
import { leagues } from '../../../../league.config';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('pages outside a league', () => {
  it('the root page explains itself and names no league', () => {
    const { container } = render(<RootPage />);
    expect(container.textContent).toContain('This site hosts private league pages. Use the link your commissioner sent you.');
    for (const l of leagues) { expect(container.textContent).not.toContain(l.name); expect(container.innerHTML).not.toContain(`/${l.slug}`); }
    expect(container.querySelector('a')).toBeNull();
  });
  it('the not-found page names no league', () => {
    const { container } = render(<LeagueNotFound />);
    expect(container.textContent).toMatch(/league not found/i);
    for (const l of leagues) expect(container.textContent).not.toContain(l.name);
  });
  it('the HTML shell names no league', () => {
    const html = readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
    expect(html).toContain('<title>Fantasy</title>');
    for (const l of leagues) expect(html).not.toContain(l.name);
  });
});
