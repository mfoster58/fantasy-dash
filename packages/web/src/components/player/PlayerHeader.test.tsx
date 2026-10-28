import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Bio } from '../../lib/player/bio';
import type { Summary } from '../../lib/player/seasons';
import PlayerHeader from './PlayerHeader';

const bio = (team: string): Bio => ({ name: 'Jaxon Smith-Njigba', pos: 'WR', nflTeam: team, age: 24, height: '6\'0"', weight: 197, college: 'Ohio State', nflDraft: '2023 · R1 #20' });
const summary = { titles: [], ptsStarted: 741.4, perStart: 18.5, starts: 40, rostered: 55, best: 42.5, w: 22, l: 18, t: 0, managers: 4 } as unknown as Summary;

function mount(team = 'SEA', espnId: string | null = '4430878', posRank: { label: string; year: number } | null = { label: 'WR1', year: 2026 }) {
  render(<MemoryRouter><PlayerHeader id="9488" bio={bio(team)} summary={summary} now={null} managerName="" rostered espnId={espnId} posRank={posRank} /></MemoryRouter>);
  return screen.getByTestId('player-banner');
}

describe('PlayerHeader banner', () => {
  it('takes the NFL team colours and names the team', () => {
    const b = mount();
    expect(b).toHaveAttribute('data-team', 'SEA');
    expect(b.getAttribute('style')).toContain('#002244');
    expect(b.getAttribute('style')).toContain('#69BE28');
    expect(screen.getByText('Seattle Seahawks')).toBeInTheDocument();
  });
  it("the team logo sits behind the name section, not the tiles", () => {
    mount();
    const logo = screen.getByTestId('team-watermark');
    expect(logo.closest('[data-testid="banner-info"]')).not.toBeNull();
    expect(logo.closest('[data-testid="header-tiles"]')).toBeNull();
  });
  it('a player without an NFL team gets the league blue wash', () => {
    const b = mount('');
    expect(b).toHaveClass('blue-wash');
    expect(b).not.toHaveAttribute('data-team');
  });
  it("shows ESPN's transparent headshot, falling back to Sleeper's when it fails or there is no ESPN id", () => {
    mount();
    const img = screen.getByTestId('banner-headshot');
    expect(img).toHaveAttribute('src', 'https://a.espncdn.com/i/headshots/nfl/players/full/4430878.png');
    fireEvent.error(img);
    expect(screen.getByTestId('banner-headshot')).toHaveAttribute('src', 'https://sleepercdn.com/content/nfl/players/9488.jpg');
  });
  it('no ESPN id: the Sleeper headshot straight away', () => {
    mount('SEA', null);
    expect(screen.getByTestId('banner-headshot')).toHaveAttribute('src', 'https://sleepercdn.com/content/nfl/players/9488.jpg');
  });
  it("the last tile is this season's position rank, not managers", () => {
    mount();
    expect(screen.queryByText('Managers')).toBeNull();
    expect(screen.getByText('W–L started')).toBeInTheDocument();
    expect(screen.getByTestId('tile-posrank')).toHaveTextContent('Pos rank · 2026WR1');
  });
  it('no rank yet reads a dash', () => {
    mount('SEA', '1', null);
    expect(screen.getByTestId('tile-posrank')).toHaveTextContent('Pos rank–');
  });
});
