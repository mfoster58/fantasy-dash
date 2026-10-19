import { useState } from 'react';

export const logoUrl = (team: string) => `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;

/** A team logo centred on (x, y); a circle with the team code when there is no team or the image fails. */
export default function TeamLogo({ team, x, y, size = 26 }: { team: string; x: number; y: number; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!team || failed) {
    return (
      <g>
        <circle cx={x} cy={y} r={size / 2 - 1} style={{ fill: 'var(--surface-2)', stroke: 'var(--line)' }} />
        <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={700} style={{ fill: 'var(--muted)' }}>{team || 'FA'}</text>
      </g>
    );
  }
  return <image href={logoUrl(team)} x={x - size / 2} y={y - size / 2} width={size} height={size} onError={() => setFailed(true)} />;
}
