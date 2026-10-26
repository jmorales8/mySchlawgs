/* eslint-disable @next/next/no-img-element */
import styles from "./avatar.module.css";

export type AvatarUser = { username: string | null; profilePhotoUrl: string | null };

export default function Avatar({ user, className }: { user: AvatarUser; className?: string }) {
  const avatarClassName = [styles.avatar, className].filter(Boolean).join(" ");
  return user.profilePhotoUrl ? <img className={avatarClassName} src={user.profilePhotoUrl} alt={`${user.username}'s profile`} /> : <span className={avatarClassName}>{user.username?.[0]?.toUpperCase() ?? "S"}</span>;
}
