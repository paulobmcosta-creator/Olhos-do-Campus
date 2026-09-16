import type { RequestHandler } from 'express';
import type { FirebaseTokenVerifier } from '../types/firebase';
import { HttpError } from '../types/errors';
import { asyncHandler } from './asyncHandler';

function bearerToken(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;
  const match = /^Bearer\s+([^\s]+)$/iu.exec(header.trim());
  return match?.[1];
}

export function requireFirebaseUser(verifier: FirebaseTokenVerifier): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const token = bearerToken(request.header('authorization'));
    if (token === undefined) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Firebase ID Token não informado.'));
      return;
    }
    try {
      request.firebaseUser = await verifier.verifyIdToken(token);
      next();
    } catch (error) {
      console.warn(`ID Token rejeitado [${request.correlationId}]:`, error instanceof Error ? error.message : 'erro desconhecido');
      next(new HttpError(401, 'INVALID_TOKEN', 'Firebase ID Token inválido, expirado ou revogado.'));
    }
  });
}
