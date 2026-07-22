import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResourceIdPipe } from '../common/security-validation.pipe';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import {
  AdminListQueryDto,
  AdminProjectListQueryDto,
  UpdateAdminUserDto,
  UpdatePlatformSettingsDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('settings')
  settings() {
    return this.admin.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.admin.updateSettings(dto);
  }

  @Get('users')
  users(@Query() query: AdminListQueryDto) {
    return this.admin.listUsers(query.search, query.skip, query.take);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', ResourceIdPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.admin.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(
    @CurrentUser('id') adminUserId: string,
    @Param('id', ResourceIdPipe) id: string,
  ) {
    return this.admin.deleteUser(adminUserId, id);
  }

  @Get('projects')
  projects(@Query() query: AdminProjectListQueryDto) {
    return this.admin.listProjects(
      query.search,
      query.skip,
      query.take,
      query.sort,
      query.order,
    );
  }

  @Delete('projects/:id')
  deleteProject(@Param('id', ResourceIdPipe) id: string) {
    return this.admin.deleteProject(id);
  }

  @Get('deployments')
  deployments(@Query() query: AdminListQueryDto) {
    return this.admin.listDeployments(query.skip, query.take);
  }

  @Post('deployments/:id/cancel')
  cancelDeployment(@Param('id', ResourceIdPipe) id: string) {
    return this.admin.cancelDeployment(id);
  }
}
