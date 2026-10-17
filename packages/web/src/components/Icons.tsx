import type { ReactElement, ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

/** shared shape data so an icon can stand alone (`<svg>`) or sit inside another chart (`<g>`) */
const SHAPES = {
  /** cup, handles, stem and base; the solid parts fill with the current colour */
  trophy: <><path d="M6 2h12v7a6 6 0 0 1-12 0z" fill="currentColor" /><path d="M6 4H4.5a2.5 2.5 0 0 0 0 5H6M18 4h1.5a2.5 2.5 0 0 1 0 5H18" /><path d="M10.5 14.7h3V18h-3z" fill="currentColor" /><path d="M7 22c0-2.2 1.3-4 4-4h2c2.7 0 4 1.8 4 4z" fill="currentColor" /></>,
  /** side view: tank at the back, seat and bowl forward, pedestal under; always white inside */
  toilet: <><path d="M4 2h5.5a1 1 0 0 1 1 1v9H3V3a1 1 0 0 1 1-1z" fill="#fff" /><path d="M3 12h18a1 1 0 0 1 1 1c0 3.5-3 5.5-6.5 5.5h-4C7.5 18.5 3 16 3 12z" fill="#fff" /><path d="M11 18.5 9.5 22h8L16 18.5z" fill="#fff" /></>,
  crown: <><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></>,
} satisfies Record<string, ReactNode>;

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Icon({ shape, title, className = '', width = '1em', height = '1em', ...rest }: IconProps & { shape: keyof typeof SHAPES }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} {...STROKE} className={`inline-block shrink-0 align-[-0.125em] ${className}`} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} {...rest}>
      {title && <title>{title}</title>}
      {SHAPES[shape]}
    </svg>
  );
}

/** Line icons drawn to match the UI's stroke weight; size follows the font size unless `width`/`height` say otherwise. */
export const TrophyIcon = (p: IconProps) => <Icon shape="trophy" {...p} />;
export const ToiletIcon = (p: IconProps) => <Icon shape="toilet" {...p} />;
export const CrownIcon = (p: IconProps) => <Icon shape="crown" {...p} />;

export type FinishKind = 'champion' | 'runnerUp' | 'third' | 'toilet';

const FINISH: Record<FinishKind, { shape: keyof typeof SHAPES; className: string; color: string; title: string }> = {
  champion: { shape: 'trophy', className: 'text-gold', color: 'var(--gold)', title: 'Champion' },
  runnerUp: { shape: 'trophy', className: 'text-silver', color: 'var(--silver)', title: 'Runner-up' },
  third: { shape: 'trophy', className: 'text-bronze', color: 'var(--bronze)', title: 'Third place' },
  toilet: { shape: 'toilet', className: 'text-ink', color: 'var(--ink)', title: 'Toilet bowl' },
};

/** Gold, silver and bronze trophies and the white toilet, a touch larger than the text around them. */
export function FinishIcon({ kind, className = '', size = '1.3em' }: { kind: FinishKind; className?: string; size?: string }) {
  const { shape, className: tone, title } = FINISH[kind];
  return <Icon shape={shape} title={title} width={size} height={size} className={`${tone} ${className}`} data-testid={`finish-${kind}`} />;
}

/** The same icon for use inside an existing `<svg>`: a `size`-wide group whose top-left corner sits at (x, y); `color` overrides the finish's own tone. */
export function FinishGlyph({ kind, x, y, size, color }: { kind: FinishKind; x: number; y: number; size: number; color?: string }): ReactElement {
  const { shape, color: tone, title } = FINISH[kind];
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(size / 24).toFixed(3)})`} style={{ color: color ?? tone }} {...STROKE} data-testid={`glyph-${kind}`}>
      <title>{title}</title>
      {SHAPES[shape]}
    </g>
  );
}
