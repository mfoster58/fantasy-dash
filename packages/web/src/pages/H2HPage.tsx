import { useLoaderData, useSearchParams } from 'react-router';
import { h2hKey, type Season } from '@fantasy-dash/core';
import ScoreCard from '../components/ScoreCard';
import ManagerPicker from '../components/h2h/ManagerPicker';
import OpponentList from '../components/h2h/OpponentList';
import SeriesSummary from '../components/h2h/SeriesSummary';
import { history, players } from '../data/load';

export default function H2HPage() {
  const seasons = useLoaderData() as Season[];
  const [params, setParams] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const set = (key: 'a' | 'b', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'a' && value === next.get('b')) next.delete('b');
    setParams(next);
  };
  const byYear = new Map(seasons.map((s) => [s.year, s]));
  const series = a && b ? history.h2h[h2hKey(a, b)] : undefined;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Head to Head</h1>
        <div className="flex flex-wrap gap-3">
          <ManagerPicker label="Manager" value={a} onChange={(v) => set('a', v)} managers={history.managers} />
          <ManagerPicker label="Opponent" value={b} onChange={(v) => set('b', v)} managers={history.managers} exclude={a || undefined} />
        </div>
      </header>

      {!a && <p className="text-sm text-muted">Choose a manager to see their history against the league.</p>}
      {a && !b && <OpponentList a={a} managers={history.managers} h2h={history.h2h} />}
      {a && b && (
        <>
          <SeriesSummary series={series} a={a} b={b} managers={history.managers} />
          {series && series.games.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {series.games.map((g) => {
                const season = byYear.get(g.year);
                const game = season?.weeks[g.week - 1]?.games.find((x) => x.id === g.gameId);
                if (!season || !game) return null;
                return (
                  <div key={g.gameId}>
                    <div className="section-label mb-1.5">{g.year} · Week {g.week}</div>
                    <ScoreCard game={game} played managers={season.managers} players={players} seasonTeams={season.playerTeams} to={`/scores/${g.year}/${g.week}/${game.matchupId}`} year={g.year} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
