import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
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

  private generateSubdomain(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
