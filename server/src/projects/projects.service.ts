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
        subdomain: this.generateSubdomain(),
        userId,
      },
    });
  }

  async findAll(userId: string, skip = 0, take = 20) {
    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.count({ where: { userId } }),
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
      },
    });
  }

  async delete(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return this.prisma.project.delete({
      where: { id: projectId },
    });
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

  private generateSubdomain(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
