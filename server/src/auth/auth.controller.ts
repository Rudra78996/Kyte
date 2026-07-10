import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Response } from 'express';

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
    const state = await this.authService.generateGithubState(user.id);
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost/api/auth/github/callback';
    // Requesting repo scope for webhooks and repo access
    const scope = 'repo,admin:repo_hook,read:user';
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
    
    return { url };
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api', '') || 'http://localhost';
    if (!code || !state) {
      return res.redirect(`${frontendUrl}/settings?github=error`);
    }
    
    try {
      await this.authService.handleGithubCallback(code, state);
      return res.redirect(`${frontendUrl}/settings?github=connected`);
    } catch (e) {
      return res.redirect(`${frontendUrl}/settings?github=error`);
    }
  }
}
