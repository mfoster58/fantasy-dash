import { Link } from 'react-router';

export default function CardHead({ over, title, to, link }: { over: string; title: string; to: string; link: string }) {
  return (
    <div className="flex items-end justify-between border-b border-line px-4 py-3">
      <div>
        <div className="section-label">{over}</div>
        <h2 className="font-display text-xl font-bold uppercase leading-tight">{title}</h2>
      </div>
      <Link to={to} className="font-display text-xs font-bold uppercase tracking-[0.12em] text-accent hover:underline">{link} →</Link>
    </div>
  );
}
