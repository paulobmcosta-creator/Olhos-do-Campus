import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AuthorizedAdminProfile } from '../../src/models/admin';
import { createTestNotificationItem, retryDelayMilliseconds } from '../domain/notificationOutbox';
import type { NotificationDeliveryMetrics, NotificationOutboxItem, NotificationWebhookEvent } from '../models/notificationDomain';
import { EmailProviderError, type EmailMessage, type EmailProvider } from '../providers/emailProvider';
import { RESEND_ATTEMPT_TAG_NAME, RESEND_NOTIFICATION_TAG_NAME, ResendWebhookVerifier } from '../providers/resendEmailProvider';
import type { AuditLogRepository } from '../repositories/auditLogRepository';
import type { NotificationOutboxRepository, NotificationWebhookApplyResult } from '../repositories/notificationOutboxRepository';
import type { SystemConfigRepository } from '../repositories/systemConfigRepository';
import { HttpError } from '../types/errors';
import { validateEmail } from '../utils/email';

const NOTIFICATION_ID_PATTERN = /^[a-f0-9]{64}$/u;
const webhookSchema = z.object({
  type: z.enum(['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained', 'email.failed', 'email.suppressed']),
  created_at: z.string().datetime().optional(),
  data: z.object({
    email_id: z.string().min(1).max(200),
    failed: z.object({ reason: z.string().min(1).max(120) }).optional(),
    tags: z.record(z.string().max(256)).optional(),
  }).passthrough(),
}).passthrough();

export interface NotificationRuntime {
  activeProvider?: 'ews' | 'resend';
  ewsEnabled?: boolean;
  resendEnabled?: boolean;
  ewsFrom?: string;
  resendFrom?: string;
  resendWebhookSecret?: string;
  enabled?: boolean;
  provider?: 'ews' | 'resend';
  from?: string;
  webhookSecret?: string;
}

export interface NotificationRuntimeStatus {
  provider: 'Resend' | 'EWS';
  environmentEnabled: boolean;
  applicationEnabled: boolean;
  effectiveEnabled: boolean;
  from: string | null;
  recipientCount: number;
  configurationIssues: string[];
  metrics: Omit<NotificationDeliveryMetrics, 'oldestPendingAt' | 'oldestUnmatchedWebhookAt' | 'lastAttemptAt' | 'lastSuccessfulSendAt' | 'lastError' | 'lastFailureCategory'> & {
    oldestPendingAt: string | null;
    oldestUnmatchedWebhookAt: string | null;
    lastAttemptAt: string | null;
    lastSuccessfulSendAt: string | null;
    lastError: string | null;
    lastFailureCategory: string | null;
  };
}

export interface NotificationProvidersMap {
  resend?: EmailProvider;
  ews?: EmailProvider;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function messageFor(item: NotificationOutboxItem, from: string): EmailMessage {
  if (item.eventType === 'ADMIN_TEST') {
    const text = 'Este é um teste controlado do canal transacional do Sistema Institucional de Manutenção da Infraestrutura Física. Nenhuma ocorrência foi criada.';
    return { to: item.recipient, from, subject: 'Teste de notificação institucional', text, html: `<p>${escapeHtml(text)}</p>` };
  }
  const date = item.templateData.occurredAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const risk = item.templateData.immediateRisk ? 'Sim — exige triagem prioritária.' : 'Não informado.';

  if (item.eventType === 'OCCURRENCE_TEAM_ROUTED') {
    const subject = `Ocorrência ${item.protocol} encaminhada para sua equipe`;
    const lines = [
      'Sistema Institucional de Manutenção da Infraestrutura Física',
      `Protocolo: ${item.protocol}`,
      `Equipe designada: ${item.templateData.teamName ?? 'Não informada'}`,
      `Data e hora: ${date}`,
      `Categoria: ${item.templateData.category}`,
      `Localização: ${item.templateData.location}`,
      `Prioridade: ${item.templateData.priority}`,
      `Risco imediato: ${risk}`,
      'Acesse o painel administrativo para visualizar os detalhes e atribuir um responsável.',
    ];
    const html = `<h1 style="font-size:18px">${escapeHtml(lines[0] ?? '')}</h1><dl>${lines.slice(1, 8).map((line) => {
      const [term, ...rest] = line.split(': ');
      return `<dt><strong>${escapeHtml(term ?? '')}</strong></dt><dd>${escapeHtml(rest.join(': '))}</dd>`;
    }).join('')}</dl><p>${escapeHtml(lines[8] ?? '')}</p>`;
    return { to: item.recipient, from, subject, text: lines.join('\n'), html };
  }

  if (item.eventType === 'OCCURRENCE_RESPONSIBLE_ASSIGNED') {
    const subject = `Você foi designado responsável pela ocorrência ${item.protocol}`;
    const lines = [
      'Sistema Institucional de Manutenção da Infraestrutura Física',
      `Protocolo: ${item.protocol}`,
      `Responsável: ${item.templateData.responsibleName ?? 'Não informado'}`,
      `Equipe: ${item.templateData.teamName ?? 'Não informada'}`,
      `Data e hora: ${date}`,
      `Categoria: ${item.templateData.category}`,
      `Localização: ${item.templateData.location}`,
      `Prioridade: ${item.templateData.priority}`,
      `Risco imediato: ${risk}`,
      'Acesse o painel administrativo para iniciar o atendimento e registrar os avanços.',
    ];
    const html = `<h1 style="font-size:18px">${escapeHtml(lines[0] ?? '')}</h1><dl>${lines.slice(1, 9).map((line) => {
      const [term, ...rest] = line.split(': ');
      return `<dt><strong>${escapeHtml(term ?? '')}</strong></dt><dd>${escapeHtml(rest.join(': '))}</dd>`;
    }).join('')}</dl><p>${escapeHtml(lines[9] ?? '')}</p>`;
    return { to: item.recipient, from, subject, text: lines.join('\n'), html };
  }

  const subject = `Nova ocorrência ${item.protocol}`;
  const lines = [
    'Sistema Institucional de Manutenção da Infraestrutura Física',
    `Protocolo: ${item.protocol}`,
    `Data e hora: ${date}`,
    `Categoria: ${item.templateData.category}`,
    `Localização: ${item.templateData.location}`,
    `Prioridade inicial: ${item.templateData.priority}`,
    `Risco imediato: ${risk}`,
    'Acesse o painel administrativo autenticado para realizar a triagem.',
  ];
  const html = `<h1 style="font-size:18px">${escapeHtml(lines[0] ?? '')}</h1><dl>${lines.slice(1, 7).map((line) => {
    const [term, ...rest] = line.split(': ');
    return `<dt><strong>${escapeHtml(term ?? '')}</strong></dt><dd>${escapeHtml(rest.join(': '))}</dd>`;
  }).join('')}</dl><p>${escapeHtml(lines[7] ?? '')}</p>`;
  return { to: item.recipient, from, subject, text: lines.join('\n'), html };
}

function failureUpdate(error: unknown, attemptCount: number, now: Date): Parameters<NotificationOutboxRepository['markFailure']>[2] {
  const providerError = error instanceof EmailProviderError
    ? error
    : new EmailProviderError('TRANSIENT', 'provider_unavailable', 'O provedor não confirmou a entrega.', 'SAME_ATTEMPT', 'IDEMPOTENCY_WINDOW');
  const retryMode = providerError.retryMode ?? 'NEW_ATTEMPT';
  if (providerError.category === 'QUOTA') {
    return {
      status: 'DEFERRED', nextAttemptAt: new Date(now.getTime() + 24 * 60 * 60_000), code: providerError.code,
      summary: providerError.message, category: 'QUOTA', retryMode: providerError.retryMode ?? 'SAME_ATTEMPT', retrySafety: providerError.retrySafety ?? 'PROVIDER_REJECTED',
    };
  }
  if (providerError.category === 'CONFIGURATION') {
    return { status: 'FAILED_CONFIGURATION', nextAttemptAt: now, code: providerError.code, summary: providerError.message, category: 'CONFIGURATION', failedAt: now };
  }
  if (providerError.category === 'INVALID_RECIPIENT') {
    return { status: 'FAILED', nextAttemptAt: now, code: providerError.code, summary: providerError.message, category: 'INVALID_RECIPIENT', failedAt: now };
  }
  if (providerError.category === 'SUPPRESSED') {
    return { status: 'SUPPRESSED', nextAttemptAt: now, code: providerError.code, summary: providerError.message, category: 'SUPPRESSION', failedAt: now };
  }
  if (providerError.category === 'PERMANENT' || (retryMode === 'NEW_ATTEMPT' && attemptCount >= 8)) {
    return { status: 'FAILED', nextAttemptAt: now, code: providerError.code, summary: providerError.message, category: 'UNKNOWN', failedAt: now };
  }
  return {
    status: 'RETRY_PENDING',
    nextAttemptAt: retryMode === 'SAME_ATTEMPT' ? now : new Date(now.getTime() + retryDelayMilliseconds(attemptCount)),
    code: providerError.code,
    summary: providerError.message,
    category: 'TRANSIENT',
    retryMode,
    retrySafety: providerError.retrySafety ?? (retryMode === 'SAME_ATTEMPT' ? 'IDEMPOTENCY_WINDOW' : 'PROVIDER_REJECTED'),
  };
}

export class NotificationService {
  private readonly providers: NotificationProvidersMap;
  public readonly activeProviderName: 'ews' | 'resend';
  private readonly webhookVerifier = new ResendWebhookVerifier();

  public constructor(
    private readonly outbox: NotificationOutboxRepository,
    private readonly configs: SystemConfigRepository,
    private readonly auditLogs: AuditLogRepository,
    providerOrMap: EmailProvider | NotificationProvidersMap | undefined,
    private readonly runtime: NotificationRuntime,
  ) {
    if (providerOrMap === undefined) {
      this.providers = {};
    } else if ('send' in providerOrMap) {
      this.providers = { [providerOrMap.name]: providerOrMap };
    } else {
      this.providers = providerOrMap;
    }
    this.activeProviderName = runtime.activeProvider ?? runtime.provider ?? (this.providers.ews !== undefined ? 'ews' : 'resend');
  }

  public get activeProvider(): EmailProvider | undefined {
    return this.activeProviderName === 'ews' ? this.providers.ews : this.providers.resend;
  }

  public get activeFrom(): string | undefined {
    if (this.activeProviderName === 'ews') {
      return this.runtime.ewsFrom ?? this.runtime.from;
    }
    return this.runtime.resendFrom ?? this.runtime.from;
  }

  private isProviderEnabled(provider: 'ews' | 'resend'): boolean {
    if (provider === 'ews') {
      return this.runtime.ewsEnabled ?? this.runtime.enabled ?? false;
    }
    return this.runtime.resendEnabled ?? this.runtime.enabled ?? false;
  }

  public async runtimeStatus(now = new Date()): Promise<NotificationRuntimeStatus> {
    const config = await this.configs.get();
    const issues: string[] = [];
    const isEws = this.activeProviderName === 'ews';
    const envEnabled = this.isProviderEnabled(this.activeProviderName);

    if (!envEnabled) {
      issues.push(isEws ? 'EWS_ENABLED está desabilitado no ambiente.' : 'RESEND_ENABLED está desabilitado no ambiente.');
    }
    if (this.activeProvider === undefined) {
      issues.push(isEws ? 'Credenciais do provedor EWS não estão configuradas.' : 'RESEND_API_KEY não está configurada.');
    }
    if (this.activeFrom === undefined) {
      issues.push(isEws ? 'EWS_FROM não está configurado.' : 'RESEND_FROM não está configurado.');
    }
    const webhookSecret = this.runtime.resendWebhookSecret ?? this.runtime.webhookSecret;
    if (!isEws && webhookSecret === undefined) {
      issues.push('RESEND_WEBHOOK_SECRET não está configurado.');
    }
    if (config === undefined) {
      issues.push('A configuração operacional ainda não foi inicializada.');
    }
    if (config !== undefined && !config.emailNotificationsEnabled) {
      issues.push('O envio está desabilitado na configuração administrativa.');
    }
    const metrics = await this.outbox.metrics(now);
    return {
      provider: isEws ? 'EWS' : 'Resend',
      environmentEnabled: envEnabled,
      applicationEnabled: config?.emailNotificationsEnabled === true,
      effectiveEnabled: envEnabled && config?.emailNotificationsEnabled === true && this.activeProvider !== undefined && this.activeFrom !== undefined,
      from: this.activeFrom ?? null,
      recipientCount: config?.notificationEmails.length ?? 0,
      configurationIssues: issues,
      metrics: {
        ...metrics,
        oldestPendingAt: metrics.oldestPendingAt?.toISOString() ?? null,
        oldestUnmatchedWebhookAt: metrics.oldestUnmatchedWebhookAt?.toISOString() ?? null,
        lastAttemptAt: metrics.lastAttemptAt?.toISOString() ?? null,
        lastSuccessfulSendAt: metrics.lastSuccessfulSendAt?.toISOString() ?? null,
        lastError: metrics.lastError ?? null,
        lastFailureCategory: metrics.lastFailureCategory ?? null,
      },
    };
  }

  public async processPending(limit = 20): Promise<{ claimed: number; sent: number; deferred: number; failed: number; uncertain: number }> {
    const config = await this.configs.get();
    if (config?.emailNotificationsEnabled !== true) return { claimed: 0, sent: 0, deferred: 0, failed: 0, uncertain: 0 };
    const now = new Date();
    const owner = randomUUID();
    const items = await this.outbox.claimEligible(Math.min(Math.max(limit, 1), 50), owner, now, 5 * 60_000);
    let sent = 0; let deferred = 0; let failed = 0; let uncertain = 0;
    for (const item of items) {
      let result: Awaited<ReturnType<EmailProvider['send']>>;
      try {
        const isEwsItem = item.provider === 'ews';
        const itemEnabled = this.isProviderEnabled(item.provider);
        const itemProvider = isEwsItem ? this.providers.ews : this.providers.resend;
        const itemFrom = isEwsItem ? (this.runtime.ewsFrom ?? this.runtime.from) : (this.runtime.resendFrom ?? this.runtime.from);

        if (!itemEnabled || itemProvider === undefined || itemFrom === undefined) {
          throw new EmailProviderError('CONFIGURATION', 'email_configuration_error', `O provedor de e-mail (${item.provider}) não está configurado ou habilitado no ambiente.`);
        }
        if (item.currentAttemptId === undefined) {
          throw new EmailProviderError('PERMANENT', 'missing_delivery_attempt', 'A tentativa de entrega não foi materializada antes da chamada ao provedor.');
        }
        result = await itemProvider.send({
          message: messageFor(item, itemFrom),
          idempotencyKey: item.idempotencyKey,
          notificationId: item.id,
          attemptId: item.currentAttemptId,
        });
      } catch (error: unknown) {
        if (!(error instanceof EmailProviderError)) {
          // Exceção de transporte sem resposta conclusiva: não criar A2 automaticamente.
          // A tentativa corrente permanece UNCERTAIN com a mesma idempotency key.
          await this.outbox.markDeliveryUncertain(item.id, owner, undefined, new Date(), item.currentAttemptId, false);
          uncertain += 1;
          continue;
        }
        const failureAt = new Date();
        const update = failureUpdate(error, item.attemptCount, failureAt);
        const finalStatus = await this.outbox.markFailure(item.id, owner, update, failureAt, item.currentAttemptId);
        if (finalStatus === 'DELIVERY_UNCERTAIN') uncertain += 1;
        else if (finalStatus === 'DEFERRED' || finalStatus === 'RETRY_PENDING') deferred += 1;
        else failed += 1;
        continue;
      }

      const acceptedAt = new Date();
      try {
        await this.outbox.markSent(item.id, owner, result.providerMessageId, acceptedAt, item.currentAttemptId);
        sent += 1;
      } catch {
        uncertain += 1;
        try {
          await this.outbox.markDeliveryUncertain(item.id, owner, result.providerMessageId, acceptedAt, item.currentAttemptId);
        } catch {
          // Lease guard continua impedindo reenvio automático
        }
      }
    }
    return { claimed: items.length, sent, deferred, failed, uncertain };
  }

  public async processMaintenance(limit = 20): Promise<{
    deliveries: Awaited<ReturnType<NotificationService['processPending']>>;
    webhookReconciliation: Awaited<ReturnType<NotificationOutboxRepository['reconcilePendingWebhooks']>>;
  }> {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const deliveries = await this.processPending(bounded);
    const webhookReconciliation = await this.outbox.reconcilePendingWebhooks(bounded, new Date());
    return { deliveries, webhookReconciliation };
  }

  public async requestTest(recipient: string, actor: AuthorizedAdminProfile, correlationId: string): Promise<NotificationOutboxItem> {
    const config = await this.configs.get();
    if (config === undefined) throw new HttpError(503, 'REFERENCE_DATA_NOT_INITIALIZED', 'A configuração operacional ainda não foi inicializada.');
    const normalized = validateEmail(recipient);
    const item = await this.outbox.enqueue(createTestNotificationItem(normalized, correlationId, new Date(), this.activeProviderName));
    await this.auditLogs.write({
      eventType: 'NOTIFICATION_TEST_REQUESTED', actorUid: actor.uid, actorEmail: actor.email, actorRole: actor.role,
      targetType: 'notification', targetId: item.id, summary: `Envio de teste solicitado pela área administrativa (${this.activeProviderName.toUpperCase()}).`, requestCorrelationId: correlationId,
      metadata: { recipientConfigured: config.notificationEmails.includes(normalized), provider: this.activeProviderName },
    });
    return item;
  }

  public async retry(limit: number, actor: AuthorizedAdminProfile, correlationId: string): Promise<number> {
    const count = await this.outbox.requeue(Math.min(Math.max(limit, 1), 100), new Date());
    await this.auditLogs.write({
      eventType: 'NOTIFICATION_RETRY_REQUESTED', actorUid: actor.uid, actorEmail: actor.email, actorRole: actor.role,
      targetType: 'notification',
      summary: `Reprocessamento solicitado para ${count} entrega(s) elegível(is). Entregas incertas não são reenviadas por esta ação; falhas de configuração só retornam à fila por decisão administrativa explícita.`,
      requestCorrelationId: correlationId,
      metadata: { count, requestedLimit: limit },
    });
    return count;
  }

  public async processWebhook(rawBody: Buffer, headers: { id?: string; timestamp?: string; signature?: string }): Promise<NotificationWebhookApplyResult> {
    const webhookSecret = this.runtime.resendWebhookSecret ?? this.runtime.webhookSecret;
    if (webhookSecret === undefined || webhookSecret.trim() === '') {
      throw new HttpError(503, 'EMAIL_CONFIGURATION_ERROR', 'O webhook transacional do Resend não está configurado.');
    }
    if (headers.id === undefined || headers.timestamp === undefined || headers.signature === undefined) {
      throw new HttpError(400, 'WEBHOOK_SIGNATURE_INVALID', 'Cabeçalhos de assinatura ausentes.');
    }
    let verified: unknown;
    try {
      const resendProvider = this.providers.resend;
      if (resendProvider !== undefined && typeof (resendProvider as { verifyWebhook?: unknown }).verifyWebhook === 'function') {
        verified = (resendProvider as unknown as { verifyWebhook: (body: string, headers: { id: string; timestamp: string; signature: string }, secret: string) => unknown }).verifyWebhook(rawBody.toString('utf8'), { id: headers.id, timestamp: headers.timestamp, signature: headers.signature }, webhookSecret);
      } else {
        verified = this.webhookVerifier.verify(rawBody.toString('utf8'), { id: headers.id, timestamp: headers.timestamp, signature: headers.signature }, webhookSecret);
      }
    } catch {
      throw new HttpError(400, 'WEBHOOK_SIGNATURE_INVALID', 'Assinatura do webhook inválida.');
    }
    const parsed = webhookSchema.safeParse(verified);
    if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Evento de webhook não reconhecido.');
    const notificationId = parsed.data.data.tags?.[RESEND_NOTIFICATION_TAG_NAME];
    const attemptId = parsed.data.data.tags?.[RESEND_ATTEMPT_TAG_NAME];
    if (notificationId !== undefined && !NOTIFICATION_ID_PATTERN.test(notificationId)) {
      throw new HttpError(400, 'WEBHOOK_NOTIFICATION_ID_INVALID', 'Identificador lógico de notificação inválido no webhook.');
    }
    if (attemptId !== undefined && !NOTIFICATION_ID_PATTERN.test(attemptId)) {
      throw new HttpError(400, 'WEBHOOK_ATTEMPT_ID_INVALID', 'Identificador de tentativa de entrega inválido no webhook.');
    }
    if (attemptId !== undefined && notificationId === undefined) {
      throw new HttpError(400, 'WEBHOOK_ATTEMPT_WITHOUT_NOTIFICATION', 'Identificador de tentativa sem notificação lógica correspondente.');
    }
    const event: NotificationWebhookEvent = {
      eventId: headers.id,
      eventType: parsed.data.type,
      providerMessageId: parsed.data.data.email_id,
      ...(notificationId === undefined ? {} : { notificationId }),
      ...(attemptId === undefined ? {} : { attemptId }),
      occurredAt: parsed.data.created_at === undefined ? new Date() : new Date(parsed.data.created_at),
      ...(parsed.data.data.failed?.reason === undefined ? {} : { failureReason: parsed.data.data.failed.reason }),
    };
    return this.outbox.applyWebhook(event);
  }
}
