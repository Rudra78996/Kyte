import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { encrypt, decrypt } from '../utils/crypto.util';
import { Prisma } from '@prisma/client';

export const PROJECT_LIMIT = 4;
const PLATFORM_SETTINGS_ID = 'platform';
export const WEBHOOK_PROJECT_LIMIT = 1;
export type ProjectAccessAction = 'read' | 'deploy' | 'manage';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    if (!dto.organizationId?.trim()) {
      throw new BadRequestException(
        'Select an organization before creating a project',
      );
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const membership = await tx.organizationMember.findUnique({
              where: {
                organizationId_userId: {
                  organizationId: dto.organizationId,
                  userId,
                },
              },
            });

            if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
              throw new NotFoundException('Organization not found');
            }

            const [used, limit] = await Promise.all([
              tx.project.count({ where: { userId } }),
              this.getProjectLimitForUser(tx, userId),
            ]);
            if (used >= limit) {
              throw new ForbiddenException({
                statusCode: 403,
                code: 'PROJECT_LIMIT_REACHED',
                message: `You can create up to ${limit} projects. Delete a project before creating another.`,
                limit,
                used,
              });
            }

            return tx.project.create({
              data: {
                name: dto.name,
                description: dto.description,
                repoUrl: dto.repoUrl,
                preset: dto.preset,
                rootDirectory: dto.rootDirectory,
                buildCommand: dto.buildCommand,
                outputDirectory: dto.outputDirectory,
                branch: dto.branch || 'main',
                subdomain: this.generateSubdomain(),
                userId,
                organizationId: dto.organizationId,
                environmentVariables: {
                  create:
                    dto.environmentVariables?.map((v) => {
                      const encrypted = encrypt(v.value);
                      return {
                        key: v.key,
                        encryptedValue: encrypted.encryptedValue,
                        iv: encrypted.iv,
                        authTag: encrypted.authTag,
                      };
                    }) || [],
                },
              },
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException(
      'Could not create the project. Please try again.',
    );
  }

  async getProjectLimit(userId: string) {
    const [used, limit] = await Promise.all([
      this.prisma.project.count({ where: { userId } }),
      this.getProjectLimitForUser(this.prisma, userId),
    ]);
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      canCreate: used < limit,
    };
  }

  private async getProjectLimitForUser(
    prisma: PrismaService | Prisma.TransactionClient,
    userId: string,
  ) {
    await prisma.$executeRaw`
      INSERT INTO "PlatformSettings" ("id", "deploymentsPaused", "defaultProjectLimit", "updatedAt")
      VALUES (${PLATFORM_SETTINGS_ID}, false, ${PROJECT_LIMIT}, NOW())
      ON CONFLICT ("id") DO NOTHING
    `;
    const [limit] = await prisma.$queryRaw<
      { projectLimitOverride: number | null; defaultProjectLimit: number }[]
    >`
      SELECT u."projectLimitOverride", s."defaultProjectLimit"
      FROM "User" u
      CROSS JOIN "PlatformSettings" s
      WHERE u."id" = ${userId} AND s."id" = ${PLATFORM_SETTINGS_ID}
      LIMIT 1
    `;
    return (
      limit?.projectLimitOverride ?? limit?.defaultProjectLimit ?? PROJECT_LIMIT
    );
  }

  async findAll(userId: string, skip = 0, take = 20, organizationId?: string) {
    if (organizationId) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });
      if (!membership) throw new NotFoundException('Organization not found');
    }
    const membershipFilter = {
      members: { some: { userId } },
    };
    const where = organizationId
      ? {
          organizationId,
          organization: membershipFilter,
        }
      : {
          OR: [
            { organization: membershipFilter },
            { organizationId: null, userId },
          ],
        };
    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { projects, total, skip, take };
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.requireProjectAccess(userId, projectId, 'read');
    const deployments = await this.prisma.deployment.findMany({
      where: { projectId },
      orderBy: { deployedAt: 'desc' },
      take: 10,
    });
    const { organization: _membershipContext, ...safeProject } = project;
    return { ...safeProject, deployments };
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.requireProjectAccess(
      userId,
      projectId,
      'manage',
    );
    if (dto.repoUrl && dto.repoUrl !== project.repoUrl && project.webhookId) {
      throw new BadRequestException(
        'Disable automatic deployments before changing the repository',
      );
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        repoUrl: dto.repoUrl,
        preset: dto.preset,
        rootDirectory: dto.rootDirectory,
        buildCommand: dto.buildCommand,
        outputDirectory: dto.outputDirectory,
        branch: dto.branch,
        ...(dto.repoUrl && dto.repoUrl !== project.repoUrl
          ? { githubRepositoryId: null }
          : {}),
      },
    });
  }

  async delete(userId: string, projectId: string) {
    await this.requireProjectAccess(userId, projectId, 'manage');

    // Unset activeDeployId first to break cyclic relation constraint
    await this.prisma.project.update({
      where: { id: projectId },
      data: { activeDeployId: null },
    });

    // Delete in transaction
    await this.prisma.$transaction([
      this.prisma.requestLog.deleteMany({ where: { projectId } }),
      this.prisma.deploymentLogChunk.deleteMany({
        where: { deployment: { projectId } },
      }),
      this.prisma.deployment.deleteMany({ where: { projectId } }),
      this.prisma.gitHubConnection.deleteMany({ where: { projectId } }),
      this.prisma.project.delete({ where: { id: projectId } }),
    ]);

    return { success: true, message: 'Project deleted successfully' };
  }

  async enableWebhook(userId: string, projectId: string) {
    const project = await this.requireProjectAccess(
      userId,
      projectId,
      'manage',
    );

    if (project.webhookId) {
      return this.webhookStatus(project, true);
    }

    const enabledWebhookProject = await this.prisma.project.findFirst({
      where: {
        userId: project.userId,
        id: { not: projectId },
        webhookId: { not: null },
      },
      select: { id: true },
    });
    if (enabledWebhookProject) {
      throw this.webhookProjectLimitError();
    }

    const accessToken = await this.getGitHubAccessToken(userId);
    const { owner, repo } = this.parseGitHubRepository(project.repoUrl);
    const repositoryResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!repositoryResponse.ok) {
      throw new BadRequestException(
        'GitHub could not verify access to this repository',
      );
    }
    const repository = (await repositoryResponse.json()) as {
      id?: number;
      permissions?: { admin?: boolean };
    };
    if (!repository.id || repository.permissions?.admin !== true) {
      throw new BadRequestException(
        'GitHub administrator permission is required to enable automatic deployments',
      );
    }

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException(
        'Automatic deployments are not configured on this server yet.',
      );
    }

    const baseDomain = process.env.BASE_DOMAIN || 'deployly.local';
    const webhookUrl =
      process.env.WEBHOOK_CALLBACK_URL ||
      `https://${baseDomain}/api/webhooks/github`;

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0',
          },
        }),
      },
    );

    if (!res.ok) {
      const errorData = await res.json();
      // 422 "Hook already exists" means someone else (or a previous attempt)
      // already registered this webhook on GitHub. Do NOT blindly enable it
      // for the current user — they may not own the repo. The user who
      // originally registered the hook is the only one who should benefit.
      if (
        res.status === 422 &&
        errorData.errors?.some((e: any) =>
          e.message?.includes('Hook already exists'),
        )
      ) {
        throw new BadRequestException(
          'A webhook already exists on this GitHub repository. ' +
            'If you are the repo owner, remove the existing webhook from GitHub Settings → Webhooks and try again.',
        );
      }
      throw new BadRequestException(
        `Failed to create webhook: ${errorData.message || res.statusText}`,
      );
    }

    const hookData = (await res.json()) as { id?: number | string };
    if (
      (typeof hookData.id !== 'number' && typeof hookData.id !== 'string') ||
      !hookData.id.toString()
    ) {
      throw new BadRequestException(
        'GitHub returned an invalid webhook response',
      );
    }
    const hookId = hookData.id.toString();

    try {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          webhookId: hookId,
          githubRepositoryId: repository.id.toString(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        ).catch(() => undefined);
        throw this.webhookProjectLimitError();
      }
      throw error;
    }

    return {
      ...this.webhookStatus({ ...project, webhookId: hookId }, true),
      message: 'Automatic deployments are now enabled.',
    };
  }

  async getWebhookStatus(userId: string, projectId: string) {
    const project = await this.requireProjectAccess(userId, projectId, 'read');
    const slotAvailable =
      Boolean(project.webhookId) ||
      !(await this.prisma.project.findFirst({
        where: {
          userId: project.userId,
          id: { not: projectId },
          webhookId: { not: null },
        },
        select: { id: true },
      }));
    return this.webhookStatus(project, slotAvailable);
  }

  async disableWebhook(userId: string, projectId: string) {
    const project = await this.requireProjectAccess(
      userId,
      projectId,
      'manage',
    );
    if (!project.webhookId) {
      return this.webhookStatus(project, true);
    }

    const accessToken = await this.getGitHubAccessToken(userId);
    const { owner, repo } = this.parseGitHubRepository(project.repoUrl);
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/hooks/${project.webhookId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!res.ok && res.status !== 404) {
      const errorData = await res.json().catch(() => ({}));
      throw new BadRequestException(
        `Failed to remove webhook: ${errorData.message || res.statusText}`,
      );
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { webhookId: null, githubRepositoryId: null },
    });

    return {
      ...this.webhookStatus({ ...project, webhookId: null }, true),
      message: 'Automatic deployments are disabled.',
    };
  }

  async requireProjectAccess(
    userId: string,
    projectId: string,
    action: ProjectAccessAction,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    const role = project.organization?.members[0]?.role;
    const allowed = project.organizationId
      ? action === 'manage'
        ? role === 'OWNER' || role === 'ADMIN'
        : Boolean(role)
      : project.userId === userId;
    const adminReadAccess =
      !allowed &&
      action === 'read' &&
      (
        await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })
      )?.role === 'ADMIN';
    if (!allowed && !adminReadAccess) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async getGitHubAccessToken(userId: string) {
    const githubConnection = await this.prisma.gitHubConnection.findFirst({
      where: { userId },
    });

    if (
      !githubConnection?.accessTokenEncrypted ||
      !githubConnection.tokenIv ||
      !githubConnection.tokenAuthTag
    ) {
      throw new BadRequestException(
        'Connect your GitHub account before managing automatic deployments.',
      );
    }

    return decrypt(
      githubConnection.accessTokenEncrypted,
      githubConnection.tokenIv,
      githubConnection.tokenAuthTag,
    );
  }

  private parseGitHubRepository(repoUrl: string) {
    const normalized = repoUrl
      .trim()
      .replace(/^git@github\.com:/i, '')
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '');
    const [owner, repo, ...extra] = normalized.split('/');

    if (!owner || !repo || extra.length > 0) {
      throw new BadRequestException(
        'Use a valid GitHub repository URL such as https://github.com/owner/repository',
      );
    }
    return { owner, repo };
  }

  private webhookStatus(
    project: {
      repoUrl: string;
      branch: string | null;
      webhookId: string | null;
    },
    canEnable: boolean,
  ) {
    return {
      enabled: Boolean(project.webhookId),
      provider: 'github',
      repository: project.repoUrl,
      branch: project.branch || 'main',
      limit: WEBHOOK_PROJECT_LIMIT,
      canEnable,
    };
  }

  private webhookProjectLimitError() {
    return new ForbiddenException({
      statusCode: 403,
      code: 'WEBHOOK_PROJECT_LIMIT_REACHED',
      message:
        'Automatic deployments can be enabled for only 1 project. Disable the existing webhook before enabling another.',
      limit: WEBHOOK_PROJECT_LIMIT,
    });
  }

  async getMetrics(userId: string, projectId: string, days: 7 | 30 | 90 = 7) {
    await this.requireProjectAccess(userId, projectId, 'read');

    const rangeStart = new Date();
    rangeStart.setUTCHours(0, 0, 0, 0);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));
    const trafficWhere: Prisma.RequestLogWhereInput = {
      projectId,
      timestamp: { gte: rangeStart },
      isPageView: true,
    };

    const [totalRequests, uniqueVisitorsCount, avgResponseAgg] =
      await Promise.all([
        this.prisma.requestLog.count({
          where: trafficWhere,
        }),

        this.prisma.requestLog.groupBy({
          by: ['ipAddress'],
          where: { ...trafficWhere, ipAddress: { not: null } },
        }),

        this.prisma.requestLog.aggregate({
          where: trafficWhere,
          _avg: { responseTime: true },
        }),
      ]);

    const visitors = uniqueVisitorsCount.length;
    const avgResponse = Math.round(avgResponseAgg._avg.responseTime || 0);

    const allLogs = await this.prisma.requestLog.findMany({
      where: trafficWhere,
      select: {
        timestamp: true,
        ipAddress: true,
        country: true,
        countryCode: true,
      },
    });

    const trafficMap = new Map<
      string,
      { label: string; pageviews: number; ips: Set<string> }
    >();
    const dateLabel = new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      trafficMap.set(d.toISOString().slice(0, 10), {
        label: dateLabel.format(d),
        pageviews: 0,
        ips: new Set(),
      });
    }

    const locationsMap = new Map<
      string,
      { code: string; visitors: Set<string> }
    >();

    for (const log of allLogs) {
      const dayKey = log.timestamp.toISOString().slice(0, 10);
      if (trafficMap.has(dayKey)) {
        const t = trafficMap.get(dayKey)!;
        t.pageviews++;
        if (log.ipAddress) t.ips.add(log.ipAddress);
      }

      const c = log.country || 'Unknown';
      const code = log.countryCode || 'UN';
      if (!locationsMap.has(c)) {
        locationsMap.set(c, { code, visitors: new Set() });
      }
      if (log.ipAddress) locationsMap.get(c)!.visitors.add(log.ipAddress);
    }

    const trafficData = Array.from(trafficMap.values()).map((data) => ({
      day: data.label,
      pageviews: data.pageviews,
      visitors: data.ips.size,
    }));

    const allLocations = Array.from(locationsMap.entries()).map(
      ([country, data]) => ({
        country,
        code: data.code,
        visitors: data.visitors.size,
      }),
    );
    const totalLocVisitors = allLocations.reduce(
      (total, location) => total + location.visitors,
      0,
    );
    const locationsList = allLocations
      .map((location) => ({
        ...location,
        share:
          totalLocVisitors > 0
            ? Math.round((location.visitors / totalLocVisitors) * 100)
            : 0,
      }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 5);

    const deployments = await this.prisma.deployment.findMany({
      where: { projectId },
      orderBy: { deployedAt: 'desc' },
      take: 20,
    });

    let successful = 0;
    let failed = 0;
    let totalBuildTime = 0;
    let validBuilds = 0;

    deployments.forEach((d) => {
      if (d.status === 'SUCCESS') successful++;
      if (d.status === 'FAILED') failed++;
      if (
        (d.status === 'SUCCESS' || d.status === 'FAILED') &&
        d.updatedAt > d.deployedAt
      ) {
        totalBuildTime += d.updatedAt.getTime() - d.deployedAt.getTime();
        validBuilds++;
      }
    });

    const avgBuild =
      validBuilds > 0 ? Math.round(totalBuildTime / validBuilds / 1000) : 0;
    const health =
      deployments.length > 0
        ? Math.round((successful / deployments.length) * 100)
        : 100;

    return {
      rangeDays: days,
      pageviews: totalRequests,
      visitors,
      avgResponse,
      avgBuild,
      health,
      successfulDeployments: successful,
      failedDeployments: failed,
      totalDeployments: deployments.length,
      trafficData,
      locations: locationsList,
    };
  }

  async getEnvironmentVariables(userId: string, projectId: string) {
    await this.requireProjectAccess(userId, projectId, 'read');
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { environmentVariables: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    return project.environmentVariables.map((env) => ({
      key: env.key,
      value: '',
      hasValue: true,
    }));
  }

  async upsertEnvironmentVariables(
    userId: string,
    projectId: string,
    variables: { key: string; value: string }[],
  ) {
    await this.requireProjectAccess(userId, projectId, 'manage');

    const existing = await this.prisma.environmentVariable.findMany({
      where: { projectId },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((variable) => variable.key));
    const writes = variables.filter(
      (variable) => variable.value !== '' || !existingKeys.has(variable.key),
    );

    const result = await this.prisma.$transaction(
      writes.map((v) => {
        const encrypted = encrypt(v.value);
        return this.prisma.environmentVariable.upsert({
          where: {
            projectId_key: { projectId, key: v.key },
          },
          update: {
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
          },
          create: {
            projectId,
            key: v.key,
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
          },
        });
      }),
    );

    return { success: true, count: result.length };
  }

  async deleteEnvironmentVariable(
    userId: string,
    projectId: string,
    key: string,
  ) {
    await this.requireProjectAccess(userId, projectId, 'manage');

    try {
      await this.prisma.environmentVariable.delete({
        where: {
          projectId_key: { projectId, key },
        },
      });
      return { success: true };
    } catch (e) {
      throw new NotFoundException('Environment variable not found');
    }
  }

  private generateSubdomain(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private normalizeDomain(domainName: string) {
    let normalized = domainName.trim().toLowerCase().replace(/\.$/, '');
    if (/^https?:\/\//.test(normalized)) {
      try {
        normalized = new URL(normalized).hostname.toLowerCase();
      } catch {
        throw new BadRequestException('Enter a valid hostname, without a path');
      }
    }

    const hostnamePattern =
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
    const localHostnamePattern =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:localhost|local)$/;
    if (
      !hostnamePattern.test(normalized) &&
      !localHostnamePattern.test(normalized)
    ) {
      throw new BadRequestException(
        'Enter a valid hostname, without a port, path, or wildcard',
      );
    }

    const baseDomain = (process.env.BASE_DOMAIN || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    if (normalized === baseDomain) {
      throw new BadRequestException(
        'This hostname is reserved for the Kyte application',
      );
    }
    const sitesDomain = (process.env.SITES_DOMAIN || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    if (
      sitesDomain &&
      (normalized === sitesDomain || normalized.endsWith(`.${sitesDomain}`))
    ) {
      throw new BadRequestException(
        'This hostname is reserved for Kyte deployments',
      );
    }
    return normalized;
  }

  private serializeDomain(domain: {
    domainName: string;
    verificationToken: string;
    status: string;
    verifiedAt: Date | null;
    createdAt: Date;
  }) {
    const routingTarget =
      process.env.DOMAIN_CNAME_TARGET ||
      process.env.BASE_DOMAIN ||
      'your-kyte-hostname';
    return {
      ...domain,
      dnsRecords: {
        routing: {
          type: 'CNAME',
          name: domain.domainName,
          value: routingTarget,
        },
        verification: {
          type: 'TXT',
          name: `_kyte.${domain.domainName}`,
          value: domain.verificationToken,
        },
      },
    };
  }

  async addDomain(userId: string, projectId: string, domainName: string) {
    await this.requireProjectAccess(userId, projectId, 'manage');

    const normalizedDomain = this.normalizeDomain(domainName);

    const existing = await this.prisma.customDomain.findUnique({
      where: { domainName: normalizedDomain },
    });
    if (existing) {
      if (existing.projectId === projectId)
        return this.serializeDomain(existing);
      throw new BadRequestException(
        'Domain is already associated with another project',
      );
    }

    const token = `kyte-verify=${randomBytes(16).toString('hex')}`;
    const domain = await this.prisma.customDomain.create({
      data: {
        projectId,
        domainName: normalizedDomain,
        verificationToken: token,
        status: 'pending',
      },
    });
    return this.serializeDomain(domain);
  }

  async getDomains(userId: string, projectId: string) {
    await this.requireProjectAccess(userId, projectId, 'read');

    const domains = await this.prisma.customDomain.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map((domain) => this.serializeDomain(domain));
  }

  async deleteDomain(userId: string, projectId: string, domainName: string) {
    await this.requireProjectAccess(userId, projectId, 'manage');

    const normalizedDomain = this.normalizeDomain(domainName);
    await this.prisma.customDomain.deleteMany({
      where: { projectId, domainName: normalizedDomain },
    });
    return { success: true };
  }

  async verifyDomain(userId: string, projectId: string, domainName: string) {
    await this.requireProjectAccess(userId, projectId, 'manage');

    const normalizedDomain = this.normalizeDomain(domainName);
    const domain = await this.prisma.customDomain.findUnique({
      where: { domainName: normalizedDomain },
    });
    if (!domain || domain.projectId !== projectId)
      throw new NotFoundException('Domain not found in this project');

    if (domain.status === 'verified') {
      return { status: 'verified', message: 'Domain is already verified' };
    }

    const isLocalDomain =
      normalizedDomain.endsWith('.localhost') ||
      normalizedDomain.endsWith('.local');
    if (process.env.NODE_ENV !== 'production' && isLocalDomain) {
      await this.prisma.customDomain.update({
        where: { id: domain.id },
        data: { status: 'verified', verifiedAt: new Date() },
      });
      return {
        status: 'verified',
        message: 'Domain automatically verified for local development',
      };
    }

    try {
      const records = await resolveTxt(`_kyte.${normalizedDomain}`);
      const txtValues = records.flat();
      if (txtValues.includes(domain.verificationToken)) {
        await this.prisma.customDomain.update({
          where: { id: domain.id },
          data: { status: 'verified', verifiedAt: new Date() },
        });
        return { status: 'verified', message: 'Domain verified successfully!' };
      }
    } catch (err) {
      console.error(`DNS lookup failed for ${normalizedDomain}`, err);
    }

    return {
      status: 'pending',
      error:
        'DNS records not found or not propagated yet. Please add a TXT record for _kyte.',
    };
  }
}
