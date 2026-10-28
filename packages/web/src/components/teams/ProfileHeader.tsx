import type { ReactNode } from 'react';
import Pennant from './Pennant';

export interface Tile { label: string; value: ReactNode; sub?: string | null; /** colours the value */ tone?: 'win' | 'loss' | 'gold' | null }

const TONE = { win: 'text-win', loss: 'text-loss', gold: 'text-gold' } as const;

interface Props {
  avatar: string | null; name: string;
  eyebrow: ReactNode; title: string; subtitle?: ReactNode;
  badges?: ReactNode[];
  tiles: Tile[];
  /** row under the tiles, e.g. "Fielded as" chips */
  chips?: ReactNode;
  /** muted footer strip */
  strip?: ReactNode;
  /** championship years, newest first; each hangs as a pennant from the banner's top edge */
  pennants?: number[];
}

/** the full-size Sleeper avatar; the thumbs are too small for the banner's photo panel */
const fullAvatar = (avatar: string) => (avatar.startsWith('https://') ? avatar : `https://sleepercdn.com/avatars/${avatar}`);

/**
 * The banner at the top of a team or manager page, built like the game of the week: the avatar cut on a diagonal with a
 * league-blue stripe and a thin gold one, the eyebrow as a kicker, the title in the banner's condensed type, the 3×2 tiles
 * on the right and the championship pennants hanging from the top edge. Chips and the footer strip sit underneath.
 * On a phone the photo is a band across the top and the rest stacks below.
 */
export default function ProfileHeader({ avatar, name, eyebrow, title, subtitle, badges, tiles, chips, strip, pennants = [] }: Props) {
  return (
    <header data-testid="profile-banner" className="card blue-wash relative isolate overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div aria-hidden="true" className="relative h-32 shrink-0 sm:h-auto sm:w-56 lg:w-64">
          <div data-testid="banner-photo" className="absolute inset-0 [clip-path:polygon(0_0,100%_0,calc(100%-40px)_100%,0_100%)]"
            style={avatar ? { backgroundImage: `url(${fullAvatar(avatar)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
            {!avatar && <div className="flex h-full items-center bg-surface-2 px-6 font-display text-5xl font-bold text-muted">{name.slice(0, 2).toUpperCase()}</div>}
          </div>
          <div data-testid="banner-stripe" className="absolute -inset-y-3 right-[38px] w-2 -skew-x-[11deg] bg-accent" />
          <div data-testid="banner-stripe" className="absolute -inset-y-3 right-[26px] w-[5px] -skew-x-[11deg] bg-gold" />
        </div>
        <div className="relative grid min-w-0 flex-1 items-center gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className={`min-w-0 ${pennants.length > 0 ? 'lg:pr-28' : ''}`}>
            <div className="flex flex-wrap items-center gap-x-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</div>
            <h1 className="mt-1.5 line-clamp-2 font-display text-[32px] font-bold uppercase leading-[0.95] tracking-wide sm:text-[42px]" title={title}>{title}</h1>
            {subtitle && <div className="mt-2 text-sm text-ink/85">{subtitle}</div>}
            {badges && badges.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted">{badges.map((b, i) => <span key={i} className="rounded bg-white/5 px-2 py-0.5">{b}</span>)}</div>}
          </div>
          {pennants.length > 0 && (
            // the pennants drape from the banner's top edge: the top-right corner on a phone, just left of the tiles from lg up
            <div className="absolute right-4 top-0 flex gap-2 sm:gap-3 lg:right-[29rem]">
              {pennants.map((y) => <Pennant key={y} year={y} />)}
            </div>
          )}
          <dl className="grid shrink-0 grid-cols-3 gap-2 sm:gap-2.5 lg:w-[27rem]">
            {tiles.map((t) => (
              <div key={t.label} className="min-w-0 rounded-lg border border-white/5 bg-bg/55 px-3 py-2">
                <dt className="truncate text-[10px] uppercase tracking-wider text-muted">{t.label}</dt>
                <dd className={`num mt-0.5 text-xl font-semibold leading-tight ${t.tone ? TONE[t.tone] : ''}`}>{t.value}</dd>
                {t.sub && <dd className="truncate text-[10px] text-muted">{t.sub}</dd>}
              </div>
            ))}
          </dl>
        </div>
      </div>
      {chips && <div className="flex flex-wrap items-center gap-2 border-t border-line/70 px-5 py-2.5 text-xs sm:px-6">{chips}</div>}
      {strip && <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line/70 bg-bg/30 px-5 py-2 text-xs text-muted sm:px-6">{strip}</div>}
    </header>
  );
}
