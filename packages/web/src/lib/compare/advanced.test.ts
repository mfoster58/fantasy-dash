import type { GradedCard, GradedTile } from '../grades/grade';
import { advancedRows, bucketsFor } from './advanced';

const t = (key: string, pct: number | null, extra: Partial<GradedTile> = {}): GradedTile =>
  ({ key, label: key, text: String(pct), detail: '', pct, style: false, status: pct === null ? 'small' : 'ranked', ...extra });
const card = (key: string, title: string, group: GradedCard['group'], tiles: GradedTile[]): GradedCard => ({ key, title, group, tiles });
/** two players: A leads usage and efficiency a, B leads efficiency b; style and unranked rows never lead */
const A = [card('usage', 'Usage', 'Opportunity', [t('share', 90), t('adot', 80, { style: true })]), card('eff', 'Efficiency', 'Production', [t('a', 70), t('b', 20), t('c', null)])];
const B = [card('usage', 'Usage', 'Opportunity', [t('share', 40), t('adot', 95, { style: true })]), card('eff', 'Efficiency', 'Production', [t('a', 10), t('b', 60), t('c', 50)])];

describe('advancedRows', () => {
  it('rows follow card order and the bucket', () => {
    expect(advancedRows([A, B], 'All').rows.map((r) => r.key)).toEqual(['share', 'adot', 'a', 'b', 'c']);
    expect(advancedRows([A, B], 'Production').rows.map((r) => r.key)).toEqual(['a', 'b', 'c']);
    expect(advancedRows([A, B], 'Usage').rows.map((r) => r.card)).toEqual(['Usage', 'Usage']);
  });
  it('style rows never lead', () => {
    expect(advancedRows([A, B], 'All').rows.find((r) => r.key === 'adot')!.lead).toEqual([false, false]);
  });
  it('unranked cells are ignored for the lead', () => {
    expect(advancedRows([A, B], 'All').rows.find((r) => r.key === 'c')!.lead).toEqual([false, false]);
  });
  it('leads and contested count the visible rows only', () => {
    expect(advancedRows([A, B], 'All')).toMatchObject({ leads: [2, 1], contested: 3 });
    expect(advancedRows([A, B], 'Opportunity')).toMatchObject({ leads: [1, 0], contested: 1 });
  });
  it('a missing card set gives empty cells and never leads', () => {
    const r = advancedRows([A, null], 'All');
    expect(r.rows[0].cells[1]).toBeNull();
    expect(r.contested).toBe(0);
  });
});

describe('bucketsFor', () => {
  it('lists All, the groups present, then the card titles', () => {
    expect(bucketsFor(A)).toEqual(['All', 'Opportunity', 'Production', 'Usage', 'Efficiency']);
  });
});
