import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';

export function getProjectAvatar(seed: string, size: number = 64): string {
  const avatar = createAvatar(shapes, {
    seed,
    size,
  });
  
  return avatar.toDataUri();
}
