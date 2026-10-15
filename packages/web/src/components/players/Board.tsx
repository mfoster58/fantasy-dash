import { useState } from 'react';
import { Link } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow } from '../../lib/playerBoards';
import { playerName, playerPos } from '../../lib/players';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import PosPill from '../PosPill';

interface Props { def: BoardDef; rows: BoardRow[]; players: PlayerDirectory; managers: History['managers'] }

const PREVIEW = 5;

export default function Board({ def, rows, players, managers }: Props) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  return (
    <section className="card overflow-hidden" aria-labelledby={`board-${def.id}`}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-3 py-2" title={def.definition}>
        <div className="min-w-0">
          <h3 id={`board-${def.id}`} className="section-label text-ink">{def.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{def.definition}</p>
        </div>
        <span className="section-label shrink-0">{def.valueHeader}</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">No players at this position.</p>
      ) : (
        <ol className="divide-y divide-line">
          {shown.map((r, i) => {
            const m = r.userId ? managers[r.userId] : undefined;
            const pos = playerPos(players, r.playerId);
            const metaNode = r.to
              ? <Link to={r.to} className="num hover:text-accent">{r.meta}</Link>
              : <span className="num">{r.meta}</span>;
            return (
              <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                <span className="num w-4 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <Headshot players={players} id={r.playerId} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{playerName(players, r.playerId)}</span>
                    <PosPill pos={pos} />
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    {metaNode}
                    {r.detail && <><span aria-hidden>·</span><span>{r.detail}</span></>}
                    {r.userId && (
                      <>
                        <span aria-hidden>·</span>
                        <Link to={`/h2h?a=${r.userId}`} className="flex items-center gap-1 hover:text-accent">
                          <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={14} />
                          <span>{m?.displayName ?? r.userId}</span>
                        </Link>
                      </>
                    )}
                  </span>
                </span>
                <span className="num shrink-0 text-base font-semibold">{r.valueLabel}</span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
          {all ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
