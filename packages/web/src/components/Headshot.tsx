import { useState } from 'react';
import type { PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import { headshotUrl, playerPos, posColor } from '../lib/players';

interface Props { players: PlayerDirectory; id: PlayerId; size?: number }

/**
 * Round player headshot (team logo for defenses). If the CDN has no image the
 * img is dropped and a position-tinted disc with the position letters remains.
 */
export default function Headshot({ players, id, size = 28 }: Props) {
  const [failed, setFailed] = useState(false);
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
      {failed ? pos : (
        <img
          src={headshotUrl(players, id)}
          alt=""
          loading="lazy"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full ${pos === 'DEF' ? 'object-contain p-[12%]' : 'object-cover object-top'}`}
        />
      )}
    </span>
  );
}
