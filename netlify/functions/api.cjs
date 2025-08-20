'use strict';
require('reflect-metadata');

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const serverless = require('serverless-http');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');

// import compiled Nest app (CommonJS)
const { AppModule } = require('../../dist/app.module.js');

let cachedHandler;

// Parse allowlist once
const ALLOW_LIST = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Utility: choose the correct Access-Control-Allow-Origin value
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

  // Strong CORS for actual requests
  app.enableCors({
    origin: (origin, cb) => cb(null, ALLOW_LIST.length ? ALLOW_LIST.includes(origin) ? origin : false : origin),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'], // not required, but handy when inspecting
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.init();

  // IMPORTANT: strip the Netlify prefix so Nest sees /auth/...
  return serverless(expressApp, {
    binary: ['*/*'],
    basePath: '/.netlify/functions/api',
  });
}

exports.handler = async (event, context) => {
  // Fast CORS preflight (OPTIONS) — answer BEFORE booting Nest/Express
  if (event.httpMethod === 'OPTIONS') {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const acrh = (event.headers && (event.headers['access-control-request-headers'] || event.headers['Access-Control-Request-Headers'])) || '';
    const allow = allowOrigin(origin);

    // If your allowlist doesn't include this origin, return 403 (or 204 with no ACAO).
    // Here we return 204 with the first allowed origin to reduce confusion during dev.
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
