import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateDeploymentDto } from '../deployments/dto/deployment.dto';
import {
  CreateProjectDto,
  EnvironmentVariablesDto,
} from '../projects/dto/project.dto';
import { PaginationDto } from './request.dto';
import {
  EnvironmentKeyPipe,
  ResourceIdPipe,
} from './security-validation.pipe';

describe('security validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const transform = (value: unknown, metatype: new () => object) =>
    pipe.transform(value, { type: 'body', metatype });

  it('rejects client-controlled deployment repository and trigger fields', async () => {
    await expect(
      transform(
        {
          commitSha: 'HEAD',
          repoUrl: 'https://github.com/attacker/repo',
          trigger: 'webhook',
        },
        CreateDeploymentDto,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid repositories, paths, branches, and oversized env input', async () => {
    await expect(
      transform(
        {
          name: 'Portfolio',
          repoUrl: 'https://evil.example/repo',
          organizationId: 'org_1',
          branch: '../main',
          outputDirectory: '../../',
        },
        CreateProjectDto,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      transform(
        {
          variables: Array.from({ length: 101 }, (_, index) => ({
            key: `KEY_${index}`,
            value: 'value',
          })),
        },
        EnvironmentVariablesDto,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('transforms and bounds pagination', async () => {
    await expect(
      transform({ skip: '0', take: '101' }, PaginationDto),
    ).rejects.toThrow(BadRequestException);
    await expect(
      transform({ skip: '2', take: '50' }, PaginationDto),
    ).resolves.toMatchObject({ skip: 2, take: 50 });
  });

  it('rejects malformed resource IDs and environment keys', () => {
    const idPipe = new ResourceIdPipe();
    const keyPipe = new EnvironmentKeyPipe();
    expect(() => idPipe.transform('../project')).toThrow(BadRequestException);
    expect(() => keyPipe.transform('INVALID-KEY')).toThrow(
      BadRequestException,
    );
    expect(idPipe.transform('cm123_project')).toBe('cm123_project');
    expect(keyPipe.transform('API_KEY')).toBe('API_KEY');
  });
});
