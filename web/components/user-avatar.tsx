import BoringAvatar from "boring-avatars";

interface UserAvatarProps {
  name: string;
  size?: number;
}

export function UserAvatar({ name, size = 32 }: UserAvatarProps) {
  return (
    <BoringAvatar
      size={size}
      name={name}
      variant="beam"
      colors={["#4f46e5", "#818cf8", "#a855f7", "#ec4899", "#f43f5e"]}
    />
  );
}
