import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Import the compiled Nest app AFTER build (exists because `npm run build` ran)
import { AppModule } from '../../dist/app.module';

let cachedHandler: any;

async function bootstrap() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, { bufferLogs: true });

  app.use(helmet());
  app.use(cookieParser());

  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : undefined, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (process.env.ENABLE_SWAGGER === 'true') {
    const cfg = new DocumentBuilder().setTitle('Auth API').setVersion('1.0').addBearerAuth().build();
    const doc = SwaggerModule.createDocument(app, cfg);
    SwaggerModule.setup('/docs', app, doc);
  }

  await app.init();
  return serverless(expressApp, { binary: ['*/*'] });
}

export const handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (!cachedHandler) cachedHandler = await bootstrap();
  return cachedHandler(event, context);
};
