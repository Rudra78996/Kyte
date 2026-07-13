import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(userId: string, name: string, slug: string) {
    const normalizedName = name.trim();
    const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (!normalizedName || !normalizedSlug) {
      throw new BadRequestException('Enter a workspace name and URL.');
    }

    // Check if slug exists
    const existing = await this.prisma.organization.findUnique({ where: { slug: normalizedSlug } });
    if (existing) {
      throw new ConflictException({
        message: 'That workspace URL is already in use.',
        suggestedSlug: await this.findAvailableSlug(normalizedSlug),
      });
    }

    // Create org and owner member
    const org = await this.prisma.organization.create({
      data: {
        name: normalizedName,
        slug: normalizedSlug,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });
    return org;
  }

  async getUserOrganizations(userId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
    });
    return members.map(m => ({ ...m.organization, role: m.role }));
  }

  private async findAvailableSlug(baseSlug: string) {
    let suffix = 2;
    let suggestion = `${baseSlug}-${suffix}`;

    while (await this.prisma.organization.findUnique({ where: { slug: suggestion } })) {
      suffix += 1;
      suggestion = `${baseSlug}-${suffix}`;
    }

    return suggestion;
  }

  async getRecentDeployments(userId: string, orgId: string) {
    // Check if user is a member
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { userId, organizationId: orgId } },
    });
    if (!member) throw new BadRequestException('Not a member of this organization');

    const deployments = await this.prisma.deployment.findMany({
      where: { project: { organizationId: orgId } },
      include: { project: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    return deployments;
  }
}
