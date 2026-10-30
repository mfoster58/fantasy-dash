import { describe, expect, it } from 'vitest';
import cleTen from '../../test/fixtures/espn/401873013.json';
import { parseSummary } from './espnGame';
import { liveDrives } from './drives';
import { busiestMoments, feedAt, replaySpan } from './replay';

const full = parseSummary(cleTen)!;
const timed = full.plays.filter((p) => p.time !== null);
const first = Math.min(...timed.map((p) => p.time!)), last = Math.max(...timed.map((p) => p.time!));

describe('feedAt', () => {
  it('has nothing before the first snap', () => {
    expect(feedAt(full, first - 1)).toBeNull();
  });

  it('shows a game partway as ESPN would have: on, only the plays so far, the latest drive still going', () => {
    const t = full.plays.find((p) => p.text.includes('K.Concepcion to TEN 20 for 32 yards'))!.time!;
    const at = feedAt(full, t)!;
    expect(at.state).toBe('in');
    expect(at.plays.every((p) => p.time! <= t)).toBe(true);
    expect(at.plays[at.plays.length - 1].time).toBe(t);
    const going = at.drives[at.drives.length - 1];
    expect(going).toMatchObject({ complete: false, result: null });
    expect(going.playIds).toContain(at.plays[at.plays.length - 1].id);
    expect(at.drives.slice(0, -1).every((d) => d.complete)).toBe(true);
  });

  it('is the whole game, over, once the last snap is in', () => {
    const at = feedAt(full, last)!;
    expect(at.state).toBe('post');
    expect(at.drives).toEqual(full.drives);
  });

  it('finds the busiest moment of each window of games: the most drives on at once for these teams, red zone counting extra', () => {
    const moments = busiestMoments([full], [new Set(['CLE']), new Set(['TEN'])]);
    expect(moments).toHaveLength(1);
    const t = moments[0];
    expect(t).toBeGreaterThanOrEqual(first);
    expect(t).toBeLessThanOrEqual(last);
    expect(liveDrives([feedAt(full, t)!], new Set(['CLE', 'TEN']))).toHaveLength(1);
    expect(busiestMoments([], [new Set(), new Set()])).toEqual([]);
  });

  it('spans the replay from just before the first snap of any game to the last', () => {
    expect(replaySpan([full])).toEqual([first - 60_000, last]);
    expect(replaySpan([])).toBeNull();
  });
});
