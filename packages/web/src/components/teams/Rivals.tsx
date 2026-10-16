import { Link } from 'react-router';
import type { History, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts, fmtRecord, fmtWinPct } from '../../lib/format';
import type { Rivalry } from '../../lib/teamProfile';

interface Props { rivalries: Rivalry[]; managers: History['managers']; userId: UserId }

const toneOf = (r: Rivalry) => (r.w > r.l ? 'win' : r.l > r.w ? 'loss' : 'even');
const toneClass = { win: 'text-win', loss: 'text-loss', even: 'text-muted' };

/** Every opponent, best record first; green when winning, red when losing. */
export default function Rivals({ rivalries, managers, userId }: Props) {
  return (
    <section className="card">
      <CardHeader title="Rivals" aside={`${rivalries.length} opponents`} />
      <ul className="divide-y divide-line">
        {rivalries.map((r) => {
          const m = managers[r.opponentId];
          const tone = toneOf(r);
          return (
            <li key={r.opponentId}>
              <Link to={`/h2h?a=${userId}&b=${r.opponentId}`} className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2 text-sm hover:bg-surface-2">
                <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.opponentId} size={24} />
                <span className="min-w-0">
                  <span className="block truncate"><span className="text-xs text-muted">vs</span> {m?.displayName ?? r.opponentId}</span>
                  <span className="num block text-xs text-muted">{fmtPts(r.pf)}–{fmtPts(r.pa)} · {r.games} game{r.games === 1 ? '' : 's'}</span>
                </span>
                <span className="text-right" data-tone={tone}>
                  <span className={`num block font-semibold ${toneClass[tone]}`}>{fmtRecord(r)}</span>
                  <span className={`num block text-xs ${toneClass[tone]}`}>{fmtWinPct(r.winPct)}</span>
                </span>
                <span className={`num w-8 text-right text-xs ${r.streak > 0 ? 'text-win' : r.streak < 0 ? 'text-loss' : 'text-muted'}`}>{r.streak > 0 ? `W${r.streak}` : r.streak < 0 ? `L${-r.streak}` : '—'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
