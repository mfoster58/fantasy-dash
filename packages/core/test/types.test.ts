import { describe, it, expect } from 'vitest';
import { h2hKey } from '../src/types';

describe('h2hKey', () => {
  it('orders ids so the key is symmetric', () => {
    expect(h2hKey('b', 'a')).toBe('a|b');
    expect(h2hKey('a', 'b')).toBe('a|b');
  });
});
