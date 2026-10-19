import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { currentInjury, gameStates, latestReportWeek } from './health';

describe('gameStates', () => {
  const db = statsDb(), ch = statsCharts();
  const st = gameStates(db, ch.injuries);
  const of = (id: string) => [1, 2, 3, 4, 5].map((w) => st.get(id)!.get(w));
  it('a steady player is healthy every week', () => {
    expect(of('wA')).toEqual(['healthy', 'healthy', 'healthy', 'healthy', 'healthy']);
  });
  it('a game under half his usual snap share with him on the next week\'s report is short; missed games are missed', () => {
    expect(of('rHurt')).toEqual(['healthy', 'short', 'missed', 'missed', 'healthy']);
  });
  it('a bye is a bye', () => {
    expect(of('rLast')[2]).toBe('bye');
  });
  it('the latest week under a third of his usual counts as short before the next report exists', () => {
    const early = { ...ch.injuries }; delete early['00-rOut']; delete early['00-wA'];   // no week-6 report yet
    expect(gameStates(db, early).get('rLast')!.get(5)).toBe('short');
    expect(of('rLast')[4]).toBe('healthy');   // the week-6 report is out and he is not on it
  });
  it('a real role cut (under half his usual, not on any report) stays healthy', () => {
    expect(of('rDown')).toEqual(['healthy', 'healthy', 'healthy', 'healthy', 'healthy']);
  });
  it('without an injury report, only the provisional latest-week rule can mark a game short', () => {
    const st2 = gameStates(db, undefined);
    expect(st2.get('rHurt')!.get(2)).toBe('healthy');
    expect(st2.get('rLast')!.get(5)).toBe('short');
  });
});

describe('injury report helpers', () => {
  it('the latest report week is the highest week listed', () => {
    expect(latestReportWeek(statsCharts().injuries)).toBe(6);
    expect(latestReportWeek(undefined)).toBe(0);
  });
  it('currentInjury is his Out or Doubtful status on the latest report, null otherwise', () => {
    const inj = statsCharts().injuries;
    expect(currentInjury('00-rOut', inj)).toEqual({ status: 'Out', injury: 'Groin' });
    expect(currentInjury('00-wA', inj)).toBeNull();      // Questionable
    expect(currentInjury('00-rHurt', inj)).toBeNull();   // listed weeks 3–4, not on the latest report
    expect(currentInjury(null, inj)).toBeNull();
  });
});
