import { describe, expect, it } from 'vitest';
import cleTen from '../../test/fixtures/espn/401873013.json';
import { parseSummary, summaryUrl } from './espnGame';

describe('parseSummary', () => {
  const feed = parseSummary(cleTen)!;

  it('reads the game: its id, both teams in Sleeper codes and whether it is on', () => {
    expect(feed.eventId).toBe('401873013');
    expect(feed.home).toBe('TEN');
    expect(feed.away).toBe('CLE');
    expect(feed.state).toBe('post');
  });

  it('keeps every drive in order, with its offense, result and plays', () => {
    expect(feed.drives).toHaveLength(21);
    const [first, pick, , td] = feed.drives;
    expect(first.team).toBe('TEN');
    expect(pick).toMatchObject({ team: 'CLE', result: 'Interception', scored: false });
    expect(td).toMatchObject({ team: 'CLE', result: 'Touchdown', scored: true, complete: true });
    expect(td.playIds).toHaveLength(9);
  });

  it('reads each play: its offense, where it started and ended, when, and the text', () => {
    const p = feed.plays.find((x) => x.text.includes('K.Concepcion to TEN 20 for 32 yards'))!;
    expect(p.offense).toBe('CLE');
    expect(p.start).toBe(52);
    expect(p.end).toBe(20);
    expect(p.period).toBe(2);
    expect(p.time).toBe(Date.parse('2026-10-25T18:12:42Z'));
    expect(p.driveId).toBe(feed.drives.find((d) => d.playIds.includes(p.id))!.id);
  });

  it('marks the drive ESPN calls current as still going', () => {
    const json = structuredClone(cleTen) as { drives: { previous: unknown[]; current?: unknown } };
    json.drives.current = json.drives.previous.pop();
    const live = parseSummary(json)!;
    expect(live.drives).toHaveLength(21);
    expect(live.drives[20].complete).toBe(false);
    expect(live.drives[19].complete).toBe(true);
  });

  it('counts a drive only once when ESPN lists the current one among the finished too', () => {
    const json = structuredClone(cleTen) as { drives: { previous: { id: string }[]; current?: unknown } };
    json.drives.current = json.drives.previous[json.drives.previous.length - 1];
    const live = parseSummary(json)!;
    expect(live.drives).toHaveLength(21);
    expect(live.drives[20].complete).toBe(false);
    expect(new Set(live.plays.map((p) => p.id)).size).toBe(live.plays.length);
  });

  it('gives up on anything that is not a game summary', () => {
    expect(parseSummary(null)).toBeNull();
    expect(parseSummary({})).toBeNull();
    expect(parseSummary({ header: { id: '1', competitions: [] } })).toBeNull();
  });

  it('builds the summary address', () => {
    expect(summaryUrl('401873013')).toBe('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401873013');
  });
});
