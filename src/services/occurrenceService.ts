import type {
  CreateOccurrenceInput,
  CreateOccurrenceResponse,
  DashboardStats,
  Occurrence,
  OccurrenceFilterOptions,
  OccurrenceListResponse,
  PublicOccurrence,
  UpdateOccurrenceInput,
} from '../models/occurrence';
import {
  createOccurrenceResponseSchema,
  dashboardStatsResponseSchema,
  occurrenceListResponseSchema,
  occurrenceResponseSchema,
  publicOccurrenceResponseSchema,
} from '../validators/responses';
import { requestBlob, requestJson } from './apiClient';

function toQueryString(filters: OccurrenceFilterOptions): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === false) continue;
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized === '' ? '' : `?${serialized}`;
}

function photoFormData(payload: object, photos: File[]): FormData {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  photos.forEach((file, index) => {
    form.append('photos', file, `photo-${index + 1}.webp`);
  });
  return form;
}

export const occurrenceService = {
  create(input: CreateOccurrenceInput, photos: File[] = []): Promise<CreateOccurrenceResponse> {
    return requestJson<CreateOccurrenceResponse>('/api/occurrences', createOccurrenceResponseSchema, {
      method: 'POST',
      authentication: 'public',
      body: photoFormData(input, photos),
    });
  },

  track(protocol: string, trackingKey: string): Promise<PublicOccurrence> {
    return requestJson<PublicOccurrence>('/api/occurrences/track', publicOccurrenceResponseSchema, {
      method: 'POST',
      authentication: 'public',
      body: JSON.stringify({ protocol, trackingKey }),
    });
  },

  getPublicPhoto(protocol: string, trackingKey: string, photoId: string, variant: 'thumbnail' | 'full'): Promise<Blob> {
    return requestBlob('/api/occurrences/track/photo', {
      method: 'POST',
      authentication: 'public',
      body: JSON.stringify({ protocol, trackingKey, photoId, variant }),
    });
  },

  list(filters: OccurrenceFilterOptions): Promise<OccurrenceListResponse> {
    return requestJson<OccurrenceListResponse>(
      `/api/admin/occurrences${toQueryString(filters)}`,
      occurrenceListResponseSchema,
      { authentication: 'admin' },
    );
  },

  getAdminById(id: string): Promise<Occurrence> {
    return requestJson<Occurrence>(`/api/admin/occurrences/${encodeURIComponent(id)}`, occurrenceResponseSchema, { authentication: 'admin' });
  },

  getAdminPhoto(id: string, photoId: string, variant: 'thumbnail' | 'full'): Promise<Blob> {
    return requestBlob(
      `/api/admin/occurrences/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}?variant=${variant}`,
      { authentication: 'admin' },
    );
  },

  addResolutionPhotos(id: string, expectedVersion: number, photos: File[]): Promise<Occurrence> {
    return requestJson<Occurrence>(`/api/admin/occurrences/${encodeURIComponent(id)}/photos`, occurrenceResponseSchema, {
      method: 'POST',
      authentication: 'admin',
      body: photoFormData({ expectedVersion }, photos),
    });
  },

  updatePhotoVisibility(id: string, photoId: string, expectedVersion: number, visibility: 'INTERNAL' | 'PUBLIC'): Promise<Occurrence> {
    return requestJson<Occurrence>(
      `/api/admin/occurrences/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}/visibility`,
      occurrenceResponseSchema,
      {
        method: 'PATCH',
        authentication: 'admin',
        body: JSON.stringify({ expectedVersion, visibility }),
      },
    );
  },

  deletePhoto(id: string, photoId: string, expectedVersion: number): Promise<Occurrence> {
    return requestJson<Occurrence>(
      `/api/admin/occurrences/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,
      occurrenceResponseSchema,
      {
        method: 'DELETE',
        authentication: 'admin',
        body: JSON.stringify({ expectedVersion }),
      },
    );
  },

  update(id: string, input: UpdateOccurrenceInput): Promise<Occurrence> {
    return requestJson<Occurrence>(`/api/admin/occurrences/${encodeURIComponent(id)}`, occurrenceResponseSchema, {
      method: 'PATCH',
      authentication: 'admin',
      body: JSON.stringify(input),
    });
  },

  getStats(): Promise<DashboardStats> {
    return requestJson<DashboardStats>('/api/admin/stats', dashboardStatsResponseSchema, { authentication: 'admin' });
  },
};
