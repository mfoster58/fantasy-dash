import { render, screen, within } from '@testing-library/react';
import type { TimelineStop } from '../../lib/careerTimeline';
import { players } from '../../test/playerFixtures';
import CareerTimeline from './CareerTimeline';

const stop = (year: number, extra: Partial<TimelineStop> = {}): TimelineStop => ({
  year, live: false, teamName: 'Alpha', w: 9, l: 5, t: 0, rank: 4, pf: 1900.4, finish: null, pointsTitle: false, top: { playerId: 'q1', position: 'QB', points: 350.4 }, ...extra,
});

describe('CareerTimeline', () => {
  it('one stop per season, with the site finish icons, captions and season cards', () => {
    render(<CareerTimeline players={players} stops={[stop(2023, { finish: 'champion', pointsTitle: true }), stop(2024, { finish: 'runnerUp' }), stop(2025, { finish: 'third' }), stop(2026, { finish: 'toilet' })]} />);
    const stops = screen.getAllByTestId('timeline-stop');
    expect(stops).toHaveLength(4);
    expect(within(stops[0]).getByTestId('finish-champion')).toBeInTheDocument();
    expect(stops[0]).toHaveTextContent('Champion');
    expect(within(stops[1]).getByTestId('finish-runnerUp')).toBeInTheDocument();
    expect(within(stops[2]).getByTestId('finish-third')).toBeInTheDocument();
    expect(within(stops[3]).getByTestId('finish-toilet')).toBeInTheDocument();
    expect(stops[3]).toHaveTextContent('Last place');
    expect(stops[0]).toHaveTextContent('Points title');
    expect(stops[0]).toHaveTextContent('9–5');
    expect(stops[0]).toHaveTextContent('1,900');
    expect(stops[0]).toHaveTextContent('Quincy One');
    expect(stops[0]).toHaveTextContent('QB · 350 pts started');
  });
  it('off the podium shows the regular-season finish; the live season says so far', () => {
    render(<CareerTimeline players={players} stops={[stop(2025, { rank: 8 }), stop(2026, { live: true, rank: 1 })]} />);
    const [done, live] = screen.getAllByTestId('timeline-stop');
    expect(done).toHaveTextContent('8th');
    expect(done).toHaveTextContent('Regular season');
    expect(live).toHaveTextContent('So far');
    expect(live).toHaveTextContent('in progress');
  });
});
