import { describe, it, expect } from 'vitest';
import { SeasonSchema, HistorySchema, PlayerDirectorySchema } from '../src/schema';
import { buildSeason } from '../src/season';
import { buildHistory } from '../src/history';
import { miniInput } from './fixtures/mini';

describe('output schemas', () => {
  const input = miniInput();
  const season = buildSeason(input);

  it('accept real builder output', () => {
    expect(() => SeasonSchema.parse(season)).not.toThrow();
    expect(() => HistorySchema.parse(buildHistory([season]))).not.toThrow();
    expect(() => PlayerDirectorySchema.parse(input.players)).not.toThrow();
  });

  it('reject malformed data', () => {
    expect(() => SeasonSchema.parse({})).toThrow();
    expect(() => SeasonSchema.parse({ ...season, standings: [{ userId: 1 }] })).toThrow();
    expect(() => HistorySchema.parse({ seasons: 'nope' })).toThrow();
    expect(() => PlayerDirectorySchema.parse({ x: { id: 'x' } })).toThrow();
  });
});
