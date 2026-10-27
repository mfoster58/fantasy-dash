import { render, screen } from '@testing-library/react';
import type { NextGame, PlayerSummary } from '../../lib/compare/summary';
import CompareCard from './CompareCard';

const summary = (extra: Partial<PlayerSummary> = {}): PlayerSummary => ({
  games: 5, total: 74, avg: 14.8, floor: 8, ceil: 20, cv: 0.4, bins: [1, 1, 1, 0, 1, 0, 1, 0, 0, 0], team: 'ATL',
  last5: [{ week: 5, opp: 'NO', home: false, pts: 31 }, { week: 4, opp: 'CAR', home: true, pts: 3 }], ...extra,
});
const next: NextGame[] = [{ week: 6, opp: 'TB', home: false, tone: 'hard', rank: 30, of: 32 }, { week: 7, opp: null, home: false, tone: null, rank: null, of: null }];
const noLead = { floor: false, avg: false, ceil: false, cv: false };

describe('CompareCard', () => {
  it('floor, average and ceiling leaders get the gold box and ▲', () => {
    render(<CompareCard index={0} name="Bijan Robinson" pos="RB" summary={summary()} next={next} lead={{ ...noLead, avg: true, cv: true }} />);
    const avg = screen.getByTestId('stat-avg');
    expect(avg).toHaveAttribute('data-lead', 'true');
    expect(avg).toHaveTextContent('14.8▲');
    expect(screen.getByTestId('stat-floor')).toHaveAttribute('data-lead', 'false');
    expect(screen.getByText(/steadiest/)).toBeInTheDocument();
  });
  it('last five shows @ for away games; next five shows byes and the defence rank', () => {
    render(<CompareCard index={0} name="X" pos="RB" summary={summary()} next={next} lead={noLead} />);
    expect(screen.getByText('@NO')).toBeInTheDocument();
    expect(screen.getByText('BYE')).toBeInTheDocument();
    expect(screen.getByTitle('#30 of 32 in points allowed to RBs')).toHaveTextContent('@TB');
  });
  it('next five is hidden when the season is finished', () => {
    render(<CompareCard index={0} name="X" pos="RB" summary={summary()} next={null} lead={noLead} />);
    expect(screen.queryByText(/Next 5/)).toBeNull();
  });
  it('a player with no games shows dashes, not NaN', () => {
    render(<CompareCard index={1} name="X" pos="RB" summary={summary({ games: 0, total: 0, avg: null, floor: null, ceil: null, cv: null, bins: Array(10).fill(0), last5: [] })} next={null} lead={noLead} />);
    expect(screen.getByTestId('stat-floor')).toHaveTextContent('—');
    expect(screen.getByTestId('stat-avg')).toHaveTextContent('—');
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
});
