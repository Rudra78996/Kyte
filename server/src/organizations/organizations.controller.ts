import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateOrganizationDto } from './dto/organization.dto';
import { ResourceIdPipe } from '../common/security-validation.pipe';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(user.id, body.name, body.slug);
  }

  @Get()
  async getUserOrganizations(@CurrentUser() user: AuthenticatedUser) {
    const orgs = await this.organizationsService.getUserOrganizations(user.id);
    return { organizations: orgs };
  }

  @Get(':id/deployments')
  async getRecentDeployments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ResourceIdPipe) id: string,
  ) {
    const deployments = await this.organizationsService.getRecentDeployments(user.id, id);
    return { deployments };
  }
}
