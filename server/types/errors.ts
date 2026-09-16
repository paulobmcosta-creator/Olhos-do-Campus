import type { ApiErrorCode } from '../../src/models/http';

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details?: Record<string, string[]>;

  public constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
