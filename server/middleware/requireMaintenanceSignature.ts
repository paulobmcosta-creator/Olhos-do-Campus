import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { HttpError } from '../types/errors';
import { asyncHandler } from './asyncHandler';

export function computeBodyDigest(body: Buffer | string | undefined): string {
  const buf = typeof body === 'string'
    ? Buffer.from(body, 'utf8')
    : (body ?? Buffer.from(''));
  return createHash('sha256').update(buf).digest('hex');
}

export function maintenanceSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  bodyDigest: string,
): string {
  return createHmac('sha256', secret)
    .update(`${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyDigest}`, 'utf8')
    .digest('hex');
}

async function resolveRawBody(request: Request): Promise<Buffer> {
  if (request.rawBody !== undefined) {
    return request.rawBody;
  }
  if (!request.readableEnded && request.readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    const combined = Buffer.concat(chunks);
    request.rawBody = combined;
    return combined;
  }
  const bodyUnknown: unknown = request.body;
  if (Buffer.isBuffer(bodyUnknown)) {
    return bodyUnknown;
  }
  if (typeof bodyUnknown === 'string') {
    return Buffer.from(bodyUnknown, 'utf8');
  }
  if (typeof bodyUnknown === 'object' && bodyUnknown !== null && Object.keys(bodyUnknown).length > 0) {
    return Buffer.from(JSON.stringify(bodyUnknown), 'utf8');
  }
  return Buffer.from('');
}

export function requireMaintenanceSignature(secret: string | undefined, replayWindowSeconds = 300): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    if (secret === undefined || secret.length < 32) {
      next(new HttpError(503, 'CONFIGURATION_ERROR', 'A autenticação de manutenção não está configurada.'));
      return;
    }
    const timestamp = request.header('x-maintenance-timestamp');
    const signature = request.header('x-maintenance-signature');
    if (timestamp === undefined || signature === undefined || !/^\d{10}$/u.test(timestamp) || !/^[a-f0-9]{64}$/u.test(signature)) {
      next(new HttpError(401, 'MAINTENANCE_SIGNATURE_INVALID', 'Assinatura de manutenção inválida.'));
      return;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - Number(timestamp)) > replayWindowSeconds) {
      next(new HttpError(401, 'MAINTENANCE_SIGNATURE_INVALID', 'A assinatura de manutenção expirou.'));
      return;
    }

    const rawBody = await resolveRawBody(request);
    const bodyDigest = computeBodyDigest(rawBody);
    const path = request.originalUrl.split('?')[0] ?? request.path;
    const expected = maintenanceSignature(secret, request.method, path, timestamp, bodyDigest);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      next(new HttpError(401, 'MAINTENANCE_SIGNATURE_INVALID', 'Assinatura de manutenção inválida.'));
      return;
    }
    next();
  });
}
