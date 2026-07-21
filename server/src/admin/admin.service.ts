import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateAdminUserDto,
  UpdatePlatformSettingsDto,
} from './dto/admin.dto';

const PLATFORM_SETTINGS_ID = 'platform';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('builds') private readonly queue: Queue,
  ) {}

  async getSettings() {
    await this.ensureSettings();
    const [settings] = await this.prisma.$queryRaw<PlatformSettingsRow[]>`
      SELECT "deploymentsPaused", "defaultProjectLimit"
      FROM "PlatformSettings"
      WHERE "id" = ${PLATFORM_SETTINGS_ID}
      LIMIT 1
    `;
    return settings;
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    await this.ensureSettings();
    const current = await this.getSettings();
    const deploymentsPaused =
      dto.deploymentsPaused ?? current.deploymentsPaused;
    const defaultProjectLimit =
      dto.defaultProjectLimit ?? current.defaultProjectLimit;
    const [settings] = await this.prisma.$queryRaw<PlatformSettingsRow[]>`
      UPDATE "PlatformSettings"
      SET
        "deploymentsPaused" = ${deploymentsPaused},
        "defaultProjectLimit" = ${defaultProjectLimit},
        "updatedAt" = NOW()
      WHERE "id" = ${PLATFORM_SETTINGS_ID}
      RETURNING "deploymentsPaused", "defaultProjectLimit"
    `;
    return settings;
  }

  async overview() {
    const [users, projects, deployments, settings, activeDeployments] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.project.count(),
        this.prisma.deployment.count(),
        this.getSettings(),
        this.prisma.deployment.count({
          where: { status: { in: ['QUEUED', 'BUILDING', 'UPLOADING'] } },
        }),
      ]);
    return { users, projects, deployments, activeDeployments, settings };
  }

  async listUsers(search = '', skip = 0, take = 20) {
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const users = await this.prisma.$queryRaw<AdminUserRow[]>`
      SELECT
        u."id",
        u."email",
        u."username",
        u."role"::text AS "role",
        u."projectLimitOverride",
        u."createdAt",
        u."updatedAt",
        COUNT(DISTINCT p."id")::int AS "projectCount",
        COUNT(DISTINCT g."id")::int AS "githubConnectionCount"
      FROM "User" u
      LEFT JOIN "Project" p ON p."userId" = u."id"
      LEFT JOIN "GitHubConnection" g ON g."userId" = u."id"
      WHERE (
        ${search} = ''
        OR u."email" ILIKE ${`%${search}%`}
        OR u."username" ILIKE ${`%${search}%`}
      )
      GROUP BY u."id"
      ORDER BY u."createdAt" DESC
      OFFSET ${skip}
      LIMIT ${take}
    `;
    const [{ total }] = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      FROM "User" u
      WHERE (
        ${search} = ''
        OR u."email" ILIKE ${`%${search}%`}
        OR u."username" ILIKE ${`%${search}%`}
      )
    `;

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        projectLimitOverride: user.projectLimitOverride,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        _count: {
          projects: user.projectCount,
          githubConnections: user.githubConnectionCount,
        },
      })),
      total,
      skip,
      take,
    };
  }

  async updateUser(id: string, dto: UpdateAdminUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.role) {
      await this.prisma.$executeRaw`
        UPDATE "User"
        SET "role" = ${dto.role}::"UserRole"
        WHERE "id" = ${id}
      `;
    }
    if (dto.projectLimitOverride !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE "User"
        SET "projectLimitOverride" = ${dto.projectLimitOverride}
        WHERE "id" = ${id}
      `;
    }
    const [updated] = await this.prisma.$queryRaw<AdminUserRow[]>`
      SELECT
        u."id",
        u."email",
        u."username",
        u."role"::text AS "role",
        u."projectLimitOverride",
        u."createdAt",
        u."updatedAt",
        COUNT(DISTINCT p."id")::int AS "projectCount",
        COUNT(DISTINCT g."id")::int AS "githubConnectionCount"
      FROM "User" u
      LEFT JOIN "Project" p ON p."userId" = u."id"
      LEFT JOIN "GitHubConnection" g ON g."userId" = u."id"
      WHERE u."id" = ${id}
      GROUP BY u."id"
    `;
    return updated;
  }

  async deleteUser(adminUserId: string, id: string) {
    if (adminUserId === id) {
      throw new ForbiddenException('You cannot delete your own admin account');
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, projects: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      for (const project of user.projects) {
        await this.deleteProjectInTransaction(tx, project.id);
      }
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.organizationMember.deleteMany({ where: { userId: id } });
      await tx.gitHubConnection.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    return { success: true };
  }

  async listProjects(search = '', skip = 0, take = 20) {
    const where: Prisma.ProjectWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { subdomain: { contains: search, mode: 'insensitive' } },
            { repoUrl: { contains: search, mode: 'insensitive' } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, username: true } },
          activeDeploy: true,
          _count: {
            select: {
              deployments: true,
              requestLogs: true,
              customDomains: true,
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { projects, total, skip, take };
  }

  async deleteProject(id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.deleteProjectInTransaction(tx, id);
    });
    return { success: true };
  }

  async listDeployments(skip = 0, take = 20) {
    const [deployments, total] = await Promise.all([
      this.prisma.deployment.findMany({
        skip,
        take,
        orderBy: { deployedAt: 'desc' },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              user: { select: { id: true, email: true, username: true } },
            },
          },
        },
      }),
      this.prisma.deployment.count(),
    ]);

    return { deployments, total, skip, take };
  }

  async cancelDeployment(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!deployment) throw new NotFoundException('Deployment not found');
    if (!['QUEUED', 'BUILDING', 'UPLOADING'].includes(deployment.status)) {
      throw new BadRequestException('Only active deployments can be canceled');
    }

    const job = await this.queue.getJob(id);
    if (job) await job.remove();
    return this.prisma.deployment.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }

  private async ensureSettings() {
    await this.prisma.$executeRaw`
      INSERT INTO "PlatformSettings" ("id", "deploymentsPaused", "defaultProjectLimit", "updatedAt")
      VALUES (${PLATFORM_SETTINGS_ID}, false, 4, NOW())
      ON CONFLICT ("id") DO NOTHING
    `;
  }

  private async deleteProjectInTransaction(
    tx: Prisma.TransactionClient,
    projectId: string,
  ) {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    await tx.project.update({
      where: { id: projectId },
      data: { activeDeployId: null },
    });
    await tx.requestLog.deleteMany({ where: { projectId } });
    await tx.deploymentLogChunk.deleteMany({
      where: { deployment: { projectId } },
    });
    await tx.deployment.deleteMany({ where: { projectId } });
    await tx.gitHubConnection.deleteMany({ where: { projectId } });
    await tx.environmentVariable.deleteMany({ where: { projectId } });
    await tx.customDomain.deleteMany({ where: { projectId } });
    await tx.project.delete({ where: { id: projectId } });
  }
}

type PlatformSettingsRow = {
  deploymentsPaused: boolean;
  defaultProjectLimit: number;
};

type AdminUserRow = {
  id: string;
  email: string;
  username: string | null;
  role: 'USER' | 'ADMIN';
  projectLimitOverride: number | null;
  createdAt: Date;
  updatedAt: Date;
  projectCount: number;
  githubConnectionCount: number;
};
