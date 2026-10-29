import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { PlayerDirectory } from '@fantasy-dash/core';
import cleTen from '../../../test/fixtures/espn/401873013.json';
import { line, side } from '../../../test/playerFixtures';
import type { NflGame } from '../../../lib/live/espn';
import { clearFinishedFeeds, FEED_POLL_MS } from '../../../lib/field/useGameFeeds';
import { asPhone } from '../../../test/phone';
import MatchupField from './MatchupField';

const DIR: PlayerDirectory = {
  8126: { id: '8126', name: "Wan'Dale Robinson", firstName: "Wan'Dale", lastName: 'Robinson', position: 'WR', team: 'TEN', yearsExp: 5, birthDate: null },
  13298: { id: '13298', name: 'KC Concepcion Jr.', firstName: 'KC', lastName: 'Concepcion Jr.', position: 'WR', team: 'CLE', yearsExp: 0, birthDate: null },
  qj: { id: 'qj', name: 'Quinshon Judkins', firstName: 'Quinshon', lastName: 'Judkins', position: 'RB', team: 'CLE', yearsExp: 1, birthDate: null },
  12711: { id: '12711', name: 'Tyler Loop', firstName: 'Tyler', lastName: 'Loop', position: 'K', team: 'TEN', yearsExp: 1, birthDate: null },
};
const SCORING = { rec: 1, rec_yd: 0.1, rec_td: 6, rush_yd: 0.1, rush_td: 6 };
const SIDES = [side('a', 50, [line('8126', 4.7), line('12711', 6)]), side('b', 60, [line('13298', 23.2), line('qj', 20)])] as const;
const nfl = (state: NflGame['state']): NflGame => ({ id: '401873013', teams: ['CLE', 'TEN'], state, period: 2, clock: '5:00', kickoff: '2026-10-25T17:00Z', halftime: false });

type Raw = typeof cleTen;
/** the real game as ESPN would have shown it partway: the first `n` drives, the last still going with its first `k` plays */
function partway(n: number, k: number): Raw {
  const json = structuredClone(cleTen) as Raw & { drives: { current?: unknown } };
  const drives = json.drives.previous.slice(0, n);
  const current = { ...drives.pop()!, displayResult: undefined };
  current.plays = current.plays.slice(0, k);
  json.header.competitions[0].status.type.state = 'in';
  json.drives = { previous: drives, current } as Raw['drives'];
  return json;
}
function fetchOf(get: () => unknown) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => get() }) as Response);
}
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const mount = (state: NflGame['state'], fetcher: ReturnType<typeof fetchOf>) =>
  render(<MatchupField sides={[SIDES[0], SIDES[1]]} names={['My boutte hurts', 'Bijon Mustard']} players={DIR} scoring={SCORING} games={[nfl(state)]} fetcher={fetcher} />);
const field = (name: string) => screen.getByRole('img', { name: `${name}'s plays on the field` });
const marks = (el: HTMLElement, pid?: string) => Array.from(el.querySelectorAll<SVGGElement>(`[data-testid="mf-play"]${pid ? `[data-pid="${pid}"]` : ''}`));

describe('MatchupField', () => {
  beforeEach(() => { vi.useFakeTimers(); clearFinishedFeeds(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  afterEach(() => { vi.useRealTimers(); });

  describe('the whole week', () => {
    it('draws each lineup\'s plays on its own field: catches, targets and runs, no kickers', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      expect(screen.getByRole('button', { name: 'Whole week' })).toHaveAttribute('aria-pressed', 'true');
      expect(marks(field('Bijon Mustard'), '13298')).toHaveLength(13);
      expect(marks(field('My boutte hurts'), '8126')).toHaveLength(6);
      expect(marks(field('My boutte hurts'), '12711')).toHaveLength(0);
    });

    it('draws a target that fell incomplete in gray, so it can\'t be mistaken for a catch', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      const flight = (kind: string) => field('Bijon Mustard').querySelector<SVGPathElement>(`[data-testid="mf-play"][data-pid="13298"][data-kind="${kind}"] path`)!;
      expect(flight('inc').style.stroke).toBe('var(--muted)');
      expect(flight('rec').style.stroke).toBe('var(--pos-WR)');
    });

    it('heads each field with the team\'s name and its score', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      expect(screen.getAllByTestId('mf-total').map((t) => t.textContent)).toEqual(['50.00', '60.00']);
    });

    it('puts the player\'s face and points only on the big plays', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      const tags = within(field('Bijon Mustard')).getAllByTestId('mf-tag');
      expect(tags.map((t) => t.textContent)).toContain('+4.2');
      expect(tags.length).toBeLessThan(13);
    });

    it('shows one player\'s plays when their name is tapped, and everyone\'s again on a second tap', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      const btn = screen.getByRole('button', { name: /Robinson/ });
      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      expect(marks(field('My boutte hurts'), '8126').every((m) => !m.classList.contains('opacity-10'))).toBe(true);
      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    it('lists the biggest plays beside the fields', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      const list = screen.getByRole('list', { name: 'Biggest plays' });
      // Judkins's touchdown runs score the most; Concepcion's 32-yard catch makes the list too
      expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(/Judkins \d-yd TD run/);
      expect(list).toHaveTextContent('Concepcion 32-yd catch+4.2');
    });
  });

  describe('on a phone', () => {
    it('shows one field at a time, with a switch between the two teams that carries each one\'s score', async () => {
      const restore = asPhone();
      try {
        mount('post', fetchOf(() => cleTen));
        await flush();
        const pick = screen.getByRole('group', { name: 'Whose field' });
        const [a, b] = within(pick).getAllByRole('button');
        expect(a).toHaveTextContent('My boutte hurts50.00');
        expect(a).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('img', { name: /plays on the field/ })).toHaveLength(1);
        expect(marks(field('My boutte hurts'), '8126')).toHaveLength(6);
        fireEvent.click(b);
        expect(b).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('img', { name: "My boutte hurts's plays on the field" })).toBeNull();
        expect(marks(field('Bijon Mustard'), '13298')).toHaveLength(13);
      } finally { restore(); }
    });
  });

  describe('replay', () => {
    it('offers a replay once the games are over, and leaves it for the whole week when done', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      fireEvent.click(screen.getByRole('button', { name: 'Replay the week' }));
      expect(screen.getByRole('slider', { name: 'Replay clock' })).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
      expect(screen.getByRole('button', { name: 'Live drives' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.queryByRole('slider', { name: 'Replay clock' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Whole week' })).toHaveAttribute('aria-pressed', 'true');
      expect(marks(field('Bijon Mustard'), '13298')).toHaveLength(13);
      expect(document.querySelectorAll('.mf-new')).toHaveLength(0);
    });

    it('offers no replay while a game is on', async () => {
      mount('in', fetchOf(() => partway(4, 5)));
      await flush();
      expect(screen.queryByRole('button', { name: 'Replay the week' })).toBeNull();
    });

    it('jumps to the busiest moment of each window without replaying everything in between', async () => {
      mount('post', fetchOf(() => cleTen));
      await flush();
      fireEvent.click(screen.getByRole('button', { name: 'Replay the week' }));
      fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }));
      const jumps = within(screen.getByRole('group', { name: 'Jump to' })).getAllByRole('button');
      expect(jumps).toHaveLength(1);
      const clock = screen.getByRole('slider', { name: 'Replay clock' }) as HTMLInputElement;
      const before = Number(clock.value);
      fireEvent.click(jumps[0]);
      expect(Number(clock.value)).toBeGreaterThan(before);
      expect(document.querySelectorAll('.mf-new')).toHaveLength(0);
      expect(screen.queryByTestId('mf-celebration')).toBeNull();
      expect(within(field('Bijon Mustard')).queryByTestId('mf-drive') ?? within(field('My boutte hurts')).queryByTestId('mf-drive')).not.toBeNull();
    });

    it('plays a finished week back as if it were live: the clock runs, plays arrive and draw themselves in', async () => {
      render(<MatchupField sides={[SIDES[0], SIDES[1]]} names={['My boutte hurts', 'Bijon Mustard']} players={DIR} scoring={SCORING} games={[nfl('post')]} fetcher={fetchOf(() => cleTen)} replay />);
      await flush();
      const clock = screen.getByRole('slider', { name: 'Replay clock' });
      const start = Number(clock.getAttribute('value') ?? (clock as HTMLInputElement).value);
      expect(screen.getByRole('button', { name: 'Pause replay' })).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
      expect(Number((clock as HTMLInputElement).value)).toBeGreaterThan(start);
      expect(screen.getByRole('button', { name: 'Live drives' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(screen.getByRole('list', { name: 'Live plays' })).getAllByRole('listitem').length).toBeGreaterThan(5);
      fireEvent.click(screen.getByRole('button', { name: 'Pause replay' }));
      const paused = (clock as HTMLInputElement).value;
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      expect((clock as HTMLInputElement).value).toBe(paused);
    });
  });

  describe('live', () => {
    it('opens on the live drives while a game is on: the team\'s logo where the ball is, and only that drive\'s plays, each with its face and points', async () => {
      // Cleveland's touchdown drive (the 4th), five plays in
      mount('in', fetchOf(() => partway(4, 5)));
      await flush();
      expect(screen.getByRole('button', { name: 'Live drives' })).toHaveAttribute('aria-pressed', 'true');
      const right = field('Bijon Mustard');
      const drive = within(right).getByTestId('mf-drive');
      expect(drive).toHaveAttribute('data-team', 'CLE');
      const driveId = cleTen.drives.previous[3].id;
      expect(marks(right).every((m) => m.dataset.drive === driveId)).toBe(true);
      expect(within(right).queryAllByTestId('mf-tag')).toHaveLength(marks(right).filter((m) => m.dataset.end === '1').length);
      expect(within(field('My boutte hurts')).queryByTestId('mf-drive')).toBeNull();
    });

    it('animates only the plays that arrive after the first look, and fetches again on its own', async () => {
      let k = 2;
      const f = fetchOf(() => partway(4, k));
      mount('in', f);
      await flush();
      expect(document.querySelectorAll('.mf-new')).toHaveLength(0);
      const before = marks(field('Bijon Mustard')).length;
      k = 6; // still short of the touchdown, so the drive stays up
      await act(async () => { await vi.advanceTimersByTimeAsync(FEED_POLL_MS); });
      expect(f.mock.calls.length).toBe(2);
      const after = marks(field('Bijon Mustard'));
      expect(after.length).toBeGreaterThan(before);
      expect(after.filter((m) => m.classList.contains('mf-new')).length).toBe(after.length - before);
    });

    it('celebrates a starter\'s touchdown when it comes in, not one already there at the first look', async () => {
      // Judkins's 5-yard touchdown run is the 8th play of Cleveland's 4th drive
      let k = 7;
      mount('in', fetchOf(() => partway(4, k)));
      await flush();
      expect(screen.queryByTestId('mf-celebration')).toBeNull();
      k = 9;
      await act(async () => { await vi.advanceTimersByTimeAsync(FEED_POLL_MS); });
      expect(screen.getByTestId('mf-celebration')).toHaveTextContent(/Touchdown.*Quinshon Judkins.*\+6\.5/);
      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      expect(screen.queryByTestId('mf-celebration')).toBeNull();
    });

    it('lists every play of the games your players are in, newest first, with your players\' plays marked', async () => {
      mount('in', fetchOf(() => partway(4, 5)));
      await flush();
      const feed = screen.getByRole('list', { name: 'Live plays' });
      const rows = within(feed).getAllByRole('listitem');
      // timeouts and the ends of quarters aren't plays
      const plays = cleTen.drives.previous.slice(0, 4).flatMap((d, i) => (i === 3 ? d.plays.slice(0, 5) : d.plays)).filter((p) => !/timeout|end/i.test(p.type.text));
      expect(rows).toHaveLength(Math.min(40, plays.length));
      expect(rows[0]).toHaveTextContent(plays[plays.length - 1].text.replace(/^\(Shotgun\) /, '').slice(0, 20));
      expect(rows.some((r) => r.dataset.mine === 'b')).toBe(true);
    });
  });
});
