// backend/netlify/functions/api.ts
import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// IMPORTANT: import the compiled Nest app (built into dist/)
import { AppModule } from '../../dist/app.module';

let cachedHandler: any;

async function bootstrap() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter, { bufferLogs: true });

  // Security & cookies
  app.use(helmet());
  app.use(cookieParser());

  // CORS – allow your frontend domain(s), comma-separated in CORS_ORIGIN
  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : undefined, credentials: true });

  // Validation like your local main.ts
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Optional Swagger in serverless (served at /.netlify/functions/api/docs)
  if (process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Auth API')
      .setDescription('NestJS Auth API on Netlify Functions')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/docs', app, doc);
  }

  await app.init();

  // Wrap express in serverless-http
  return serverless(expressApp, { binary: ['*/*'] });
}

export const handler = async (event: any, context: any) => {
  // Reuse across invocations (improves cold starts)
  context.callbackWaitsForEmptyEventLoop = false;
  if (!cachedHandler) cachedHandler = await bootstrap();
  return cachedHandler(event, context);
};
