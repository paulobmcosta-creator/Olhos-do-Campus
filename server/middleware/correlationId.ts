import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../utils/logger';

const SAFE_ID = /^[A-Za-z0-9._-]{1,100}$/u;

export const assignCorrelationId: RequestHandler = (request, response, next) => {
  const incoming = request.header('x-request-id');
  request.correlationId = incoming !== undefined && SAFE_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader('X-Request-Id', request.correlationId);
  logger.info('http.request.received', { requestId: request.correlationId, method: request.method, route: request.path });
  next();
};
