import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * The pixel width of a container, so an SVG chart can size its viewBox to it and keep its text at a real
 * 10px whatever the card width. Falls back to `fallback` where ResizeObserver is missing (jsdom).
 */
export function useWidth<T extends HTMLElement>(fallback = 640): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => { const w = Math.round(entries[0]?.contentRect.width ?? 0); if (w > 0) setWidth(Math.max(320, w)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
