import * as fs from 'fs-extra';
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  uploadDirectory,
} from './minio';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
  CreateBucketCommand: jest.fn().mockImplementation((input) => input),
  HeadBucketCommand: jest.fn().mockImplementation((input) => input),
}));
jest.mock('node:fs', () => ({
  createReadStream: jest.fn().mockReturnValue('stream'),
}));
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(true),
  readdir: jest.fn(),
  lstat: jest.fn(),
}));

describe('deployment output upload limits', () => {
  let mockSend: jest.Mock;

  beforeAll(() => {
    const { S3Client } = jest.requireMock('@aws-sdk/client-s3');
    mockSend = S3Client.mock.results[0].value.send;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
    mockSend.mockResolvedValue({});
  });

  it('rejects an oversized deployment before creating or uploading objects', async () => {
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([
      {
        name: 'bundle.js',
        isSymbolicLink: () => false,
        isDirectory: () => false,
        isFile: () => true,
      },
    ]);
    (fs.lstat as unknown as jest.Mock).mockResolvedValue({
      size: MAX_UPLOAD_BYTES + 1,
    });

    await expect(uploadDirectory('deploy', '/output')).rejects.toThrow(
      '100 MB upload limit',
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects too many output files before uploading any of them', async () => {
    (fs.readdir as unknown as jest.Mock).mockResolvedValue(
      Array.from({ length: MAX_UPLOAD_FILES + 1 }, (_, index) => ({
        name: `${index}.txt`,
        isSymbolicLink: () => false,
        isDirectory: () => false,
        isFile: () => true,
      })),
    );
    (fs.lstat as unknown as jest.Mock).mockResolvedValue({ size: 1 });

    await expect(uploadDirectory('deploy', '/output')).rejects.toThrow(
      'file limit',
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips symlinks and streams valid regular files', async () => {
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([
      {
        name: 'escape',
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
      },
      {
        name: 'index.html',
        isSymbolicLink: () => false,
        isDirectory: () => false,
        isFile: () => true,
      },
    ]);
    (fs.lstat as unknown as jest.Mock).mockResolvedValue({ size: 20 });

    await uploadDirectory('deploy', '/output');

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        Key: 'deploy/index.html',
        Body: 'stream',
        ContentLength: 20,
      }),
    );
  });
});
