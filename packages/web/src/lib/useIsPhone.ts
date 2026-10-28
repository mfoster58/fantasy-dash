import { useEffect, useState } from 'react';

/** the phone breakpoint: below Tailwind's sm */
export const PHONE_QUERY = '(max-width: 639px)';

/** True on a phone-width screen; false where matchMedia is unavailable (tests, SSR). */
export function useIsPhone(): boolean {
  const query = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
  const [phone, setPhone] = useState(query);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return phone;
}
