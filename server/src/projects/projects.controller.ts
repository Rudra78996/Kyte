import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('organizationId') organizationId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.projectsService.findAll(
      userId,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
      organizationId,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.findOne(userId, projectId);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(userId, projectId, dto);
  }

  @Get(':id/metrics')
  async getMetrics(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.getMetrics(userId, projectId);
  }

  @Post(':id/webhook/enable')
  async enableWebhook(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.enableWebhook(userId, projectId);
  }

  @Delete(':id')
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.delete(userId, projectId);
  }

  @Get(':id/env')
  async getEnv(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.getEnvironmentVariables(userId, projectId);
  }

  @Post(':id/env')
  async upsertEnv(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() body: { variables: { key: string; value: string }[] },
  ) {
    return this.projectsService.upsertEnvironmentVariables(userId, projectId, body.variables);
  }

  @Delete(':id/env/:key')
  async deleteEnv(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Param('key') key: string,
  ) {
    return this.projectsService.deleteEnvironmentVariable(userId, projectId, key);
  }
  @Post(':id/domains')
  async addDomain(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() body: { domainName: string },
  ) {
    return this.projectsService.addDomain(userId, projectId, body.domainName);
  }

  @Get(':id/domains')
  async getDomains(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.getDomains(userId, projectId);
  }

  @Delete(':id/domains/:domainName')
  async deleteDomain(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Param('domainName') domainName: string,
  ) {
    return this.projectsService.deleteDomain(userId, projectId, domainName);
  }

  @Post(':id/domains/:domainName/verify')
  async verifyDomain(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Param('domainName') domainName: string,
  ) {
    return this.projectsService.verifyDomain(userId, projectId, domainName);
  }
}
