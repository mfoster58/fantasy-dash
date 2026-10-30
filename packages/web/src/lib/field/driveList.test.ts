import { describe, expect, it } from 'vitest';
import cleTen from '../../test/fixtures/espn/401873013.json';
import { parseSummary, type EspnGameFeed } from './espnGame';
import { driveList } from './driveList';
import { readPlays, type Starter } from './readPlays';

const SCORING = { rec: 1, rec_yd: 0.1, rec_td: 6, rush_yd: 0.1, rush_td: 6 };
const JUDKINS: Starter = { id: 'qj', firstName: 'Quinshon', lastName: 'Judkins', team: 'CLE', pos: 'RB' };
const full = parseSummary(cleTen)!;
/** the game partway: the first `n` drives, the last one still going with its first `k` plays */
function cut(n: number, k: number): EspnGameFeed {
  const drives = full.drives.slice(0, n).map((d, i) => (i === n - 1 ? { ...d, complete: false, result: null, playIds: d.playIds.slice(0, k) } : d));
  const ids = new Set(drives.flatMap((d) => d.playIds));
  return { ...full, state: 'in', drives, plays: full.plays.filter((p) => ids.has(p.id)) };
}
const list = (feed: EspnGameFeed) => driveList([feed], readPlays(feed, [JUDKINS], SCORING));

describe('driveList', () => {
  it('lists the drives a lineup\'s players were in, newest first, each with its quarter, snaps, yards, result and their points', () => {
    const drives = list(full);
    expect(drives.length).toBeGreaterThan(2);
    expect(drives.every((d, i) => i === 0 || d.time <= drives[i - 1].time)).toBe(true);
    expect(drives[drives.length - 1]).toMatchObject({ result: 'Interception', yards: 11 }); // Cleveland's opening drive
    const td = drives.find((d) => d.key === full.drives[3].id)!; // Cleveland's first touchdown drive, Judkins scoring from the 5
    expect(td).toMatchObject({ key: full.drives[3].id, team: 'CLE', period: 1, snaps: 6, yards: 73, result: 'Touchdown', live: false, spot: 0 });
    expect(td.pts).toBeCloseTo(readPlays(full, [JUDKINS], SCORING).filter((p) => p.driveId === td.key).reduce((n, p) => n + p.pts, 0));
  });

  it('counts a punted drive to the spot it was punted from', () => {
    const feed = cut(7, 1); // Cleveland's punt (the 6th drive) is done
    const punt = driveList([feed], readPlays(feed, [JUDKINS], SCORING)).find((d) => d.key === full.drives[5].id)!;
    expect(punt).toMatchObject({ result: 'Punt', snaps: 5, yards: 5, spot: 89 });
  });

  it('marks the drive still going as live, with no result, the ball where it is', () => {
    const feed = cut(4, 5); // Cleveland's touchdown drive, five plays in
    const [now] = list(feed);
    expect(now).toMatchObject({ key: full.drives[3].id, live: true, result: null });
    expect(now.spot).toBe(feed.plays[feed.plays.length - 1].end);
  });

  it('leaves out drives none of the lineup\'s players were in', () => {
    expect(list(full).every((d) => d.team === 'CLE')).toBe(true);
  });
});
