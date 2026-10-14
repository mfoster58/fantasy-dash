import { Link } from 'react-router';
import { h2hKey, type History } from '@fantasy-dash/core';
import Avatar from '../Avatar';

interface Props { a: string; managers: History['managers']; h2h: History['h2h'] }

export default function OpponentList({ a, managers, h2h }: Props) {
  const rows = Object.entries(managers)
    .filter(([id]) => id !== a)
    .map(([id, m]) => {
      const s = h2h[h2hKey(a, id)];
      const w = s ? (s.a === a ? s.aWins : s.bWins) : 0;
      const l = s ? (s.a === a ? s.bWins : s.aWins) : 0;
      const t = s?.ties ?? 0;
      return { id, name: m.displayName, avatar: m.avatar, w, l, t, games: s?.games.length ?? 0 };
    })
    .sort((x, y) => y.games - x.games || x.name.localeCompare(y.name));
  return (
    <div className="card max-w-2xl">
      <div className="section-label px-4 pt-3">Pick an opponent</div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/h2h?a=${a}&b=${r.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-surface-2">
              <Avatar avatar={r.avatar} name={r.name} size={24} />
              <span className="flex-1 font-medium">{r.name}</span>
              <span className={`num ${r.w > r.l ? 'text-win' : r.l > r.w ? 'text-loss' : 'text-muted'}`}>{r.w}-{r.l}{r.t ? `-${r.t}` : ''}</span>
              <span className="num w-20 text-right text-xs text-muted">{r.games ? `${r.games} games` : 'never met'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
