import { useId, type ReactElement, type ReactNode, type SVGProps } from 'react';
import type { MoveKind } from '../lib/player/journey';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

/** shared shape data so an icon can stand alone (`<svg>`) or sit inside another chart (`<g>`) */
const SHAPES = {
  /** cup, handles, stem and base; the solid parts fill with the current colour */
  trophy: <><path d="M6 2h12v7a6 6 0 0 1-12 0z" fill="currentColor" /><path d="M6 4H4.5a2.5 2.5 0 0 0 0 5H6M18 4h1.5a2.5 2.5 0 0 1 0 5H18" /><path d="M10.5 14.7h3V18h-3z" fill="currentColor" /><path d="M7 22c0-2.2 1.3-4 4-4h2c2.7 0 4 1.8 4 4z" fill="currentColor" /></>,
  /** side view: tank at the back, seat and bowl forward, pedestal under; always white inside */
  toilet: <><path d="M4 2h5.5a1 1 0 0 1 1 1v9H3V3a1 1 0 0 1 1-1z" fill="#fff" /><path d="M3 12h18a1 1 0 0 1 1 1c0 3.5-3 5.5-6.5 5.5h-4C7.5 18.5 3 16 3 12z" fill="#fff" /><path d="M11 18.5 9.5 22h8L16 18.5z" fill="#fff" /></>,
  crown: <><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></>,
  /** draft ticket, perforated down the stub */
  ticket: <><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M10 5v12" strokeDasharray="2 2" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  swap: <><path d="M4 8h14l-3-3" /><path d="M20 16H6l3 3" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
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

/** A flame for the points title, filled with an orange-to-yellow gradient. */
export function FlameIcon({ size = '1.3em', title = 'Points title' }: { size?: string; title?: string }) {
  const id = `flame-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="inline-block shrink-0 align-[-0.125em]" role="img" aria-label={title} data-testid="flame">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff5a1f" /><stop offset=".6" stopColor="#ff9a3c" /><stop offset="1" stopColor="#ffd166" /></linearGradient>
      </defs>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill={`url(#${id})`} stroke="#ff7a2f" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
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

const MOVE: Record<MoveKind, { shape: keyof typeof SHAPES; className: string; title: string }> = {
  drafted: { shape: 'ticket', className: 'text-ink', title: 'Drafted' },
  kept: { shape: 'lock', className: 'text-gold', title: 'Kept' },
  traded: { shape: 'swap', className: 'text-accent', title: 'Traded' },
  waiver: { shape: 'coin', className: 'text-win', title: 'Waiver claim' },
  freeAgent: { shape: 'plus', className: 'text-win', title: 'Free-agent add' },
  dropped: { shape: 'minus', className: 'text-loss', title: 'Dropped' },
  commissioner: { shape: 'swap', className: 'text-muted', title: 'Commissioner move' },
};

/** A league move's glyph on a small chip, for the player page's path through the league. */
export function MoveIcon({ kind }: { kind: MoveKind }) {
  const { shape, className, title } = MOVE[kind];
  return <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-surface-2 ${className}`}><Icon shape={shape} title={title} width="14" height="14" /></span>;
}
