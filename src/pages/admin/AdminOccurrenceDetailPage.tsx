import { ArrowLeft, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../../components/common/OccurrenceBadges';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusAlert } from '../../components/common/StatusAlert';
import { AdminPhotoGallery } from '../../components/photos/AdminPhotoGallery';
import { ROUTES } from '../../config/routes';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { AdminAssignee } from '../../models/admin';
import type { CampusLocation, CategoryItem } from '../../models/config';
import type { OperationalTeam } from '../../models/operations';
import {
  INTERNAL_NOTE_AUDIENCES,
  OCCURRENCE_PRIORITIES,
  OCCURRENCE_STATUSES,
  type AttachmentRelation,
  type DataClassification,
  type InternalNoteAudience,
  type LocationSelectionInput,
  type Occurrence,
  isOccurrencePriority,
  isActiveOccurrenceStatus,
  type OccurrencePriority,
  type OccurrenceStatus,
  type UpdateOccurrenceInput,
} from '../../models/occurrence';
import { adminService } from '../../services/adminService';
import { ApiError } from '../../services/apiClient';
import { occurrenceService } from '../../services/occurrenceService';
import { operationsService } from '../../services/operationsService';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { startNonDestructivePolling } from '../../utils/polling';

const AUDIENCE_LABELS: Record<InternalNoteAudience, string> = {
  ADMIN_ONLY: 'Somente administradores',
  ADMINS_AND_MANAGERS: 'Administradores e gestores',
  RESPONSIBLE_TEAM: 'Equipe responsável',
};

function locationText(location: Occurrence['location']): string {
  return [location.campusName, location.buildingName, location.floor, location.room, location.complement]
    .filter((part) => part !== undefined && part.trim() !== '')
    .join(' — ');
}

function selectionFromOccurrence(occurrence: Occurrence): LocationSelectionInput | null {
  const { campusId, buildingId, floorId, roomId, complement, isOther, otherDescription } = occurrence.location;
  if (!campusId || !buildingId || !floorId || !roomId) return null;
  return { campusId, buildingId, floorId, roomId, ...(complement ? { complement } : {}), ...(isOther ? { isOther } : {}), ...(otherDescription ? { otherDescription } : {}) };
}

export function AdminOccurrenceDetailPage(): React.JSX.Element {
  useDocumentTitle('Detalhamento da ocorrência');
  const { id } = useParams<{ id: string }>();
  const { session } = useAdminAuth();
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);
  const [status, setStatus] = useState<OccurrenceStatus>('Recebida');
  const [priority, setPriority] = useState<OccurrencePriority>('Normal');
  const [categoryId, setCategoryId] = useState('');
  const [categoryReason, setCategoryReason] = useState('');
  const [locationSelection, setLocationSelection] = useState<LocationSelectionInput | null>(null);
  const [locationReason, setLocationReason] = useState('');
  const [assignedTeamId, setAssignedTeamId] = useState('');
  const [assignedToAdminUserId, setAssignedToAdminUserId] = useState('');
  const [dataClassification, setDataClassification] = useState<DataClassification>('REAL');
  const [attachmentTargetProtocol, setAttachmentTargetProtocol] = useState('');
  const [attachmentRelation, setAttachmentRelation] = useState<AttachmentRelation>('DUPLICATE');
  const [attachmentReason, setAttachmentReason] = useState('');
  const [applyPublicMessageToAttached, setApplyPublicMessageToAttached] = useState(false);
  const [publicMessage, setPublicMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [internalNoteAudience, setInternalNoteAudience] = useState<InternalNoteAudience>('ADMINS_AND_MANAGERS');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [teams, setTeams] = useState<OperationalTeam[]>([]);
  const [assignees, setAssignees] = useState<AdminAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingTest, setDeletingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);

  const isAttendant = session?.user.role === 'Atendente';

  const applyLoaded = useCallback((loaded: Occurrence): void => {
    setOccurrence(loaded);
    setStatus(loaded.status);
    setPriority(loaded.priority);
    setCategoryId(loaded.categoryId);
    setLocationSelection(selectionFromOccurrence(loaded));
    setAssignedTeamId(loaded.assignedTeamId ?? '');
    setAssignedToAdminUserId(loaded.assignedToAdminUserId ?? '');
    setDataClassification(loaded.dataClassification);
    setAttachmentTargetProtocol(loaded.attachedToProtocol ?? '');
    setAttachmentRelation(loaded.attachmentRelation ?? 'DUPLICATE');
    setAttachmentReason('');
    setApplyPublicMessageToAttached(false);
    if (session?.user.role === 'Atendente') {
      setInternalNoteAudience('RESPONSIBLE_TEAM');
    }
    setNewVersionAvailable(false);
  }, [session?.user.role]);

  const loadOccurrence = useCallback(async (): Promise<void> => {
    if (session === null || id === undefined) return;
    const loaded = await occurrenceService.getAdminById(id);
    applyLoaded(loaded);
  }, [applyLoaded, id, session]);

  useEffect(() => {
    if (session === null || id === undefined) return;
    let ignore = false;
    const assigneesPromise = isAttendant
      ? Promise.resolve([] as AdminAssignee[])
      : adminService.listAssignees();
    Promise.all([
      occurrenceService.getAdminById(id),
      operationsService.listCategories(),
      operationsService.listLocations(),
      operationsService.listTeams(),
      assigneesPromise,
    ]).then(([loaded, categoryItems, campusItems, teamItems, assigneeItems]) => {
      if (ignore) return;
      applyLoaded(loaded);
      setCategories(categoryItems);
      setLocations(campusItems);
      setTeams(teamItems);
      setAssignees(assigneeItems);
      setError(null);
    }).catch((caught: unknown) => {
      if (!ignore) setError(getErrorMessage(caught));
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, [applyLoaded, id, isAttendant, session]);

  useEffect(() => {
    if (session === null || id === undefined || occurrence === null) return;
    return startNonDestructivePolling(async () => {
      const fresh = await occurrenceService.getAdminById(id);
      return fresh.version !== occurrence.version;
    }, () => setNewVersionAvailable(true));
  }, [id, occurrence, session]);

  const selectedCampus = locations.find((campus) => campus.id === locationSelection?.campusId) ?? locations[0];
  const selectedArea = selectedCampus?.buildings.find((area) => area.id === locationSelection?.buildingId) ?? selectedCampus?.buildings[0];
  const selectedFloor = selectedArea?.floors.find((floor) => floor.id === locationSelection?.floorId) ?? selectedArea?.floors[0];
  const selectedTeam = teams.find((team) => team.id === assignedTeamId);
  const eligibleAssignees = useMemo(() => {
    if (!assignedTeamId) return assignees;
    const memberIds = new Set(selectedTeam?.memberAdminUserIds ?? []);
    return assignees.filter((item) => memberIds.has(item.id));
  }, [assignedTeamId, assignees, selectedTeam]);

  const changeCampus = (campusId: string): void => {
    const campus = locations.find((item) => item.id === campusId);
    const area = campus?.buildings.find((item) => item.active !== false);
    const floor = area?.floors[0];
    const room = floor?.rooms.find((item) => item.active !== false);
    if (campus && area && floor && room) setLocationSelection({ campusId: campus.id, buildingId: area.id, floorId: floor.id, roomId: room.id });
  };
  const changeArea = (buildingId: string): void => {
    if (!selectedCampus) return;
    const area = selectedCampus.buildings.find((item) => item.id === buildingId);
    const floor = area?.floors[0];
    const room = floor?.rooms.find((item) => item.active !== false);
    if (area && floor && room) setLocationSelection({ campusId: selectedCampus.id, buildingId: area.id, floorId: floor.id, roomId: room.id });
  };
  const changeRoom = (roomId: string): void => {
    if (!selectedCampus || !selectedArea || !selectedFloor) return;
    setLocationSelection({ campusId: selectedCampus.id, buildingId: selectedArea.id, floorId: selectedFloor.id, roomId });
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (session === null || id === undefined || occurrence === null) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const audience: InternalNoteAudience = isAttendant ? 'RESPONSIBLE_TEAM' : internalNoteAudience;
      const normalizedAssignment = assignedToAdminUserId.trim();
      const normalizedTeam = assignedTeamId.trim();
      const normalizedAttachmentTarget = attachmentTargetProtocol.trim().toUpperCase();
      const categoryChanged = !isAttendant && categoryId !== occurrence.categoryId;
      const attachmentChanged = !isAttendant && (normalizedAttachmentTarget !== (occurrence.attachedToProtocol ?? '') || (normalizedAttachmentTarget !== '' && attachmentRelation !== occurrence.attachmentRelation));
      const currentSelection = selectionFromOccurrence(occurrence);
      const locationChanged = !isAttendant && locationSelection !== null && JSON.stringify(locationSelection) !== JSON.stringify(currentSelection);
      if (categoryChanged && categoryReason.trim().length < 10) throw new Error('Informe uma justificativa da recategorização com pelo menos 10 caracteres.');
      if (locationChanged && locationReason.trim().length < 10) throw new Error('Informe uma justificativa da correção do local com pelo menos 10 caracteres.');
      if (attachmentChanged && attachmentReason.trim().length < 10) throw new Error('Informe uma justificativa do apensamento ou desapensamento com pelo menos 10 caracteres.');
      if (!isAttendant && normalizedAssignment && normalizedTeam && !eligibleAssignees.some((item) => item.id === normalizedAssignment)) throw new Error('O responsável individual deve integrar a equipe selecionada.');
      if (internalNote.trim() && audience === 'ADMIN_ONLY' && session.user.role !== 'Administrador') throw new Error('Somente Administradores podem usar a audiência “Somente administradores”.');
      if (internalNote.trim() && audience === 'RESPONSIBLE_TEAM' && !normalizedTeam) throw new Error('Selecione uma equipe responsável antes de usar a audiência “Equipe responsável”.');
      if (internalNote.trim() && audience === 'RESPONSIBLE_TEAM' && session.user.role !== 'Administrador' && !session.user.teamIds.includes(normalizedTeam)) throw new Error('Você precisa integrar a equipe responsável para usar essa audiência.');
      const input: UpdateOccurrenceInput = {
        expectedVersion: occurrence.version,
        ...(status === occurrence.status ? {} : { status }),
        ...(!isAttendant && priority !== occurrence.priority ? { priority } : {}),
        ...(categoryChanged ? { categoryId, categoryChangeReason: categoryReason.trim() } : {}),
        ...(locationChanged && locationSelection ? { location: locationSelection, locationChangeReason: locationReason.trim() } : {}),
        ...(!isAttendant && normalizedTeam !== (occurrence.assignedTeamId ?? '') ? { assignedTeamId: normalizedTeam === '' ? null : normalizedTeam } : {}),
        ...(!isAttendant && normalizedAssignment !== (occurrence.assignedToAdminUserId ?? '') ? { assignedToAdminUserId: normalizedAssignment === '' ? null : normalizedAssignment } : {}),
        ...(!isAttendant && dataClassification !== occurrence.dataClassification ? { dataClassification } : {}),
        ...(attachmentChanged ? { attachmentTargetProtocol: normalizedAttachmentTarget === '' ? null : normalizedAttachmentTarget, ...(normalizedAttachmentTarget === '' ? {} : { attachmentRelation }), attachmentReason: attachmentReason.trim() } : {}),
        ...(publicMessage.trim() === '' ? {} : { newPublicMessage: publicMessage.trim(), ...(applyPublicMessageToAttached ? { applyPublicMessageToAttached: true } : {}) }),
        ...(internalNote.trim() === '' ? {} : { newInternalNote: internalNote.trim(), internalNoteAudience: audience }),
      };
      if (Object.keys(input).length === 1) { setError('Informe ao menos uma alteração.'); return; }
      const updated = await occurrenceService.update(id, input);
      applyLoaded(updated);
      setCategoryReason(''); setLocationReason(''); setAttachmentReason(''); setApplyPublicMessageToAttached(false); setPublicMessage(''); setInternalNote('');
      setSuccess(`Alterações registradas. Versão atual: ${updated.version}.`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        if (caught.code === 'INVALID_STATUS_TRANSITION') {
          setError(caught.message || 'A alteração de situação solicitada não é permitida a partir da situação atual.');
        } else {
          try {
            await loadOccurrence();
            setError('Esta ocorrência foi atualizada por outra operação. Recarregue os dados e tente novamente.');
          } catch {
            setError(getErrorMessage(caught));
          }
        }
      } else {
        setError(getErrorMessage(caught));
      }
    } finally { setSaving(false); }
  };

  const purgeTest = async (): Promise<void> => {
    if (!occurrence || !id || session?.user.role !== 'Administrador' || occurrence.dataClassification !== 'TEST') return;
    if (!window.confirm(`Excluir definitivamente o dado TEST ${occurrence.protocol}? Esta ação não se aplica a registros REAL.`)) return;
    setDeletingTest(true); setError(null);
    try { await operationsService.purgeTest(id); window.location.assign(ROUTES.adminOccurrences); }
    catch (caught) { setError(getErrorMessage(caught)); setDeletingTest(false); }
  };

  if (loading) return <LoadingState label="Carregando ocorrência..." />;
  if (error !== null && occurrence === null) return <StatusAlert tone="error">{error}</StatusAlert>;
  if (occurrence === null) return <StatusAlert tone="error">A ocorrência solicitada não foi encontrada.</StatusAlert>;

  return (
    <div className="space-y-6">
      <Link to={ROUTES.adminOccurrences} className="inline-flex items-center gap-2 text-sm font-semibold text-green-800 underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à lista</Link>
      {newVersionAvailable && <StatusAlert tone="warning"><span className="inline-flex flex-wrap items-center gap-3">Esta ocorrência foi atualizada em outra sessão. O formulário aberto não foi substituído.<button type="button" className="btn-secondary" onClick={() => void loadOccurrence()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Recarregar dados</button></span></StatusAlert>}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protocolo</p><h1 className="mt-1 break-all font-mono text-2xl font-bold text-slate-950 sm:text-3xl">{occurrence.protocol}</h1><p className="mt-2 text-sm text-slate-600">Registrada em {formatDateTime(occurrence.createdAt)} — versão {occurrence.version} — {occurrence.dataClassification === 'TEST' ? 'Dado de teste' : 'Registro institucional'}</p></div>
        <div className="flex flex-wrap gap-2"><StatusBadge status={occurrence.status} /><PriorityBadge priority={occurrence.priority} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="border border-slate-300 p-5">
            <h2 className="text-lg font-bold text-slate-950">Dados da ocorrência</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="detail-term">Categoria atual</dt><dd className="detail-value">{occurrence.categoryName}</dd></div>
              <div><dt className="detail-term">Categoria informada originalmente</dt><dd className="detail-value">{occurrence.reportedCategoryName}</dd></div>
              <div><dt className="detail-term">Risco imediato</dt><dd className="detail-value">{occurrence.immediateRisk ? 'Informado pelo comunicante' : 'Não informado'}</dd></div>
              <div><dt className="detail-term">Equipe responsável</dt><dd className="detail-value">{occurrence.assignedTeamNameSnapshot ?? 'Não atribuída'}</dd></div>
              <div className="sm:col-span-2"><dt className="detail-term">Local atual</dt><dd className="detail-value">{locationText(occurrence.location)}</dd></div>
              <div className="sm:col-span-2"><dt className="detail-term">Local informado originalmente</dt><dd className="detail-value">{locationText(occurrence.reportedLocation)}</dd></div>
              <div><dt className="detail-term">Responsável</dt><dd className="detail-value">{occurrence.assignedToDisplayNameSnapshot ?? 'Não atribuído'}</dd></div>
              <div><dt className="detail-term">Natureza do registro</dt><dd className="detail-value">{occurrence.dataClassification === 'TEST' ? 'TEST — não contabilizado nos indicadores operacionais' : 'REAL'}</dd></div>
              {occurrence.duplicateOfProtocol && <div><dt className="detail-term">Duplicidade legada</dt><dd className="detail-value">{occurrence.duplicateOfProtocol}</dd></div>}
              <div><dt className="detail-term">Apensamento</dt><dd className="detail-value">{occurrence.attachedToProtocol ? `Apensada a ${occurrence.attachedToProtocol} — ${occurrence.attachmentRelation === 'DUPLICATE' ? 'duplicada' : 'similar'}` : occurrence.attachmentGroup && occurrence.attachmentGroup.memberCount > 1 ? `Ocorrência principal de grupo com ${occurrence.attachmentGroup.memberCount} registros` : 'Não se aplica'}</dd></div>
              <div><dt className="detail-term">Tempo total aberto</dt><dd className="detail-value">{(occurrence.totalOpenHours ?? 0).toFixed(1)} h corridas</dd></div>
              <div><dt className="detail-term">Tempo efetivo de SLA</dt><dd className="detail-value">{(occurrence.effectiveBusinessHours ?? 0).toFixed(1)} h úteis</dd></div>
              {occurrence.sla && <><div><dt className="detail-term">Prazo da primeira resposta</dt><dd className="detail-value">{formatDateTime(occurrence.sla.firstResponseDueAt)}{occurrence.sla.firstResponseOutcome ? ` — ${occurrence.sla.firstResponseOutcome === 'ON_TIME' ? 'no prazo' : 'vencido'}` : ''}</dd></div><div><dt className="detail-term">Prazo de conclusão</dt><dd className="detail-value">{formatDateTime(occurrence.sla.resolutionDueAt)} — {occurrence.sla.resolutionPaused ? 'SLA pausado' : occurrence.slaStatus ?? 'em acompanhamento'}</dd></div></>}
              <div className="sm:col-span-2"><dt className="detail-term">Descrição</dt><dd className="detail-value whitespace-pre-wrap leading-6">{occurrence.description}</dd></div>
            </dl>
          </section>

          {session !== null && <AdminPhotoGallery occurrence={occurrence} role={session.user.role} onOccurrenceUpdated={applyLoaded} />}

          <section className="border border-slate-300 p-5"><h2 className="text-lg font-bold text-slate-950">Histórico funcional</h2><ol className="mt-4 space-y-4 border-l-2 border-green-700 pl-5">{(occurrence.timeline ?? []).map((item) => <li key={item.id}><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{item.title}</p><span className={`border px-2 py-0.5 text-[11px] font-semibold ${item.isPublic ? 'border-green-300 bg-green-50 text-green-900' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>{item.isPublic ? 'Público' : 'Interno'}</span></div><p className="text-xs text-slate-500">{formatDateTime(item.date)}{item.authorRole ? ` — ${item.authorRole}` : ''}</p>{item.description && <p className="mt-1 text-sm leading-6 text-slate-700">{item.description}</p>}</li>)}</ol></section>
          <section className="border border-slate-300 p-5"><h2 className="text-lg font-bold text-slate-950">Mensagens públicas</h2><div className="mt-4 space-y-3">{(occurrence.publicMessages ?? []).map((message) => <article key={message.id} className="border border-green-200 bg-green-50 p-4"><p className="text-sm leading-6 text-slate-800">{message.message}</p><p className="mt-2 text-xs text-slate-500">{message.authorRole} — {formatDateTime(message.date)}</p></article>)}{(occurrence.publicMessages ?? []).length === 0 && <p className="text-sm text-slate-600">Nenhuma mensagem pública adicional.</p>}</div></section>
          <section className="border border-slate-300 p-5"><h2 className="text-lg font-bold text-slate-950">Observações administrativas internas</h2><p className="mt-1 text-xs text-slate-600">Nunca são retornadas pela consulta pública. A audiência é aplicada também pelo backend.</p><div className="mt-4 space-y-3">{(occurrence.internalNotes ?? []).map((note) => <article key={note.id} className="border border-slate-300 bg-slate-50 p-4"><p className="text-sm leading-6 text-slate-800">{note.note}</p><p className="mt-2 text-xs text-slate-500">{note.authorName} — {note.authorRole} — {formatDateTime(note.date)} — {AUDIENCE_LABELS[note.audience]}</p></article>)}{(occurrence.internalNotes ?? []).length === 0 && <p className="text-sm text-slate-600">Nenhuma observação interna visível para sua audiência.</p>}</div></section>
        </div>

        <aside>
          <form onSubmit={(event) => void submit(event)} className="space-y-5 border border-slate-300 bg-slate-50 p-5 lg:sticky lg:top-4">
            <h2 className="text-lg font-bold text-slate-950">{isAttendant ? 'Atendimento da ocorrência' : 'Gestão operacional'}</h2>
            <div><label htmlFor="admin-status" className="form-label">Situação</label><select id="admin-status" className="form-control" value={status} onChange={(event) => { if (isActiveOccurrenceStatus(event.target.value)) setStatus(event.target.value); }}>{occurrence.status === 'Duplicada' && <option value="Duplicada" disabled>Duplicada — situação legada</option>}{OCCURRENCE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select><p className="mt-1 text-xs text-slate-500">A situação pode ser alterada diretamente para qualquer opção disponível. Toda mudança permanece registrada no histórico.</p></div>
            {!isAttendant ? (
              <>
                <div><label htmlFor="admin-priority" className="form-label">Prioridade</label><select id="admin-priority" className="form-control" value={priority} onChange={(event) => { if (isOccurrencePriority(event.target.value)) setPriority(event.target.value); }}>{OCCURRENCE_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div><label htmlFor="admin-data-classification" className="form-label">Natureza do registro</label><select id="admin-data-classification" className="form-control" value={dataClassification} onChange={(event) => setDataClassification(event.target.value as DataClassification)}><option value="REAL">REAL — ocorrência institucional</option><option value="TEST">TEST — teste/homologação</option></select><p className="mt-1 text-xs text-slate-500">Registros TEST permanecem auditáveis, mas não entram no dashboard, nos indicadores e nos relatórios operacionais por padrão. Em grupos apensados, a classificação é sincronizada.</p></div>
                <fieldset className="space-y-3 border border-slate-300 p-3"><legend className="px-1 text-sm font-bold text-slate-900">Correção de categoria</legend><div><label htmlFor="admin-category" className="form-label">Categoria atual</label><select id="admin-category" className="form-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.filter((item) => item.active || item.id === occurrence.categoryId).sort((a,b)=>a.sortOrder-b.sortOrder).map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' — inativa'}</option>)}</select></div>{categoryId !== occurrence.categoryId && <div><label htmlFor="category-reason" className="form-label">Justificativa obrigatória</label><textarea id="category-reason" className="form-control min-h-20" value={categoryReason} maxLength={500} onChange={(e)=>setCategoryReason(e.target.value)} required /></div>}<p className="text-xs text-slate-500">O valor originalmente informado pelo comunicante permanece imutável.</p></fieldset>
                <fieldset className="space-y-3 border border-slate-300 p-3"><legend className="px-1 text-sm font-bold text-slate-900">Correção de local</legend>{locations.length > 1 && <div><label className="form-label" htmlFor="admin-campus">Campus</label><select id="admin-campus" className="form-control" value={selectedCampus?.id ?? ''} onChange={(e)=>changeCampus(e.target.value)}>{locations.map((campus)=><option key={campus.id} value={campus.id}>{campus.campusName}</option>)}</select></div>}<div><label className="form-label" htmlFor="admin-area">Bloco/Área</label><select id="admin-area" className="form-control" value={selectedArea?.id ?? ''} onChange={(e)=>changeArea(e.target.value)}>{selectedCampus?.buildings.filter((area)=>area.active!==false || area.id===occurrence.location.buildingId).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map((area)=><option key={area.id} value={area.id}>{area.name}</option>)}</select></div><div><label className="form-label" htmlFor="admin-room">Ambiente</label><select id="admin-room" className="form-control" value={locationSelection?.roomId ?? ''} onChange={(e)=>changeRoom(e.target.value)}>{selectedFloor?.rooms.filter((room)=>room.active!==false || room.id===occurrence.location.roomId).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map((room)=><option key={room.id} value={room.id}>{room.name}</option>)}</select></div>{locationSelection && JSON.stringify(locationSelection)!==JSON.stringify(selectionFromOccurrence(occurrence)) && <div><label htmlFor="location-reason" className="form-label">Justificativa obrigatória</label><textarea id="location-reason" className="form-control min-h-20" value={locationReason} maxLength={500} onChange={(e)=>setLocationReason(e.target.value)} required /></div>}<p className="text-xs text-slate-500">O local reportado originalmente permanece disponível no histórico administrativo.</p></fieldset>
                <div><label htmlFor="admin-team" className="form-label">Equipe/Setor responsável</label><select id="admin-team" className="form-control" value={assignedTeamId} onChange={(event) => { const value=event.target.value;setAssignedTeamId(value);if(value && !teams.find((t)=>t.id===value)?.memberAdminUserIds.includes(assignedToAdminUserId))setAssignedToAdminUserId(''); }}><option value="">Sem equipe</option>{teams.filter((team)=>team.active || team.id===occurrence.assignedTeamId).sort((a,b)=>a.sortOrder-b.sortOrder).map((team)=><option key={team.id} value={team.id}>{team.name}{team.active?'':' — inativa'}</option>)}</select></div>
                <div><label htmlFor="admin-assigned" className="form-label">Responsável <span className="font-normal text-slate-500">(opcional)</span></label><select id="admin-assigned" className="form-control" value={assignedToAdminUserId} onChange={(event) => setAssignedToAdminUserId(event.target.value)}><option value="">Não atribuído</option>{assignedToAdminUserId !== '' && !eligibleAssignees.some((item) => item.id === assignedToAdminUserId) && <option value={assignedToAdminUserId}>{occurrence.assignedToDisplayNameSnapshot ?? 'Responsável atual'}</option>}{eligibleAssignees.map((item) => <option key={item.id} value={item.id}>{item.displayName} — {item.role}</option>)}</select></div>
                <fieldset className="space-y-3 border border-slate-300 p-3"><legend className="px-1 text-sm font-bold text-slate-900">Apensamento operacional</legend>
                  {occurrence.attachmentGroup && occurrence.attachmentGroup.memberCount > 1 && <div className="border border-slate-200 bg-white p-3"><p className="text-xs font-semibold uppercase text-slate-600">Grupo atual</p><ul className="mt-2 space-y-1 text-sm">{occurrence.attachmentGroup.members.map((member)=><li key={member.id}><Link className="font-mono text-green-800 underline" to={ROUTES.adminOccurrence(member.id)}>{member.protocol}</Link> — {member.relation==='PRIMARY'?'principal':member.relation==='DUPLICATE'?'duplicada':'similar'}</li>)}</ul></div>}
                  <div><label htmlFor="attachment-target" className="form-label">Protocolo da ocorrência principal</label><input id="attachment-target" className="form-control font-mono uppercase" value={attachmentTargetProtocol} onChange={(event)=>setAttachmentTargetProtocol(event.target.value.toUpperCase())} placeholder="INF-2026-000001" /><p className="mt-1 text-xs text-slate-500">Para desapensar esta ocorrência, apague o protocolo e informe a justificativa. Uma ocorrência principal que já possua apensadas deve ser desmembrada antes de ser apensada a outra.</p></div>
                  {attachmentTargetProtocol.trim()!=='' && <div><label htmlFor="attachment-relation" className="form-label">Relação</label><select id="attachment-relation" className="form-control" value={attachmentRelation} onChange={(event)=>setAttachmentRelation(event.target.value as AttachmentRelation)}><option value="DUPLICATE">Duplicada — mesmo problema</option><option value="SIMILAR">Similar — tratamento conjunto</option></select></div>}
                  {(attachmentTargetProtocol.trim().toUpperCase() !== (occurrence.attachedToProtocol ?? '') || (attachmentTargetProtocol.trim()!=='' && attachmentRelation!==occurrence.attachmentRelation)) && <div><label htmlFor="attachment-reason" className="form-label">Justificativa obrigatória</label><textarea id="attachment-reason" className="form-control min-h-20" minLength={10} maxLength={500} value={attachmentReason} onChange={(event)=>setAttachmentReason(event.target.value)} required /></div>}
                  <p className="text-xs text-slate-500">No grupo, situação, prioridade, equipe, responsável e natureza REAL/TEST são sincronizados. Descrição, local e categoria informados, fotografias, protocolo, chave e observações permanecem próprios de cada registro.</p>
                </fieldset>
              </>
            ) : (
              <div className="space-y-4 rounded border border-slate-200 bg-white p-3">
                <div>
                  <span className="form-label">Prioridade</span>
                  <div className="mt-1"><PriorityBadge priority={occurrence.priority} /></div>
                </div>
                <div>
                  <span className="form-label">Equipe responsável</span>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{occurrence.assignedTeamNameSnapshot ?? 'Não atribuída'}</p>
                </div>
                <div>
                  <span className="form-label">Responsável atribuído</span>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{occurrence.assignedToDisplayNameSnapshot ?? 'Não atribuído'}</p>
                </div>
              </div>
            )}
            <div><label htmlFor="admin-public-message" className="form-label">Nova mensagem pública <span className="font-normal text-slate-500">(opcional)</span></label><textarea id="admin-public-message" className="form-control min-h-24" maxLength={1000} value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} />{!isAttendant && occurrence.attachmentGroup && occurrence.attachmentGroup.memberCount > 1 && publicMessage.trim()!=='' && <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={applyPublicMessageToAttached} onChange={(event)=>setApplyPublicMessageToAttached(event.target.checked)} /><span>Publicar esta mensagem em todas as ocorrências apensadas.</span></label>}</div>
            <div><label htmlFor="admin-internal-note" className="form-label">Nova observação interna <span className="font-normal text-slate-500">(opcional)</span></label><textarea id="admin-internal-note" className="form-control min-h-24" maxLength={1000} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /></div>
            {internalNote.trim() && !isAttendant && <div><label htmlFor="note-audience" className="form-label">Audiência da observação</label><select id="note-audience" className="form-control" value={internalNoteAudience} onChange={(e)=>{const value=e.target.value;if(INTERNAL_NOTE_AUDIENCES.some((item)=>item===value))setInternalNoteAudience(value as InternalNoteAudience);}}>{INTERNAL_NOTE_AUDIENCES.map((audience)=><option key={audience} value={audience} disabled={(audience==='ADMIN_ONLY'&&session?.user.role!=='Administrador')||(audience==='RESPONSIBLE_TEAM'&&(!assignedTeamId||(session?.user.role!=='Administrador'&&!session?.user.teamIds.includes(assignedTeamId))))}>{AUDIENCE_LABELS[audience]}</option>)}</select></div>}
            {internalNote.trim() && isAttendant && <p className="text-xs text-slate-600">Observação direcionada à equipe responsável.</p>}
            {error !== null && <StatusAlert tone="error">{error}</StatusAlert>}{success !== null && <StatusAlert tone="success">{success}</StatusAlert>}
            <button type="submit" className="btn-primary w-full" disabled={saving}><Save className="h-4 w-4" aria-hidden="true" />{saving ? 'Salvando...' : 'Registrar alterações'}</button>
            {session?.user.role === 'Administrador' && occurrence.dataClassification === 'TEST' && <button type="button" className="btn-secondary w-full border-red-300 text-red-800" onClick={() => void purgeTest()} disabled={deletingTest}><Trash2 className="h-4 w-4" aria-hidden="true" />{deletingTest ? 'Excluindo dado TEST...' : 'Excluir definitivamente dado TEST'}</button>}
          </form>
        </aside>
      </div>
    </div>
  );
}
