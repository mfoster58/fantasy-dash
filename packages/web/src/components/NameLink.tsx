import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import type { UserId } from '@fantasy-dash/core';

type Rest = Omit<ComponentProps<typeof Link>, 'to' | 'className' | 'children'>;

/** A manager's name, opening the career page. */
export function ManagerLink({ userId, className = '', children, ...rest }: { userId: UserId; className?: string; children: ReactNode } & Rest) {
  return <Link to={`/managers/${userId}`} className={`hover:text-accent ${className}`} {...rest}>{children}</Link>;
}

/** A team name, opening that season's team page. */
export function TeamLink({ userId, year, className = '', children, ...rest }: { userId: UserId; year: number; className?: string; children: ReactNode } & Rest) {
  return <Link to={`/teams/${year}/${userId}`} className={`hover:text-accent ${className}`} {...rest}>{children}</Link>;
}

/** A player's name, opening his player page. */
export function PlayerLink({ id, className = '', children, ...rest }: { id: string; className?: string; children: ReactNode } & Rest) {
  return <Link to={`/player/${id}`} className={`hover:text-accent ${className}`} {...rest}>{children}</Link>;
}

/**
 * Fills its positioned parent so the whole row or card opens `to`, while the named links
 * inside it sit above with `relative z-10`. Keeps one link from nesting inside another.
 */
export function CoverLink({ to, label, className = '', ...rest }: { to: string; label: string; className?: string } & Rest) {
  return <Link to={to} aria-label={label} className={`absolute inset-0 ${className}`} {...rest} />;
}
