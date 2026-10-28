import { fireEvent, render, screen, within } from '@testing-library/react';
import { gradeFixture } from '../../../test/gradeFixtures';
import GradesSection from './GradesSection';

/** this season with FTN, and last season (same numbers) without it */
function seasons() {
  const now = gradeFixture(true), last = gradeFixture(false);
  last.db.year = 2025;
  last.chart.year = 2025;
  return { dbs: [last.db, now.db], charts: [last.chart, now.chart] };
}
const region = () => screen.getByRole('region', { name: /Grades/ });
const tileOf = (key: string) => region().querySelector(`[data-tile="${key}"]`)!;

describe('GradesSection', () => {
  it('renders the summary, then nine cards of four tiles in one grid with no section headings', () => {
    const { dbs, charts } = seasons();
    render(<GradesSection id="wa" dbs={dbs} charts={charts} />);
    expect(within(region()).getByText('Best at')).toBeInTheDocument();
    expect(within(region()).getByText('Weakest at')).toBeInTheDocument();
    expect(within(region()).getAllByTestId('summary-row')).toHaveLength(8);
    expect(within(region()).queryAllByTestId('grade-group')).toHaveLength(0);
    const cards = within(region()).getAllByTestId('grade-card');
    expect(cards).toHaveLength(9);
    expect(new Set(cards.map((c) => c.parentElement)).size).toBe(1);
    for (const c of cards) expect(c.querySelectorAll('[data-tile]')).toHaveLength(4);
  });

  it('a style tile reads "pct · style"; a graded tile a plain percentile coloured by it', () => {
    const { dbs, charts } = seasons();
    render(<GradesSection id="wa" dbs={dbs} charts={charts} />);
    expect(tileOf('adot')).toHaveTextContent(/\d+(st|nd|rd|th) pct · style/);
    expect(tileOf('dropRate')).toHaveTextContent('100th pct');
    expect(tileOf('dropRate').getAttribute('data-pct')).toBe('100');
    // a progress bar filled to the percentile, not a dot on a track
    expect((tileOf('adot').querySelector('[data-testid="pct-fill"]') as HTMLElement).style.width).toMatch(/^\d+%$/);
    expect(tileOf('adot').querySelector('[data-testid="pct-dot"]')).toBeNull();
  });

  it('opens on the newest season and the picker switches seasons', () => {
    const { dbs, charts } = seasons();
    render(<GradesSection id="wa" dbs={dbs} charts={charts} />);
    expect(tileOf('dropRate')).toHaveTextContent('3%');
    fireEvent.change(within(region()).getByRole('combobox'), { target: { value: '2025' } });
    expect(tileOf('dropRate')).toHaveTextContent('no FTN data');
  });

  it('a player under the volume minimum shows "not ranked" tiles', () => {
    const { dbs, charts } = seasons();
    render(<GradesSection id="ws" dbs={dbs} charts={charts} />);
    expect(tileOf('tgtShare')).toHaveTextContent('not ranked');
  });

  it('grade cards show no question line', () => {
    const { dbs, charts } = seasons();
    render(<GradesSection id="wa" dbs={dbs} charts={charts} />);
    expect(screen.queryByText('What does a target to him earn?')).toBeNull();
  });
  it("the fantasy card uses the season's league scoring", () => {
    const { dbs, charts } = seasons();
    render(<GradesSection id="qa" dbs={dbs} charts={charts} scoringFor={() => ({ rush_yd: 0.2, rush_td: 4 })} />);
    expect(tileOf('rushShare')).toHaveTextContent('30%');
  });
  it('carries the FTN credit line', () => {
    const { dbs, charts } = seasons();
    render(<GradesSection id="wa" dbs={dbs} charts={charts} />);
    expect(region()).toHaveTextContent('Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse');
  });

  it('renders nothing for a player with no gsis id', () => {
    const { dbs, charts } = seasons();
    for (const d of dbs) d.players.wa = { ...d.players.wa, gsisId: null };
    const { container } = render(<GradesSection id="wa" dbs={dbs} charts={charts} />);
    expect(container).toBeEmptyDOMElement();
  });
});
