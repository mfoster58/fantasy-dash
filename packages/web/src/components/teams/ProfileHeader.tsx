import type { ReactNode } from 'react';
import Avatar from '../Avatar';

export interface Tile { label: string; value: ReactNode; sub?: string | null; /** colours the value */ tone?: 'win' | 'loss' | 'gold' | null }

const TONE = { win: 'text-win', loss: 'text-loss', gold: 'text-gold' } as const;

interface Props {
  avatar: string | null; name: string;
  eyebrow: ReactNode; title: string; subtitle?: ReactNode;
  badges: ReactNode[];
  tiles: Tile[];
  /** row under the tiles, e.g. "Fielded as" chips */
  chips?: ReactNode;
  /** muted footer strip */
  strip?: ReactNode;
}

/** The big profile card at the top of a team or manager page: avatar, titles, badge line, 3×2 stat tiles, optional chip row and footer strip. */
export default function ProfileHeader({ avatar, name, eyebrow, title, subtitle, badges, tiles, chips, strip }: Props) {
  return (
    <header className="card overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <Avatar avatar={avatar} name={name} size={84} />
          <div className="min-w-0">
            <div className="section-label flex flex-wrap items-center gap-x-2">{eyebrow}</div>
            <h1 className="mt-1 line-clamp-2 text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]" title={title}>{title}</h1>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{badges.map((b, i) => <span key={i}>{b}</span>)}</div>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="min-w-[5.5rem] rounded-lg border border-line px-3 py-2 text-center">
              <dt className="section-label text-[10px]">{t.label}</dt>
              <dd className={`num mt-0.5 text-xl font-semibold leading-tight ${t.tone ? TONE[t.tone] : ''}`}>{t.value}</dd>
              {t.sub && <dd className="truncate text-[10px] text-muted">{t.sub}</dd>}
            </div>
          ))}
        </dl>
      </div>
      {chips && <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-2.5 text-xs sm:px-6">{chips}</div>}
      {strip && <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line bg-surface-2 px-5 py-2 text-xs text-muted sm:px-6">{strip}</div>}
    </header>
  );
}
