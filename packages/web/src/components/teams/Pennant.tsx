import { useId } from 'react';
import { FinishGlyph } from '../Icons';

/**
 * A championship pennant that hangs from the top of a profile card: tall gold banner, V-point,
 * two grommets, CHAMPION tracked small near the top, the year large under it, a trophy by the point.
 * Gold comes from the theme token so it reads in both themes.
 */
export default function Pennant({ year, className = '' }: { year: number; className?: string }) {
  const id = useId();
  const grad = `pennant-fill-${id}`;
  const dark = 'color-mix(in srgb, var(--gold) 35%, black)';
  return (
    <svg role="img" aria-label={`Champion ${year}`} viewBox="0 0 76 128" className={`h-24 w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] sm:h-32 ${className}`}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--gold) 70%, white)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--gold)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--gold) 72%, black)' }} />
        </linearGradient>
      </defs>
      <path d="M1 0h74v94L38 127 1 94z" fill={`url(#${grad})`} />
      <path d="M6 5h64v86L38 119 6 91z" fill="none" stroke={dark} strokeWidth="1.5" strokeOpacity="0.55" />
      <circle cx="14" cy="8" r="3" fill="var(--bg)" stroke={dark} strokeWidth="1.5" />
      <circle cx="62" cy="8" r="3" fill="var(--bg)" stroke={dark} strokeWidth="1.5" />
      {/* the word is fitted to a fixed run between the inset borders, so it stays centred whatever font loads; weights are ones the stylesheet ships */}
      <text x="38" y="38" textAnchor="middle" textLength="56" lengthAdjust="spacing" fill={dark} fontSize="9.5" fontWeight="600" fontFamily="var(--font-sans)">CHAMPION</text>
      <text x="38" y="73" textAnchor="middle" fill={dark} fontSize="24" fontWeight="500" fontFamily="var(--font-mono)">{year}</text>
      <FinishGlyph kind="champion" x={29} y={82} size={18} color={dark} />
    </svg>
  );
}
