import { describe, expect, it } from 'vitest';
import cleTen from '../../test/fixtures/espn/401873013.json';
import { parseSummary, type EspnGameFeed } from './espnGame';
import { liveDrives, SCORE_HOLD_MS } from './drives';

/** the Browns-Titans game cut off after `n` drives, the last one still going when `going` */
function cut(n: number, going: boolean): EspnGameFeed {
  const full = parseSummary(cleTen)!;
  const drives = full.drives.slice(0, n).map((d, i) => (going && i === n - 1 ? { ...d, complete: false, result: null } : d));
  const ids = new Set(drives.flatMap((d) => d.playIds));
  return { ...full, state: 'in', drives, plays: full.plays.filter((p) => ids.has(p.id)) };
}
const lastPlay = (f: EspnGameFeed) => f.plays[f.plays.length - 1];

describe('liveDrives', () => {
  it('shows the drive going on for a team with a starter: where it began, where the ball is and the down', () => {
    const feed = cut(5, true); // Tennessee's punt drive, still going
    const [d] = liveDrives([feed], new Set(['TEN']), lastPlay(feed).time!);
    expect(d).toMatchObject({ eventId: '401873013', team: 'TEN', from: feed.drives[4].from, spot: lastPlay(feed).end, down: lastPlay(feed).down, result: null });
    expect(d.key).toBe(feed.drives[4].id);
  });

  it('shows nothing for a drive by a team without a starter', () => {
    const feed = cut(5, true);
    expect(liveDrives([feed], new Set(['CLE']), lastPlay(feed).time!)).toEqual([]);
  });

  it('clears a drive as soon as it is over, so its lines never linger after a punt', () => {
    const feed = cut(5, false);
    expect(feed.drives[4].result).toBe('Punt');
    expect(liveDrives([feed], new Set(['TEN']), lastPlay(feed).time! + 1000)).toEqual([]);
  });

  it('holds a scoring drive a few seconds so the touchdown can be seen, then clears it', () => {
    const feed = cut(4, false); // Cleveland's touchdown drive, just finished
    const t = lastPlay(feed).time!;
    expect(liveDrives([feed], new Set(['CLE']), t + 5000)).toMatchObject([{ team: 'CLE', result: 'Touchdown', spot: 0 }]);
    expect(liveDrives([feed], new Set(['CLE']), t + SCORE_HOLD_MS + 1000)).toEqual([]);
  });

  it('shows nothing for a game that is over', () => {
    const feed = { ...cut(5, true), state: 'post' as const };
    expect(liveDrives([feed], new Set(['TEN']), lastPlay(feed).time!)).toEqual([]);
  });
});
