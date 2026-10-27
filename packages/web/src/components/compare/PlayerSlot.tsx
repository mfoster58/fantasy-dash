import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { PlayerDb } from '@fantasy-dash/core';
import { players } from '../../data/load';
import { groupOf, type PosGroup } from '../../lib/compare/url';
import Headshot from '../Headshot';
import PosPill from '../PosPill';

const LETTERS = 'ABCD';
const MAX_OPTIONS = 8;

interface Option { id: string; name: string; pos: string; team: string; pts: number }

/** The group's players with rows this season, by season points; one pass over the rows. */
function optionsFor(db: PlayerDb, pos: PosGroup): Option[] {
  const pts = new Map<string, number>(), team = new Map<string, string>();
  for (const r of db.rows) { pts.set(r.id, (pts.get(r.id) ?? 0) + (r.pts ?? 0)); team.set(r.id, r.team); }
  return Object.values(db.players)
    .filter((p) => groupOf(p.pos) === pos && pts.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, pos: p.pos, team: team.get(p.id) ?? '', pts: pts.get(p.id) ?? 0 }))
    .sort((a, b) => b.pts - a.pts);
}

/** One comparison slot: a search box with suggestions while empty, the player with a ✕ once picked. */
export default function PlayerSlot({ index, db, pos, value, taken, onPick }: {
  index: number; db: PlayerDb; pos: PosGroup; value: string | null; taken: string[]; onPick: (id: string | null) => void;
}) {
  const uid = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const all = useMemo(() => optionsFor(db, pos), [db, pos]);
  const q = text.trim().toLowerCase();
  const shown = all.filter((o) => !taken.includes(o.id) && (!q || o.name.toLowerCase().includes(q))).slice(0, MAX_OPTIONS);
  const label = `Player ${LETTERS[index]}`;
  const dot = <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--slot-${index})` }} />;

  if (value) {
    const o = all.find((x) => x.id === value);
    const name = o?.name ?? db.players[value]?.name ?? value;
    return (
      <div className="card flex min-w-0 items-center gap-2 px-3 py-2">
        {dot}
        <Headshot players={players} id={value} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-wider text-muted">{label}</div>
          <div className="truncate font-semibold">{name} <span className="text-xs font-normal text-muted">{o?.team}</span></div>
        </div>
        <button type="button" aria-label={`Remove ${name}`} onClick={() => onPick(null)} className="rounded px-1.5 text-muted hover:text-ink">✕</button>
      </div>
    );
  }

  const pick = (o: Option) => { onPick(o.id); setText(''); setOpen(false); setActive(-1); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };
  const listId = `${uid}-list`;
  const optId = (o: Option) => `${uid}-opt-${o.id}`;

  return (
    <div className="card relative min-w-0 px-3 py-2">
      <label className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted" htmlFor={`${uid}-in`}>{dot}{label}</label>
      <input id={`${uid}-in`} type="text" role="combobox" autoComplete="off" placeholder="Search players…"
        aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && shown[active] ? optId(shown[active]) : undefined}
        value={text} onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey}
        className="mt-1 w-full rounded border border-line bg-surface-2 px-2 py-1 text-sm text-ink placeholder:text-muted" />
      {open && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {shown.length === 0 && <li className="px-3 py-2 text-xs text-muted">No players</li>}
          {shown.map((o, i) => (
            <li key={o.id} id={optId(o)} role="option" data-id={o.id} aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === active ? 'bg-surface-2' : 'hover:bg-surface-2'}`}>
              <Headshot players={players} id={o.id} size={24} />
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              <PosPill pos={o.pos} />
              <span className="w-9 text-xs text-muted">{o.team}</span>
              <span className="num w-12 text-right text-xs text-muted">{o.pts.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
