import { useState } from 'react';

/**
 * The ? button beside a title. The definition shows while the button is hovered or focused, and a press pins it until
 * the next press, Escape or blur. A press clears the hover flag, so a phone tap (mouseenter then click, never a mouseleave)
 * opens on the first tap and closes on the second. The panel itself is rendered by the caller, in the flow of its header,
 * so a card's clipped overflow can never cut it off.
 */
export function useAbout(): { open: boolean; buttonProps: Record<string, unknown> } {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  return {
    open,
    buttonProps: {
      onClick: () => { setPinned((p) => !p); setHover(false); },
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      onFocus: () => setHover(true),
      onBlur: () => { setHover(false); setPinned(false); },
      onKeyDown: (e: { key: string }) => { if (e.key === 'Escape') { setHover(false); setPinned(false); } },
    },
  };
}

/** The ? beside a title; the caller renders the panel with `id={aboutId}` and `role="tooltip"`. */
export function AboutButton({ open, buttonProps, aboutId }: { open: boolean; buttonProps: Record<string, unknown>; aboutId: string }) {
  return (
    <button
      type="button"
      aria-label="What counts"
      aria-expanded={open}
      aria-describedby={open ? aboutId : undefined}
      {...buttonProps}
      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-semibold leading-none ${open ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:border-ink hover:text-ink'}`}
    >
      ?
    </button>
  );
}
