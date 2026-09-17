import 'dotenv/config';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminServices } from '../server/config/firebaseAdmin';
import { SERVER_ENV } from '../server/config/env';

export interface ResendPreCheckNotificationItem {
  id: string;
  status: string;
  provider?: string | null;
}

export interface ResendPreCheckAttemptItem {
  id: string;
  notificationId: string;
  status: string;
  deliveredAt?: Date | string | null;
  permanentFailureAt?: Date | string | null;
  completedAt?: Date | string | null;
}

export interface ResendPreCheckWebhookItem {
  id: string;
  status: string;
}

export interface ResendPreCheckSummary {
  notifications: {
    PENDING: number;
    PROCESSING: number;
    DEFERRED: number;
    RETRY_PENDING: number;
    SENT: number;
    DELIVERY_UNCERTAIN: number;
    FAILED_CONFIGURATION: number;
    FAILED: number;
    DELIVERED: number;
    BOUNCED: number;
    COMPLAINED: number;
    SUPPRESSED: number;
    OTHER: number;
    totalResend: number;
  };
  potentiallyReconcilableAttempts: number;
  orphanAttemptsCount: number;
  unmatchedWebhooksCount: number;
  readErrorsCount: number;
  readyToDisableResend: boolean;
  activePendingCount: number;
  blockingReasons: string[];
}

/**
 * Normaliza o identificador do provedor de e-mail replicando estritamente a semântica do runtime:
 * - provider === 'ews' -> 'ews'
 * - provider === 'resend' -> 'resend'
 * - provider ausente / undefined / null -> 'resend' (legado)
 * - provider com valor desconhecido -> 'resend' (conservador / fail-closed)
 */
export function normalizeNotificationProvider(providerValue: unknown): 'ews' | 'resend' {
  return providerValue === 'ews' ? 'ews' : 'resend';
}

/**
 * Avalia de forma pura, determinística e ESTRITAMENTE FAIL-CLOSED as condições para desativação segura do Resend.
 *
 * Princípio Fundamental: Na dúvida, erro, estado desconhecido ou pendência, READY_TO_DISABLE_RESEND = false.
 *
 * READY_TO_DISABLE_RESEND é estritamente TRUE apenas se:
 * - Notificações Resend PENDING === 0
 * - Notificações Resend PROCESSING === 0
 * - Notificações Resend DEFERRED === 0
 * - Notificações Resend RETRY_PENDING === 0
 * - Notificações Resend SENT === 0 (aguardando confirmação/webhook)
 * - Notificações Resend FAILED === 0 (podem ser reprocessadas/requeued)
 * - Notificações Resend DELIVERY_UNCERTAIN === 0
 * - Notificações Resend FAILED_CONFIGURATION === 0
 * - Notificações Resend OTHER / UNKNOWN === 0 (nenhum status desconhecido/malformado)
 * - Tentativas Resend potencialmente reconciliáveis (ACCEPTED sem deliveredAt/completedAt) === 0
 * - Tentativas órfãs (sem notificação pai encontrada) === 0
 * - Webhooks Resend pendentes (UNMATCHED_PENDING) === 0
 * - Erros de leitura/consulta no Firestore === 0
 */
export function evaluateResendPreCheck(
  notifications: ResendPreCheckNotificationItem[],
  attempts: ResendPreCheckAttemptItem[],
  webhooks: ResendPreCheckWebhookItem[],
  notificationLookupMap?: Map<string, ResendPreCheckNotificationItem>,
  readErrorsCount = 0,
): ResendPreCheckSummary {
  const lookup = notificationLookupMap ?? new Map<string, ResendPreCheckNotificationItem>();
  if (!notificationLookupMap) {
    for (const notif of notifications) {
      lookup.set(notif.id, notif);
    }
  }

  const notifCounts = {
    PENDING: 0,
    PROCESSING: 0,
    DEFERRED: 0,
    RETRY_PENDING: 0,
    SENT: 0,
    DELIVERY_UNCERTAIN: 0,
    FAILED_CONFIGURATION: 0,
    FAILED: 0,
    DELIVERED: 0,
    BOUNCED: 0,
    COMPLAINED: 0,
    SUPPRESSED: 0,
    OTHER: 0,
    totalResend: 0,
  };

  for (const notif of notifications) {
    const normalizedProvider = normalizeNotificationProvider(notif.provider);
    if (normalizedProvider === 'resend') {
      notifCounts.totalResend += 1;
      const st = notif.status;
      if (st === 'PENDING') notifCounts.PENDING += 1;
      else if (st === 'PROCESSING') notifCounts.PROCESSING += 1;
      else if (st === 'DEFERRED') notifCounts.DEFERRED += 1;
      else if (st === 'RETRY_PENDING') notifCounts.RETRY_PENDING += 1;
      else if (st === 'SENT') notifCounts.SENT += 1;
      else if (st === 'DELIVERY_UNCERTAIN') notifCounts.DELIVERY_UNCERTAIN += 1;
      else if (st === 'FAILED_CONFIGURATION') notifCounts.FAILED_CONFIGURATION += 1;
      else if (st === 'FAILED') notifCounts.FAILED += 1;
      else if (st === 'DELIVERED') notifCounts.DELIVERED += 1;
      else if (st === 'BOUNCED') notifCounts.BOUNCED += 1;
      else if (st === 'COMPLAINED') notifCounts.COMPLAINED += 1;
      else if (st === 'SUPPRESSED') notifCounts.SUPPRESSED += 1;
      else notifCounts.OTHER += 1;
    }
  }

  let potentiallyReconcilableAttempts = 0;
  let orphanAttemptsCount = 0;

  for (const attempt of attempts) {
    const parentNotif = lookup.get(attempt.notificationId);
    if (parentNotif === undefined) {
      // Documento pai inexistente no Firestore representa inconsistência de dados (tentativa órfã)
      orphanAttemptsCount += 1;
    } else if (normalizeNotificationProvider(parentNotif.provider) === 'resend') {
      // Somente contar como tentativa Resend se a notificação pai pertencer ao provedor Resend
      if (attempt.status === 'ACCEPTED' && !attempt.deliveredAt && !attempt.permanentFailureAt && !attempt.completedAt) {
        potentiallyReconcilableAttempts += 1;
      }
    }
  }

  let unmatchedWebhooksCount = 0;
  for (const wh of webhooks) {
    // Contar apenas webhooks efetivamente em estado UNMATCHED_PENDING
    if (wh.status === 'UNMATCHED_PENDING') {
      unmatchedWebhooksCount += 1;
    }
  }

  const activePendingCount =
    notifCounts.PENDING + notifCounts.PROCESSING + notifCounts.DEFERRED + notifCounts.RETRY_PENDING;
  const sentCount = notifCounts.SENT;
  const failedCount = notifCounts.FAILED;
  const uncertainCount = notifCounts.DELIVERY_UNCERTAIN;
  const failedConfigCount = notifCounts.FAILED_CONFIGURATION;
  const otherCount = notifCounts.OTHER;

  const blockingReasons: string[] = [];
  if (activePendingCount > 0) {
    blockingReasons.push(
      `${activePendingCount} notificações Resend ativas (PENDING: ${notifCounts.PENDING}, PROCESSING: ${notifCounts.PROCESSING}, DEFERRED: ${notifCounts.DEFERRED}, RETRY_PENDING: ${notifCounts.RETRY_PENDING})`,
    );
  }
  if (sentCount > 0) {
    blockingReasons.push(
      `${sentCount} notificações Resend em SENT aguardando confirmação final de entrega`,
    );
  }
  if (failedCount > 0) {
    blockingReasons.push(
      `${failedCount} notificações Resend em FAILED (podem ser reprocessadas/requeued pelo worker)`,
    );
  }
  if (uncertainCount > 0) {
    blockingReasons.push(`${uncertainCount} notificações Resend em DELIVERY_UNCERTAIN`);
  }
  if (failedConfigCount > 0) {
    blockingReasons.push(`${failedConfigCount} notificações Resend em FAILED_CONFIGURATION`);
  }
  if (otherCount > 0) {
    blockingReasons.push(
      `${otherCount} notificações Resend com status desconhecido/não suportado (UNKNOWN/OTHER) que exigem análise manual`,
    );
  }
  if (potentiallyReconcilableAttempts > 0) {
    blockingReasons.push(`${potentiallyReconcilableAttempts} tentativas Resend aceitas aguardando entrega/webhook`);
  }
  if (orphanAttemptsCount > 0) {
    blockingReasons.push(
      `${orphanAttemptsCount} tentativas de entrega órfãs (notificação pai inexistente no Firestore)`,
    );
  }
  if (unmatchedWebhooksCount > 0) {
    blockingReasons.push(`${unmatchedWebhooksCount} webhooks Resend em UNMATCHED_PENDING`);
  }
  if (readErrorsCount > 0) {
    blockingReasons.push(
      `${readErrorsCount} erros de leitura/consulta no Firestore (diagnóstico fail-closed)`,
    );
  }

  const readyToDisableResend = blockingReasons.length === 0;

  return {
    notifications: notifCounts,
    potentiallyReconcilableAttempts,
    orphanAttemptsCount,
    unmatchedWebhooksCount,
    readErrorsCount,
    readyToDisableResend,
    activePendingCount,
    blockingReasons,
  };
}

/**
 * Executa o diagnóstico de pré-check conectado ao Firestore (somente leitura).
 * Implementado com rigor estrito em modo fail-closed.
 * Avalia todos os documentos da outbox, interpretando documentos sem provider ou com valor desconhecido como Resend.
 */
export async function diagnoseResendMigrationFromFirestore(firestore: Firestore): Promise<ResendPreCheckSummary> {
  let readErrorsCount = 0;
  const outboxRef = firestore.collection('notificationOutbox');

  const notifications: ResendPreCheckNotificationItem[] = [];
  const notificationCache = new Map<string, ResendPreCheckNotificationItem>();

  try {
    // Consulta todos os documentos da coleção outbox (sem filtro por provider para capturar documentos legados sem o campo)
    const outboxSnapshot = await outboxRef.get();
    for (const doc of outboxSnapshot.docs) {
      const data = doc.data();
      const item: ResendPreCheckNotificationItem = {
        id: doc.id,
        status: String(data['status'] ?? 'UNKNOWN'),
        provider: normalizeNotificationProvider(data['provider']),
      };
      notifications.push(item);
      notificationCache.set(doc.id, item);
    }
  } catch (error) {
    readErrorsCount += 1;
    console.error('Erro ao consultar coleção notificationOutbox:', error);
  }

  // Obter todas as tentativas
  const attempts: ResendPreCheckAttemptItem[] = [];
  try {
    const attemptsSnapshot = await firestore.collectionGroup('attempts').get();
    for (const doc of attemptsSnapshot.docs) {
      const data = doc.data();
      const notifId = String(data['notificationId'] ?? doc.ref.parent.parent?.id ?? '');

      if (notifId !== '' && !notificationCache.has(notifId)) {
        // Buscar notificação pai no Firestore se não estiver no cache
        try {
          const parentDoc = await outboxRef.doc(notifId).get();
          if (parentDoc.exists) {
            const parentData = parentDoc.data() ?? {};
            notificationCache.set(notifId, {
              id: notifId,
              status: String(parentData['status'] ?? 'UNKNOWN'),
              provider: normalizeNotificationProvider(parentData['provider']),
            });
          }
          // Se parentDoc não existir, não adicionamos ao cache, o que caracterizará tentativa órfã
        } catch (parentError) {
          // Falha de leitura da notificação pai: fail-closed!
          readErrorsCount += 1;
          console.error(`Erro ao consultar notificação pai da tentativa ${doc.id} (notifId: ${notifId}):`, parentError);
        }
      }

      attempts.push({
        id: doc.id,
        notificationId: notifId,
        status: String(data['status'] ?? 'PROCESSING'),
        deliveredAt: (data['deliveredAt'] as Date | string) ?? null,
        permanentFailureAt: (data['permanentFailureAt'] as Date | string) ?? null,
        completedAt: (data['completedAt'] as Date | string) ?? null,
      });
    }
  } catch (attemptsError) {
    readErrorsCount += 1;
    console.error('Erro ao consultar collectionGroup attempts:', attemptsError);
  }

  // Consultar webhooks pendentes na coleção real notificationWebhookEvents
  const webhooks: ResendPreCheckWebhookItem[] = [];
  try {
    const webhookSnapshot = await firestore
      .collection('notificationWebhookEvents')
      .where('status', '==', 'UNMATCHED_PENDING')
      .get();
    for (const doc of webhookSnapshot.docs) {
      const data = doc.data();
      webhooks.push({
        id: doc.id,
        status: String(data['status'] ?? 'UNMATCHED_PENDING'),
      });
    }
  } catch (webhookError) {
    // Erro de consulta ao Firestore: fail-closed (não assume zero silenciosamente)!
    readErrorsCount += 1;
    console.error('Erro ao consultar coleção notificationWebhookEvents:', webhookError);
  }

  return evaluateResendPreCheck(notifications, attempts, webhooks, notificationCache, readErrorsCount);
}

export async function runPreMigrationResendCheck(): Promise<void> {
  console.log('========================================================================');
  console.log(' DIAGNÓSTICO SOMENTE LEITURA — PRÉ-CHECK DE TRANSIÇÃO RESEND -> EWS (0.7.7)');
  console.log('========================================================================\n');

  const { firestore } = getFirebaseAdminServices(SERVER_ENV);
  console.log(`Conectado ao Firestore (Projeto: ${SERVER_ENV.firebaseProjectId}). Consultando outbox...\n`);

  const summary = await diagnoseResendMigrationFromFirestore(firestore);

  console.log('RESEND PRE-MIGRATION CHECK\n');
  console.log('Notifications (Resend):');
  console.log(`  PENDING: ${summary.notifications.PENDING}`);
  console.log(`  PROCESSING: ${summary.notifications.PROCESSING}`);
  console.log(`  DEFERRED: ${summary.notifications.DEFERRED}`);
  console.log(`  RETRY_PENDING: ${summary.notifications.RETRY_PENDING}`);
  console.log(`  SENT: ${summary.notifications.SENT}`);
  console.log(`  DELIVERY_UNCERTAIN: ${summary.notifications.DELIVERY_UNCERTAIN}`);
  console.log(`  FAILED_CONFIGURATION: ${summary.notifications.FAILED_CONFIGURATION}`);
  console.log(`  FAILED: ${summary.notifications.FAILED}`);
  console.log(`  DELIVERED: ${summary.notifications.DELIVERED}`);
  console.log(`  UNKNOWN/OTHER: ${summary.notifications.OTHER}`);
  console.log(`  Total Resend Notifications: ${summary.notifications.totalResend}\n`);

  console.log(`Potentially reconcilable Resend attempts: ${summary.potentiallyReconcilableAttempts}`);
  console.log(`Orphan attempts: ${summary.orphanAttemptsCount}`);
  console.log(`Unmatched pending Resend webhooks: ${summary.unmatchedWebhooksCount}`);
  console.log(`Read/query errors: ${summary.readErrorsCount}\n`);

  console.log(`READY_TO_DISABLE_RESEND: ${summary.readyToDisableResend ? 'YES' : 'NO'}`);

  console.log('\n========================================================================');
  if (summary.readyToDisableResend) {
    console.log('✅ TRANSIÇÃO SEGURA:');
    console.log('   Não existem notificações ou tentativas ativas pendentes do provedor Resend.');
    console.log('   O envio pelo Resend pode ser desativado com segurança (RESEND_ENABLED=false).');
    console.log('   Recomenda-se manter RESEND_WEBHOOK_SECRET ativo para reconciliação passiva.');
  } else {
    console.log('⚠️ DRENAGEM NECESSÁRIA / BLOQUEIO DE SEGURANÇA:');
    for (const reason of summary.blockingReasons) {
      console.log(`   - ${reason}`);
    }
    console.log('\n   RECOMENDAÇÃO OPERACIONAL:');
    console.log('   1. Manter EMAIL_PROVIDER=ews para novos registros;');
    console.log('   2. Manter RESEND_ENABLED=true temporariamente até que o worker drene as pendências;');
    console.log('   3. Manter RESEND_WEBHOOK_SECRET configurado;');
    console.log('   4. Reexecutar este pré-check até confirmar READY_TO_DISABLE_RESEND: YES antes de setar RESEND_ENABLED=false.');
  }
  console.log('========================================================================\n');

  if (!summary.readyToDisableResend && summary.readErrorsCount > 0) {
    process.exitCode = 1;
  }
}

// Executar quando chamado diretamente via CLI
const isDirectRun = process.argv[1]?.includes('preMigrationResendCheck');
if (isDirectRun) {
  runPreMigrationResendCheck().catch((error) => {
    console.error('Erro fatal ao executar pré-check de transição:', error);
    process.exit(1);
  });
}

