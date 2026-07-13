import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @CurrentUser() user: any,
    @Body() body: { name: string; slug: string }
  ) {
    return this.organizationsService.createOrganization(user.id, body.name, body.slug);
  }

  @Get()
  async getUserOrganizations(@CurrentUser() user: any) {
    const orgs = await this.organizationsService.getUserOrganizations(user.id);
    return { organizations: orgs };
  }

  @Get(':id/deployments')
  async getRecentDeployments(@CurrentUser() user: any, @Param('id') id: string) {
    const deployments = await this.organizationsService.getRecentDeployments(user.id, id);
    return { deployments };
  }
}
