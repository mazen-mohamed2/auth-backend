'use strict';
require('reflect-metadata');

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const serverless = require('serverless-http');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');

// 👇 import the compiled (CommonJS) file from dist
const { AppModule } = require('../../dist/app.module.js');

let cachedHandler;

async function bootstrap() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, { bufferLogs: true });

  app.use(helmet());
  app.use(cookieParser());

  // CORS
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

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.init();
return serverless(expressApp, {
  binary: ['*/*'],
  basePath: '/.netlify/functions/api',   // 👈 strip the Netlify function prefix
});}

exports.handler = async (event, context) => {
  // --- Fast CORS preflight (fixes empty/blocked requests) ---
  if (event.httpMethod === 'OPTIONS') {
    const origin = (event.headers && event.headers.origin) || '';
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
