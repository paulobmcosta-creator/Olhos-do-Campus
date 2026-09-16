import type { RequestHandler } from 'express';
import type { AppCheckVerifier } from '../types/firebase';
import { HttpError } from '../types/errors';
import { asyncHandler } from './asyncHandler';

export function requireAppCheck(verifier: AppCheckVerifier, enforced: boolean): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const token = request.header('x-firebase-appcheck');
    if (token === undefined || token.trim() === '') {
      if (enforced) {
        next(new HttpError(401, 'APP_CHECK_REQUIRED', 'Firebase App Check Token não informado.'));
        return;
      }
      next();
      return;
    }
    try {
      await verifier.verifyToken(token);
      next();
    } catch (error) {
      console.warn(`App Check rejeitado [${request.correlationId}]:`, error instanceof Error ? error.message : 'erro desconhecido');
      next(new HttpError(403, 'APP_CHECK_INVALID', 'Firebase App Check Token inválido.'));
    }
  });
}
