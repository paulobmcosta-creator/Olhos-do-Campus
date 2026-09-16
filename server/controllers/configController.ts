import type { RequestHandler } from 'express';
import type { BootstrapData, SystemConfig } from '../../src/models/config';
import { asyncHandler } from '../middleware/asyncHandler';
import type { ConfigService } from '../services/configService';
import { HttpError } from '../types/errors';
import type { ConfigUpdateBody } from '../validators/schemas';

export function createConfigController(service: ConfigService): {
  getBootstrap: RequestHandler<Record<string, never>, BootstrapData>;
  getOperational: RequestHandler<Record<string, never>, { config: SystemConfig }>;
  update: RequestHandler<Record<string, never>, { config: SystemConfig }, ConfigUpdateBody>;
} {
  return {
    getBootstrap: asyncHandler(async (_request, response) => response.json(await service.getBootstrap())),
    getOperational: asyncHandler(async (_request, response) => response.json({ config: await service.getOperationalConfig() })),
    update: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json({ config: await service.updateConfig(request.body, request.adminUser, request.correlationId) });
    }),
  };
}
