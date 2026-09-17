import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import type { NotificationService } from '../services/notificationService';
import { HttpError } from '../types/errors';

function actor(request: Parameters<RequestHandler>[0]) {
  if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
  return request.adminUser;
}

function bodyField(request: Parameters<RequestHandler>[0], key: string): unknown {
  const body: unknown = request.body;
  return typeof body === 'object' && body !== null && key in body
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

function bodyString(request: Parameters<RequestHandler>[0], key: string): string {
  const value = bodyField(request, key);
  return typeof value === 'string' ? value : '';
}

export function createNotificationController(service: NotificationService): {
  status: RequestHandler; test: RequestHandler; retry: RequestHandler; process: RequestHandler; webhook: RequestHandler;
} {
  return {
    status: asyncHandler(async (_request, response) => response.json(await service.runtimeStatus())),
    test: asyncHandler(async (request, response) => response.status(202).json(await service.requestTest(bodyString(request, 'recipient'), actor(request), request.correlationId))),
    retry: asyncHandler(async (request, response) => response.json({ requeued: await service.retry(Number(bodyField(request, 'limit')), actor(request), request.correlationId) })),
    process: asyncHandler(async (request, response) => response.json(await service.processMaintenance(Number(bodyField(request, 'limit') ?? 20)))),
    webhook: asyncHandler(async (request, response) => {
      if (!Buffer.isBuffer(request.body)) throw new HttpError(400, 'VALIDATION_ERROR', 'Corpo bruto do webhook ausente.');
      const result = await service.processWebhook(request.body, {
        id: request.header('svix-id') ?? undefined,
        timestamp: request.header('svix-timestamp') ?? undefined,
        signature: request.header('svix-signature') ?? undefined,
      });
      response.status(200).json({ status: result });
    }),
  };
}
