import type { RequestHandler, Response } from 'express';
import type {
  CreateOccurrenceResponse,
  DashboardStats,
  Occurrence,
  OccurrenceListResponse,
  PublicOccurrence,
} from '../../src/models/occurrence';
import { asyncHandler } from '../middleware/asyncHandler';
import type { PhotoBinary } from '../services/photoService';
import type { OccurrenceService } from '../services/occurrenceService';
import { HttpError } from '../types/errors';
import type {
  AddResolutionPhotosBody,
  CreateOccurrenceBody,
  DeletePhotoBody,
  OccurrenceFilterQuery,
  OccurrenceIdParams,
  OccurrencePhotoParams,
  PhotoVariantQuery,
  PublicPhotoBody,
  TrackingBody,
  UpdateOccurrenceBody,
  UpdatePhotoVisibilityBody,
} from '../validators/schemas';

function sendProtectedImage(response: Response, photo: PhotoBinary): void {
  response.setHeader('Content-Type', photo.contentType);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Content-Disposition', 'inline');
  response.status(200).send(photo.buffer);
}

export function createOccurrenceController(service: OccurrenceService): {
  create: RequestHandler<Record<string, never>, CreateOccurrenceResponse, CreateOccurrenceBody>;
  track: RequestHandler<Record<string, never>, PublicOccurrence, TrackingBody>;
  publicPhoto: RequestHandler<Record<string, never>, unknown, PublicPhotoBody>;
  list: RequestHandler<Record<string, never>, OccurrenceListResponse, never, OccurrenceFilterQuery>;
  getById: RequestHandler<OccurrenceIdParams, Occurrence>;
  update: RequestHandler<OccurrenceIdParams, Occurrence, UpdateOccurrenceBody>;
  stats: RequestHandler<Record<string, never>, DashboardStats>;
  getAdminPhoto: RequestHandler<OccurrencePhotoParams, unknown, never, PhotoVariantQuery>;
  addResolutionPhotos: RequestHandler<OccurrenceIdParams, Occurrence, AddResolutionPhotosBody>;
  updatePhotoVisibility: RequestHandler<OccurrencePhotoParams, Occurrence, UpdatePhotoVisibilityBody>;
  deletePhoto: RequestHandler<OccurrencePhotoParams, Occurrence, DeletePhotoBody>;
} {
  return {
    create: asyncHandler(async (request, response) => {
      response.status(201).json(await service.create(request.body, request.photoFiles ?? [], request.correlationId));
    }),
    track: asyncHandler(async (request, response) => {
      response.json(await service.track(request.body.protocol, request.body.trackingKey));
    }),
    publicPhoto: asyncHandler(async (request, response) => {
      const photo = await service.getPublicPhoto(
        request.body.protocol,
        request.body.trackingKey,
        request.body.photoId,
        request.body.variant,
      );
      sendProtectedImage(response, photo);
    }),
    list: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.list(request.query, request.adminUser));
    }),
    getById: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.getById(request.params.id, request.adminUser));
    }),
    update: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.update(request.params.id, request.body, request.adminUser, request.correlationId));
    }),
    stats: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.getStats(request.adminUser));
    }),
    getAdminPhoto: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      const photo = await service.getAdminPhoto(request.params.id, request.params.photoId, request.query.variant, request.adminUser);
      sendProtectedImage(response, photo);
    }),
    addResolutionPhotos: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.status(201).json(await service.addResolutionPhotos(
        request.params.id,
        request.body,
        request.photoFiles ?? [],
        request.adminUser,
        request.correlationId,
      ));
    }),
    updatePhotoVisibility: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.updatePhotoVisibility(
        request.params.id,
        request.params.photoId,
        request.body,
        request.adminUser,
        request.correlationId,
      ));
    }),
    deletePhoto: asyncHandler(async (request, response) => {
      if (request.adminUser === undefined) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão administrativa ausente.');
      response.json(await service.deletePhoto(
        request.params.id,
        request.params.photoId,
        request.body,
        request.adminUser,
        request.correlationId,
      ));
    }),
  };
}
