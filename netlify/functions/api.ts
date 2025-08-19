// netlify/functions/api.js  (CommonJS)
require('reflect-metadata');

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const serverless = require('serverless-http');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');

// Import the **compiled** app (CJS)
const { AppModule } = require('../../dist/app.module');

let cachedHandler : any;

async function bootstrap() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, { bufferLogs: true });

  // Security & cookies
  app.use(helmet());
  app.use(cookieParser());

  // CORS (allow multiple origins via CORS_ORIGIN="a,b,c")
  const origins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : undefined,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Validation (same as main.ts)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Optional Swagger at /.netlify/functions/api/docs
  if (process.env.ENABLE_SWAGGER === 'true') {
    const cfg = new DocumentBuilder().setTitle('Auth API').setVersion('1.0').addBearerAuth().build();
    const doc = SwaggerModule.createDocument(app, cfg);
    SwaggerModule.setup('/docs', app, doc);
  }

  await app.init();
  return serverless(expressApp, { binary: ['*/*'] });
}

exports.handler = async (event:any, context:any) => {
  // --- Fast CORS preflight ---
  if (event.httpMethod === 'OPTIONS') {
    const origin = event.headers && event.headers.origin || '';
    const allowList = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const isAllowed = allowList.includes(origin);
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : (allowList[0] || '*'),
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Vary': 'Origin',
      },
    };
  }

  context.callbackWaitsForEmptyEventLoop = false;
  if (!cachedHandler) cachedHandler = await bootstrap();
  return cachedHandler(event, context);
};
