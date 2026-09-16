import { Plus, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusAlert } from '../../components/common/StatusAlert';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { AdminUser } from '../../models/admin';
import type { OperationalTeam } from '../../models/operations';
import { adminService } from '../../services/adminService';
import { operationsService } from '../../services/operationsService';
import { getErrorMessage } from '../../utils/errors';

interface TeamDraft { name: string; description: string; sortOrder: number; active: boolean; memberAdminUserIds: string[]; }
function fromTeam(team: OperationalTeam): TeamDraft { return { name: team.name, description: team.description ?? '', sortOrder: team.sortOrder, active: team.active, memberAdminUserIds: [...team.memberAdminUserIds] }; }

export function AdminTeamsPage(): React.JSX.Element {
  useDocumentTitle('Equipes e setores');
  const [teams, setTeams] = useState<OperationalTeam[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [members, setMembers] = useState<string[]>([]);
  const [editing, setEditing] = useState<Record<string, TeamDraft>>({});
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const load = useCallback(async (showLoading = false): Promise<void> => { if (showLoading) setLoading(true); try { const [teamItems, userItems] = await Promise.all([operationsService.listTeams(), adminService.listUsers()]); setTeams(teamItems.sort((a, b) => a.sortOrder - b.sortOrder)); setUsers(userItems.filter((item) => item.active && !item.legacyRole)); setEditing(Object.fromEntries(teamItems.map((item) => [item.id, fromTeam(item)]))); setError(null); } catch (caught) { setError(getErrorMessage(caught)); } finally { setLoading(false); } }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [teamItems, userItems] = await Promise.all([operationsService.listTeams(), adminService.listUsers()]);
        if (!active) return;
        setTeams(teamItems.sort((a, b) => a.sortOrder - b.sortOrder));
        setUsers(userItems.filter((item) => item.active && !item.legacyRole));
        setEditing(Object.fromEntries(teamItems.map((item) => [item.id, fromTeam(item)])));
        setError(null);
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);
  const submit = async (event: FormEvent): Promise<void> => { event.preventDefault(); try { await operationsService.createTeam({ name: name.trim(), description: description.trim() || undefined, sortOrder: (teams.at(-1)?.sortOrder ?? 0) + 10, memberAdminUserIds: members }); setName(''); setDescription(''); setMembers([]); setSuccess('Equipe/Setor criado e membros sincronizados.'); await load(); } catch (caught) { setError(getErrorMessage(caught)); } };
  const save = async (team: OperationalTeam): Promise<void> => { const draft = editing[team.id]; if (!draft) return; setSaving(team.id); try { await operationsService.updateTeam(team.id, { name: draft.name.trim(), description: draft.description.trim() || undefined, sortOrder: draft.sortOrder, active: draft.active, memberAdminUserIds: draft.memberAdminUserIds }); setSuccess(`Equipe/Setor “${draft.name}” atualizado.`); await load(); } catch (caught) { setError(getErrorMessage(caught)); } finally { setSaving(null); } };
  const toggleMember = (teamId: string, userId: string, checked: boolean): void => { setEditing((all) => { const draft = all[teamId]; if (!draft) return all; return { ...all, [teamId]: { ...draft, memberAdminUserIds: checked ? [...new Set([...draft.memberAdminUserIds, userId])] : draft.memberAdminUserIds.filter((id) => id !== userId) } }; }); };
  return <div className="space-y-5">
    <div className="flex justify-between"><div><h1 className="text-3xl font-bold">Equipes/Setores</h1><p className="mt-1 text-sm text-slate-700">Somente Administradores gerenciam a estrutura. Usuários podem integrar uma ou mais equipes; o responsável individual da ocorrência permanece opcional.</p></div><button className="btn-secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Atualizar</button></div>
    <form className="space-y-4 border border-slate-300 p-5" onSubmit={(event) => void submit(event)}><h2 className="text-lg font-bold">Nova equipe/setor</h2><div className="grid gap-3 sm:grid-cols-2"><div><label className="form-label" htmlFor="team-name">Nome</label><input id="team-name" className="form-control" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div><div><label className="form-label" htmlFor="team-desc">Descrição</label><input id="team-desc" className="form-control" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></div></div><fieldset><legend className="form-label">Membros iniciais</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{users.map((user) => <label className="flex items-center gap-2 border p-2" key={user.id}><input type="checkbox" checked={members.includes(user.id)} onChange={(e) => setMembers((current) => e.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />{user.displayName} — {user.role}</label>)}</div></fieldset><button className="btn-primary"><Plus className="h-4 w-4" aria-hidden="true" />Criar equipe/setor</button></form>
    {error && <StatusAlert tone="error">{error}</StatusAlert>}{success && <StatusAlert tone="success">{success}</StatusAlert>}
    {loading ? <LoadingState label="Carregando equipes..." /> : <div className="grid gap-4">{teams.map((team) => { const draft = editing[team.id] ?? fromTeam(team); return <article key={team.id} className="space-y-4 border border-slate-300 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="lg:col-span-2"><label className="form-label" htmlFor={`team-edit-name-${team.id}`}>Nome</label><input id={`team-edit-name-${team.id}`} className="form-control" value={draft.name} onChange={(e) => setEditing({ ...editing, [team.id]: { ...draft, name: e.target.value } })} /></div><div><label className="form-label" htmlFor={`team-order-${team.id}`}>Ordem</label><input id={`team-order-${team.id}`} type="number" className="form-control" value={draft.sortOrder} onChange={(e) => setEditing({ ...editing, [team.id]: { ...draft, sortOrder: Number(e.target.value) } })} /></div><label className="flex items-end gap-2 pb-3"><input type="checkbox" checked={draft.active} onChange={(e) => setEditing({ ...editing, [team.id]: { ...draft, active: e.target.checked } })} />Equipe ativa</label><div className="sm:col-span-2 lg:col-span-4"><label className="form-label" htmlFor={`team-edit-desc-${team.id}`}>Descrição</label><input id={`team-edit-desc-${team.id}`} className="form-control" value={draft.description} onChange={(e) => setEditing({ ...editing, [team.id]: { ...draft, description: e.target.value } })} /></div></div><fieldset><legend className="form-label">Membros</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{users.map((user) => <label className="flex items-center gap-2 border p-2" key={user.id}><input type="checkbox" checked={draft.memberAdminUserIds.includes(user.id)} onChange={(e) => toggleMember(team.id, user.id, e.target.checked)} />{user.displayName} — {user.role}</label>)}</div></fieldset><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">{draft.memberAdminUserIds.length} membro(s). Equipes historicamente utilizadas são desativadas, não apagadas.</p><button className="btn-primary" type="button" disabled={saving === team.id} onClick={() => void save(team)}><Save className="h-4 w-4" aria-hidden="true" />{saving === team.id ? 'Salvando...' : 'Salvar equipe'}</button></div></article>; })}</div>}
  </div>;
}
