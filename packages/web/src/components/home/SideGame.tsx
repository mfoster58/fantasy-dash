import type { Game, GameSide, Season, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { CoverLink, TeamLink } from '../NameLink';
import { fmtRecord, fmtTag } from '../../lib/format';
import type { SideTag } from '../../lib/home/pick';
import type { GameView } from '../../lib/home/view';
import { StateLabel, scoreTone, teamName } from './GameBanner';

const TAGS: Record<string, { label: string; tone: string }> = {
  upset: { label: 'Upset alert', tone: 'text-coral' },
  champ: { label: 'Champ watch', tone: 'text-win' },
  top: { label: 'Top of the table', tone: 'text-accent' },
  shootout: { label: 'Shootout', tone: 'text-accent' },
};
export const tagOf = (tag: SideTag) => TAGS[tag] ?? { label: fmtTag(tag as Parameters<typeof fmtTag>[0]), tone: 'text-accent' };

export default function SideGame({ game, season, view, tag, champion }: { game: Game; season: Season; view: GameView; tag: SideTag; champion: UserId | null }) {
  const t = tagOf(tag);
  const row = (s: GameSide, i: 0 | 1) => {
    const m = season.managers[s.userId];
    return (
      <div className="mt-2 grid grid-cols-[24px_1fr_auto] items-center gap-2.5 text-[13px]">
        <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={24} />
        <span className="flex min-w-0 items-baseline gap-1">
          <TeamLink userId={s.userId} year={season.year} className="relative z-10 truncate">{teamName(season, s.userId)}</TeamLink>
          <span className="shrink-0 whitespace-nowrap">{s.userId === champion && '🏆 '}<span className="text-muted">{fmtRecord(s.recordBefore)}</span></span>
        </span>
        <span className={`num ${scoreTone(view, i)}`}>{view.scores[i].toFixed(1)}</span>
      </div>
    );
  };
  return (
    <section aria-label={t.label} className="card relative flex-1 px-3.5 py-3">
      <CoverLink to={`/scores/${season.year}/${game.week}/${game.matchupId}`} label={`${teamName(season, game.sides[0].userId)} vs ${teamName(season, game.sides[1].userId)}`} />
      <div className="flex items-center justify-between">
        <span className={`font-display text-xs font-bold uppercase tracking-[0.14em] ${t.tone}`}>{t.label}</span>
        <StateLabel status={view.status} />
      </div>
      {row(game.sides[0], 0)}
      {row(game.sides[1], 1)}
    </section>
  );
}
