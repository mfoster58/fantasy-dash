/** a team photo URL, or a Sleeper account avatar id */
interface Props { avatar: string | null; name: string; size?: number }

/** a team photo URL as-is, a Sleeper avatar id as its thumbnail URL */
export const avatarUrl = (avatar: string): string => (avatar.startsWith('https://') ? avatar : `https://sleepercdn.com/avatars/thumbs/${avatar}`);

export default function Avatar({ avatar, name, size = 32 }: Props) {
  if (avatar) {
    return (
      <img
        src={avatarUrl(avatar)}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-surface-2"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className="grid shrink-0 place-items-center rounded-full bg-surface-2 font-medium text-muted"
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
