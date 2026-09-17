import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../types/errors';
import { logger } from '../utils/logger';

export const apiNotFound: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, 'NOT_FOUND', 'Rota de API não encontrada.'));
};

function hasType(error: unknown, type: string): boolean {
  return typeof error === 'object' && error !== null && 'type' in error && error.type === type;
}

function firebaseUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = String(error.code);
  return code.includes('unavailable')
    || code.includes('deadline-exceeded')
    || code.includes('credential')
    || code.includes('network');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  const correlationId = request.correlationId;
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        correlationId,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }
  if (hasType(error, 'entity.parse.failed')) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'O corpo contém JSON inválido.', correlationId } });
    return;
  }
  if (hasType(error, 'entity.too.large')) {
    response.status(413).json({ error: { code: 'VALIDATION_ERROR', message: 'O corpo excede o limite permitido.', correlationId } });
    return;
  }
  if (firebaseUnavailable(error)) {
    logger.error('http.error.firebase_unavailable', { requestId: correlationId, errorCode: 'FIREBASE_UNAVAILABLE', status: 503 });
    response.status(503).json({
      error: {
        code: 'FIREBASE_UNAVAILABLE',
        message: 'Os serviços de autenticação ou autorização estão temporariamente indisponíveis.',
        correlationId,
      },
    });
    return;
  }
  logger.error('http.error.unhandled', { requestId: correlationId, errorCode: 'INTERNAL_ERROR', status: 500 });
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'O serviço encontrou um erro interno e não concluiu a solicitação.',
      correlationId,
    },
  });
};
