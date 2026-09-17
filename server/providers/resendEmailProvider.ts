import { Resend } from 'resend';
import type { EmailProvider, EmailSendRequest, EmailSendResult } from './emailProvider';
import { EmailProviderError } from './emailProvider';

export const RESEND_NOTIFICATION_TAG_NAME = 'notification_id' as const;
export const RESEND_ATTEMPT_TAG_NAME = 'attempt_id' as const;
const TECHNICAL_ID_PATTERN = /^[a-f0-9]{64}$/u;

export function resendNotificationTags(notificationId: string, attemptId: string): Array<{ name: typeof RESEND_NOTIFICATION_TAG_NAME | typeof RESEND_ATTEMPT_TAG_NAME; value: string }> {
  if (!TECHNICAL_ID_PATTERN.test(notificationId)) {
    throw new EmailProviderError('PERMANENT', 'invalid_notification_id', 'O identificador lógico da notificação é inválido para correlação com o provedor.');
  }
  if (!TECHNICAL_ID_PATTERN.test(attemptId)) {
    throw new EmailProviderError('PERMANENT', 'invalid_attempt_id', 'O identificador da tentativa de entrega é inválido para correlação com o provedor.');
  }
  return [
    { name: RESEND_NOTIFICATION_TAG_NAME, value: notificationId },
    { name: RESEND_ATTEMPT_TAG_NAME, value: attemptId },
  ];
}

interface ResendErrorShape { name?: string; message?: string; statusCode?: number | null; }

function safeSummary(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[endereço omitido]')
    .replace(/\b(?:re_|whsec_|sk_)[A-Za-z0-9_-]+\b/gu, '[credencial omitida]')
    .slice(0, 300);
}

export function classifyResendError(error: ResendErrorShape): EmailProviderError {
  const status = error.statusCode ?? 0;
  const name = error.name ?? 'resend_error';
  const summary = safeSummary(error.message ?? 'O provedor rejeitou a entrega.');
  const searchable = `${name} ${summary}`;
  if (status === 429 || /rate|quota/iu.test(searchable)) return new EmailProviderError('QUOTA', name, summary, 'SAME_ATTEMPT', 'PROVIDER_REJECTED');
  if (status === 401 || status === 403 || /api.key|domain|authentication|sender|configuration/iu.test(searchable)) return new EmailProviderError('CONFIGURATION', name, summary);
  if (/suppression|suppressed/iu.test(searchable)) return new EmailProviderError('SUPPRESSED', name, summary);
  if (/invalid[_ ]?recipient|invalid email|invalid address/iu.test(searchable)) return new EmailProviderError('INVALID_RECIPIENT', name, summary);
  if (name === 'concurrent_idempotent_requests' || status >= 500 || status === 408 || status === 0) return new EmailProviderError('TRANSIENT', name, summary, 'SAME_ATTEMPT', 'IDEMPOTENCY_WINDOW');
  return new EmailProviderError('PERMANENT', name, summary);
}

export class ResendWebhookVerifier {
  private readonly resend: Resend;

  public constructor() {
    this.resend = new Resend('unused_api_key_webhook_only');
  }

  public verify(payload: string, headers: { id: string; timestamp: string; signature: string }, secret: string): unknown {
    return this.resend.webhooks.verify({ payload, headers, webhookSecret: secret });
  }
}

export class ResendEmailProvider implements EmailProvider {
  public readonly name = 'resend' as const;
  private readonly resend: Resend;

  public constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  public async send(request: EmailSendRequest): Promise<EmailSendResult> {
    const result = await this.resend.emails.send({
      from: request.message.from,
      to: [request.message.to],
      subject: request.message.subject,
      text: request.message.text,
      html: request.message.html,
      tags: resendNotificationTags(request.notificationId, request.attemptId),
    }, { idempotencyKey: request.idempotencyKey });
    if (result.error !== null) throw classifyResendError(result.error);
    if (result.data === null) throw new EmailProviderError('TRANSIENT', 'empty_provider_response', 'O provedor não confirmou a entrega.', 'SAME_ATTEMPT', 'IDEMPOTENCY_WINDOW');
    return { providerMessageId: result.data.id };
  }

  public verifyWebhook(payload: string, headers: { id: string; timestamp: string; signature: string }, secret: string): unknown {
    return this.resend.webhooks.verify({ payload, headers, webhookSecret: secret });
  }
}
