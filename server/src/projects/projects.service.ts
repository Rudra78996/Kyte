import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { encrypt, decrypt } from '../utils/crypto.util';

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
        environmentVariables: {
          create: dto.environmentVariables?.map(v => {
            const encrypted = encrypt(v.value);
            return {
              key: v.key,
              encryptedValue: encrypted.encryptedValue,
              iv: encrypted.iv,
            };
          }) || [],
        },
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

  async getEnvironmentVariables(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { environmentVariables: true },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Access denied');

    return project.environmentVariables.map(env => ({
      key: env.key,
      value: decrypt(env.encryptedValue, env.iv),
    }));
  }

  async upsertEnvironmentVariables(userId: string, projectId: string, variables: { key: string; value: string }[]) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Access denied');

    const result = await this.prisma.$transaction(
      variables.map(v => {
        const encrypted = encrypt(v.value);
        return this.prisma.environmentVariable.upsert({
          where: {
            projectId_key: { projectId, key: v.key }
          },
          update: {
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
          },
          create: {
            projectId,
            key: v.key,
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
          }
        });
      })
    );

    return { success: true, count: result.length };
  }

  async deleteEnvironmentVariable(userId: string, projectId: string, key: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.userId !== userId) throw new ForbiddenException('Access denied');

    try {
      await this.prisma.environmentVariable.delete({
        where: {
          projectId_key: { projectId, key }
        }
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

    const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
    const localHostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:localhost|local)$/;
    if (!hostnamePattern.test(normalized) && !localHostnamePattern.test(normalized)) {
      throw new BadRequestException('Enter a valid hostname, without a port, path, or wildcard');
    }

    const baseDomain = (process.env.BASE_DOMAIN || '').trim().toLowerCase().replace(/\.$/, '');
    if (normalized === baseDomain) {
      throw new BadRequestException('This hostname is reserved for the Kyte application');
    }
    return normalized;
  }

  private serializeDomain(domain: { domainName: string; verificationToken: string; status: string; verifiedAt: Date | null; createdAt: Date }) {
    const routingTarget = process.env.DOMAIN_CNAME_TARGET || process.env.BASE_DOMAIN || 'your-kyte-hostname';
    return {
      ...domain,
      dnsRecords: {
        routing: { type: 'CNAME', name: domain.domainName, value: routingTarget },
        verification: { type: 'TXT', name: `_kyte.${domain.domainName}`, value: domain.verificationToken },
      },
    };
  }

  async addDomain(userId: string, projectId: string, domainName: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('Access denied');

    const normalizedDomain = this.normalizeDomain(domainName);

    const existing = await this.prisma.customDomain.findUnique({ where: { domainName: normalizedDomain } });
    if (existing) {
      if (existing.projectId === projectId) return this.serializeDomain(existing);
      throw new BadRequestException('Domain is already associated with another project');
    }

    const token = `kyte-verify=${randomBytes(16).toString('hex')}`;
    const domain = await this.prisma.customDomain.create({
      data: {
        projectId,
        domainName: normalizedDomain,
        verificationToken: token,
        status: 'pending'
      }
    });
    return this.serializeDomain(domain);
  }

  async getDomains(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('Access denied');

    const domains = await this.prisma.customDomain.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map((domain) => this.serializeDomain(domain));
  }

  async deleteDomain(userId: string, projectId: string, domainName: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('Access denied');

    const normalizedDomain = this.normalizeDomain(domainName);
    await this.prisma.customDomain.deleteMany({
      where: { projectId, domainName: normalizedDomain }
    });
    return { success: true };
  }

  async verifyDomain(userId: string, projectId: string, domainName: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new ForbiddenException('Access denied');

    const normalizedDomain = this.normalizeDomain(domainName);
    const domain = await this.prisma.customDomain.findUnique({ where: { domainName: normalizedDomain } });
    if (!domain || domain.projectId !== projectId) throw new NotFoundException('Domain not found in this project');

    if (domain.status === 'verified') {
      return { status: 'verified', message: 'Domain is already verified' };
    }

    const isLocalDomain = normalizedDomain.endsWith('.localhost') || normalizedDomain.endsWith('.local');
    if (process.env.NODE_ENV !== 'production' && isLocalDomain) {
      await this.prisma.customDomain.update({
        where: { id: domain.id },
        data: { status: 'verified', verifiedAt: new Date() }
      });
      return { status: 'verified', message: 'Domain automatically verified for local development' };
    }

    try {
      const records = await resolveTxt(`_kyte.${normalizedDomain}`);
      const txtValues = records.flat();
      if (txtValues.includes(domain.verificationToken)) {
        await this.prisma.customDomain.update({
          where: { id: domain.id },
          data: { status: 'verified', verifiedAt: new Date() }
        });
        return { status: 'verified', message: 'Domain verified successfully!' };
      }
    } catch (err) {
      console.error(`DNS lookup failed for ${normalizedDomain}`, err);
    }

    return { status: 'pending', error: 'DNS records not found or not propagated yet. Please add a TXT record for _kyte.' };
  }
}
