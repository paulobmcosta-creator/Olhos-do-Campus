import { Plus, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ADMIN_ROLES, isAdminRole, type AdminRole, type AdminUser, type AdminUserCreateInput } from '../../models/admin';
import { adminService } from '../../services/adminService';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { LoadingState } from '../common/LoadingState';
import { StatusAlert } from '../common/StatusAlert';

const empty: AdminUserCreateInput = { email: '', displayName: '', role: 'Gestor', active: true };

export function AdminUserManagement(): React.JSX.Element {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<AdminUserCreateInput>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await adminService.listUsers());
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await adminService.listUsers();
        if (active) {
          setUsers(data);
          setError(null);
        }
      } catch (e) {
        if (active) setError(getErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving('new');
    try {
      await adminService.createUser({ ...form, email: form.email.trim(), displayName: form.displayName.trim() });
      setForm(empty);
      setSuccess('Usuário administrativo cadastrado.');
      await load();
    } catch (x) {
      setError(getErrorMessage(x));
    } finally {
      setSaving(null);
    }
  };

  const update = async (user: AdminUser, patch: { role?: AdminRole; active?: boolean }) => {
    setSaving(user.id);
    try {
      await adminService.updateUser(user.id, patch);
      setSuccess('Cadastro atualizado e auditado.');
      await load();
    } catch (x) {
      setError(getErrorMessage(x));
    } finally {
      setSaving(null);
    }
  };

  const legacy = async (user: AdminUser, action: 'ACTIVATE_AS_ATTENDANT' | 'CONVERT_TO_MANAGER' | 'DEACTIVATE') => {
    setSaving(user.id);
    try {
      await adminService.resolveLegacy(user.id, { action });
      setSuccess(
        action === 'ACTIVATE_AS_ATTENDANT'
          ? 'Papel legado ativado explicitamente como Atendente.'
          : action === 'CONVERT_TO_MANAGER'
          ? 'Papel legado convertido explicitamente para Gestor.'
          : 'Usuário legado inativado.'
      );
      await load();
    } catch (x) {
      setError(getErrorMessage(x));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="space-y-5 border border-slate-300 p-4 sm:p-5" aria-labelledby="users-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="users-title" className="text-xl font-bold text-slate-950">Usuários</h2>
          <p className="mt-1 text-sm text-slate-700">
            Os papéis <strong>Administrador</strong>, <strong>Gestor</strong> e <strong>Atendente</strong> podem ser atribuídos. Registros legados permanecem bloqueados até decisão explícita.
          </p>
        </div>
        <button className="btn-secondary" type="button" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Atualizar
        </button>
      </div>

      <form onSubmit={e => void create(e)} className="grid gap-3 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="form-label" htmlFor="new-user-email">E-mail institucional</label>
          <input
            id="new-user-email"
            className="form-control w-full"
            type="email"
            required
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="new-user-name">Nome</label>
          <input
            id="new-user-name"
            className="form-control w-full"
            required
            value={form.displayName}
            onChange={e => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="new-user-role">Papel</label>
          <select
            id="new-user-role"
            className="form-control w-full"
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value as AdminRole })}
          >
            {ADMIN_ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={saving === 'new'}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Cadastrar
          </button>
        </div>
      </form>

      {error && <StatusAlert tone="error">{error}</StatusAlert>}
      {success && <StatusAlert tone="success">{success}</StatusAlert>}

      {loading ? (
        <LoadingState label="Carregando usuários..." />
      ) : (
        <>
          {/* Mobile Card View (< sm) */}
          <div className="space-y-3 sm:hidden" aria-label="Lista de usuários administrativos em dispositivos móveis">
            {users.map(u => (
              <article key={u.id} className="border border-slate-300 bg-white p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-slate-950"><span className="sr-only">Usuário: </span>{u.displayName}</h3>
                  <p className="text-sm text-slate-600 break-all"><span className="sr-only">E-mail: </span>{u.email}</p>
                  <p className="text-xs text-slate-500 mt-1">Atualizado: {formatDateTime(u.updatedAt)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 block">Papel:</span>
                    {u.legacyRole ? (
                      <span className="inline-flex items-center gap-1 border border-amber-500 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 mt-0.5">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Atendente — legado
                      </span>
                    ) : (
                      <span className="font-medium text-slate-900">{u.role}</span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Estado:</span>
                    <span className={`inline-block px-2 py-0.5 font-medium rounded ${u.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Equipes vinculadas:</span>
                    <span className="font-medium text-slate-900">{u.teamIds.length}</span>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  {u.legacyRole ? (
                    <div className="flex flex-col gap-2">
                      <button className="btn-secondary w-full" type="button" disabled={saving === u.id} onClick={() => void legacy(u, 'ACTIVATE_AS_ATTENDANT')}>
                        Ativar como Atendente
                      </button>
                      <button className="btn-secondary w-full" type="button" disabled={saving === u.id} onClick={() => void legacy(u, 'CONVERT_TO_MANAGER')}>
                        Converter para Gestor
                      </button>
                      <button className="btn-secondary w-full" type="button" disabled={saving === u.id} onClick={() => void legacy(u, 'DEACTIVATE')}>
                        Inativar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button className="btn-secondary w-full" type="button" disabled={saving === u.id} onClick={() => void update(u, { active: !u.active })}>
                        {u.active ? 'Inativar' : 'Ativar'}
                      </button>
                      {isAdminRole(u.role) && (
                        <div>
                          <label htmlFor={`mobile-role-${u.id}`} className="sr-only">Papel de {u.displayName}</label>
                          <select
                            id={`mobile-role-${u.id}`}
                            aria-label={`Papel de ${u.displayName}`}
                            className="form-control w-full"
                            value={u.role}
                            onChange={e => void update(u, { role: e.target.value as AdminRole })}
                          >
                            {ADMIN_ROLES.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Desktop Table View (>= sm) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b-2 text-left">
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Papel</th>
                  <th className="p-3">Equipes</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b align-top">
                    <td className="p-3">
                      <strong>{u.displayName}</strong><br />
                      <span className="text-slate-600 break-all">{u.email}</span><br />
                      <span className="text-xs text-slate-500">Atualizado: {formatDateTime(u.updatedAt)}</span>
                    </td>
                    <td className="p-3">
                      {u.legacyRole ? (
                        <span className="inline-flex items-center gap-1 border border-amber-500 bg-amber-50 px-2 py-1 font-semibold text-amber-900">
                          <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Atendente — legado
                        </span>
                      ) : (
                        u.role
                      )}
                    </td>
                    <td className="p-3">{u.teamIds.length}</td>
                    <td className="p-3">{u.active ? 'Ativo' : 'Inativo'}</td>
                    <td className="p-3">
                      {u.legacyRole ? (
                        <div className="flex flex-col gap-2">
                          <button className="btn-secondary" type="button" disabled={saving === u.id} onClick={() => void legacy(u, 'ACTIVATE_AS_ATTENDANT')}>
                            Ativar como Atendente
                          </button>
                          <button className="btn-secondary" type="button" disabled={saving === u.id} onClick={() => void legacy(u, 'CONVERT_TO_MANAGER')}>
                            Converter para Gestor
                          </button>
                          <button className="btn-secondary" type="button" disabled={saving === u.id} onClick={() => void legacy(u, 'DEACTIVATE')}>
                            Inativar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <button className="btn-secondary" type="button" disabled={saving === u.id} onClick={() => void update(u, { active: !u.active })}>
                            {u.active ? 'Inativar' : 'Ativar'}
                          </button>
                          {isAdminRole(u.role) && (
                            <select
                              aria-label={`Papel de ${u.displayName}`}
                              className="form-control"
                              value={u.role}
                              onChange={e => void update(u, { role: e.target.value as AdminRole })}
                            >
                              {ADMIN_ROLES.map(r => <option key={r}>{r}</option>)}
                            </select>
                          )}
                          <span className="sr-only"><Save /></span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
