import { posColor } from '../lib/players';

export default function PosPill({ pos, className = '' }: { pos: string; className?: string }) {
  return (
    <span
      className={`inline-block w-8 shrink-0 rounded px-1 py-px text-center text-[10px] font-semibold leading-4 text-white ${className}`}
      style={{ background: posColor(pos) }}
    >
      {pos}
    </span>
  );
}
