import { describe, expect, it } from 'vitest';
import { espnScoreboardUrl, scoredThrough, weekFinished } from '../src/nflWeek';

const ev = (state: string, completed = state === 'post') => ({ status: { type: { state, completed } } });

describe('weekFinished', () => {
  it('is finished once every NFL game that week is final', () => {
    expect(weekFinished({ events: [ev('post'), ev('post')] })).toBe(true);
  });
  it('is not while any game is to play, on, or called off, or when the scoreboard is empty or unreadable', () => {
    expect(weekFinished({ events: [ev('post'), ev('in')] })).toBe(false);
    expect(weekFinished({ events: [ev('post'), ev('pre')] })).toBe(false);
    expect(weekFinished({ events: [ev('post'), ev('post', false)] })).toBe(false); // postponed
    expect(weekFinished({ events: [] })).toBe(false);
    expect(weekFinished(null)).toBe(false);
  });
});

describe('scoredThrough', () => {
  it('moves one week past Sleeper\'s last scored week once ESPN has every game of it final', async () => {
    expect(await scoredThrough(6, async (w) => w === 7)).toBe(7);
  });
  it('stays at Sleeper\'s week while the next is still being played, or when ESPN cannot be read', async () => {
    expect(await scoredThrough(6, async () => false)).toBe(6);
    expect(await scoredThrough(6, async () => { throw new Error('down'); })).toBe(6);
  });
});

describe('espnScoreboardUrl', () => {
  it('asks for a regular-season NFL week', () => {
    expect(espnScoreboardUrl(2026, 7)).toBe('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=7');
  });
});
