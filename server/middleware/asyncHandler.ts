import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler<P = Record<string, string>, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown>(
  handler: (request: Request<P, ResBody, ReqBody, ReqQuery>, response: Response<ResBody>, next: NextFunction) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}
