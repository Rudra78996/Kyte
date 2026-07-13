import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
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
      },
    });
  }

  async findAll(userId: string, skip = 0, take = 20, organizationId?: string) {
    const where = organizationId ? { userId, organizationId } : { userId };
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
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        deployments: {
          orderBy: { deployedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return project;
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
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
      },
    });
  }

  async delete(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organization: { include: { members: true } } }
    });

    if (!project) throw new NotFoundException('Project not found');
    
    // Check ownership or org admin/owner
    const isOwner = project.userId === userId;
    const orgMember = project.organization?.members.find(m => m.userId === userId);
    const hasOrgAccess = orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role);

    if (!isOwner && !hasOrgAccess) {
      throw new ForbiddenException('You do not have permission to delete this project');
    }

    // Unset activeDeployId first to break cyclic relation constraint
    await this.prisma.project.update({
      where: { id: projectId },
      data: { activeDeployId: null }
    });

    // Delete in transaction
    await this.prisma.$transaction([
      this.prisma.requestLog.deleteMany({ where: { projectId } }),
      this.prisma.deploymentLogChunk.deleteMany({ where: { deployment: { projectId } } }),
      this.prisma.deployment.deleteMany({ where: { projectId } }),
      this.prisma.gitHubConnection.deleteMany({ where: { projectId } }),
      this.prisma.project.delete({ where: { id: projectId } })
    ]);

    return { success: true, message: 'Project deleted successfully' };
  }

  async enableWebhook(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('You do not have access to this project');

    if (project.webhookId) {
      return { success: true, message: 'Webhook is already enabled for this project!' };
    }

    const githubConnection = await this.prisma.gitHubConnection.findFirst({
      where: { userId },
    });

    if (!githubConnection || !githubConnection.accessTokenEncrypted) {
      throw new BadRequestException('GitHub account is not connected or missing token. Please connect your GitHub account in settings.');
    }

    const accessToken = Buffer.from(githubConnection.accessTokenEncrypted, 'base64').toString('utf-8');

    let repoUrl = project.repoUrl.replace(/\.git$/, '');
    const urlParts = repoUrl.split('/');
    const repo = urlParts.pop();
    const owner = urlParts.pop();

    if (!owner || !repo) {
      throw new BadRequestException('Invalid GitHub repository URL format');
    }

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret is not configured on the server');
    }

    const baseDomain = process.env.BASE_DOMAIN || 'deployly.local';
    const webhookUrl = process.env.WEBHOOK_CALLBACK_URL || `https://${baseDomain}/api/webhooks/github`;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
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
          insecure_ssl: '0'
        }
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      // 422 means hook already exists
      if (res.status === 422 && errorData.errors?.some((e: any) => e.message?.includes('Hook already exists'))) {
        // Just mark it as enabled in DB
        await this.prisma.project.update({
          where: { id: projectId },
          data: { webhookId: 'existing_hook' }
        });
        return { success: true, message: 'Webhook was already configured on GitHub. Enabled in dashboard!' };
      }
      throw new BadRequestException(`Failed to create webhook: ${errorData.message || res.statusText}`);
    }

    const hookData = await res.json();
    
    await this.prisma.project.update({
      where: { id: projectId },
      data: { webhookId: hookData.id.toString() }
    });

    return { success: true, message: 'Webhook successfully created on GitHub!' };
  }

  async getMetrics(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('You do not have access to this project');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalRequests, uniqueVisitorsCount, avgResponseAgg] = await Promise.all([
      this.prisma.requestLog.count({ where: { projectId, timestamp: { gte: sevenDaysAgo } } }),
      
      this.prisma.requestLog.groupBy({
        by: ['ipAddress'],
        where: { projectId, timestamp: { gte: sevenDaysAgo }, ipAddress: { not: null } }
      }),

      this.prisma.requestLog.aggregate({
        where: { projectId, timestamp: { gte: sevenDaysAgo } },
        _avg: { responseTime: true }
      })
    ]);

    const visitors = uniqueVisitorsCount.length;
    const avgResponse = Math.round(avgResponseAgg._avg.responseTime || 0);

    const allLogs = await this.prisma.requestLog.findMany({
      where: { projectId, timestamp: { gte: sevenDaysAgo } },
      select: { timestamp: true, ipAddress: true, country: true, countryCode: true }
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trafficMap = new Map<string, { pageviews: number, ips: Set<string> }>();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      trafficMap.set(days[d.getDay()], { pageviews: 0, ips: new Set() });
    }

    const locationsMap = new Map<string, { code: string, visitors: Set<string> }>();

    for (const log of allLogs) {
      const dayStr = days[log.timestamp.getDay()];
      if (trafficMap.has(dayStr)) {
        const t = trafficMap.get(dayStr)!;
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

    const trafficData = Array.from(trafficMap.entries()).map(([day, data]) => ({
      day,
      pageviews: data.pageviews,
      visitors: data.ips.size
    }));

    const locationsList = Array.from(locationsMap.entries()).map(([country, data]) => ({
      country,
      code: data.code,
      visitors: data.visitors.size,
      share: 0
    })).sort((a, b) => b.visitors - a.visitors).slice(0, 5);

    const totalLocVisitors = locationsList.reduce((acc, l) => acc + l.visitors, 0);
    locationsList.forEach(l => {
      l.share = totalLocVisitors > 0 ? Math.round((l.visitors / totalLocVisitors) * 100) : 0;
    });

    const deployments = await this.prisma.deployment.findMany({
      where: { projectId },
      orderBy: { deployedAt: 'desc' },
      take: 20
    });

    let successful = 0;
    let failed = 0;
    let totalBuildTime = 0;
    let validBuilds = 0;

    deployments.forEach(d => {
      if (d.status === 'SUCCESS') successful++;
      if (d.status === 'FAILED') failed++;
      if ((d.status === 'SUCCESS' || d.status === 'FAILED') && d.updatedAt > d.deployedAt) {
        totalBuildTime += (d.updatedAt.getTime() - d.deployedAt.getTime());
        validBuilds++;
      }
    });

    const avgBuild = validBuilds > 0 ? Math.round((totalBuildTime / validBuilds) / 1000) : 0;
    const health = deployments.length > 0 ? Math.round((successful / deployments.length) * 100) : 100;

    return {
      pageviews: totalRequests,
      visitors,
      avgResponse,
      avgBuild,
      health,
      successfulDeployments: successful,
      failedDeployments: failed,
      totalDeployments: deployments.length,
      trafficData,
      locations: locationsList
    };
  }


  private generateSubdomain(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
