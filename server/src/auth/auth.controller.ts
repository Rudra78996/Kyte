import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GithubCallbackDto } from './dto/github-callback.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  @Get('github/connect')
  @UseGuards(JwtAuthGuard)
  async githubConnect(@CurrentUser() user: AuthenticatedUser) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri =
      process.env.GITHUB_CALLBACK_URL || 'http://localhost/github/callback';
    // Requesting repo scope for webhooks and repo access
    const scope = 'repo,admin:repo_hook,read:user';
    if (!clientId) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }
    const state = await this.authService.generateGithubState(user.id);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      prompt: 'select_account',
    });
    const url = `https://github.com/login/oauth/authorize?${params}`;

    return { url };
  }

  @Get('github/repos')
  @UseGuards(JwtAuthGuard)
  async githubRepos(@CurrentUser() user: AuthenticatedUser) {
    const repos = await this.authService.githubRepos(user);
    return { repos };
  }

  @Delete('github/disconnect')
  @UseGuards(JwtAuthGuard)
  disconnectGithub(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.disconnectGithub(user);
  }

  @Post('github/callback')
  @UseGuards(JwtAuthGuard)
  async githubCallback(
    @Body() callback: GithubCallbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authService.handleGithubCallback(
      callback.code,
      callback.state,
      user.id,
    );
    return { connected: true };
  }
}
