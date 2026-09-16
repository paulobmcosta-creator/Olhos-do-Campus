import { z } from 'zod';
import { getAdminIdToken } from '../auth/adminAuth';
import { getPublicIdToken } from '../auth/publicAuth';
import { FRONTEND_ENV } from '../config/env';
import type { ApiErrorCode } from '../models/http';
import { getAppCheckToken } from './firebase/appCheckTokenService';

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code: ApiErrorCode,
    public readonly details?: Record<string, string[]>,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const errorCodes = [
  'VALIDATION_ERROR', 'UNAUTHENTICATED', 'INVALID_TOKEN', 'APP_CHECK_REQUIRED', 'APP_CHECK_INVALID',
  'FORBIDDEN', 'ADMIN_NOT_AUTHORIZED', 'ADMIN_INACTIVE', 'DOMAIN_NOT_ALLOWED', 'PROVIDER_NOT_ALLOWED',
  'EMAIL_NOT_VERIFIED', 'UID_MISMATCH', 'NOT_FOUND', 'CONFLICT',
  'PHOTO_TOO_LARGE', 'PHOTO_COUNT_EXCEEDED', 'PHOTO_TYPE_NOT_ALLOWED', 'PHOTO_CORRUPTED',
  'PHOTO_DIMENSIONS_EXCEEDED', 'PHOTO_PROCESSING_FAILED', 'PHOTO_STORAGE_FAILED', 'PHOTO_NOT_FOUND',
  'PHOTO_NOT_PUBLIC', 'PHOTO_VERSION_CONFLICT',
  'REFERENCE_DATA_NOT_INITIALIZED', 'FIREBASE_UNAVAILABLE', 'CONFIGURATION_ERROR', 'INTERNAL_ERROR', 'NETWORK_ERROR', 'UNKNOWN_ERROR',
] as const;

const apiErrorPayloadSchema = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string(),
    correlationId: z.string().optional(),
    details: z.record(z.array(z.string())).optional(),
  }),
});

function errorCodeFromStatus(status: number): ApiErrorCode {
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 503) return 'FIREBASE_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'UNKNOWN_ERROR';
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Não foi possível autenticar a solicitação.';
  if (status === 403) return 'A operação não foi autorizada.';
  if (status === 404) return 'O recurso solicitado não foi encontrado.';
  if (status === 409) return 'A operação conflita com o estado atual dos dados.';
  if (status === 413) return 'O arquivo ou corpo enviado excede o limite permitido.';
  if (status === 503) return 'O serviço Firebase está temporariamente indisponível.';
  return status >= 500 ? 'O serviço encontrou um erro interno.' : 'A solicitação não pôde ser concluída.';
}

async function parseResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError('O serviço retornou uma resposta inválida.', response.status, 'INTERNAL_ERROR');
  }
}

export type AuthenticationMode = 'none' | 'public' | 'admin';

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  authentication?: AuthenticationMode;
  appCheck?: boolean;
  headers?: Record<string, string>;
}

async function authenticationToken(mode: AuthenticationMode): Promise<string | undefined> {
  if (mode === 'public') return getPublicIdToken();
  if (mode === 'admin') return getAdminIdToken();
  return undefined;
}

async function requestRaw(path: string, options: RequestOptions): Promise<Response> {
  const {
    authentication = 'none',
    appCheck = true,
    headers: customHeaders,
    ...requestInit
  } = options;
  const [idToken, appCheckToken] = await Promise.all([
    authenticationToken(authentication),
    appCheck ? getAppCheckToken() : Promise.resolve(undefined),
  ]);

  const headers = new Headers(customHeaders);
  if (typeof requestInit.body === 'string' && requestInit.body !== '' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (idToken !== undefined) headers.set('Authorization', `Bearer ${idToken}`);
  if (appCheckToken !== undefined) headers.set('X-Firebase-AppCheck', appCheckToken);

  try {
    return await fetch(`${FRONTEND_ENV.apiBaseUrl}${path}`, { ...requestInit, headers });
  } catch {
    throw new ApiError('O serviço está indisponível ou houve falha de rede.', 0, 'NETWORK_ERROR');
  }
}

async function throwResponseError(response: Response): Promise<never> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const parsed = apiErrorPayloadSchema.safeParse(payload);
  throw new ApiError(
    parsed.success ? parsed.data.error.message : fallbackMessage(response.status),
    response.status,
    parsed.success ? parsed.data.error.code : errorCodeFromStatus(response.status),
    parsed.success ? parsed.data.error.details : undefined,
    parsed.success ? parsed.data.error.correlationId : response.headers.get('x-request-id') ?? undefined,
  );
}

export async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const response = await requestRaw(path, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
  });
  if (!response.ok) await throwResponseError(response);
  const payload = response.status === 204 ? undefined : await parseResponseJson(response);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError('O serviço retornou dados incompatíveis com o contrato esperado.', response.status, 'INTERNAL_ERROR');
  }
  return parsed.data;
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await requestRaw(path, {
    ...options,
    headers: { Accept: 'image/webp', ...(options.headers ?? {}) },
  });
  if (!response.ok) await throwResponseError(response);
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'image/webp') {
    throw new ApiError('O serviço retornou um tipo de arquivo inesperado.', response.status, 'INTERNAL_ERROR');
  }
  return response.blob();
}

export async function requestFile(path:string,options:RequestOptions={}):Promise<{blob:Blob;contentDisposition:string|null;count:number|null}>{
  const response=await requestRaw(path,{...options,headers:{Accept:'*/*',...(options.headers??{})}});if(!response.ok)await throwResponseError(response);const countHeader=response.headers.get('x-exported-count');return{blob:await response.blob(),contentDisposition:response.headers.get('content-disposition'),count:countHeader===null?null:Number(countHeader)};
}
