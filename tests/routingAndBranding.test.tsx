import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppDataProvider } from '../src/context/AppDataContext';
import { AppRoutes } from '../src/routes/AppRouter';
import { APP_VERSION } from '../src/config/version';

vi.mock('../src/context/AdminAuthContext', () => ({
  AdminAuthProvider: ({ children }: { children: ReactNode }) => children,
  useAdminAuth: () => ({
    session: null,
    status: 'signed-out',
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    retryAuthorization: vi.fn(),
  }),
}));

vi.mock('../src/services/firebase/appCheckTokenService', () => ({
  getAppCheckToken: vi.fn(() => Promise.resolve(undefined)),
}));

const bootstrap = {
  config: {
    institutionDisplayName: 'IFES — Campus Barra de São Francisco',
    serviceNotice: '',
  },
  categories: [{ id: 'cat-1', name: 'Iluminação', description: 'Problemas de iluminação.', active: true, sortOrder: 1, resolutionBaseBusinessHours: 60, version: 1 }],
  locations: [{
    id: 'campus-1',
    campusName: 'Campus Barra de São Francisco',
    buildings: [{ id: 'bloco-1', name: 'Bloco principal', floors: [{ id: 'terreo', name: 'Térreo', rooms: [{ id: 'sala-1', name: 'Sala 1' }] }] }],
  }],
  runtime: {
    version: APP_VERSION,
    emulatorMode: true,
    firebaseIntegrated: true,
    publicAuthentication: 'firebase-anonymous',
    adminAuthentication: 'google',
    adminAuthorization: 'firestore',
    occurrencePersistence: 'firestore',
    referenceDataPersistence: 'firestore',
    photoStorage: 'firebase-storage',
    photoUploadEnabled: true,
    maxInitialPhotos: 3,
    maxResolutionPhotos: 3,
    emailDelivery: false,
    appCheckEnforced: false,
  },
};

function renderRoute(initialEntry = '/'): void {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(bootstrap), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))));
  render(
    <AppDataProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppDataProvider>,
  );
}

describe('rotas e identidade institucional', () => {
  it('renderiza nome fantasia, nome oficial e marca com texto alternativo adequado', async () => {
    renderRoute();
    expect(await screen.findByText('Ajude-nos a cuidar e melhorar os espaços do campus.')).toBeInTheDocument();
    expect(screen.getAllByText('Olhos do Campus').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sistema Institucional de Manutenção da Infraestrutura Física').length).toBeGreaterThan(0);
    expect(screen.getByAltText('Instituto Federal do Espírito Santo — Campus Barra de São Francisco')).toBeInTheDocument();
  });

  it('navega para a rota real de acompanhamento', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('heading', { name: 'Ajude-nos a cuidar e melhorar os espaços do campus.' });
    await user.click(screen.getAllByRole('link', { name: 'Acompanhar uma ocorrência' })[0]!);
    expect(await screen.findByRole('heading', { name: 'Acompanhar uma ocorrência' })).toBeInTheDocument();
  });

  it('exibe login Google e não apresenta seleção de perfil demonstrativo', async () => {
    renderRoute('/administracao/entrar');
    expect(await screen.findByRole('button', { name: 'Entrar com Google' })).toBeInTheDocument();
    expect(screen.queryByText(/perfil demonstrativo/iu)).not.toBeInTheDocument();
  });

  it('renderiza página não encontrada em URL inexistente', async () => {
    renderRoute('/rota-inexistente');
    expect(await screen.findByRole('heading', { name: /página não encontrada/iu })).toBeInTheDocument();
  });
});
