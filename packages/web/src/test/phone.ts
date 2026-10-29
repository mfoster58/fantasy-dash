/** Makes matchMedia report a phone-width screen until the returned function restores it. */
export function asPhone(): () => void {
  const was = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: q.includes('max-width: 639px'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  return () => { window.matchMedia = was; };
}
