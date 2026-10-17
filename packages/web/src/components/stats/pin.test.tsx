import { renderHook, act } from '@testing-library/react';
import { lineStroke, lineWidth, markAttrs, rowClass, usePinHover } from './pin';

describe('pin helpers', () => {
  it('the hovered manager overrides the pinned one until the pointer leaves', () => {
    const { result } = renderHook(() => usePinHover('a'));
    expect(result.current.active).toBe('a');
    act(() => result.current.hoverProps('b').onMouseEnter());
    expect(result.current.active).toBe('b');
    act(() => result.current.hoverProps('b').onMouseLeave());
    expect(result.current.active).toBe('a');
  });
  it('marks the active manager and dims the rest only when someone is active', () => {
    expect(markAttrs('a', 'a')).toEqual({ 'data-pinned': 'true' });
    expect(markAttrs('b', 'a')).toEqual({ 'data-dim': 'true' });
    expect(markAttrs('b', null)).toEqual({});
    expect(rowClass('a', 'a')).toBe('text-gold font-semibold');
    expect(rowClass('b', 'a')).toBe('opacity-40');
    expect(rowClass('b', null)).toBe('');
    expect([lineStroke('a', 'a'), lineStroke('b', 'a'), lineStroke('b', null)]).toEqual(['var(--gold)', 'var(--dim)', 'var(--dim)']);
    expect([lineWidth('a', 'a'), lineWidth('b', 'a')]).toEqual([3, 1.5]);
  });
});
