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
 * on the right and the championship pennants hanging beside the name. Chips and the footer strip sit under the name and tiles,
 * right of the photo, which runs the banner's full height.
 * On a phone the photo sits left of the name, and the tiles, chips and strip run the full width below
 * (the body's wrappers dissolve with display: contents so their pieces join the banner's own grid).
 */
export default function ProfileHeader({ avatar, name, eyebrow, title, subtitle, badges, tiles, chips, strip, pennants = [] }: Props) {
  return (
    <header data-testid="profile-banner" className="card blue-wash relative isolate overflow-hidden">
      <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] sm:flex">
        <div aria-hidden="true" className="relative min-h-[136px] w-[8.5rem] shrink-0 sm:min-h-[210px] sm:w-56 lg:w-60">
          {/* the photo's edge is skewed by the stripes' own 11deg, so it runs parallel to them whatever the banner's height;
              inside, the square avatar is skewed back upright and shown whole, its height the banner's */}
          <div className="absolute inset-y-0 -left-12 right-[46px] -skew-x-[11deg] overflow-hidden bg-surface-2">
            {avatar
              ? <div data-testid="banner-photo" className="absolute inset-y-0 left-10 -right-6 skew-x-[11deg] bg-cover bg-center sm:left-auto sm:aspect-square" style={{ backgroundImage: `url(${fullAvatar(avatar)})` }} />
              : <div data-testid="banner-photo" className="flex h-full skew-x-[11deg] items-center pl-16 font-display text-5xl font-bold text-muted">{name.slice(0, 2).toUpperCase()}</div>}
          </div>
          <div data-testid="banner-stripe" className="absolute -top-3 bottom-0 sm:-bottom-3 right-[38px] w-2 -skew-x-[11deg] bg-accent" />
          <div data-testid="banner-stripe" className="absolute -top-3 bottom-0 sm:-bottom-3 right-[26px] w-[5px] -skew-x-[11deg] bg-gold" />
        </div>
        {/* everything right of the photo, team history and the footer strip included, so the photo runs the banner's full height */}
        <div data-testid="banner-body" className="contents min-w-0 flex-1 flex-col sm:flex">
        <div className="relative contents min-w-0 flex-1 items-center gap-5 px-5 py-5 sm:grid sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div data-testid="banner-info" className="flex min-w-0 items-start gap-3 self-stretch py-4 pr-4 sm:gap-5 sm:p-0">
          <div className="min-w-0 self-center">
            <div className="flex flex-wrap items-center gap-x-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</div>
            <h1 className="mt-1.5 line-clamp-3 font-display text-[28px] font-bold uppercase leading-[0.95] tracking-wide sm:line-clamp-2 sm:text-[42px]" title={title}>{title}</h1>
            {subtitle && <div className="mt-2 text-sm text-ink/85">{subtitle}</div>}
            {badges && badges.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted">{badges.map((b, i) => <span key={i} className="rounded bg-white/5 px-2 py-0.5">{b}</span>)}</div>}
          </div>
          {pennants.length > 0 && (
            // right beside the name, pulled up through the padding so they drape from the banner's top edge
            <div className="-mt-4 flex shrink-0 gap-2 sm:-mt-5 sm:gap-3">
              {pennants.map((y) => <Pennant key={y} year={y} />)}
            </div>
          )}
          </div>
          <dl className="col-span-2 grid shrink-0 grid-cols-3 gap-2 px-4 pb-4 sm:gap-2.5 sm:p-0 lg:w-[27rem]">
            {tiles.map((t) => (
              <div key={t.label} className="min-w-0 rounded-lg border border-white/5 bg-bg/55 px-3 py-2">
                <dt className="truncate text-[10px] uppercase tracking-wider text-muted">{t.label}</dt>
                <dd className={`num mt-0.5 text-xl font-semibold leading-tight ${t.tone ? TONE[t.tone] : ''}`}>{t.value}</dd>
                {t.sub && <dd className="truncate text-[10px] text-muted">{t.sub}</dd>}
              </div>
            ))}
          </dl>
        </div>
        {chips && <div className="col-span-2 flex flex-wrap items-center gap-2 border-t border-line/70 px-5 py-2.5 text-xs sm:px-6">{chips}</div>}
        {strip && <div className="col-span-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-line/70 bg-bg/30 px-5 py-2 text-xs text-muted sm:px-6">{strip}</div>}
        </div>
      </div>
    </header>
  );
}
