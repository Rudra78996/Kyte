import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateDeploymentDto } from './dto/deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(
    private prisma: PrismaService,
    private projectsService: ProjectsService,
  ) {}

  async create(userId: string, projectId: string, dto: CreateDeploymentDto) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    // Idempotency: check if deployment with same commit already exists and is pending
    const existingPending = await this.prisma.deployment.findFirst({
      where: {
        projectId,
        commitSha: dto.commitSha,
        status: 'QUEUED',
      },
    });

    if (existingPending) {
      return existingPending;
    }

    // Create deployment record
    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        repoUrl: dto.repoUrl,
        branch: dto.branch,
        commitSha: dto.commitSha,
        commitMessage: dto.commitMessage,
        deployedBy: userId,
        status: 'QUEUED',
        triggerSource: (dto.trigger || 'MANUAL').toUpperCase() as any,
        s3Prefix: `${projectId}/${Date.now()}`,
      },
    });

    // TODO: Enqueue job in Phase 3
    // await this.queue.add('deploy', { deploymentId: deployment.id });

    return deployment;
  }

  async findAll(userId: string, projectId: string, skip = 0, take = 20) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    const [deployments, total] = await Promise.all([
      this.prisma.deployment.findMany({
        where: { projectId },
        skip,
        take,
        orderBy: { deployedAt: 'desc' },
      }),
      this.prisma.deployment.count({ where: { projectId } }),
    ]);

    return { deployments, total, skip, take };
  }

  async findOne(userId: string, projectId: string, deploymentId: string) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        logs: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (deployment.projectId !== projectId) {
      throw new ForbiddenException(
        'Deployment does not belong to this project',
      );
    }

    return deployment;
  }

  async rollback(userId: string, projectId: string, deploymentId: string) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (deployment.projectId !== projectId) {
      throw new ForbiddenException(
        'Deployment does not belong to this project',
      );
    }

    if (deployment.status !== 'SUCCESS') {
      throw new NotFoundException('Cannot rollback non-successful deployment');
    }

    // Get previous successful deployment
    const previousDeploy = await this.prisma.deployment.findFirst({
      where: {
        projectId,
        status: 'SUCCESS',
        deployedAt: { lt: deployment.deployedAt },
      },
      orderBy: { deployedAt: 'desc' },
    });

    if (!previousDeploy) {
      throw new NotFoundException('No previous successful deployment found');
    }

    // Create rollback deployment
    const rollbackDeploy = await this.prisma.deployment.create({
      data: {
        projectId,
        repoUrl: previousDeploy.repoUrl,
        branch: previousDeploy.branch,
        commitSha: previousDeploy.commitSha,
        commitMessage: `Rollback to ${previousDeploy.commitSha.slice(0, 7)}`,
        deployedBy: userId,
        status: 'QUEUED',
        triggerSource: 'MANUAL',
        s3Prefix: `${projectId}/${Date.now()}`,
      },
    });

    // TODO: Enqueue rollback job in Phase 3

    return rollbackDeploy;
  }
}
