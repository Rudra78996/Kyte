import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { NestExpressApplication } from '@nestjs/platform-express';
import { assertEncryptionConfigured } from './utils/crypto.util';
import type { NextFunction, Request, Response } from 'express';
import { assertWebhookSecretConfigured } from './webhooks/webhook-config';
import helmet from 'helmet';
import { assertProductionConfiguration } from './common/production-config';

async function bootstrap() {
  assertEncryptionConfigured();
  assertWebhookSecretConfigured();
  assertProductionConfiguration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { limit: '64kb', extended: false });
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.originalUrl.length > 2_048) {
      response
        .status(HttpStatus.URI_TOO_LONG)
        .json({ statusCode: HttpStatus.URI_TOO_LONG, message: 'URI too long' });
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const dashboardOrigins = (
    process.env.DASHBOARD_ORIGINS || 'http://localhost,http://localhost:3002'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin(origin, callback) {
      if (!origin || dashboardOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
