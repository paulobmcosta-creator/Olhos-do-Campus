import { describe, expect, it } from 'vitest';
import type { AdminUser } from '../src/models/admin';
import { InMemoryAdminUserRepository, LastAdministratorProtectedError } from '../server/repositories/adminUserRepository';
import { hashNormalizedEmail } from '../server/utils/email';

function user(email: string, role: AdminUser['role'], active = true): AdminUser {
  const id = hashNormalizedEmail(email);
  return {
    id, email, normalizedEmail: email, displayName: email, role, teamIds: [], active, legacyRole: role === 'Atendente',
    createdAt: '2026-08-05T00:00:00.000Z', createdBy: 'test',
    updatedAt: '2026-08-05T00:00:00.000Z', updatedBy: 'test',
  };
}

describe('repositório administrativo transacional', () => {
  it('previne duplicidade pelo hash do e-mail normalizado', async () => {
    const repository = new InMemoryAdminUserRepository();
    await repository.create({ email: 'novo@ifes.edu.br', normalizedEmail: 'novo@ifes.edu.br', displayName: 'Novo', role: 'Gestor', actorId: 'actor' });
    await expect(repository.create({ email: 'novo@ifes.edu.br', normalizedEmail: 'novo@ifes.edu.br', displayName: 'Novo', role: 'Gestor', actorId: 'actor' })).rejects.toThrow(/já está autorizado/iu);
  });

  it('bloqueia inativação e rebaixamento do último Administrador', async () => {
    const administrator = user('admin@ifes.edu.br', 'Administrador');
    const repository = new InMemoryAdminUserRepository([administrator]);
    await expect(repository.update(administrator.id, { active: false }, 'actor')).rejects.toBeInstanceOf(LastAdministratorProtectedError);
    await expect(repository.update(administrator.id, { role: 'Gestor' }, 'actor')).rejects.toBeInstanceOf(LastAdministratorProtectedError);
  });

  it('permite alteração quando outro Administrador ativo permanece', async () => {
    const first = user('a@ifes.edu.br', 'Administrador');
    const second = user('b@ifes.edu.br', 'Administrador');
    const repository = new InMemoryAdminUserRepository([first, second]);
    const result = await repository.update(first.id, { active: false }, 'actor');
    expect(result.after.active).toBe(false);
  });

  it('vincula UID uma única vez e rejeita UID divergente', async () => {
    const pending = user('pending@ifes.edu.br', 'Gestor');
    const repository = new InMemoryAdminUserRepository([pending]);
    expect(await repository.authorizeLogin(pending.email, 'uid-one', true)).toMatchObject({ status: 'authorized', uidBound: true });
    expect(await repository.authorizeLogin(pending.email, 'uid-one', true)).toMatchObject({ status: 'authorized', uidBound: false });
    expect(await repository.authorizeLogin(pending.email, 'uid-two', true)).toMatchObject({ status: 'uid-mismatch' });
  });

  it('detecta papel legado sem autorizar e exige resolução explícita', async () => {
    const legacy = user('legacy@ifes.edu.br', 'Atendente');
    const repository = new InMemoryAdminUserRepository([legacy]);
    expect(await repository.authorizeLogin(legacy.email, 'uid-one', true)).toMatchObject({ status: 'legacy-role' });
    const converted = await repository.resolveLegacy(legacy.id, 'CONVERT_TO_MANAGER', 'admin');
    expect(converted).toMatchObject({ role: 'Gestor', legacyRole: false });
  });

});
