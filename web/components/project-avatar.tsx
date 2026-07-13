import Image from 'next/image';
import { getProjectAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface ProjectAvatarProps {
  projectId: string;
  size?: number;
  className?: string;
}

export function ProjectAvatar({ projectId, size = 40, className = "" }: ProjectAvatarProps) {
  const avatarUri = getProjectAvatar(projectId, size);

  return (
    <div 
      className={cn(
        "overflow-hidden shrink-0 flex items-center justify-center", 
        className
      )}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarUri} alt="Project Avatar" width={size} height={size} className="w-full h-full object-cover" />
    </div>
  );
}
