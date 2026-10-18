import { columnTints, percentiles, tintFor } from './percentile';
import { aggregate } from './aggregate';
import { COLUMNS } from './columns';
import { miniDb } from '../../test/playerDbFixtures';
import { VALUE_SATURATION, valueColor } from '../draft';

describe('percentiles', () => {
  it('ranks from 0 to 1, averaging ties and skipping nulls', () => {
    expect(percentiles([10, 30, 20, null])).toEqual([0, 1, 0.5, null]);
    expect(percentiles([5, 5, 1])).toEqual([0.75, 0.75, 0]);
    expect(percentiles([7])).toEqual([0.5]);
    expect(percentiles([])).toEqual([]);
  });
});

describe('tintFor', () => {
  it('uses the draft board red-yellow-green scale: yellow at the midpoint, green above, red below, reversed for lower-is-better', () => {
    expect(tintFor(null)).toBe('transparent');
    expect(tintFor(0.5)).toBe(valueColor(0));
    expect(tintFor(1)).toBe(valueColor(VALUE_SATURATION));
    expect(tintFor(0)).toBe(valueColor(-VALUE_SATURATION));
    expect(tintFor(0.75)).toBe(valueColor(VALUE_SATURATION / 2));
    expect(tintFor(1, true)).toBe(valueColor(-VALUE_SATURATION));
    expect(tintFor(1)).toContain('#2f9e5f');
    expect(tintFor(0)).toContain('#d64545');
    expect(tintFor(0.5)).toContain('#e6c229');
  });
});

describe('columnTints', () => {
  const aggs = aggregate(miniDb(), 1, 3);
  const at = (key: string) => { const t = columnTints(COLUMNS[key], aggs, 'total'); return (id: string) => t[aggs.findIndex((a) => a.id === id)]; };
  const green = (s: number) => valueColor(s * VALUE_SATURATION);

  it('colours any rushing or receiving TD green, deeper per game, and leaves none untinted', () => {
    const re = at('reTd');
    expect(re('w1')).toBe(green(0.8 + 0.2 * (2 / 3)));   // 2 TD in 3 games
    expect(re('t1')).toBe(green(0.8 + 0.2 * (1 / 3)));   // 1 TD in 3 games: still green
    expect(re('w2')).toBe(valueColor(-VALUE_SATURATION)); // targets but no TD: a zero, full red
    expect(at('ruTd')('r1')).toBe(green(1));            // a TD a game or better is full green
  });
  it('puts passing TDs on a per-game scale: 0 red, 1 yellow, 2 green, 3+ full green, only for real passers', () => {
    expect(at('paTd')('q1')).toBe(valueColor(0.8 * (5 / 3 - 1) * VALUE_SATURATION)); // 5 TD in 3 games
    expect(at('paTd')('w1')).toBe('transparent');                                     // never threw
  });
  it('paints a zero full red when the player had the chance, and leaves it alone when he did not', () => {
    expect(at('cmp')('w1')).toBe('transparent');          // never threw: his 0 completions say nothing
    expect(at('ruTd')('w2')).toBe('transparent');         // never carried
    expect(at('paTd')('w1')).toBe('transparent');         // not a real passer
    // a signed column sits at the middle of its scale at 0, it is not a bad zero
    const flat = { ...COLUMNS.projPlus, value: () => 0 };
    expect(columnTints(flat, aggs, 'total').some((t) => t === valueColor(-VALUE_SATURATION))).toBe(false);

    expect(at('cmp')('q1')).not.toBe('transparent');
    const fum = at('fum');
    expect(fum('w1')).not.toBe('transparent');           // touches but no fumbles: a good zero
    expect(at('int')('r1')).toBe('transparent');         // never a real passer: his 0 INT says nothing
  });
});
