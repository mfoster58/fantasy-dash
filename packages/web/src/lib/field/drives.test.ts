import { describe, expect, it } from 'vitest';
import cleTen from '../../test/fixtures/espn/401873013.json';
import { parseSummary, type EspnGameFeed } from './espnGame';
import { liveDrives } from './drives';

/** the Browns-Titans game cut off after `n` drives, the last one still going when `going`, with only its first `k` plays */
function cut(n: number, going: boolean, k?: number): EspnGameFeed {
  const full = parseSummary(cleTen)!;
  const drives = full.drives.slice(0, n).map((d, i) => (going && i === n - 1 ? { ...d, complete: false, result: null, playIds: d.playIds.slice(0, k) } : d));
  const ids = new Set(drives.flatMap((d) => d.playIds));
  return { ...full, state: 'in', drives, plays: full.plays.filter((p) => ids.has(p.id)) };
}
const lastPlay = (f: EspnGameFeed) => f.plays[f.plays.length - 1];

describe('liveDrives', () => {
  it('shows the drive going on for a team with a starter: where its first snap was, where the ball is and the down', () => {
    const feed = cut(5, true, 3); // Tennessee's 5th drive: the kickoff and two runs
    const [d] = liveDrives([feed], new Set(['TEN']));
    const firstSnap = feed.plays.find((p) => p.driveId === d.key && p.type !== 'Kickoff')!;
    expect(d).toMatchObject({ eventId: '401873013', team: 'TEN', from: firstSnap.start, spot: lastPlay(feed).end, down: lastPlay(feed).down, result: null });
    expect(d.key).toBe(feed.drives[4].id);
  });

  it('shows nothing for a drive by a team without a starter', () => {
    expect(liveDrives([cut(5, true, 3)], new Set(['CLE']))).toEqual([]);
  });

  it('keeps a touchdown drive up, scored and in the end zone, until the other team\'s first snap', () => {
    const scored = cut(4, false); // Cleveland's touchdown drive, just finished
    expect(liveDrives([scored], new Set(['CLE']))).toMatchObject([{ team: 'CLE', result: 'Touchdown', spot: 0, down: null }]);
    // Tennessee's drive has begun with the kickoff, but not a snap: the touchdown stays
    expect(liveDrives([cut(5, true, 1)], new Set(['CLE']))).toMatchObject([{ team: 'CLE', result: 'Touchdown' }]);
    // Tennessee's first snap: Cleveland's drive leaves the field
    expect(liveDrives([cut(5, true, 2)], new Set(['CLE']))).toEqual([]);
  });

  it('keeps a punted drive up too, marked as a punt, until the other team\'s first snap', () => {
    const punted = cut(5, true); // the punt is in, and ESPN still calls the drive current
    expect(liveDrives([punted], new Set(['TEN']))).toMatchObject([{ team: 'TEN', result: 'Punt', down: null }]);
    expect(liveDrives([cut(5, false)], new Set(['TEN']))).toMatchObject([{ team: 'TEN', result: 'Punt' }]);
    expect(liveDrives([cut(6, true, 1)], new Set(['TEN']))).toEqual([]);
  });

  it('shows nothing for a game that is over', () => {
    expect(liveDrives([{ ...cut(5, true, 3), state: 'post' }], new Set(['TEN']))).toEqual([]);
  });
});
