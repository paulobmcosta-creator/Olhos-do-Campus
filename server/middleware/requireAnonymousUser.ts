import type { RequestHandler } from 'express';
import { HttpError } from '../types/errors';

export const requireAnonymousUser: RequestHandler = (request, _response, next) => {
  if (request.firebaseUser?.provider !== 'anonymous') {
    next(new HttpError(403, 'PROVIDER_NOT_ALLOWED', 'A operação pública exige uma sessão anônima Firebase válida.'));
    return;
  }
  next();
};
