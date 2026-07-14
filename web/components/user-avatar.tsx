"use client";

import BoringAvatar from "boring-avatars";
import { useEffect, useState } from "react";

interface UserAvatarProps {
  name: string;
  size?: number;
}

export function UserAvatar({ name, size = 32 }: UserAvatarProps) {
  const [initialWiggle, setInitialWiggle] = useState(false);

  useEffect(() => {
    // Trigger the wiggle shortly after mounting
    const timer1 = setTimeout(() => setInitialWiggle(true), 100);
    // Remove the class after the animation completes so hover works
    const timer2 = setTimeout(() => setInitialWiggle(false), 1100);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className={`transition-transform duration-300 hover:scale-110 hover:animate-wiggle cursor-pointer ${initialWiggle ? 'animate-wiggle' : ''}`}>
      <BoringAvatar
        size={size}
        name={name}
        variant="beam"
        colors={["#4f46e5", "#818cf8", "#a855f7", "#ec4899", "#f43f5e"]}
      />
    </div>
  );
}
