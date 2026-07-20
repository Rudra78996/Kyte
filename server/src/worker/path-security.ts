import { realpath, stat } from 'node:fs/promises';
import * as path from 'node:path';

function escapesBase(baseDirectory: string, candidate: string) {
  const relative = path.relative(baseDirectory, candidate);
  return (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}

export function validateRelativeDirectory(
  value: string,
  label: string,
  allowCurrentDirectory = true,
) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\0')) {
    throw new Error(`${label} must be a valid relative directory`);
  }

  if (path.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed)) {
    throw new Error(`${label} must be relative`);
  }

  const normalized = path.posix.normalize(trimmed.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${label} cannot leave the project directory`);
  }
  if (!allowCurrentDirectory && normalized === '.') {
    throw new Error(`${label} must be a directory inside the project`);
  }

  return normalized;
}

export function resolvePathWithin(
  baseDirectory: string,
  relativeDirectory: string,
  label: string,
) {
  const base = path.resolve(baseDirectory);
  const candidate = path.resolve(base, relativeDirectory);

  if (escapesBase(base, candidate)) {
    throw new Error(`${label} cannot leave the project directory`);
  }
  return candidate;
}

export async function resolveExistingDirectoryWithin(
  baseDirectory: string,
  candidateDirectory: string,
  label: string,
) {
  const [realBase, realCandidate] = await Promise.all([
    realpath(baseDirectory),
    realpath(candidateDirectory),
  ]);

  if (escapesBase(realBase, realCandidate)) {
    throw new Error(`${label} resolves outside the project directory`);
  }

  const candidateStat = await stat(realCandidate);
  if (!candidateStat.isDirectory()) {
    throw new Error(`${label} must resolve to a directory`);
  }

  return realCandidate;
}
