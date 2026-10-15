import type { Draft, DraftPick, History, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtSigned } from '../../lib/format';
import { playerName, playerPos } from '../../lib/players';
import { leagueExtremes, letterGrade, managerDraftSummaries, pickLabel } from '../../lib/draft';
import TeamDraft from './TeamDraft';
import TopDraftValues from './TopDraftValues';

export const signClass = (n: number | null, fallback = 'text-muted') => (n === null || n === 0 ? fallback : n > 0 ? 'text-win' : 'text-loss');

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; inSeason: boolean;
  selected: UserId; onSelect: (userId: UserId) => void; history: History;
}

/** Card header in the style "small label / bold title". */
export function CardHeader({ label, title, aside }: { label: string; title: string; aside?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-line px-4 pb-2 pt-3">
      <div>
        <div className="section-label">{label}</div>
        <div className="text-sm font-semibold uppercase tracking-wide">{title}</div>
      </div>
      {aside && <div className="text-xs text-muted">{aside}</div>}
    </div>
  );
}

export function PickLine({ p, players, managers, teams }: { p: DraftPick; players: PlayerDirectory; managers: Record<UserId, Manager>; teams: number }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className="num w-9 text-xs text-muted">{pickLabel(p, teams)}</span>
      <Headshot players={players} id={p.playerId} size={26} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5"><span className="truncate font-medium">{playerName(players, p.playerId)}</span><PosPill pos={playerPos(players, p.playerId)} /></span>
        <span className="block truncate text-xs text-muted">{managers[p.userId]?.displayName ?? p.userId}{p.redraftPos !== null ? ` · redraft ${p.redraftPos}` : ''}</span>
      </span>
      <span className={`num text-base font-semibold ${signClass(p.value)}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
    </li>
  );
}

export default function DraftAnalysis({ draft, managers, players, inSeason, selected, onSelect, history }: Props) {
  const summaries = managerDraftSummaries(draft);
  const teams = draft.slotOrder.length;
  const { steals, busts } = leagueExtremes(draft, 10);
  const maxAbs = Math.max(1, ...summaries.map((s) => Math.abs(s.totalValue)));
  const note = inSeason ? ' (to date)' : '';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="card">
          <CardHeader label={`${inSeason ? 'To date' : 'Final'}`} title="Draft grades" aside="Each draft against what a pick in that slot usually returns" />
          <ol>
            {summaries.map((s, i) => {
              const m = managers[s.userId];
              const rank = i + 1;
              const active = s.userId === selected;
              return (
                <li key={s.userId}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.userId)}
                    aria-pressed={active}
                    className={`grid w-full grid-cols-[1.75rem_minmax(0,1fr)_2.5rem] items-center gap-3 border-t border-line px-4 py-2.5 text-left hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
                  >
                    <span className={`num grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${rank === 1 ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-muted'}`}>{rank}</span>
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2"><Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={20} /><span className="truncate text-sm font-medium">{m?.displayName ?? s.userId}</span></span>
                        <span className={`num text-sm font-semibold ${signClass(s.totalValue)}`}>{fmtSigned(s.totalValue, 0)}</span>
                      </span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded bg-surface-2">
                        <span className={`block h-full rounded ${s.totalValue >= 0 ? 'bg-win' : 'bg-loss'}`} style={{ width: `${Math.round((Math.abs(s.totalValue) / maxAbs) * 100)}%` }} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {s.beat} of {s.valued} picks beat their slot · {fmtSigned(s.hits, 0)} from the hits · {fmtSigned(s.misses, 0)} from the misses · slot {fmtSigned(s.totalSlot, 0)} · production {fmtSigned(s.totalProduction, 0)}
                      </span>
                    </span>
                    <span className="text-right text-lg font-bold">{letterGrade(rank, summaries.length)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            Value has two parts. Slot value converts the pick taken and the player's redraft position (where they would go if the league redrafted on this season's production) into draft capital on a trade-value curve, so a late dart that misses costs almost nothing and an early whiff costs most of what was spent. Production value is points over the positional baseline minus what a pick in that slot typically returns this season{inSeason ? ', to date, with points scaled so teams that have had their bye are not behind' : ''}; a player below bench level counts as bench level, not worse. Quarterback points count at half weight, matching how a one-QB league actually prices them. Kickers and defenses are excluded. Letter grades follow rank.
          </p>
        </div>
        <TeamDraft draft={draft} managers={managers} players={players} userId={selected} onSelect={onSelect} inSeason={inSeason} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card"><CardHeader label={`Best picks${note}`} title="Top 10 steals" /><ul className="divide-y divide-line px-4">{steals.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} teams={teams} />)}</ul></div>
        <div className="card"><CardHeader label={`Worst picks${note}`} title="Top 10 busts" /><ul className="divide-y divide-line px-4">{busts.map((p) => <PickLine key={p.pickNo} p={p} players={players} managers={managers} teams={teams} />)}</ul></div>
        <TopDraftValues history={history} players={players} />
      </div>
    </div>
  );
}
