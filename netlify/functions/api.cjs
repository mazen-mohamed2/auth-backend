'use strict';
require('reflect-metadata');

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const serverless = require('serverless-http');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');

const { AppModule } = require('../../dist/app.module.js');

let cachedHandler;

const ALLOW_LIST = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function allowOrigin(origin) {
  if (!origin) return ALLOW_LIST[0] || '';
  return ALLOW_LIST.includes(origin) ? origin : (ALLOW_LIST[0] || '');
}

async function bootstrap() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, { bufferLogs: true });

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: (origin, cb) => cb(null, ALLOW_LIST.length ? ALLOW_LIST.includes(origin) ? origin : false : origin),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'], 
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.init();

  return serverless(expressApp, {
    binary: ['*/*'],
    basePath: '/.netlify/functions/api',
  });
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const acrh = (event.headers && (event.headers['access-control-request-headers'] || event.headers['Access-Control-Request-Headers'])) || '';
    const allow = allowOrigin(origin);

  
    const headers = {
      'Access-Control-Allow-Origin': allow || origin || '',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': acrh || 'Content-Type, Authorization, X-Requested-With',
      'Vary': 'Origin',
    };

    return { statusCode: 204, headers };
  }

  context.callbackWaitsForEmptyEventLoop = false;
  if (!cachedHandler) cachedHandler = await bootstrap();
  return cachedHandler(event, context);
};
