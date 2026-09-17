import { Database, HardDrive, Mail, PackageCheck, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusAlert } from '../../components/common/StatusAlert';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { InfrastructureOverview } from '../../models/infrastructure';
import { infrastructureService } from '../../services/infrastructureService';
import { notificationService } from '../../services/notificationService';
import { getErrorMessage } from '../../utils/errors';

function bytes(value:number|null):string{return value===null?'Não medido':new Intl.NumberFormat('pt-BR',{style:'unit',unit:'megabyte',maximumFractionDigits:2}).format(value/1_000_000);}
function percent(value:number|null):string{return value===null?'Não medido':`${value.toFixed(1)}%`;}
function date(value:string|null):string{return value===null?'Não coletado':new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});}

export function AdminInfrastructurePage():React.JSX.Element{
 useDocumentTitle('Infraestrutura e capacidade');const[data,setData]=useState<InfrastructureOverview|null>(null);const[error,setError]=useState<string|null>(null);const[message,setMessage]=useState<string|null>(null);const[busy,setBusy]=useState(false);const[periodDays,setPeriodDays]=useState<30|90|365>(90);const[renderedAt]=useState(()=>Date.now());
 const load=useCallback(async()=>{try{setData(await infrastructureService.overview());setError(null);}catch(caught){setError(getErrorMessage(caught));}},[]);
 useEffect(()=>{let active=true;void infrastructureService.overview().then(result=>{if(active){setData(result);setError(null);}}).catch(caught=>{if(active)setError(getErrorMessage(caught));});return()=>{active=false;};},[]);
 const action=async(work:()=>Promise<unknown>,success:string)=>{setBusy(true);try{await work();setMessage(success);setError(null);await load();}catch(caught){setError(getErrorMessage(caught));}finally{setBusy(false);}};
 if(error!==null&&data===null)return <StatusAlert tone="error">{error}</StatusAlert>;if(data===null)return <LoadingState label="Carregando o último snapshot agregado de infraestrutura…"/>;const latest=data.latest;const settings=data.settings;const cutoff=renderedAt-periodDays*86_400_000;const periodHistory=data.history.filter(item=>new Date(item.capturedAt).getTime()>=cutoff);const chronological=[...periodHistory].reverse();const completeR2History=chronological.filter(item=>item.r2.inventoryComplete);const r2Values=completeR2History.flatMap(item=>item.r2.bytes===null?[]:[item.r2.bytes]);const chartMaximum=Math.max(...r2Values,1),chartMinimum=Math.min(...r2Values,0),chartRange=Math.max(chartMaximum-chartMinimum,1);const chartPoints=r2Values.map((value,index)=>`${r2Values.length===1?50:(index/(r2Values.length-1))*100},${38-((value-chartMinimum)/chartRange)*34}`).join(' ');const latestComplete=latest?.r2.inventoryComplete===true;const previous=data.history.filter(item=>item.r2.inventoryComplete)[1]?.r2.bytes??null;const growthSincePrevious=!latestComplete||latest?.r2.bytes===null||latest?.r2.bytes===undefined||previous===null?null:latest.r2.bytes-previous;const growthFor=(days:number):number|null=>{if(!latestComplete||latest?.r2.bytes===null||latest?.r2.bytes===undefined)return null;const comparison=data.history.find(item=>item.r2.inventoryComplete&&new Date(item.capturedAt).getTime()<=renderedAt-days*86_400_000)?.r2.bytes;return comparison===null||comparison===undefined?null:latest.r2.bytes-comparison;};const growth30=growthFor(30),growth90=growthFor(90);const firestoreOldest=data.history.at(-1);const firestoreDays=latest===null||firestoreOldest===undefined?0:(new Date(latest.capturedAt).getTime()-new Date(firestoreOldest.capturedAt).getTime())/86_400_000;const firestoreMonthlyGrowth=latest===null||firestoreOldest===undefined||firestoreDays<7?null:((latest.firestore.totalDocuments-firestoreOldest.firestore.totalDocuments)/firestoreDays)*30;
 const r2Partial=latest!==null&&!latest.r2.inventoryComplete;const capacityCards=[['Fotografias e R2',latest?.r2.bytes??null,settings.r2StorageReferenceBytes,data.levels.r2,r2Partial],['Cloud Firestore',latest?.firestore.estimatedLogicalBytes??null,settings.firestoreStorageReferenceBytes,data.levels.firestore,false],['Artifact Registry — estimativa lógica',latest?.artifactRegistry.bytes??null,settings.artifactRegistryStorageReferenceBytes,data.levels.artifactRegistry,false]] as const;
  return (
    <div className="space-y-8 min-w-0">
      <header>
        <h1 className="text-3xl font-bold">Infraestrutura e capacidade</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-700">
          Uso observado pelo aplicativo, estimativas lógicas e referências operacionais. Estes dados não correspondem necessariamente à fatura dos provedores.
        </p>
      </header>

      <div aria-live="polite">
        {error && <StatusAlert tone="error">{error}</StatusAlert>}
        {message && <StatusAlert tone="success">{message}</StatusAlert>}
      </div>

      <section aria-labelledby="capacity-summary">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="capacity-summary" className="text-xl font-bold">Resumo</h2>
            <p className="text-sm text-slate-600">Última atualização: {date(latest?.capturedAt ?? null)}</p>
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => void action(() => infrastructureService.snapshot(), 'Snapshot agregado atualizado.')}>
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Atualizar levantamento</span>
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {capacityCards.map(([label, current, reference, level, partial]) => (
            <article className="border border-slate-300 bg-white p-4 min-w-0" key={label}>
              <h3 className="font-bold">{label}</h3>
              <p className="mt-3 text-2xl font-bold">{partial ? 'Pelo menos ' : ''}{bytes(current)}</p>
              <p className="text-sm">{level.level} — {partial ? 'Percentual integral indisponível' : percent(level.percent)}</p>
              <p className="mt-1 text-xs text-slate-600">Referência: {bytes(reference)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 min-w-0" aria-label="Indicadores técnicos">
        <article className="border border-slate-300 p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <HardDrive className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Fotografias e R2</span>
          </h2>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><dt className="detail-term">Objetos</dt><dd className="detail-value">{latest?.r2.objectCount ?? 'Não medido'}</dd></div>
            <div><dt className="detail-term">Bytes</dt><dd className="detail-value">{r2Partial ? 'Pelo menos ' : ''}{bytes(latest?.r2.bytes ?? null)}</dd></div>
            <div><dt className="detail-term">Principais</dt><dd className="detail-value">{latest?.r2.mainPhotoCount ?? 'Não medido'}</dd></div>
            <div><dt className="detail-term">Miniaturas</dt><dd className="detail-value">{latest?.r2.thumbnailCount ?? 'Não medido'}</dd></div>
            <div><dt className="detail-term">Objeto mais antigo</dt><dd className="detail-value">{date(latest?.r2.oldestObjectAt ?? null)}</dd></div>
            <div><dt className="detail-term">Último inventário</dt><dd className="detail-value">{date(latest?.r2.lastInventoryAt ?? null)}</dd></div>
            <div><dt className="detail-term">Situação do inventário</dt><dd className="detail-value">{latest === null ? 'Não coletado' : latest.r2.inventoryComplete ? 'Integral' : 'Inventário parcial'}</dd></div>
          </dl>
          {r2Partial ? (
            <StatusAlert tone="info">
              Inventário parcial. Os bytes exibidos são um limite inferior observado; percentual integral e projeção integral permanecem indisponíveis até uma captura completa.
            </StatusAlert>
          ) : (
            <p className="mt-4 text-xs text-slate-600">
              Ocupação instantânea aproximada em relação à referência operacional. O faturamento do R2 utiliza GB-mês e não é calculado por esta tela.
            </p>
          )}
        </article>

        <article className="border border-slate-300 p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Database className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Cloud Firestore</span>
          </h2>
          <p className="mt-3 text-2xl font-bold">{latest?.firestore.totalDocuments ?? 0} documentos observados</p>
          <p className="text-sm text-slate-600">{latest?.firestore.estimationMethod ?? 'Nenhum levantamento disponível.'}</p>
          <p className="mt-1 text-xs text-slate-600">
            Amostra: {latest?.firestore.documentsSampled ?? 0} documento(s); cobertura: {percent(latest?.firestore.coveragePercent ?? null)}. A estimativa não inclui índices nem representa armazenamento faturável.
          </p>
          <button
            className="btn-secondary mt-3 whitespace-normal text-left max-w-full"
            disabled={busy}
            onClick={() => void action(() => infrastructureService.estimateFirestore(5_000), 'Estimativa lógica paginada do Firestore atualizada.')}
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Estimar armazenamento lógico (até 5.000 leituras)</span>
          </button>
          <div className="mt-3 max-h-64 overflow-auto max-w-full">
            <table className="min-w-full text-sm">
              <thead>
                <tr><th className="p-2 text-left">Coleção</th><th className="p-2 text-right">Documentos</th></tr>
              </thead>
              <tbody>
                {Object.entries(latest?.firestore.counts ?? {}).map(([name, count]) => (
                  <tr className="border-t" key={name}>
                    <th className="p-2 text-left font-medium">{name}</th>
                    <td className="p-2 text-right">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="border border-slate-300 p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Mail className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Notificações por e-mail</span>
          </h2>
          <p className="mt-2 text-sm">
            {data.notificationRuntime.provider} — {data.notificationRuntime.effectiveEnabled ? 'habilitado' : 'desabilitado'} — remetente: {data.notificationRuntime.from ?? 'não configurado'} — {data.notificationRuntime.recipientCount} destinatário(s).
          </p>
          <p className="mt-1 text-sm">
            Aceites pelo provedor hoje: {latest?.notifications.acceptedToday ?? 0}/{settings.resendDailyReference} — {data.levels.resendDaily.level} ({percent(data.levels.resendDaily.percent)}). No mês: {latest?.notifications.acceptedThisMonth ?? 0}/{settings.resendMonthlyReference} — {data.levels.resendMonthly.level} ({percent(data.levels.resendMonthly.percent)}).
          </p>
          <div className="mt-3 overflow-x-auto max-w-full">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2">Tentativas iniciadas</th>
                  <th className="p-2">Aceitas pelo provedor</th>
                  <th className="p-2">Entregas confirmadas</th>
                  <th className="p-2">Falhas de tentativa</th>
                  <th className="p-2">Bounces</th>
                  <th className="p-2">Complaints</th>
                  <th className="p-2">Tentativas incertas</th>
                  <th className="p-2">Retries</th>
                  <th className="p-2">Pendentes lógicas</th>
                  <th className="p-2">Retry lógico</th>
                  <th className="p-2">Webhooks sem correlação</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t text-center">
                  <td className="p-2">{latest?.notifications.attemptsStarted ?? 0}</td>
                  <td>{latest?.notifications.attemptsAccepted ?? 0}</td>
                  <td>{latest?.notifications.attemptsDelivered ?? 0}</td>
                  <td>{latest?.notifications.attemptsFailed ?? 0}</td>
                  <td>{latest?.notifications.attemptsBounced ?? 0}</td>
                  <td>{latest?.notifications.attemptsComplained ?? 0}</td>
                  <td>{latest?.notifications.attemptsUncertain ?? 0}</td>
                  <td>{latest?.notifications.retries ?? 0}</td>
                  <td>{latest?.notifications.pending ?? 0}</td>
                  <td>{latest?.notifications.retryPending ?? 0}</td>
                  <td>{latest?.notifications.unmatchedWebhookPending ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="detail-term">Pendente mais antiga</dt><dd>{date(latest?.notifications.oldestPendingAt ?? null)}</dd></div>
            <div><dt className="detail-term">Último aceite do provedor</dt><dd>{date(latest?.notifications.lastSuccessfulSendAt ?? null)}</dd></div>
            <div><dt className="detail-term">Última tentativa</dt><dd>{date(latest?.notifications.lastAttemptAt ?? null)}</dd></div>
            <div><dt className="detail-term">Webhook não correlacionado mais antigo</dt><dd>{date(latest?.notifications.oldestUnmatchedWebhookAt ?? null)}</dd></div>
            <div className="sm:col-span-2"><dt className="detail-term">Último erro</dt><dd className="break-all">{latest?.notifications.lastError ?? 'Nenhum erro registrado.'}</dd></div>
            <div className="sm:col-span-2"><dt className="detail-term">Categoria segura da última falha</dt><dd>{latest?.notifications.lastFailureCategory ?? 'Nenhuma categoria registrada.'}</dd></div>
          </dl>
          {(latest?.notifications.unmatchedWebhookPending ?? 0) > 0 && (
            <StatusAlert tone={(latest?.notifications.oldestUnmatchedWebhookAt !== null && latest?.notifications.oldestUnmatchedWebhookAt !== undefined && renderedAt - new Date(latest.notifications.oldestUnmatchedWebhookAt).getTime() > 60 * 60_000) ? 'warning' : 'info'}>
              Há {latest?.notifications.unmatchedWebhookPending ?? 0} webhook(s) válido(s) aguardando correlação. A manutenção automática tentará novamente em lote; eventos com mais de uma hora exigem atenção operacional.
            </StatusAlert>
          )}
          <p className="mt-3 text-xs text-slate-600">
            Cada <strong>tentativa de entrega</strong> com <code>providerAcceptedAt</code> conta uma unidade lógica de consumo. Uma mesma notificação pode consumir mais de uma unidade se retries distintos forem efetivamente aceitos. Entrega confirmada é evento posterior e não incrementa novamente o consumo. Registros 0.7.2 sem subcoleção de tentativas permanecem contabilizados como mínimo histórico até eventual materialização lazy. As referências acima não substituem cota ou faturamento do provedor.
          </p>
          <button
            className="btn-secondary mt-3 whitespace-normal text-left max-w-full"
            disabled={busy}
            onClick={() => void action(() => notificationService.retry(20), 'Notificações elegíveis recolocadas na fila.')}
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Reprocessar notificações pendentes</span>
          </button>
        </article>

        <article className="border border-slate-300 p-4 sm:p-5 min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <PackageCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Artifact Registry</span>
          </h2>
          {latest?.artifactRegistry.collected ? (
            <dl className="mt-3">
              <dt className="detail-term">Soma lógica aproximada das imagens observadas</dt>
              <dd className="detail-value">{bytes(latest.artifactRegistry.bytes)}</dd>
              <dt className="detail-term mt-3">Versões</dt>
              <dd className="detail-value">{latest.artifactRegistry.versionCount}</dd>
              <dt className="detail-term mt-3">Coletado em</dt>
              <dd className="detail-value">{date(latest.artifactRegistry.capturedAt)}</dd>
            </dl>
          ) : (
            <p className="mt-3 text-sm">Nenhum levantamento do Artifact Registry foi registrado.</p>
          )}
          <p className="mt-3 text-xs text-slate-600">
            O valor é uma estimativa lógica baseada nas imagens listadas e não corresponde necessariamente ao armazenamento faturado pelo Google Cloud, pois camadas podem ser compartilhadas entre imagens.
          </p>
        </article>
      </section>

      <section className="border border-slate-300 p-4 sm:p-5 min-w-0">
        <h2 className="text-xl font-bold">Manutenção técnica</h2>
        <dl className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div><dt className="detail-term">Limpezas pendentes</dt><dd className="detail-value">{latest?.cleanup.pendingTasks ?? 0}</dd></div>
          <div><dt className="detail-term">Objetos pendentes</dt><dd className="detail-value">{latest?.cleanup.pendingObjects ?? 0}</dd></div>
          <div><dt className="detail-term">Órfãos detectados</dt><dd className="detail-value">{latest?.reconciliation.orphanObjects ?? 0}</dd></div>
          <div><dt className="detail-term">Metadados sem objeto</dt><dd className="detail-value">{latest?.reconciliation.missingObjects ?? 0}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary whitespace-normal text-left" disabled={busy} onClick={() => void action(() => infrastructureService.reconcile(), 'Reconciliação concluída em modo somente relatório.')}>
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Reconciliar R2 × Firestore</span>
          </button>
          <button className="btn-secondary whitespace-normal text-left" disabled={busy} onClick={() => void action(() => infrastructureService.cleanup(20), 'Tarefas de limpeza processadas.')}>
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Processar tarefas de limpeza pendentes</span>
          </button>
        </div>
      </section>

      <section className="border border-slate-300 p-4 sm:p-5 min-w-0">
        <h2 className="text-xl font-bold">Referências operacionais</h2>
        <p className="mt-1 text-sm text-slate-700">Esses valores são referências cadastradas e não substituem a página de faturamento do provedor.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ['R2 (bytes)', 'r2StorageReferenceBytes'],
            ['Firestore (bytes)', 'firestoreStorageReferenceBytes'],
            ['Artifact Registry — estimativa lógica (bytes)', 'artifactRegistryStorageReferenceBytes'],
            ['Resend diário', 'resendDailyReference'],
            ['Resend mensal', 'resendMonthlyReference'],
            ['Atenção (%)', 'warningPercent'],
            ['Alerta (%)', 'alertPercent'],
            ['Crítico (%)', 'criticalPercent'],
          ] as const).map(([label, key]) => (
            <label className="form-label min-w-0" key={key}>
              <span>{label}</span>
              <input
                className="form-control"
                type="number"
                min="1"
                value={settings[key]}
                onChange={event => setData({ ...data, settings: { ...settings, [key]: Number(event.target.value) } })}
              />
            </label>
          ))}
          <label className="form-label min-w-0">
            <span>Referência verificada em</span>
            <input
              className="form-control"
              type="date"
              value={settings.referenceVerifiedAt}
              onChange={event => setData({ ...data, settings: { ...settings, referenceVerifiedAt: event.target.value } })}
            />
          </label>
        </div>
        <button className="btn-primary mt-3" disabled={busy} onClick={() => void action(() => infrastructureService.updateSettings(data.settings), 'Referências operacionais atualizadas.')}>
          <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Salvar referências</span>
        </button>
      </section>

      <section className="border border-slate-300 p-4 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Histórico de capacidade</h2>
            <p className="mt-1 text-sm text-slate-600">Visualização temporal do uso observado; a tabela contém os mesmos dados.</p>
          </div>
          <label className="form-label">
            <span>Período</span>
            <select className="form-control" value={periodDays} onChange={event => setPeriodDays(Number(event.target.value) as 30 | 90 | 365)}>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
              <option value={365}>12 meses</option>
            </select>
          </label>
        </div>
        <dl className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <div><dt className="detail-term">R2 desde o snapshot anterior</dt><dd className="detail-value">{bytes(growthSincePrevious)}</dd></div>
          <div><dt className="detail-term">R2 em 30 dias</dt><dd className="detail-value">{bytes(growth30)}</dd></div>
          <div><dt className="detail-term">R2 em 90 dias</dt><dd className="detail-value">{bytes(growth90)}</dd></div>
          <div><dt className="detail-term">Média mensal recente do R2</dt><dd className="detail-value">{bytes(growth90 === null ? null : growth90 / 3)}</dd></div>
          <div><dt className="detail-term">Crescimento mensal de documentos Firestore</dt><dd className="detail-value">{firestoreMonthlyGrowth === null ? 'Histórico insuficiente' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(firestoreMonthlyGrowth)}</dd></div>
        </dl>
        {r2Values.length < 2 ? (
          <p className="mt-4 text-sm">Ainda não há histórico suficiente para desenhar a evolução do R2.</p>
        ) : (
          <svg className="mt-4 h-48 w-full border border-slate-200 bg-slate-50" viewBox="0 0 100 40" role="img" aria-labelledby="r2-chart-title r2-chart-description" preserveAspectRatio="none">
            <title id="r2-chart-title">Evolução da ocupação observada no R2</title>
            <desc id="r2-chart-description">Linha temporal dos bytes observados no período selecionado; valores exatos disponíveis na tabela seguinte.</desc>
            <polyline points={chartPoints} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" className="text-green-800" />
          </svg>
        )}
        <div className="mt-3 overflow-x-auto max-w-full">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Período</th>
                <th className="p-2 text-right">R2</th>
                <th className="p-2 text-right">Documentos Firestore</th>
                <th className="p-2 text-right">E-mails aceitos no mês</th>
                <th className="p-2 text-right">Artifact Registry (estimativa lógica)</th>
              </tr>
            </thead>
            <tbody>
              {periodHistory.length === 0 ? (
                <tr><td className="p-3" colSpan={5}>Ainda não há histórico no período selecionado.</td></tr>
              ) : (
                periodHistory.map(snapshot => (
                  <tr className="border-t" key={snapshot.id}>
                    <th className="p-2 text-left font-medium">{snapshot.period}</th>
                    <td className="p-2 text-right">{snapshot.r2.inventoryComplete ? '' : '>= '}{bytes(snapshot.r2.bytes)}</td>
                    <td className="p-2 text-right">{snapshot.firestore.totalDocuments}</td>
                    <td className="p-2 text-right">{snapshot.notifications.acceptedThisMonth}</td>
                    <td className="p-2 text-right">{bytes(snapshot.artifactRegistry.bytes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-1 text-sm break-words">
          {data.projections.map(item => (
            <p key={item.metric}><strong>{item.metric}:</strong> {item.message}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
