import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('projects/:projectId/deployments')
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(private deploymentsService: DeploymentsService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDeploymentDto,
  ) {
    return this.deploymentsService.create(userId, projectId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.deploymentsService.findAll(
      userId,
      projectId,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get(':deploymentId')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.deploymentsService.findOne(userId, projectId, deploymentId);
  }

  @Post(':deploymentId/rollback')
  async rollback(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.deploymentsService.rollback(userId, projectId, deploymentId);
  }
}
