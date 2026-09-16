import type { RequestHandler } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';
import { HttpError } from '../types/errors';

function formatDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'request';
    details[key] = [...(details[key] ?? []), issue.message];
  }
  return details;
}

function validationError(message: string, error: ZodError): HttpError {
  return new HttpError(400, 'VALIDATION_ERROR', message, formatDetails(error));
}

export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(validationError('Os dados enviados não passaram pela validação.', result.error));
      return;
    }
    request.body = result.data as unknown;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      next(validationError('Os parâmetros de consulta não passaram pela validação.', result.error));
      return;
    }
    for (const key of Object.keys(request.query)) {
      delete request.query[key];
    }
    Object.assign(request.query, result.data);
    next();
  };
}

export function validateParams(schema: ZodTypeAny): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(validationError('O identificador informado não é válido.', result.error));
      return;
    }
    for (const key of Object.keys(request.params)) {
      delete request.params[key];
    }
    Object.assign(request.params, result.data);
    next();
  };
}
