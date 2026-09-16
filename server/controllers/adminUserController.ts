import type { RequestHandler } from 'express';
import type { AdminAssignee, AdminUser, AuditLog } from '../../src/models/admin';
import { asyncHandler } from '../middleware/asyncHandler';
import type { AdminUserService } from '../services/adminUserService';
import { HttpError } from '../types/errors';
import type {
  AdminUserCreateBody,
  AdminUserIdParams,
  AdminUserUpdateBody,
  BoundedLimitQuery,
  LegacyAdminResolutionBody,
} from '../validators/schemas';

export function createAdminUserController(service: AdminUserService): {
  list: RequestHandler<Record<string, never>, AdminUser[], never, BoundedLimitQuery>;
  assignees: RequestHandler<Record<string, never>, AdminAssignee[]>;
  create: RequestHandler<Record<string, never>, AdminUser, AdminUserCreateBody>;
  update: RequestHandler<AdminUserIdParams, AdminUser, AdminUserUpdateBody>;
  resolveLegacy: RequestHandler<AdminUserIdParams, AdminUser, LegacyAdminResolutionBody>;
  auditLogs: RequestHandler<Record<string, never>, AuditLog[], never, BoundedLimitQuery>;
} {
  return {
    list: asyncHandler(async (request, response) => {
      response.json(await service.list(request.query.limit));
    }),
    assignees: asyncHandler(async (_request, response) => {
      response.json(await service.listAssignees());
    }),
    create: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      const user = await service.create(request.body, request.adminUser, request.correlationId);
      response.status(201).json(user);
    }),
    update: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.update(request.params.id, request.body, request.adminUser, request.correlationId));
    }),
    resolveLegacy: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.resolveLegacy(request.params.id, request.body, request.adminUser, request.correlationId));
    }),
    auditLogs: asyncHandler(async (request, response) => {
      response.json(await service.listAuditLogs(request.query.limit));
    }),
  };
}
