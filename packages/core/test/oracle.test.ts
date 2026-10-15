import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSeason, type RawSeasonInput } from '../src/season';

const ORACLE = {
  2025: { champion: 'mattygggg', runnerUp: 'ErikOdd', third: 'faraz525', lastPlace: 'vishwakn' },
  2024: { champion: 'CurryLover53', runnerUp: 'mattygggg', third: 'azhangatang', lastPlace: 'vishwakn' },
  2023: { champion: 'BigBufoon', runnerUp: 'vishwakn', third: 'ErikOdd', lastPlace: 'CurryLover53' },
} as const;

function load(year: number): RawSeasonInput {
  const file = path.join(__dirname, 'fixtures', `playoffs-${year}.json`);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return { ...raw, projections: {}, stats: {}, players: {}, playerSeasonPoints: {}, playerGames: {}, teamGames: {}, transactions: [], draft: null };
}

describe('bracket oracle (real seasons)', () => {
  for (const [year, expected] of Object.entries(ORACLE)) {
    it(`resolves ${year} honors`, () => {
      const season = buildSeason(load(Number(year)));
      const name = (id: string | null) => (id ? season.managers[id].displayName : null);
      expect({
        champion: name(season.honors.champion),
        runnerUp: name(season.honors.runnerUp),
        third: name(season.honors.third),
        lastPlace: name(season.honors.lastPlace),
      }).toEqual(expected);
    });

    it(`tags ${year} playoff games`, () => {
      const season = buildSeason(load(Number(year)));
      const tags = season.weeks.slice(season.playoffWeekStart - 1).flatMap((w) => w.games.map((g) => g.tag));
      expect(tags.filter((t) => t === 'Final')).toHaveLength(1);
      expect(tags.filter((t) => t === 'Toilet Bowl')).toHaveLength(1);
      expect(tags.filter((t) => t === 'QF')).toHaveLength(2);
      expect(tags).not.toContain(null);
      const bracketGames = [...season.brackets.winners, ...season.brackets.consolation];
      expect(bracketGames.every((g) => g.gameId !== null)).toBe(true);
    });
  }
});
