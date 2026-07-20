import { mkdtemp, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import {
  resolveExistingDirectoryWithin,
  resolvePathWithin,
  validateRelativeDirectory,
} from './path-security';

describe('worker path security', () => {
  it.each([
    ['../secrets', 'Output directory cannot leave'],
    ['packages/site/../../../secrets', 'Output directory cannot leave'],
    ['/etc', 'Output directory must be relative'],
    ['C:\\Windows', 'Output directory must be relative'],
  ])('rejects unsafe directory %s', (value, expectedMessage) => {
    expect(() =>
      validateRelativeDirectory(value, 'Output directory', false),
    ).toThrow(expectedMessage);
  });

  it('rejects the project root as an output directory', () => {
    expect(() =>
      validateRelativeDirectory('.', 'Output directory', false),
    ).toThrow('must be a directory inside');
  });

  it('resolves a normal nested output directory', () => {
    const base = path.resolve('/tmp/build/app');
    const relative = validateRelativeDirectory(
      'packages/site/dist',
      'Output directory',
      false,
    );

    expect(resolvePathWithin(base, relative, 'Output directory')).toBe(
      path.join(base, 'packages/site/dist'),
    );
  });

  it('rejects sibling-prefix paths', () => {
    expect(() =>
      resolvePathWithin('/tmp/build/app', '../app-secrets', 'Output directory'),
    ).toThrow('cannot leave');
  });

  it('rejects an output symlink that resolves outside the project', async () => {
    const temporaryRoot = await mkdtemp(
      path.join(tmpdir(), 'kyte-path-security-'),
    );
    const appDirectory = path.join(temporaryRoot, 'app');
    const outsideDirectory = path.join(temporaryRoot, 'outside');
    const outputLink = path.join(appDirectory, 'dist');

    await Promise.all([
      mkdir(appDirectory, { recursive: true }),
      mkdir(outsideDirectory, { recursive: true }),
    ]);
    await symlink(outsideDirectory, outputLink, 'dir');

    await expect(
      resolveExistingDirectoryWithin(
        appDirectory,
        outputLink,
        'Output directory',
      ),
    ).rejects.toThrow('resolves outside');
  });
});
