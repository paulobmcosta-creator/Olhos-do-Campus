import type { RequestHandler } from 'express';
import { HttpError } from '../types/errors';

const METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const HEADERS = 'Authorization, Content-Type, X-Firebase-AppCheck';

export function restrictedCors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (request, response, next) => {
    const origin = request.header('origin');
    if (origin !== undefined) {
      response.setHeader('Vary', 'Origin');
      if (!allowed.has(origin)) {
        next(new HttpError(403, 'FORBIDDEN', 'A origem da solicitação não está autorizada.'));
        return;
      }
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Methods', METHODS);
      response.setHeader('Access-Control-Allow-Headers', HEADERS);
      response.setHeader('Access-Control-Max-Age', '600');
    }
    if (request.method === 'OPTIONS') {
      response.status(204).send();
      return;
    }
    next();
  };
}
