import type { NflGame } from './espn';
import { inFallbackWindow, shouldPoll } from './schedule';

const at = (iso: string) => Date.parse(iso);
const g = (state: NflGame['state'], kickoff: string): NflGame => ({ teams: ['KC', 'BUF'], state, period: 0, clock: '15:00', kickoff, halftime: false });

describe('shouldPoll', () => {
  it('polls while any game is on', () => {
    expect(shouldPoll(at('2026-10-25T18:00Z'), [g('post', '2026-10-23T00:15Z'), g('in', '2026-10-25T17:00Z')])).toBe(true);
  });
  it('polls from 15 minutes before a kickoff, and keeps polling when a kickoff runs late', () => {
    expect(shouldPoll(at('2026-10-25T16:46Z'), [g('pre', '2026-10-25T17:00Z')])).toBe(true);
    expect(shouldPoll(at('2026-10-25T16:44Z'), [g('pre', '2026-10-25T17:00Z')])).toBe(false);
    expect(shouldPoll(at('2026-10-25T17:10Z'), [g('pre', '2026-10-25T17:00Z')])).toBe(true);
  });
  it('does not poll when every game is over or there are none', () => {
    expect(shouldPoll(at('2026-10-27T12:00Z'), [g('post', '2026-10-25T17:00Z')])).toBe(false);
    expect(shouldPoll(at('2026-10-27T12:00Z'), [])).toBe(false);
  });
  it('falls back to the game windows when ESPN could not be read', () => {
    expect(shouldPoll(at('2026-10-23T00:30Z'), null)).toBe(true);
    expect(shouldPoll(at('2026-10-21T18:00Z'), null)).toBe(false);
  });
});

describe('inFallbackWindow (Eastern time, either side of the clock change)', () => {
  it('covers Thursday and Monday nights from 8pm', () => {
    expect(inFallbackWindow(at('2026-10-23T00:30Z'))).toBe(true);  // Thu 8:30pm EDT
    expect(inFallbackWindow(at('2026-10-22T23:30Z'))).toBe(false); // Thu 7:30pm EDT
    expect(inFallbackWindow(at('2026-11-10T01:30Z'))).toBe(true);  // Mon 8:30pm EST
    expect(inFallbackWindow(at('2026-11-10T00:30Z'))).toBe(false); // Mon 7:30pm EST
  });
  it('covers Sundays from 9am', () => {
    expect(inFallbackWindow(at('2026-11-08T14:30Z'))).toBe(true);  // Sun 9:30am EST
    expect(inFallbackWindow(at('2026-11-08T13:30Z'))).toBe(false); // Sun 8:30am EST
    expect(inFallbackWindow(at('2026-10-25T13:30Z'))).toBe(true);  // Sun 9:30am EDT
  });
  it('covers December Saturdays from 1pm, but not other Saturdays', () => {
    expect(inFallbackWindow(at('2026-12-12T19:00Z'))).toBe(true);  // Sat 2pm EST
    expect(inFallbackWindow(at('2026-12-12T17:00Z'))).toBe(false); // Sat noon EST
    expect(inFallbackWindow(at('2026-11-14T19:00Z'))).toBe(false); // a November Saturday
  });
  it('is closed midweek', () => {
    expect(inFallbackWindow(at('2026-10-21T18:00Z'))).toBe(false); // Wednesday
  });
});
