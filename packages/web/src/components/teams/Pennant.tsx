import { useId } from 'react';
import { FinishGlyph } from '../Icons';

/**
 * A championship pennant that hangs from the top of a profile card: a tall V-pointed banner in the
 * site's own gold language, the faint gold tint of a record row with a gold outline rather than a
 * solid block, CHAMPION as a muted eyebrow label, the year large in gold, a gold trophy by the point.
 */
export default function Pennant({ year, className = '' }: { year: number; className?: string }) {
  const id = useId();
  const grad = `pennant-fill-${id}`;
  const outline = 'color-mix(in srgb, var(--gold) 55%, transparent)';
  return (
    <svg role="img" aria-label={`Champion ${year}`} viewBox="0 0 76 128" className={`h-24 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)] sm:h-32 ${className}`}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--gold) 10%, var(--surface))' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--gold) 22%, var(--surface))' }} />
        </linearGradient>
      </defs>
      <path d="M1 0.5h74v93.5L38 127 1 94z" fill={`url(#${grad})`} stroke={outline} strokeWidth="1" strokeLinejoin="round" />
      {/* a short gold hairline where the banner meets the card's top border, so it still reads as hung from the edge */}
      <path d="M1 0.5h74" stroke="var(--gold)" strokeWidth="1.5" />
      {/* the word is fitted to a fixed run so it stays centred whatever font loads; weights are ones the stylesheet ships */}
      <text x="38" y="38" textAnchor="middle" textLength="56" lengthAdjust="spacing" fill="var(--muted)" fontSize="9.5" fontWeight="600" fontFamily="var(--font-sans)">CHAMPION</text>
      <text x="38" y="73" textAnchor="middle" fill="var(--gold)" fontSize="24" fontWeight="500" fontFamily="var(--font-mono)">{year}</text>
      <FinishGlyph kind="champion" x={29} y={82} size={18} color="var(--gold)" />
    </svg>
  );
}
