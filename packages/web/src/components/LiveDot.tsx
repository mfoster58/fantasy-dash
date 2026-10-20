/** "LIVE" with a pulsing dot while scores are refreshing. */
export default function LiveDot({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-loss">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
      </span>
      LIVE
    </span>
  );
}
