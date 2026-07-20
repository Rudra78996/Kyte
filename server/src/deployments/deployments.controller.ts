import { Throttle } from '@nestjs/throttler';
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DeploymentsService } from './deployments.service';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationDto } from '../common/request.dto';
import { ResourceIdPipe } from '../common/security-validation.pipe';

@Controller('projects/:projectId/deployments')
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(private deploymentsService: DeploymentsService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('projectId', ResourceIdPipe) projectId: string,
    @Body() dto: CreateDeploymentDto,
  ) {
    return this.deploymentsService.create(userId, projectId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Param('projectId', ResourceIdPipe) projectId: string,
    @Query() query: PaginationDto,
  ) {
    return this.deploymentsService.findAll(
      userId,
      projectId,
      query.skip,
      query.take,
    );
  }

  @Get(':deploymentId')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('projectId', ResourceIdPipe) projectId: string,
    @Param('deploymentId', ResourceIdPipe) deploymentId: string,
  ) {
    return this.deploymentsService.findOne(userId, projectId, deploymentId);
  }

  @Post(':deploymentId/rollback')
  async rollback(
    @CurrentUser('id') userId: string,
    @Param('projectId', ResourceIdPipe) projectId: string,
    @Param('deploymentId', ResourceIdPipe) deploymentId: string,
  ) {
    return this.deploymentsService.rollback(userId, projectId, deploymentId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Sse(':deploymentId/logs')
  async streamLogs(
    @CurrentUser('id') userId: string,
    @Param('projectId', ResourceIdPipe) projectId: string,
    @Param('deploymentId', ResourceIdPipe) deploymentId: string,
  ): Promise<Observable<MessageEvent>> {
    return this.deploymentsService.streamLogs(userId, projectId, deploymentId);
  }
}
