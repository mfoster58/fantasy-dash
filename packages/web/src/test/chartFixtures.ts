import type { ChartDb } from '@fantasy-dash/core';

/** 2025 charts for the miniDb players (gsis `00-<id>`) plus peers. Numbers chosen so percentiles are easy to read. */
export function miniCharts(year = 2025): ChartDb {
  return {
    year, builtAt: '2026-01-01T00:00:00.000Z', participation: true, injuries: {},
    players: {
      '00-w1': { pos: 'WR', routes: {
        all: { GO: [30, 15, 450, 9, 3], 'IN/DIG': [15, 12, 180, 4.5, 1], SLANT: [5, 4, 30, 0.5, 0] },
        man: { GO: [10, 4, 120, 1, 1], 'IN/DIG': [3, 2, 20, 0.2, 0] },
        zone: { GO: [20, 11, 330, 8, 2], 'IN/DIG': [15, 12, 180, 4.5, 1], SLANT: [5, 4, 30, 0.5, 0] } } },
      '00-w2': { pos: 'WR', routes: {
        all: { GO: [20, 6, 160, -2, 0], 'IN/DIG': [40, 30, 400, 8, 2] },
        man: { GO: [20, 6, 160, -2, 0], 'IN/DIG': [10, 7, 90, 1, 0] },
        zone: { 'IN/DIG': [30, 23, 310, 7, 2] } } },
      '00-x3': { pos: 'WR', routes: { all: { GO: [10, 7, 240, 6, 2] }, man: {}, zone: { GO: [10, 7, 240, 6, 2] } } },
      '00-t1': { pos: 'TE', routes: { all: { GO: [6, 2, 40, -1, 0], 'IN/DIG': [4, 3, 30, 0.4, 0] }, man: {}, zone: { GO: [6, 2, 40, -1, 0], 'IN/DIG': [4, 3, 30, 0.4, 0] } } },
      '00-r1': { pos: 'RB',
        routes: { all: { SWING: [12, 10, 60, 1, 0] }, man: {}, zone: { SWING: [12, 10, 60, 1, 0] } },
        lanes: { all: { LT: [60, 300, 3, 30, 2], MID: [9, 30, -1, 3, 0], RE: [41, 160, -2, 15, 1] }, light: { LT: [40, 230, 4, 22, 2] }, heavy: { LT: [20, 70, -1, 8, 0], MID: [9, 30, -1, 3, 0] } } },
      '00-r2': { pos: 'RB', lanes: { all: { LT: [30, 90, -2, 10, 0], RE: [80, 400, 4, 40, 3] }, light: {}, heavy: {} } },
      '00-q1': { pos: 'QB',
        zones: { all: { 'short|right': [80, 64, 600, 12, 5, 1, 40, 80], 'deep|left': [8, 2, 90, -1, 1, 1, -10, 8], 'mid|middle': [70, 40, 700, 9, 4, 2, 0, 70] }, clean: { 'short|right': [60, 50, 480, 10, 4, 0, 30, 60] }, pressured: { 'short|right': [20, 14, 120, 2, 1, 1, 10, 20] } },
        splits: { all: [170, 158, 106, 1390, 18, 12], pressured: [40, 30, 16, 200, -9, 10], clean: [130, 128, 90, 1190, 27, 2], man: [60, 56, 36, 500, 4, 4], zone: [110, 102, 70, 890, 14, 8], COVER_0: [12, 11, 5, 60, -2, 1] } },
      '00-q2': { pos: 'QB',
        zones: { all: { 'short|right': [90, 60, 500, 4, 2, 2, -20, 90], 'mid|middle': [70, 30, 450, 2, 2, 3, -50, 70] }, clean: {}, pressured: {} },
        splits: { all: [170, 165, 100, 1100, 2, 5], pressured: [50, 48, 20, 300, -12, 2], clean: [120, 117, 80, 800, 14, 3], man: [70, 68, 40, 450, 1, 2], zone: [100, 97, 60, 650, 1, 3] } },
    },
  };
}
