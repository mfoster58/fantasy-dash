import type { Game, Season, UserId, Week } from '@fantasy-dash/core';
import { useLive } from '../../lib/live/LiveProvider';
import { weekStatus } from '../../lib/live/weekStatus';
import type { Picks } from '../../lib/home/pick';
import { gameView } from '../../lib/home/view';
import GameBanner from './GameBanner';
import SideGame from './SideGame';

/** The game of the week and the tagged games, live when this is the live week. Picks come from the synced week. */
export default function TopRow({ season, week, picks, champion }: { season: Season; week: Week; picks: Picks; champion: UserId | null }) {
  const live = useLive();
  const st = weekStatus(season, week, live);
  const shown = (g: Game) => {
    const lg = st.week.games.find((x) => x.id === g.id) ?? g;
    return { game: lg, view: gameView(lg, st.outlookOf(lg), week.played, [st.toPlay(lg.sides[0]), st.toPlay(lg.sides[1])]) };
  };
  if (!picks.hero) return null;
  const hero = shown(picks.hero);
  return (
    <div className={`grid gap-3.5 ${picks.sides.length ? 'lg:grid-cols-[1fr_270px]' : ''}`}>
      <GameBanner game={hero.game} season={season} view={hero.view} />
      {picks.sides.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:flex lg:flex-col">
          {picks.sides.map(({ game, tag }) => { const x = shown(game); return <SideGame key={game.id} game={x.game} season={season} view={x.view} tag={tag} champion={champion} />; })}
        </div>
      )}
    </div>
  );
}
