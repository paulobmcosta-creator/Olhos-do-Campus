import type { RequestHandler } from 'express';
import type { AuthorizedAdminProfile } from '../../src/models/admin';
import { HttpError } from '../types/errors';

export type AdminSessionHandler = RequestHandler<Record<string, never>, { user: AuthorizedAdminProfile }>;

export const adminSessionController: AdminSessionHandler = (request, response) => {
  if (request.adminUser === undefined) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa não autorizada.');
  }
  response.json({ user: request.adminUser });
};
