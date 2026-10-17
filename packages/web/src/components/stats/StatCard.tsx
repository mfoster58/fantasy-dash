import type { ReactNode } from 'react';
import { AboutButton, useAbout } from '../About';

interface Props { id: string; eyebrow: string; title: string; about?: string; caption?: string; wide?: boolean; children: ReactNode }

/** One chart card: eyebrow, title with the ? definition, the chart, a one-line caption. */
export default function StatCard({ id, eyebrow, title, about, caption, wide = false, children }: Props) {
  const popover = useAbout();
  const aboutId = `about-${id}`;
  return (
    <section className={`card flex flex-col ${wide ? 'lg:col-span-2' : ''}`} aria-labelledby={`stat-${id}`}>
      <header className="border-b border-line px-4 pb-2 pt-3">
        <div className="section-label">{eyebrow}</div>
        <div className="flex items-center gap-1.5">
          <h3 id={`stat-${id}`} className="text-base font-semibold leading-tight text-ink">{title}</h3>
          {about && <AboutButton open={popover.open} buttonProps={popover.buttonProps} aboutId={aboutId} />}
        </div>
        {about && popover.open && <p id={aboutId} role="tooltip" className="mt-1.5 rounded-md bg-surface-2 px-2.5 py-2 text-xs leading-snug text-ink">{about}</p>}
      </header>
      <div className="min-w-0 flex-1 p-4">{children}</div>
      {caption && <p className="border-t border-line px-4 py-2 text-xs text-muted">{caption}</p>}
    </section>
  );
}

/** the body of a chart with nothing to draw */
export function Empty({ text = 'Nothing played yet.' }: { text?: string }) {
  return <p className="py-6 text-center text-xs text-muted">{text}</p>;
}
