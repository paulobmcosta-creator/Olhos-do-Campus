import type { RequestHandler } from 'express';
import type { AdminRole } from '../../src/models/admin';
import { HttpError } from '../types/errors';

export function requireRole(...roles: AdminRole[]): RequestHandler {
  const allowed = new Set(roles);
  return (request, _response, next) => {
    if (request.adminUser === undefined || !allowed.has(request.adminUser.role)) {
      next(new HttpError(403, 'FORBIDDEN', 'O papel administrativo autenticado não possui permissão para esta operação.'));
      return;
    }
    next();
  };
}
