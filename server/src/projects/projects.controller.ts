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
import {
  CreateProjectDto,
  DomainDto,
  EnvironmentVariablesDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MetricsQueryDto, ProjectListQueryDto } from '../common/request.dto';
import {
  EnvironmentKeyPipe,
  ResourceIdPipe,
} from '../common/security-validation.pipe';

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
    @Query() query: ProjectListQueryDto,
  ) {
    return this.projectsService.findAll(
      userId,
      query.skip,
      query.take,
      query.organizationId,
    );
  }

  @Get('limits')
  async getProjectLimit(@CurrentUser('id') userId: string) {
    return this.projectsService.getProjectLimit(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
  ) {
    return this.projectsService.findOne(userId, projectId);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(userId, projectId, dto);
  }

  @Get(':id/metrics')
  async getMetrics(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
    @Query() query: MetricsQueryDto,
  ) {
    return this.projectsService.getMetrics(userId, projectId, query.days);
  }

  @Post(':id/webhook/enable')
  async enableWebhook(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
  ) {
    return this.projectsService.enableWebhook(userId, projectId);
  }

  @Get(':id/webhook')
  async getWebhookStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
  ) {
    return this.projectsService.getWebhookStatus(userId, projectId);
  }

  @Delete(':id/webhook')
  async disableWebhook(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
  ) {
    return this.projectsService.disableWebhook(userId, projectId);
  }

  @Delete(':id')
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
  ) {
    return this.projectsService.delete(userId, projectId);
  }

  @Get(':id/env')
  async getEnv(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
  ) {
    return this.projectsService.getEnvironmentVariables(userId, projectId);
  }

  @Post(':id/env')
  async upsertEnv(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
    @Body() body: EnvironmentVariablesDto,
  ) {
    return this.projectsService.upsertEnvironmentVariables(
      userId,
      projectId,
      body.variables,
    );
  }

  @Delete(':id/env/:key')
  async deleteEnv(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
    @Param('key', EnvironmentKeyPipe) key: string,
  ) {
    return this.projectsService.deleteEnvironmentVariable(
      userId,
      projectId,
      key,
    );
  }
  @Post(':id/domains')
  async addDomain(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
    @Body() body: DomainDto,
  ) {
    return this.projectsService.addDomain(userId, projectId, body.domainName);
  }

  @Get(':id/domains')
  async getDomains(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
  ) {
    return this.projectsService.getDomains(userId, projectId);
  }

  @Delete(':id/domains/:domainName')
  async deleteDomain(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
    @Param('domainName') domainName: string,
  ) {
    return this.projectsService.deleteDomain(userId, projectId, domainName);
  }

  @Post(':id/domains/:domainName/verify')
  async verifyDomain(
    @CurrentUser('id') userId: string,
    @Param('id', ResourceIdPipe) projectId: string,
    @Param('domainName') domainName: string,
  ) {
    return this.projectsService.verifyDomain(userId, projectId, domainName);
  }
}
