import type { ReactElement, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

const base = ({ title, className = '', ...rest }: IconProps) => ({
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  className: `inline-block size-[1em] shrink-0 align-[-0.125em] ${className}`,
  'aria-hidden': title ? undefined : true, role: title ? 'img' : undefined, ...rest,
});

/** Line icons drawn to match the UI's stroke weight; size follows the font size. */
export function TrophyIcon(p: IconProps) {
  return <svg {...base(p)}>{p.title && <title>{p.title}</title>}<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
}
export function MedalIcon(p: IconProps) {
  return <svg {...base(p)}>{p.title && <title>{p.title}</title>}<circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>;
}
export function ToiletIcon(p: IconProps) {
  return <svg {...base(p)}>{p.title && <title>{p.title}</title>}<path d="M7 3h8a1 1 0 0 1 1 1v7H7z" /><path d="M4 11h16v1a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" /><path d="M8 18l-1 3h10l-1-3" /></svg>;
}
export function CrownIcon(p: IconProps) {
  return <svg {...base(p)}>{p.title && <title>{p.title}</title>}<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>;
}

export type FinishKind = 'champion' | 'runnerUp' | 'third' | 'toilet';

const FINISH: Record<FinishKind, { Icon: (p: IconProps) => ReactElement; className: string; title: string }> = {
  champion: { Icon: TrophyIcon, className: 'text-gold', title: 'Champion' },
  runnerUp: { Icon: MedalIcon, className: 'text-silver', title: 'Runner-up' },
  third: { Icon: MedalIcon, className: 'text-bronze', title: 'Third place' },
  toilet: { Icon: ToiletIcon, className: 'text-loss', title: 'Toilet bowl' },
};

/** Gold trophy, silver and bronze medals, red toilet. */
export function FinishIcon({ kind, className = '' }: { kind: FinishKind; className?: string }) {
  const { Icon, className: tone, title } = FINISH[kind];
  return <Icon title={title} className={`${tone} ${className}`} data-testid={`finish-${kind}`} />;
}
