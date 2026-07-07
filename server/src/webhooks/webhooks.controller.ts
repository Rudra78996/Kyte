import { Controller, Post, Headers, Body, UseGuards, HttpCode } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { GithubWebhookGuard } from './github-webhook.guard';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @UseGuards(GithubWebhookGuard)
  @HttpCode(200)
  async handleGithubWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: any,
  ) {
    if (event === 'ping') {
      return { message: 'pong' };
    }

    if (event === 'push') {
      await this.webhooksService.handlePushEvent(deliveryId, payload);
    }

    // Return success to GitHub
    return { received: true };
  }
}
