import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { SeasonHardware, Winner } from '../../lib/history/hardware';
import SeasonBanner from './SeasonBanner';

const win = (userId: string, team: string, extra: Partial<Winner> = {}): Winner =>
  ({ userId, team, manager: userId.toUpperCase(), avatar: `https://sleepercdn.com/uploads/${userId}.jpg`, w: 8, l: 6, t: 0, rank: 2, pf: 2004, ...extra });
const done: SeasonHardware = {
  year: 2025, live: false, lastScoredWeek: 17,
  champion: win('a', 'Chad McConkey'), runnerUp: win('b', 'Saquon these nuts'), third: win('c', 'Bijon Mustard'),
  pointsTitle: win('c', 'Bijon Mustard', { pf: 2062.4 }), seed: win('c', 'Bijon Mustard', { w: 10, l: 4 }), lastPlace: win('d', 'Write me off', { w: 3, l: 11 }),
  final: { winner: 115.48, loser: 112.1 },
};
const mount = (h: SeasonHardware) => render(<MemoryRouter><SeasonBanner h={h} /></MemoryRouter>);

describe('SeasonBanner', () => {
  it("the champion leads, with that season's picture, record, seed and the final score", () => {
    mount(done);
    const b = screen.getByRole('region', { name: '2025 season' });
    expect(within(b).getByText('2025 Champion')).toBeInTheDocument();
    expect(within(b).getByRole('heading', { name: 'Chad McConkey' })).toBeInTheDocument();
    expect(within(b).getByTestId('champion-photo').getAttribute('style')).toContain('uploads/a.jpg');
    // the avatar is square: shown whole at the banner's height, not stretched across a wide box and zoomed in
    expect(within(b).getByTestId('champion-photo')).toHaveClass('aspect-square');
    expect(b).toHaveTextContent('8–6 · 2nd in the regular season');
    expect(within(b).getByTestId('final')).toHaveTextContent('Final115.48–112.10over Saquon these nuts');
  });
  it('lists the rest of the hardware with its icons', () => {
    mount(done);
    const rows = screen.getAllByTestId('award');
    expect(rows.map((r) => r.getAttribute('data-award'))).toEqual(['runnerUp', 'third', 'pointsTitle', 'seed', 'lastPlace']);
    expect(within(rows[0]).getByTestId('finish-runnerUp')).toBeInTheDocument();
    expect(within(rows[1]).getByTestId('finish-third')).toBeInTheDocument();
    expect(within(rows[2]).getByTestId('flame')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('2,062 pts');
    expect(within(rows[4]).getByTestId('finish-toilet')).toBeInTheDocument();
    expect(rows[4]).toHaveTextContent('3–11');
  });
  it('links to the season review and each manager', () => {
    mount(done);
    expect(screen.getByRole('link', { name: /Season review/ })).toHaveAttribute('href', '/history/2025');
    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute('href', '/managers/a');
  });
  it('a season in progress shows its top seed and points leader so far', () => {
    mount({ ...done, live: true, lastScoredWeek: 7, champion: null, runnerUp: null, third: null, lastPlace: null, final: null });
    const b = screen.getByRole('region', { name: '2025 season' });
    expect(b).toHaveTextContent('In progress · through week 7');
    expect(screen.getAllByTestId('award').map((r) => r.getAttribute('data-award'))).toEqual(['seed', 'pointsTitle']);
    expect(b).toHaveTextContent('Top seed so far');
    expect(b).toHaveTextContent('Points leader so far');
    expect(screen.queryByTestId('final')).toBeNull();
  });
});
