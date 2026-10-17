import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../src/playerdb/csv';

const rows = (t: string) => [...parseCsv(t)];

describe('parseCsv', () => {
  it('maps every data line onto the header', () => {
    expect(rows('a,b\n1,2\n3,4\n')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
  it('handles quoted commas, doubled quotes and embedded newlines', () => {
    expect(rows('name,note\n"Smith, Jr.","said ""hi""\nthere"\n')).toEqual([{ name: 'Smith, Jr.', note: 'said "hi"\nthere' }]);
  });
  it('accepts CRLF, a BOM, a missing final newline and skips blank lines', () => {
    expect(rows('﻿a,b\r\n1,2\r\n\r\n3,4')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });
  it('pads short lines with empty strings', () => {
    expect(rows('a,b,c\n1,2\n')).toEqual([{ a: '1', b: '2', c: '' }]);
  });
  it('closes a quoted field that ends the input without a newline', () => {
    expect(rows('a,b\n1,"x"')).toEqual([{ a: '1', b: 'x' }]);
    expect(rows('a,b\n1,""')).toEqual([{ a: '1', b: '' }]);
    expect(rows('a,b\n1,"unterminated')).toEqual([{ a: '1', b: 'unterminated' }]);
  });
});
