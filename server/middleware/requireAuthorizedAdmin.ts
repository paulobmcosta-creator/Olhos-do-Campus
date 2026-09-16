import type { RequestHandler } from 'express';
import type { AdminAuthorizationService } from '../services/adminAuthorizationService';
import { HttpError } from '../types/errors';
import { asyncHandler } from './asyncHandler';

export function requireAuthorizedAdmin(service: AdminAuthorizationService, recordAuthorizedLogin = false): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    if (request.firebaseUser === undefined) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'A identidade Firebase não foi validada.'));
      return;
    }
    try {
      request.adminUser = await service.authorize(request.firebaseUser, request.correlationId, recordAuthorizedLogin);
      next();
    } catch (error) {
      next(error);
    }
  });
}
