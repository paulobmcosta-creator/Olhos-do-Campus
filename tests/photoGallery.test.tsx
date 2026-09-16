import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Occurrence } from '../src/models/occurrence';
import { AdminPhotoGallery } from '../src/components/photos/AdminPhotoGallery';
import { PublicSolutionPhotoGallery } from '../src/components/photos/PublicSolutionPhotoGallery';
import { occurrenceService } from '../src/services/occurrenceService';

vi.mock('../src/services/occurrenceService', () => ({
  occurrenceService: {
    getAdminPhoto: vi.fn(() => Promise.resolve(new Blob([new Uint8Array([1])], { type: 'image/webp' }))),
    getPublicPhoto: vi.fn(() => Promise.resolve(new Blob([new Uint8Array([1])], { type: 'image/webp' }))),
    addResolutionPhotos: vi.fn(),
    updatePhotoVisibility: vi.fn(),
    deletePhoto: vi.fn(),
  },
}));

const baseOccurrence: Occurrence = {
  id: 'occ-1', protocol: 'INF-2026-000001', reportedCategoryId: 'cat-iluminacao', reportedCategoryName: 'Iluminação', categoryId: 'cat-iluminacao', categoryName: 'Iluminação',
  reportedLocation: { campusName: 'Campus', buildingName: 'Bloco', floor: '', room: 'Sala' },
  location: { campusName: 'Campus', buildingName: 'Bloco', floor: '', room: 'Sala' },
  description: 'Descrição suficiente para o teste da galeria.', immediateRisk: false, status: 'Em atendimento', priority: 'Normal',
  createdAt: '2026-08-13T10:00:00.000Z', updatedAt: '2026-08-13T10:00:00.000Z', version: 3, dataClassification: 'REAL', reopenedCount: 0, totalOpenHours: 0, effectiveBusinessHours: 0,
  timeline: [], publicMessages: [], internalNotes: [],
  photos: [
    { id: '11111111-1111-4111-8111-111111111111', kind: 'INITIAL', visibility: 'INTERNAL', status: 'READY', width: 1200, height: 800, byteSize: 1000, createdAt: '2026-08-13T10:00:00.000Z' },
    { id: '22222222-2222-4222-8222-222222222222', kind: 'RESOLUTION', visibility: 'INTERNAL', status: 'READY', width: 1200, height: 800, byteSize: 900, createdAt: '2026-08-13T11:00:00.000Z' },
  ],
};

let sequence = 0;
let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sequence = 0;
  revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:gallery-${++sequence}`) });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
});

afterEach(() => { vi.clearAllMocks(); });

// eslint-disable-next-line @typescript-eslint/unbound-method
const { getAdminPhoto, getPublicPhoto } = vi.mocked(occurrenceService);

describe('galeria administrativa protegida', () => {
  it('separa fotografias do registro e da solução, carrega miniaturas protegidas e permite ampliar', async () => {
    render(<AdminPhotoGallery occurrence={baseOccurrence} role="Gestor" onOccurrenceUpdated={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Fotografias do registro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fotografias da solução' })).toBeInTheDocument();
    await waitFor(() => expect(getAdminPhoto).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText('Interna')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Tornar pública' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Excluir fotografia' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /abrir fotografia 1 de fotografias do registro/iu }));
    expect(await screen.findByRole('dialog', { name: 'Visualização ampliada da fotografia' })).toBeInTheDocument();
    expect(getAdminPhoto).toHaveBeenCalledWith(baseOccurrence.id, baseOccurrence.photos[0]!.id, 'full');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(revoke).toHaveBeenCalled();
  });

  it('Gestor dispõe das ações operacionais de fotografia previstas para a área administrativa', async () => {
    render(<AdminPhotoGallery occurrence={baseOccurrence} role="Gestor" onOccurrenceUpdated={vi.fn()} />);
    await waitFor(() => expect(getAdminPhoto).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Tornar pública' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Excluir fotografia' })).toHaveLength(2);
  });
});

describe('galeria pública da solução', () => {
  it('busca miniatura e imagem ampliada pela API usando protocolo e chave no corpo lógico da chamada', async () => {
    const photo = { id: '22222222-2222-4222-8222-222222222222', kind: 'RESOLUTION' as const, width: 1200, height: 800, createdAt: '2026-08-13T11:00:00.000Z' };
    render(<PublicSolutionPhotoGallery photos={[photo]} protocol="INF-2026-000001" trackingKey="ABCD-EFGH-IJKL" />);
    expect(await screen.findByRole('heading', { name: 'Registro fotográfico da solução' })).toBeInTheDocument();
    await waitFor(() => expect(getPublicPhoto).toHaveBeenCalledWith('INF-2026-000001', 'ABCD-EFGH-IJKL', photo.id, 'thumbnail'));
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar fotografia pública da solução 1' }));
    expect(await screen.findByRole('dialog', { name: 'Fotografia pública ampliada da solução' })).toBeInTheDocument();
    expect(getPublicPhoto).toHaveBeenCalledWith('INF-2026-000001', 'ABCD-EFGH-IJKL', photo.id, 'full');
  });
});
