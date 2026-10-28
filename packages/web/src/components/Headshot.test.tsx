import { fireEvent, render, screen } from '@testing-library/react';
import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from './Headshot';

const players: PlayerDirectory = {
  '9488': { id: '9488', name: 'Jaxon Smith-Njigba', firstName: 'Jaxon', lastName: 'Smith-Njigba', position: 'WR', team: 'SEA', yearsExp: 3, birthDate: null },
};
const img = (c: HTMLElement) => c.querySelector('img');

describe('Headshot', () => {
  it('rides out a failed load: the full-size picture, then the thumbnail once more, and only then the position letters', () => {
    const { container } = render(<Headshot players={players} id="9488" />);
    expect(img(container)).toHaveAttribute('src', 'https://sleepercdn.com/content/nfl/players/thumb/9488.jpg');
    fireEvent.error(img(container)!);
    expect(img(container)).toHaveAttribute('src', 'https://sleepercdn.com/content/nfl/players/9488.jpg');
    fireEvent.error(img(container)!);
    expect(img(container)).toHaveAttribute('src', 'https://sleepercdn.com/content/nfl/players/thumb/9488.jpg?retry=1');
    fireEvent.error(img(container)!);
    expect(img(container)).toBeNull();
    expect(screen.getByText('WR')).toBeInTheDocument();
  });
  it('loads straight away when asked to, for a picture that moves into view on its own', () => {
    const { container } = render(<Headshot players={players} id="9488" eager />);
    expect(img(container)).toHaveAttribute('loading', 'eager');
  });
});
