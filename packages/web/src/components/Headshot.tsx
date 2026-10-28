import { useState } from 'react';
import type { PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import { headshotUrl, playerPos, posColor } from '../lib/players';

interface Props {
  players: PlayerDirectory; id: PlayerId; size?: number;
  /** load at once rather than when scrolled near, for a picture that moves into view by itself (the crawl) */
  eager?: boolean;
}

/** where to look, in order: the thumbnail, the full-size picture, then the thumbnail once more past any cached failure */
function sources(players: PlayerDirectory, id: PlayerId): string[] {
  const thumb = headshotUrl(players, id);
  if (playerPos(players, id) === 'DEF') return [thumb, `${thumb}?retry=1`];
  return [thumb, `https://sleepercdn.com/content/nfl/players/${id}.jpg`, `${thumb}?retry=1`];
}

/**
 * Round player headshot (team logo for defenses). A load that fails (the CDN drops some requests when a page asks
 * for dozens at once) tries the next source; only when all fail is the img dropped for a position-tinted disc with
 * the position letters.
 */
export default function Headshot({ players, id, size = 28, eager = false }: Props) {
  // failures counted per player, so a reused component starts afresh for the next one
  const [miss, setMiss] = useState<{ id: PlayerId; n: number }>({ id, n: 0 });
  const tried = miss.id === id ? miss.n : 0;
  const list = sources(players, id);
  const pos = playerPos(players, id);
  const color = posColor(pos);
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.32)),
        color,
        background: `color-mix(in srgb, ${color} 16%, var(--surface-2))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)`,
      }}
      aria-hidden="true"
    >
      {tried >= list.length ? pos : (
        <img
          key={list[tried]}
          src={list[tried]}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          width={size}
          height={size}
          onError={() => setMiss({ id, n: tried + 1 })}
          className={`absolute inset-0 h-full w-full ${pos === 'DEF' ? 'object-contain p-[12%]' : 'object-cover object-top'}`}
        />
      )}
    </span>
  );
}
