import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import { GithubWebhookGuard } from './github-webhook.guard';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseGuards(GithubWebhookGuard)
  @HttpCode(200)
  async handleGithubWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: unknown,
  ) {
    if (event === 'ping') {
      return { message: 'pong' };
    }

    if (event === 'push') {
      await this.webhooksService.handlePushEvent(deliveryId, payload || {});
    }

    // Return success to GitHub
    return { received: true };
  }
}
