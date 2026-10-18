import '@testing-library/jest-dom/vitest';

// Node 25+ ships a global `localStorage` that is undefined without --localstorage-file and hides jsdom's; fall back to an in-memory one.
{
  const data = new Map<string, string>();
  const storage = {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  } as Storage;
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

// jsdom has no PointerEvent, so fireEvent.pointer* would drop `pointerType`; a MouseEvent carrying it is enough for our handlers.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? ''; }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventShim, configurable: true });
}
